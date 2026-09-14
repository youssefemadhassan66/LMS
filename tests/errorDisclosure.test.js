import { jest } from "@jest/globals";
import request from "supertest";

jest.setTimeout(30_000);

// NODE_ENV is deliberately "development" here — the value the production
// container was actually running when it answered a 401 with a stack trace and
// the absolute paths of the source files. These tests assert that the response
// is safe anyway, because a deployment running under the wrong NODE_ENV must
// not be a disclosure.
Object.assign(process.env, {
  NODE_ENV: "development",
  TRUST_PROXY: "1",
  JWT_TOKEN_SECRET: "test-secret-32-characters-long!!",
  JWT_REFRESH_TOKEN_SECRET: "test-refresh-secret-32-characters!",
  JWT_TOKEN_EXPIRES_IN: "2h",
  JWT_REFRESH_EXPIRES_IN: "7d",
  SALT_ROUNDS: "4",
  CLIENT_URL: "http://localhost:5173",
});
delete process.env.EXPOSE_ERROR_DETAILS;

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

let app;

beforeAll(async () => {
  ({ default: app } = await import("../App.js"));
}, 60_000);

// No database is needed: every request below is rejected by auth or by the
// router before it reaches a model.
describe("error responses do not disclose internals", () => {
  it("answers an unauthenticated request with a message and nothing else", async () => {
    const res = await request(app).get("/api/v1/user");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Please login to access this route !");

    // The exact regression: stack, the raw error object, and the absolute
    // source paths inside them.
    expect(res.body.stack).toBeUndefined();
    expect(res.body.error).toBeUndefined();
    expect(Object.keys(res.body).sort()).toEqual(["message", "status"]);
  });

  it("names no file path, module or framework anywhere in the body", async () => {
    const res = await request(app).get("/api/v1/user");
    const body = JSON.stringify(res.body);

    expect(body).not.toMatch(/Services\/AuthServices/);
    expect(body).not.toMatch(/node_modules/);
    expect(body).not.toMatch(/\bat [A-Za-z]+ \(/); // a stack frame
    expect(body).not.toMatch(/file:\/\//);
  });

  it("does not leak through a bad token either", async () => {
    const res = await request(app).get("/api/v1/user").set("Authorization", "Bearer not-a-real-token");

    expect(res.status).toBe(401);
    expect(res.body.stack).toBeUndefined();
    expect(res.body.error).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules/);
  });

  it("keeps a 404 from the router free of internals", async () => {
    const res = await request(app).get("/api/v1/no-such-route-exists");

    expect(res.status).toBe(404);
    expect(res.body.stack).toBeUndefined();
    expect(res.body.error).toBeUndefined();
  });
});

describe("EXPOSE_ERROR_DETAILS", () => {
  afterEach(() => {
    delete process.env.EXPOSE_ERROR_DETAILS;
    process.env.NODE_ENV = "development";
  });

  it("returns the stack when a developer opts in locally", async () => {
    process.env.EXPOSE_ERROR_DETAILS = "true";

    const res = await request(app).get("/api/v1/user");

    expect(res.status).toBe(401);
    expect(typeof res.body.stack).toBe("string");
    expect(res.body.error).toBeDefined();
  });

  it("is ignored when the app runs as production, however it is set", async () => {
    process.env.EXPOSE_ERROR_DETAILS = "true";
    process.env.NODE_ENV = "production";

    const res = await request(app).get("/api/v1/user");

    expect(res.status).toBe(401);
    expect(res.body.stack).toBeUndefined();
    expect(res.body.error).toBeUndefined();
  });

  it('treats any value other than "true" as off', async () => {
    for (const value of ["1", "yes", "TRUE", ""]) {
      process.env.EXPOSE_ERROR_DETAILS = value;

      const res = await request(app).get("/api/v1/user");

      expect(res.body.stack).toBeUndefined();
      expect(res.body.error).toBeUndefined();
    }
  });
});
