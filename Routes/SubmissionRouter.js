import express from "express";
import { protectionController, restrictedToController } from "../Controllers/AuthController.js";

import {
  createSubmissionController,
  getAllSubmissionsController,
  getSubmissionByIdController,
  getSubmissionsByTaskIdController,
  getSubmissionsByStudentIdController,
  getAllMySubmissionsController,
  getMySubmissionController,
  getMySubmissionStatsController,
  getSubmissionStatsByStudentIdController,
  getTasksDueDateBucketsController,
  updateSubmissionByIdController,
  deleteSubmissionByIdController,
  updateSubmissionStatusController,
  submitTaskController,
  reviewSubmissionController,
} from "../Controllers/SubmissionController.js";

const router = express.Router();

// All routes require authentication
router.use(protectionController);

// ─── Authenticated (any logged-in user) ──────────────────────────────────────


router.get("/", getAllSubmissionsController);


router.get("/task/:taskId", getSubmissionsByTaskIdController);

router.get("/me", getAllMySubmissionsController);
router.get("/me/stats", getMySubmissionStatsController);
router.get("/me/:id", getMySubmissionController);

router.get("/student/:studentId/stats", getSubmissionStatsByStudentIdController);


router.get("/student/:studentId/due-buckets", getTasksDueDateBucketsController);

router.get("/student/:studentId", getSubmissionsByStudentIdController);

router.get("/:id", getSubmissionByIdController);


router.patch("/:id/submit", submitTaskController);

// ─── Restricted (instructor / admin only) ────────────────────────────────────

router.use(restrictedToController("admin", "instructor"));

router.post("/", createSubmissionController);


router.patch("/:id", updateSubmissionByIdController);


router.patch("/:id/status", updateSubmissionStatusController);

 
router.patch("/:id/review", reviewSubmissionController);

router.delete("/:id", deleteSubmissionByIdController);

export default router;
