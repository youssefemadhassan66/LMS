import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import logger from "../Utilities/Logger.js";

const HandleCastDbError = (err) => {
  const message = `Invalid ${err.path} : ${err.value}`;
  return new AppErrorHelper(message, 400);
};

const HandelDuplicatesError = (err) => {
  const field = Object.keys(err.keyValue ?? {})[0];
  const value = field ? err.keyValue[field] : "";
  const message = `Duplicated value ${value} for this key ${field} , Please use another value`;
  return new AppErrorHelper(message, 400);
};
const HandleValidationError = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Validation Error , ${errors.join(". ")}`;
  return new AppErrorHelper(message, 400);
};
const HandleJwtError = () => {
  return new AppErrorHelper("Invalid token , Please login or create an account !", 401);
};

const HandleJwtExpirationError = () => {
  return new AppErrorHelper("Token expired , Please login again", 401);
};

// Translate multer errors into user-facing 400s instead of generic 500s.
const HandleMulterError = (err) => {
  const codeToMessage = {
    LIMIT_FILE_SIZE: "File too large. Maximum size is 10 MB.",
    LIMIT_FILE_COUNT: "Too many files uploaded.",
    LIMIT_UNEXPECTED_FILE: `Unexpected file field "${err.field}". Use the "files" field for uploads.`,
    LIMIT_PART_COUNT: "Too many parts in the upload.",
    LIMIT_FIELD_KEY: "Field name too long.",
    LIMIT_FIELD_VALUE: "Field value too long.",
    LIMIT_FIELD_COUNT: "Too many non-file fields.",
  };
  return new AppErrorHelper(codeToMessage[err.code] || `Upload error: ${err.message}`, 400);
};

// Stack traces, the raw error object and internal file paths are for the log
// stream, never for the response body. This branch is opt-in only — see
// shouldExposeErrorDetails below.
const DebugErrorHandler = (err, req, res) => {
  logger.info(err);
  res.status(Number(err.statusCode) || 500).json({
    status: err.status,
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

// The safe response: a status and a message the caller can act on, nothing
// about how the server is built. Non-operational errors keep their detail in
// the log and say nothing beyond "something went wrong" over the wire.
const SafeErrorHandler = (err, req, res) => {
  const statusCode = Number(err.statusCode) || 500;
  if (err.isOperational) {
    res.status(statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    logger.error(err);
    res.status(statusCode).json({
      status: "Error",
      message: "Something went wrong !",
    });
  }
};

const normalize = (err) => {
  let normalized = { ...err, name: err.name, message: err.message, stack: err.stack };
  if (normalized.name === "CastError") normalized = HandleCastDbError(normalized);
  if (normalized.code === 11000) normalized = HandelDuplicatesError(normalized);
  if (normalized.name === "ValidationError") normalized = HandleValidationError(normalized);
  if (normalized.name === "JsonWebTokenError") normalized = HandleJwtError();
  if (normalized.name === "TokenExpiredError") normalized = HandleJwtExpirationError();
  if (normalized.name === "MulterError") normalized = HandleMulterError(normalized);
  return normalized;
};

// Leaking internals used to hang on NODE_ENV alone, which made a deployment
// mistake a disclosure: a server running with NODE_ENV=development — the
// default this app falls back to, and what the production container was
// actually started with — answered every error with the stack trace, the
// absolute paths of the source files, and the whole error object.
//
// So the detailed body is now opt-in and says so in its own name. It is
// returned only when EXPOSE_ERROR_DETAILS is explicitly "true" AND the app is
// not running as production, which no deployment does by accident. Every other
// combination — the variable unset, misspelled, left over in a production
// container — gets the safe response. Local debugging sets it in .env.
const shouldExposeErrorDetails = () => {
  if (process.env.EXPOSE_ERROR_DETAILS !== "true") return false;
  return (process.env.NODE_ENV || "development").toLowerCase() !== "production";
};

const GlobalErrorHandler = (err, req, res, next) => {
  err.status = err.status || "fail";
  err.statusCode = err.statusCode || 500;

  const error = normalize(err);

  if (shouldExposeErrorDetails()) {
    error.stack = err.stack;
    DebugErrorHandler(error, req, res);
    return;
  }

  SafeErrorHandler(error, req, res);
};

export default GlobalErrorHandler;
