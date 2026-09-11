import Joi from "joi";

// Validation for the admin-only user management routes (/api/v1/user).
//
// These routes had no validation layer at all: every bad value fell through to
// Mongoose, which answered with a raw ValidationError. A password the model
// rejected (under 8 characters) therefore read as an unrelated server error in
// the admin dialog, and an admin could not tell a rejected password from a
// saved one.
//
// The password is deliberately NOT trimmed, lowercased or otherwise rewritten.
// Login hashes and compares the exact string it is given, so any normalisation
// applied here — and nowhere else — would store a hash of something different
// from what the account holder is later told to type.
const passwordRule = Joi.string().min(8).max(128).messages({
  "string.base": "Password must be text",
  "string.min": "Password must be at least 8 characters",
  "string.max": "Password cannot exceed 128 characters",
  "any.required": "Password is required",
});

// Mirrors the User model's own validator so the failure comes back as a 400
// with a readable message instead of a Mongoose ValidationError.
const fullNameRule = Joi.string()
  .trim()
  .min(2)
  .max(100)
  .pattern(/^[\p{L}\s'\-]{2,}$/u)
  .messages({
    "string.min": "Full name must be at least 2 characters",
    "string.max": "Full name cannot exceed 100 characters",
    "string.pattern.base": "Full name may only contain letters, spaces, hyphens, and apostrophes",
    "any.required": "Full name is required",
  });

const userNameRule = Joi.string().trim().min(5).max(30).messages({
  "string.min": "Username must be at least 5 characters",
  "string.max": "Username cannot exceed 30 characters",
  "any.required": "Username is required",
});

const emailRule = Joi.string()
  .trim()
  .lowercase()
  .email({ minDomainSegments: 2, tlds: { allow: false } })
  .max(254)
  .messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  });

const roleRule = Joi.string().valid("student", "parent", "instructor", "admin").messages({
  "any.only": "Role must be one of: student, parent, instructor, admin",
  "any.required": "Role is required",
});

// ─── POST /api/v1/user ───────────────────────────────────────────────────────
export const adminCreateUserSchema = Joi.object({
  FullName: fullNameRule.required(),
  UserName: userNameRule.required(),
  Email: emailRule.required(),
  password: passwordRule.required(),
  role: roleRule.required(),
  avatar: Joi.string().uri().max(500).optional().allow("", null),
  isActive: Joi.boolean().optional(),
});

// ─── PATCH /api/v1/user/:id ──────────────────────────────────────────────────
// Every field is optional — the dialog sends only what it edits — but the body
// has to carry at least one of them, so an empty PATCH is a 400 rather than a
// silent no-op the admin reads as success.
export const adminUpdateUserSchema = Joi.object({
  FullName: fullNameRule,
  UserName: userNameRule,
  Email: emailRule,
  // "" means "leave the password alone": the edit dialog always sends the field.
  password: passwordRule.allow(""),
  role: roleRule,
  avatar: Joi.string().uri().max(500).allow("", null),
  isActive: Joi.boolean(),
})
  .min(1)
  .messages({
    "object.min": "No changes were provided",
  });
