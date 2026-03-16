class AppErrorHelper extends Error{
    constructor(message,statusCode,details = null){
        this.message = message;
        this.statusCode = statusCode;
        this.status = `${this.statusCode}`.startsWith("4") ? "Fail":"Error";
        isOperational = true;
        super(message);
        this.details = details;
        this.timeStamp = new Date().toISOString();
        Error.captureStackTrace(this,this.constructor)
    }

}

export default AppErrorHelper