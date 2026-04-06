import AppErrorHelper from "../Utilities/AppErrorHelper.js";

/**
 * @param {Object} schema - Joi validation schema
 * @param {String} source - Source of data to validate ('body', 'params', 'query')
 * @returns {Function} Express middleware function
 */
export const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const dataToValidate = req[source];

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(", ");

      return next(new AppErrorHelper(errorMessage, 400));
    }

    // Replace request data with validated and sanitized data
    req[source] = value;
    next();
  };
};

/**
 * Middleware for validating multiple sources
 * @param {Object} schemas - Object with schemas for different sources
 * @returns {Function} Express middleware function
 */
export const validateMultiple = (schemas) => {
  return (req, res, next) => {
    const errors = [];

    // Validate each source
    Object.keys(schemas).forEach((source) => {
      const schema = schemas[source];
      const dataToValidate = req[source];

      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        errors.push(...error.details.map((detail) => `${source}: ${detail.message}`));
      } else {
        req[source] = value;
      }
    });

    if (errors.length > 0) {
      return next(new AppErrorHelper(errors.join(", "), 400));
    }

    next();
  };
};
