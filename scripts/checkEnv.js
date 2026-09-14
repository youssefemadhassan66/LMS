import "dotenv/config";
import { validateEnv } from "../Configs/validateEnv.js";

// Preflight the environment without starting the server.
//
// validateEnv() runs at boot and exits the process when something is missing,
// so a deployment with an incomplete .env fails by going down rather than by
// telling anyone. Run this first — on the server, against the real .env — and
// it reports the same findings while nothing is at stake:
//
//   npm run env:check
//
// It prints variable NAMES and verdicts, never values: the output is meant to
// be safe to paste into a ticket or a CI log.

const isSet = (name) => typeof process.env[name] === "string" && process.env[name].trim().length > 0;
const NODE_ENV = (process.env.NODE_ENV || "").toLowerCase();
const isProduction = NODE_ENV === "production";

const notes = [];
const problems = [];

// ─── Checks validateEnv() does not make ──────────────────────────────────────
// These do not stop the server from booting. They break it once it is up,
// which is harder to diagnose than a refused start.

// CORS_ORIGIN unset falls back to http://localhost:5173 in both App.js and the
// Socket.IO handshake, so every browser request from the real frontend — and
// every websocket — is refused, while curl keeps working.
if (!isSet("CORS_ORIGIN") && !isSet("ALLOWED_ORIGINS")) {
  problems.push("CORS_ORIGIN is not set. The API will only accept browser requests from http://localhost:5173, " + "so the deployed frontend cannot call it and Socket.IO will not connect.");
} else {
  const origins = (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const local = origins.filter((origin) => /localhost|127\.0\.0\.1/.test(origin));
  notes.push(`CORS_ORIGIN allows ${origins.length} origin(s)${local.length ? `, ${local.length} of them local` : ""}.`);
  if (isProduction && origins.some((origin) => origin.startsWith("http://") && !/localhost|127\.0\.0\.1/.test(origin))) {
    problems.push("CORS_ORIGIN contains a plain-http non-local origin; cookies are sent with Secure and will be dropped.");
  }
}

// CLIENT_URL is the base for password-reset and verification links. Wrong or
// missing means the email arrives with a link nobody can use.
if (!isSet("CLIENT_URL")) {
  problems.push("CLIENT_URL is not set. Password-reset and verification emails will build links against a missing origin.");
}

// TRUST_PROXY matters much more in production, where the rate limiters are
// active: behind Nginx with the wrong value, req.ip is the proxy for every
// caller, so one bucket is shared by all of them and a single busy client can
// lock everyone out of login.
const trustProxy = process.env.TRUST_PROXY ?? "1 (default)";
notes.push(`TRUST_PROXY is ${trustProxy}. Behind one Nginx hop this should be 1.`);
if (process.env.TRUST_PROXY === "0") {
  problems.push("TRUST_PROXY=0 while the rate limiters are active: every request appears to come from the proxy's IP, " + "so all users share one login bucket.");
}

// The switch this script was written for.
notes.push(
  isProduction ? "NODE_ENV=production: rate limiters ACTIVE, HSTS on, logs at warn, error responses safe." : `NODE_ENV=${NODE_ENV || "not set"}: rate limiters DISABLED (no brute-force protection), HSTS off. ` + "Error responses are safe regardless.",
);

if (process.env.EXPOSE_ERROR_DETAILS === "true") {
  if (isProduction) {
    notes.push("EXPOSE_ERROR_DETAILS=true is set but ignored under NODE_ENV=production.");
  } else {
    problems.push("EXPOSE_ERROR_DETAILS=true and NODE_ENV is not production: responses will include stack traces.");
  }
}

console.log(`Checking environment for NODE_ENV=${NODE_ENV || "not set"}\n`);

// ─── The same validation the server runs at boot ─────────────────────────────
let bootOk = true;
try {
  validateEnv();
} catch {
  // validateEnv has already printed the specific missing and invalid variables.
  bootOk = false;
}

console.log(bootOk ? "\nBoot validation: PASSED" : "\nBoot validation: FAILED — the server will exit on start.");

if (notes.length > 0) {
  console.log("\nNotes:");
  notes.forEach((note) => console.log(`  - ${note}`));
}

if (problems.length > 0) {
  console.log("\nWill not stop the server booting, but will break it once running:");
  problems.forEach((problem) => console.log(`  - ${problem}`));
}

if (!bootOk || problems.length > 0) {
  process.exitCode = 1;
} else {
  console.log("\nNothing outstanding.");
}
