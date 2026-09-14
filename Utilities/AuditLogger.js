import AuditLog from "../Models/AuditLog.js";

/**
 * Write a record to the audit log.
 * Never throws — a logging failure must not break the main request.
 *
 * @param {object} opts
 * @param {string|object} [opts.actor]      - User _id (or user object with _id).
 *   Omitted for events with no account behind them, e.g. a failed login for an
 *   address that does not exist.
 * @param {string}        [opts.actorEmail] - The address the caller claimed,
 *   when there is no actor to point at.
 * @param {string}        [opts.actorRole]
 * @param {string}        opts.action  - e.g. "grade_submission"
 * @param {string}        [opts.targetModel]
 * @param {string}        [opts.targetId]
 * @param {object}        [opts.meta]  - extra context
 * @param {string}        [opts.ip]
 */
const auditLog = async ({ actor, actorEmail, actorRole, action, targetModel, targetId, meta, ip } = {}) => {
  try {
    const actorId = actor?._id ?? actor;
    await AuditLog.create({ actor: actorId, actorEmail, actorRole, action, targetModel, targetId, meta, ip });
  } catch (err) {
    console.error("[AuditLog] Failed to write audit entry:", err.message);
  }
};

export default auditLog;
