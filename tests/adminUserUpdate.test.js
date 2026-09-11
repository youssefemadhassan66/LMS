import { jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import bcrypt from "bcryptjs";

jest.setTimeout(60_000);

Object.assign(process.env, {
  NODE_ENV: "test",
  TRUST_PROXY: "1",
  JWT_TOKEN_SECRET: "test-secret-32-characters-long!!",
  JWT_REFRESH_TOKEN_SECRET: "test-refresh-secret-32-characters!",
  JWT_TOKEN_EXPIRES_IN: "2h",
  JWT_REFRESH_EXPIRES_IN: "7d",
  SALT_ROUNDS: "4",
  CLIENT_URL: "http://localhost:5173",
});

jest.unstable_mockModule("../Utilities/EmailHelper.js", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../Services/NotificationHelpers.js", () => ({
  getAdminIds: jest.fn().mockResolvedValue([]),
  getStudentRecipients: jest.fn().mockResolvedValue({ studentUserId: null, studentName: "Student", parentIds: [] }),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
  notifyStudentAndParents: jest.fn().mockResolvedValue(undefined),
  notifyUsers: jest.fn().mockResolvedValue(undefined),
}));

let mongod;
let app;
let User;
let Token;

beforeAll(async () => {
  ({ default: app } = await import("../App.js"));
  ({ default: User } = await import("../Models/user.js"));
  ({ default: Token } = await import("../Models/Token.js"));
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
});

let ipCounter = 0;
const freshIp = () => {
  ipCounter += 1;
  return `198.18.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
};

/** Create an admin and return a bearer token for them. */
const makeAdmin = async () => {
  await User.create({
    FullName: "Admin User",
    UserName: "admin_user",
    Email: "admin@example.com",
    password: "AdminPass123!",
    role: "admin",
  });

  const res = await request(app)
    .post("/api/v1/auth/login")
    .set("X-Forwarded-For", freshIp())
    .send({ email: "admin@example.com", password: "AdminPass123!" });

  expect(res.status).toBe(200);
  return res.body.data.token;
};

const makeStudent = () =>
  User.create({
    FullName: "Target Student",
    UserName: "target_student",
    Email: "target@example.com",
    password: "OriginalPass1!",
    role: "student",
  });

/**
 * An account already in the database whose OTHER fields no longer satisfy the
 * current schema: a 4-character UserName (public signup's Joi floor is 3, the
 * model's is 5) and a FullName with a title and a digit. Inserted through the
 * driver so the model's validators cannot reject the fixture itself — this is
 * what the collection actually holds for accounts created under older rules.
 */
const makeLegacyStudent = async () => {
  const { insertedId } = await User.collection.insertOne({
    FullName: "Dr. Ahmed 3ly",
    UserName: "ali1",
    Email: "legacy@example.com",
    password: await bcrypt.hash("OriginalPass1!", 4),
    role: "student",
    isActive: true,
    approvalStatus: "approved",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return insertedId;
};

const createUserPayload = {
  FullName: "Created Student",
  UserName: "created_student",
  Email: "created@example.com",
  password: "test@1234",
  role: "student",
};

describe("POST /api/v1/user — password handling", () => {
  it("lets a user the admin created log in with the password the admin set", async () => {
    const token = await makeAdmin();

    const created = await request(app)
      .post("/api/v1/user")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send(createUserPayload);

    expect(created.status).toBe(201);

    const stored = await User.findById(created.body.data.user._id).select("+password");
    expect(stored.password).toMatch(/^\$2[aby]\$/);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("X-Forwarded-For", freshIp())
      .send({ email: "created@example.com", password: "test@1234" });

    expect(login.status).toBe(200);
  });

  it("never returns the password hash in the create response", async () => {
    const token = await makeAdmin();

    const created = await request(app)
      .post("/api/v1/user")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send(createUserPayload);

    expect(created.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(created.body)).not.toContain("$2b$");
  });

  it("rejects a password the model would refuse, with a readable message", async () => {
    const token = await makeAdmin();

    const created = await request(app)
      .post("/api/v1/user")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send({ ...createUserPayload, password: "short" });

    expect(created.status).toBe(400);
    expect(created.body.message).toMatch(/at least 8 characters/i);
    expect(await User.findOne({ Email: "created@example.com" })).toBeNull();
  });
});

describe("PATCH /api/v1/user/:id — password handling", () => {
  it("stores the new password as a bcrypt hash, never as plaintext", async () => {
    const token = await makeAdmin();
    const student = await makeStudent();

    const res = await request(app)
      .patch(`/api/v1/user/${student._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send({ password: "test@1234" });

    expect(res.status).toBe(200);

    const stored = await User.findById(student._id).select("+password");

    // The exact regression: findByIdAndUpdate skipped the pre("save") hook and
    // wrote the plaintext straight to MongoDB.
    expect(stored.password).not.toBe("test@1234");
    expect(stored.password).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare("test@1234", stored.password)).toBe(true);
  });

  it("lets the user log in with the password the admin set", async () => {
    const token = await makeAdmin();
    const student = await makeStudent();

    await request(app)
      .patch(`/api/v1/user/${student._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send({ password: "test@1234" });

    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("X-Forwarded-For", freshIp())
      .send({ email: "target@example.com", password: "test@1234" });

    expect(login.status).toBe(200);
  });

  it("revokes the target's existing sessions when the password changes", async () => {
    const token = await makeAdmin();
    const student = await makeStudent();

    await request(app)
      .post("/api/v1/auth/login")
      .set("X-Forwarded-For", freshIp())
      .send({ email: "target@example.com", password: "OriginalPass1!" });

    expect(await Token.countDocuments({ userId: student._id })).toBeGreaterThan(0);

    await request(app)
      .patch(`/api/v1/user/${student._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send({ password: "test@1234" });

    expect(await Token.countDocuments({ userId: student._id })).toBe(0);
  });

  it("updates ordinary fields without touching the password", async () => {
    const token = await makeAdmin();
    const student = await makeStudent();
    const before = await User.findById(student._id).select("+password");

    const res = await request(app)
      .patch(`/api/v1/user/${student._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send({ FullName: "Renamed Student" });

    expect(res.status).toBe(200);

    const after = await User.findById(student._id).select("+password");
    expect(after.FullName).toBe("Renamed Student");
    // No re-hash of an unchanged password: the stored hash must be identical,
    // otherwise every profile edit would silently invalidate the login.
    expect(after.password).toBe(before.password);
  });

  it("ignores fields an admin is not allowed to set through this route", async () => {
    const token = await makeAdmin();
    const student = await makeStudent();

    await request(app)
      .patch(`/api/v1/user/${student._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send({ FullName: "Renamed Student", apiKeyHash: "attacker-controlled", passwordResetToken: "nope" });

    const after = await User.findById(student._id).select("+apiKeyHash +passwordResetToken");
    expect(after.apiKeyHash).toBeUndefined();
    expect(after.passwordResetToken).toBeUndefined();
  });

  it("resets the password of an account whose other fields predate the current schema", async () => {
    const token = await makeAdmin();
    const legacyId = await makeLegacyStudent();

    // Validating the whole document on save rejected this outright, so the new
    // password never landed and the account stayed locked out — while the
    // dialog reported an error about the name.
    const res = await request(app)
      .patch(`/api/v1/user/${legacyId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send({ password: "test@1234" });

    expect(res.status).toBe(200);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("X-Forwarded-For", freshIp())
      .send({ email: "legacy@example.com", password: "test@1234" });

    expect(login.status).toBe(200);
  });

  it("stores the password exactly as typed, without trimming it", async () => {
    const token = await makeAdmin();
    const student = await makeStudent();

    await request(app)
      .patch(`/api/v1/user/${student._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send({ password: " test@1234 " });

    // Login compares the raw string, so a password trimmed on the way in would
    // hash something different from what the account holder is told to type.
    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("X-Forwarded-For", freshIp())
      .send({ email: "target@example.com", password: " test@1234 " });

    expect(login.status).toBe(200);
  });

  it("treats a whitespace-only password as 'leave it alone'", async () => {
    const token = await makeAdmin();
    const student = await makeStudent();
    const before = await User.findById(student._id).select("+password");

    const res = await request(app)
      .patch(`/api/v1/user/${student._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send({ FullName: "Renamed Student", password: "        " });

    expect(res.status).toBe(200);

    const after = await User.findById(student._id).select("+password");
    expect(after.password).toBe(before.password);
  });

  it("never returns the password hash in the response", async () => {
    const token = await makeAdmin();
    const student = await makeStudent();

    const res = await request(app)
      .patch(`/api/v1/user/${student._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Forwarded-For", freshIp())
      .send({ password: "test@1234" });

    expect(res.body.data.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("test@1234");
  });
});
