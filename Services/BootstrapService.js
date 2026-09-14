import crypto from "crypto";
import User from "../Models/user.js";
import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import auditLog from "../Utilities/AuditLogger.js";
import ensureStudentProfile from "../Utilities/StudentProfileHelper.js";

// Creating the first admin of an empty database.
//
// Every route that creates an admin is admin-only, so a database with no admin
// in it cannot be administered at all — the chicken-and-egg that a fresh
// deployment hits. This opens exactly one door and shuts it permanently:
//
//   1. ADMIN_BOOTSTRAP_SECRET must be set. Unset, the route does not exist —
//      it answers 404, so a scanner cannot tell it apart from a typo.
//   2. The caller must present that secret, compared in constant time.
//   3. The users collection must contain no admin. The moment one exists, by
//      this route or any other, this stops working for good.
//
// Rule 3 is what makes the others a backstop rather than the only defence: a
// leaked secret is worthless against a database that already has its admin.

const NO_ADMIN_MESSAGE = "Bootstrap is not available.";

// Both sides are hashed to a fixed length first: timingSafeEqual throws on a
// length mismatch, and that throw would itself leak the secret's length.
const secretMatches = (provided, expected) => {
  if (typeof provided !== "string" || provided.length === 0) return false;
  const providedHash = crypto.createHash("sha256").update(provided).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
};

const bootstrapAdminService = async ({ payload, providedSecret, ip }) => {
  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

  // Not configured: the route is not merely closed, it is absent. Anything
  // that describes why would tell a scanner it found something real.
  if (typeof expectedSecret !== "string" || expectedSecret.trim().length === 0) {
    throw new AppErrorHelper("Can't find this route on this server!", 404);
  }

  if (!secretMatches(providedSecret, expectedSecret)) {
    // Recorded with no actor: nobody is authenticated, and a wrong secret here
    // is exactly the kind of thing an admin should see in the log.
    await auditLog({
      action: "bootstrap_admin_denied",
      meta: { reason: "invalid_secret" },
      ip,
    });
    throw new AppErrorHelper(NO_ADMIN_MESSAGE, 403);
  }

  // withInactive so a soft-deleted admin still counts. Deactivating the only
  // admin must not reopen this route.
  const existingAdmin = await User.findOne({ role: "admin" }).setOptions({ withInactive: true }).select("_id");

  if (existingAdmin) {
    await auditLog({
      action: "bootstrap_admin_denied",
      meta: { reason: "admin_already_exists" },
      ip,
    });
    throw new AppErrorHelper(NO_ADMIN_MESSAGE, 403);
  }

  const admin = await User.create({
    FullName: payload.FullName,
    UserName: payload.UserName,
    Email: payload.Email,
    password: payload.password,
    role: "admin",
    isActive: true,
    // Nobody is left to approve this account, and no verification mail can be
    // answered before there is an admin to send it.
    approvalStatus: "approved",
    emailVerified: true,
  });

  // Not expected for an admin, but ensureStudentProfile is the one place that
  // decides this, and role is fixed to "admin" above — kept only so the rule
  // lives in a single place if that ever changes.
  if (admin.role === "student") {
    await ensureStudentProfile(admin._id);
  }

  await auditLog({
    actor: admin._id,
    actorEmail: admin.Email,
    actorRole: admin.role,
    action: "bootstrap_admin",
    targetModel: "User",
    targetId: admin._id,
    meta: { UserName: admin.UserName },
    ip,
  });

  admin.password = undefined;
  return admin;
};

export { bootstrapAdminService };
