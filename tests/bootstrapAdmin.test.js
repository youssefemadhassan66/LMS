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
  BOOTSTRAP_RATE_MAX: "50",
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

const SECRET = "bootstrap-secret-for-tests";

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

beforeEach(() => {
  process.env.ADMIN_BOOTSTRAP_SECRET = SECRET;
});

afterEach(async () => {
  delete process.env.ADMIN_BOOTSTRAP_SECRET;
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
});

let ipCounter = 0;
const freshIp = () => {
  ipCounter += 1;
  return `198.19.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
};

const payload = {
  FullName: "First Admin",
  UserName: "firstadmin",
  Email: "first.admin@example.com",
  password: "Bootstrap123",
};

const bootstrap = (secret, body = payload) => {
  const req = request(app).post("/api/v1/auth/bootstrap-admin").set("X-Forwarded-For", freshIp());
  if (secret !== undefined) req.set("x-bootstrap-secret", secret);
  return req.send(body);
};

describe("POST /api/v1/auth/bootstrap-admin", () => {
  it("creates the first admin of an empty database", async () => {
    const res = await bootstrap(SECRET);

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("admin");
    expect(res.body.data.user.Email).toBe(payload.Email);

    const stored = await User.findOne({ Email: payload.Email }).select("+password");
    expect(stored.role).toBe("admin");
    expect(stored.approvalStatus).toBe("approved");
    expect(stored.isActive).toBe(true);
    // Written through the model, so the hook hashed it.
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  it("lets that admin log in immediately", async () => {
    await bootstrap(SECRET);

    const login = await request(app).post("/api/v1/auth/login").set("X-Forwarded-For", freshIp()).send({ email: payload.Email, password: payload.password });

    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe("admin");
  });

  it("never returns the password hash", async () => {
    const res = await bootstrap(SECRET);

    expect(res.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("$2");
  });

  it("closes permanently once an admin exists", async () => {
    expect((await bootstrap(SECRET)).status).toBe(201);

    const second = await bootstrap(SECRET, { ...payload, Email: "second.admin@example.com", UserName: "secondadmin" });

    expect(second.status).toBe(403);
    expect(await User.countDocuments({ role: "admin" })).toBe(1);
  });

  it("stays closed when the only admin has been deactivated", async () => {
    await bootstrap(SECRET);
    // A soft delete must not reopen the door.
    await User.updateOne({ Email: payload.Email }, { isActive: false });

    const again = await bootstrap(SECRET, { ...payload, Email: "third.admin@example.com", UserName: "thirdadmin" });

    expect(again.status).toBe(403);
  });

  it("refuses a wrong secret", async () => {
    const res = await bootstrap("not-the-secret");

    expect(res.status).toBe(403);
    expect(await User.countDocuments()).toBe(0);
  });

  it("refuses a missing secret", async () => {
    const res = await bootstrap(undefined);

    expect(res.status).toBe(403);
    expect(await User.countDocuments()).toBe(0);
  });

  it("does not exist when ADMIN_BOOTSTRAP_SECRET is unset", async () => {
    delete process.env.ADMIN_BOOTSTRAP_SECRET;

    const res = await bootstrap(SECRET);

    // 404, not 403: an unconfigured route must not confirm it is there.
    expect(res.status).toBe(404);
    expect(await User.countDocuments()).toBe(0);
  });

  it("cannot be used to create any role but admin", async () => {
    const res = await bootstrap(SECRET, { ...payload, role: "student" });

    // role is not in the schema, and stripUnknown drops it.
    expect(res.status).toBe(201);
    expect((await User.findOne({ Email: payload.Email })).role).toBe("admin");
  });

  it("validates the account details", async () => {
    const res = await bootstrap(SECRET, { ...payload, password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 8 characters/i);
    expect(await User.countDocuments()).toBe(0);
  });

  it("records both the success and the refusals", async () => {
    await bootstrap("not-the-secret");
    await bootstrap(SECRET);
    await bootstrap(SECRET, { ...payload, Email: "again@example.com", UserName: "againadmin" });

    const denied = await AuditLog.find({ action: "bootstrap_admin_denied" }).sort({ createdAt: 1 });
    expect(denied.map((entry) => entry.meta.reason)).toEqual(["invalid_secret", "admin_already_exists"]);

    const created = await AuditLog.findOne({ action: "bootstrap_admin" });
    expect(created).not.toBeNull();
  });
});
