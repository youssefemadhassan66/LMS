import winston from "winston";

const isProduction = process.env.NODE_ENV;

const logger = winston.createLogger({
  level: "error",
  format: winston.format.json(),
  transports: [isProduction ? new winston.transports.File({ filename: "logs/error.log" }) : new winston.transports.Console()],
});

export default logger;
