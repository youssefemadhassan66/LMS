import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import GlobalErrorHandler from "./Middleware/GlobalErrorHandler.js";
import AppErrorHelper from "./Utilities/AppErrorHelper.js";
import authRouter from "./Routes/authRouts.js";
import userRouter from "./Routes/userRouts.js";
import StudentProfileRouter from "./Routes/StudentProfileRouter.js";
import SessionRouter from "./Routes/SessionRouter.js";
import TaskRouter from "./Routes/TaskRouter.js";
import SubmissionRouter from "./Routes/SubmissionRouter.js";
import SessionReviewRouter from './Routes/SessionReviewRouter.js'

const app = express();

// ─── 1. Security Headers ──────────────────────────────────────────────────────
app.use(helmet());

// ─── 2. CORS ─────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// ─── 3. Rate Limiting ─────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// ─── 4. Logger (dev only) ─────────────────────────────────────────────────────
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ─── 5. Body Parsers ─────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// ─── 6. NoSQL Injection Sanitization ─────────────────────────────────────────
// ✅ Replaced express-mongo-sanitize entirely — that package tries to reassign
// req.query which is a read-only getter in newer Express/Node versions and crashes.
// This custom middleware does the same job: strips any key starting with $ or
// containing a . from req.body and req.params only (safe to mutate both).

const sanitizeValue = (obj) => {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete obj[key];
      } else {
        sanitizeValue(obj[key]); // recurse into nested objects
      }
    }
  }
};

app.use((req, res, next) => {
  sanitizeValue(req.body);
  sanitizeValue(req.params);
  next();
});

// ─── 7. Compression ──────────────────────────────────────────────────────────
app.use(compression());

// ─── 8. Static Files ─────────────────────────────────────────────────────────
app.use("/uploads", express.static("uploads"));

// ─── 9. Routes ───────────────────────────────────────────────────────────────
app.use("/api/v1/auth",           authRouter);
app.use("/api/v1/user",           userRouter);
app.use("/api/v1/StudentProfile", StudentProfileRouter);
app.use("/api/v1/session",        SessionRouter);
app.use("/api/v1/task",           TaskRouter);
app.use("/api/v1/submission",     SubmissionRouter);
app.use("/api/v1/sessionReview",     SessionReviewRouter);

// ─── 10. Unhandled Routes ─────────────────────────────────────────────────────
app.all(/.*/, (req, res, next) => {
  next(new AppErrorHelper(`Can't find ${req.originalUrl} on this server!`, 404));
});

// ─── 11. Global Error Handler ────────────────────────────────────────────────
app.use(GlobalErrorHandler);

export default app;