import express from "express";
import { protectionController, restrictedToController } from "../Controllers/AuthController.js";

import {
  createSubmissionController,
  getAllSubmissionsController,
  getSubmissionByIdController,
  getSubmissionsByTaskIdController,
  getSubmissionsByStudentIdController,
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

// ⚠️ Specific student sub-routes must come BEFORE /student/:studentId
router.get("/student/:studentId/stats",       getSubmissionStatsByStudentIdController);
router.get("/student/:studentId/due-buckets", getTasksDueDateBucketsController); //Check on this function Later
router.get("/student/:studentId",             getSubmissionsByStudentIdController);

router.get("/:id", getSubmissionByIdController);

// Student submits their work
router.patch("/:id/submit", submitTaskController);

// ─── Restricted (instructor / admin only) ────────────────────────────────────

router.use(restrictedToController("admin", "instructor"));

// Create a submission
router.post("/", createSubmissionController);

// Update Submission
router.patch("/:id", updateSubmissionByIdController);

// Update status manually
router.patch("/:id/status", updateSubmissionStatusController);

// Instructor reviews a submission
router.patch("/:id/review", reviewSubmissionController);

// Delete a submission
router.delete("/:id", deleteSubmissionByIdController);

export default router;