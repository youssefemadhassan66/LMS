import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // Optional because the most interesting security events have no account
    // behind them: a failed login for an address that does not exist is worth
    // recording precisely because nobody owns it. Every entry written by an
    // authenticated request still carries one.
    actor: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
    // What the caller claimed to be when there is no actor to point at — the
    // email typed into the login form. Never a password, never a token.
    actorEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    actorRole: {
      type: String,
    },
    action: {
      type: String,
      required: true,
      // e.g. "grade_submission", "impersonate_user", "delete_session", "reset_password"
    },
    targetModel: {
      type: String,
      // e.g. "Submission", "User", "Session"
    },
    targetId: {
      type: mongoose.Schema.ObjectId,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      // any extra context: { before, after, reason }
    },
    ip: {
      type: String,
    },
  },
  { timestamps: true },
);

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ targetModel: 1, targetId: 1 });
auditLogSchema.index({ action: 1 });
// The dashboard opens on "newest first" across every action, and the failed
// -login view filters by the attempted address.
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorEmail: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
