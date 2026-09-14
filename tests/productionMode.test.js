import { jest } from "@jest/globals";
import request from "supertest";

jest.setTimeout(30_000);

// Boots the app exactly as production does. Everything asserted here changed
// behaviour the moment NODE_ENV flipped from development to production, so
// these are the things worth knowing still work.
//
// The limits are pinned small so the tests assert the shape of each bucket
// rather than how the production defaults happen to be tuned.
// Jest runs the suites in one process (--runInBand), and seven of them do not
// pin their own NODE_ENV. Snapshot what this file overwrites and put it back in
// afterAll, so the run order cannot decide whether another suite sees
// production — which would switch its rate limiters on and its bcrypt cost up.
const overridden = ["NODE_ENV", "TRUST_PROXY", "SALT_ROUNDS", "RATE_LIMIT_MAX", "LOGIN_ACCOUNT_RATE_MAX", "LOGIN_IP_RATE_MAX", "CORS_ORIGIN", "CLIENT_URL"];
const originalEnv = Object.fromEntries(overridden.map((key) => [key, process.env[key]]));

Object.assign(process.env, {
  NODE_ENV: "production",
  TRUST_PROXY: "1",
  JWT_TOKEN_SECRET: "test-secret-32-characters-long!!",
  JWT_REFRESH_TOKEN_SECRET: "test-refresh-secret-32-characters!",
  JWT_TOKEN_EXPIRES_IN: "2h",
  JWT_REFRESH_EXPIRES_IN: "7d",
  SALT_ROUNDS: "12",
  CLIENT_URL: "https://algogambit.online",
  CORS_ORIGIN: "https://algogambit.online",
  RATE_LIMIT_MAX: "4",
  LOGIN_ACCOUNT_RATE_MAX: "2",
  LOGIN_IP_RATE_MAX: "50",
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

let app;

beforeAll(async () => {
  ({ default: app } = await import("../App.js"));
}, 60_000);

afterAll(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

let ipCounter = 0;
const freshIp = () => {
  ipCounter += 1;
  return `198.18.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
};

// No database is needed anywhere below: each request is stopped by a limiter,
// by auth, or by body validation before it reaches a model.
describe("rate limiting is active under production", () => {
  // The body deliberately omits the password. The limiters are mounted above
  // the router, so the attempt is counted and then rejected by validation —
  // which keeps these tests off the database while exercising the same bucket
  // a real credential-stuffing run would fill.
  const loginAttempt = (ip, email) => request(app).post("/api/v1/auth/login").set("X-Forwarded-For", ip).send({ email });

  it("throttles repeated logins against one account", async () => {
    const ip = freshIp();

    // LOGIN_ACCOUNT_RATE_MAX=2, so the third attempt on this account is refused.
    expect((await loginAttempt(ip, "victim@example.com")).status).toBe(400);
    expect((await loginAttempt(ip, "victim@example.com")).status).toBe(400);

    const third = await loginAttempt(ip, "victim@example.com");
    expect(third.status).toBe(429);
    expect(third.text).toMatch(/too many authentication attempts/i);
  });

  it("keys the login bucket per account, not globally", async () => {
    const ip = freshIp();

    await loginAttempt(ip, "first@example.com");
    await loginAttempt(ip, "first@example.com");
    expect((await loginAttempt(ip, "first@example.com")).status).toBe(429);

    // A different account from the same IP still has its own budget: one
    // sprayed victim must not lock out everyone else.
    expect((await loginAttempt(ip, "second@example.com")).status).not.toBe(429);
  });

  it("throttles general API traffic", async () => {
    const ip = freshIp();
    const call = () => request(app).get("/api/v1/user").set("X-Forwarded-For", ip);

    // RATE_LIMIT_MAX=4 unauthenticated calls, keyed by IP; the fifth is refused.
    for (let i = 0; i < 4; i += 1) {
      expect((await call()).status).toBe(401);
    }
    expect((await call()).status).toBe(429);
  });

  it("never throttles the endpoints whose failure reads as a lost session", async () => {
    const ip = freshIp();

    // Burn well past RATE_LIMIT_MAX on the exempt paths. These are checked
    // mount-relative ("/v1/auth/me", not "/api/v1/auth/me"); getting that wrong
    // is what made the exemption silently do nothing before.
    for (let i = 0; i < 8; i += 1) {
      const res = await request(app).get("/api/v1/auth/me").set("X-Forwarded-For", ip);
      expect(res.status).not.toBe(429);
    }

    const health = await request(app).get("/api/v1/health").set("X-Forwarded-For", ip);
    expect(health.status).not.toBe(429);
  });
});

describe("production hardening", () => {
  it("sends HSTS", async () => {
    const res = await request(app).get("/api/v1/health").set("X-Forwarded-For", freshIp());

    expect(res.headers["strict-transport-security"]).toMatch(/max-age=31536000/);
    expect(res.headers["strict-transport-security"]).toMatch(/includeSubDomains/);
  });

  it("still returns no stack trace or error object", async () => {
    const res = await request(app).get("/api/v1/user").set("X-Forwarded-For", freshIp());

    expect(res.status).toBe(401);
    expect(res.body.stack).toBeUndefined();
    expect(res.body.error).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules/);
  });

  it("allows the configured frontend origin and no other", async () => {
    const allowed = await request(app).get("/api/v1/health").set("Origin", "https://algogambit.online").set("X-Forwarded-For", freshIp());
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://algogambit.online");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const other = await request(app).get("/api/v1/health").set("Origin", "https://not-the-frontend.example").set("X-Forwarded-For", freshIp());
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
