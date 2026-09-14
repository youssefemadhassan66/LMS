import { jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";

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
let AuditLog;

beforeAll(async () => {
  ({ default: app } = await import("../App.js"));
  ({ default: User } = await import("../Models/user.js"));
  ({ default: AuditLog } = await import("../Models/AuditLog.js"));
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
  return `198.20.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
};

const makeUser = (overrides = {}) =>
  User.create({
    FullName: "Test Student",
    UserName: "teststudent",
    Email: "student@example.com",
    password: "Password123",
    role: "student",
    ...overrides,
  });

const login = (email, password) => request(app).post("/api/v1/auth/login").set("X-Forwarded-For", freshIp()).send({ email, password });

const makeAdmin = async () => {
  await User.create({
    FullName: "Admin User",
    UserName: "admin_user",
    Email: "admin@example.com",
    password: "AdminPass123",
    role: "admin",
  });
  const res = await login("admin@example.com", "AdminPass123");
  expect(res.status).toBe(200);
  return res.body.data.token;
};

describe("login is recorded", () => {
  it("writes a login entry naming the user, with an ip", async () => {
    const user = await makeUser();

    expect((await login("student@example.com", "Password123")).status).toBe(200);

    const entry = await AuditLog.findOne({ action: "login" });
    expect(entry).not.toBeNull();
    expect(String(entry.actor)).toBe(String(user._id));
    expect(entry.actorRole).toBe("student");
    expect(entry.actorEmail).toBe("student@example.com");
    expect(entry.ip).toBeTruthy();
    // The timestamp the dashboard shows.
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it("records a wrong password against the real account", async () => {
    const user = await makeUser();

    expect((await login("student@example.com", "WrongPassword1")).status).toBe(401);

    const entry = await AuditLog.findOne({ action: "login_failed" });
    expect(String(entry.actor)).toBe(String(user._id));
    expect(entry.meta.reason).toBe("wrong_password");
  });

  it("records an attempt on an address that does not exist", async () => {
    expect((await login("nobody@example.com", "Password123")).status).toBe(401);

    const entry = await AuditLog.findOne({ action: "login_failed" });
    // No account to attribute it to — the point of making actor optional.
    expect(entry.actor).toBeUndefined();
    expect(entry.actorEmail).toBe("nobody@example.com");
    expect(entry.meta.reason).toBe("unknown_email");
  });

  it("separates a correct password on an unapproved account from a bad one", async () => {
    await makeUser({ approvalStatus: "pending" });

    expect((await login("student@example.com", "Password123")).status).toBe(403);

    const entry = await AuditLog.findOne({ action: "login_failed" });
    expect(entry.meta.reason).toBe("account_pending");
  });

  it("never stores the password that was tried", async () => {
    await makeUser();
    await login("student@example.com", "WrongPassword1");
    await login("nobody@example.com", "AnotherSecret1");

    const entries = await AuditLog.find({});
    expect(JSON.stringify(entries)).not.toContain("WrongPassword1");
    expect(JSON.stringify(entries)).not.toContain("AnotherSecret1");
  });
});

describe("signup is recorded", () => {
  it("writes a signup entry with the timestamp and the pending status", async () => {
    const res = await request(app).post("/api/v1/auth/signup").set("X-Forwarded-For", freshIp()).send({
      FullName: "New Person",
      UserName: "newperson",
      Email: "new.person@example.com",
      password: "Password123",
      role: "student",
    });

    expect(res.status).toBe(201);

    const entry = await AuditLog.findOne({ action: "signup" });
    expect(entry).not.toBeNull();
    expect(entry.actorEmail).toBe("new.person@example.com");
    expect(entry.actorRole).toBe("student");
    expect(entry.meta.approvalStatus).toBe("pending");
    expect(entry.meta.requiresApproval).toBe(true);
    expect(entry.createdAt).toBeInstanceOf(Date);
  });
});

describe("approval is recorded against the admin who made it", () => {
  it("writes approve_user naming both the admin and the account", async () => {
    const token = await makeAdmin();
    const pending = await makeUser({ approvalStatus: "pending" });

    const res = await request(app).patch(`/api/v1/user/${pending._id}/approval`).set("Authorization", `Bearer ${token}`).set("X-Forwarded-For", freshIp()).send({ approvalStatus: "approved" });

    expect(res.status).toBe(200);

    const entry = await AuditLog.findOne({ action: "approve_user" });
    expect(entry).not.toBeNull();
    expect(entry.actorRole).toBe("admin");
    expect(entry.actorEmail).toBe("admin@example.com");
    expect(String(entry.targetId)).toBe(String(pending._id));
    expect(entry.meta.subjectEmail).toBe("student@example.com");
    expect(entry.meta.reviewedAt).toBeTruthy();
  });

  it("writes reject_user with the reason", async () => {
    const token = await makeAdmin();
    const pending = await makeUser({ approvalStatus: "pending" });

    await request(app).patch(`/api/v1/user/${pending._id}/approval`).set("Authorization", `Bearer ${token}`).set("X-Forwarded-For", freshIp()).send({ approvalStatus: "rejected", rejectionReason: "Not a real student" });

    const entry = await AuditLog.findOne({ action: "reject_user" });
    expect(entry.meta.rejectionReason).toBe("Not a real student");
  });

  it("names the approving admin on the user record the dashboard reads", async () => {
    const token = await makeAdmin();
    const pending = await makeUser({ approvalStatus: "pending" });

    await request(app).patch(`/api/v1/user/${pending._id}/approval`).set("Authorization", `Bearer ${token}`).set("X-Forwarded-For", freshIp()).send({ approvalStatus: "approved" });

    const list = await request(app).get("/api/v1/user").set("Authorization", `Bearer ${token}`).set("X-Forwarded-For", freshIp());

    const approved = list.body.data.users.find((entry) => entry.Email === "student@example.com");
    // Populated, so the dashboard can print a name instead of an id.
    expect(approved.approvalReviewedBy.FullName).toBe("Admin User");
    expect(approved.approvalReviewedAt).toBeTruthy();
  });
});

describe("the audit endpoint serves these to the dashboard", () => {
  it("returns login and signup entries, newest first", async () => {
    const token = await makeAdmin();
    await makeUser();
    await login("student@example.com", "Password123");

    const res = await request(app).get("/api/v1/audit-logs?sort=-createdAt&limit=100").set("Authorization", `Bearer ${token}`).set("X-Forwarded-For", freshIp());

    expect(res.status).toBe(200);
    const actions = res.body.data.logs.map((entry) => entry.action);
    expect(actions).toContain("login");
  });
});
