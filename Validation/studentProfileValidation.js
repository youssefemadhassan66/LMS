import Joi from "joi";

// Validation schema for creating a student profile
export const createStudentProfileSchema = Joi.object({
  parents: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .message("Invalid parent ID format"),
    )
    .optional()
    .messages({
      "array.base": "Parents must be an array",
    }),

  grade: Joi.string().trim().min(1).max(50).optional().messages({
    "string.base": "Grade must be a string",
    "string.min": "Grade must be at least 1 character",
    "string.max": "Grade cannot exceed 50 characters",
  }),

  notes: Joi.string().trim().max(500).optional().messages({
    "string.base": "Notes must be a string",
    "string.max": "Notes cannot exceed 500 characters",
  }),
});

// Validation schema for updating a student profile
export const updateStudentProfileSchema = Joi.object({
  parents: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .message("Invalid parent ID format"),
    )
    .optional()
    .messages({
      "array.base": "Parents must be an array",
    }),

  grade: Joi.string().trim().min(1).max(50).optional().messages({
    "string.base": "Grade must be a string",
    "string.min": "Grade must be at least 1 character",
    "string.max": "Grade cannot exceed 50 characters",
  }),

  notes: Joi.string().trim().max(500).optional().messages({
    "string.base": "Notes must be a string",
    "string.max": "Notes cannot exceed 500 characters",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// Validation schema for profile ID parameter
export const profileIdSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid profile ID format",
      "any.required": "Profile ID is required",
    }),
});
