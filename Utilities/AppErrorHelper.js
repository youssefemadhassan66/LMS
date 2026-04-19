class AppErrorHelper extends Error {
  constructor(message, statusCode, details = null) {
    super(message);

    this.message = message;
    this.statusCode = statusCode;

    this.status = `${this.statusCode}`.startsWith("4") ? "Fail" : "Error";
    this.isOperational = true;

    this.details = details;
    this.timeStamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppErrorHelper;
