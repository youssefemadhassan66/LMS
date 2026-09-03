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

jest.unstable_mockModule("../Utilities/SocketManager.js", () => ({
  emitToUser: jest.fn(),
  emitToAll: jest.fn(),
  getIo: jest.fn(),
  initSocket: jest.fn(),
  authenticateSocket: jest.fn(),
}));

let mongod;
let app;
let User;
let StudentProfile;
let reviewUserApprovalService;
let createUserService;
let getAllStudentProfilesService;

beforeAll(async () => {
  ({ default: app } = await import("../App.js"));
  ({ default: User } = await import("../Models/user.js"));
  ({ default: StudentProfile } = await import("../Models/studentProfile.js"));
  ({ reviewUserApprovalService, createUserService } = await import("../Services/UserServices.js"));
  ({ getAllStudentProfilesService } = await import("../Services/studentProfileServices.js"));
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  jest.clearAllMocks();
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
});

let ipCounter = 0;
const freshIp = () => {
  ipCounter += 1;
  return `198.51.100.${(ipCounter % 250) + 1}`;
};

const signup = (n, role) =>
  request(app)
    .post("/api/v1/auth/signup")
    .set("X-Forwarded-For", freshIp())
    .send({
      FullName: "New Person",
      UserName: `new_person_${n}`,
      Email: `new.person.${n}@example.com`,
      password: "Password123!",
      role,
    });

const makeAdmin = () => User.create({ FullName: "Admin One", UserName: "admin_one", Email: "admin.one@example.com", password: "AdminPass1!", role: "admin" });

describe("a student account always has a StudentProfile", () => {
  it("provisions the profile at signup", async () => {
    const res = await signup("s1", "student");
    expect(res.status).toBe(201);

    const student = await User.findOne({ UserName: "new_person_s1" });
    expect(await StudentProfile.countDocuments({ user: student._id })).toBe(1);
  });

  it("does not provision one for a parent signup", async () => {
    expect((await signup("p1", "parent")).status).toBe(201);

    expect(await StudentProfile.countDocuments()).toBe(0);
  });

  it("provisions the profile when an admin creates the student directly", async () => {
    const student = await createUserService({
      FullName: "Direct Student",
      UserName: "direct_student",
      Email: "direct.student@example.com",
      password: "Password123!",
      role: "student",
    });

    expect(await StudentProfile.countDocuments({ user: student._id })).toBe(1);
  });

  // The regression this suite exists for: a student created before profiles were
  // provisioned at signup stayed profile-less through approval, so instructors
  // and admins could never schedule a session for them.
  it("provisions the profile when approving a legacy profile-less student", async () => {
    const admin = await makeAdmin();
    const student = await User.create({
      FullName: "Legacy Student",
      UserName: "legacy_student",
      Email: "legacy.student@example.com",
      password: "Password123!",
      role: "student",
      approvalStatus: "pending",
    });

    expect(await StudentProfile.countDocuments({ user: student._id })).toBe(0);

    await reviewUserApprovalService({ userId: student._id, approvalStatus: "approved", reviewedBy: admin });

    expect(await StudentProfile.countDocuments({ user: student._id })).toBe(1);
  });

  it("stays at one profile when approval runs twice", async () => {
    const admin = await makeAdmin();
    await signup("s2", "student");
    const student = await User.findOne({ UserName: "new_person_s2" });

    await reviewUserApprovalService({ userId: student._id, approvalStatus: "approved", reviewedBy: admin });
    await reviewUserApprovalService({ userId: student._id, approvalStatus: "approved", reviewedBy: admin });

    expect(await StudentProfile.countDocuments({ user: student._id })).toBe(1);
  });

  it("creates no profile when the account is rejected", async () => {
    const admin = await makeAdmin();
    const student = await User.create({
      FullName: "Rejected Student",
      UserName: "rejected_student",
      Email: "rejected.student@example.com",
      password: "Password123!",
      role: "student",
      approvalStatus: "pending",
    });

    await reviewUserApprovalService({ userId: student._id, approvalStatus: "rejected", rejectionReason: "no", reviewedBy: admin });

    expect(await StudentProfile.countDocuments({ user: student._id })).toBe(0);
  });

  // The user-visible symptom: the student has to show up in the list an admin
  // picks from when scheduling a session.
  it("makes the new student selectable by an admin scheduling a session", async () => {
    const admin = await makeAdmin();
    await signup("s3", "student");
    const student = await User.findOne({ UserName: "new_person_s3" });

    await reviewUserApprovalService({ userId: student._id, approvalStatus: "approved", reviewedBy: admin });

    const profiles = await getAllStudentProfilesService({}, { _id: admin._id, role: "admin" });
    expect(profiles.map((profile) => String(profile.user?._id ?? profile.user))).toContain(String(student._id));
  });
});
