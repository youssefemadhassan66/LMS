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

/**
 * @swagger
 * /api/v1/submission:
 *   get:
 *     summary: Get all submissions
 *     tags: [Submissions]
 *     description: Retrieve all submissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of submissions
 */
router.get("/", getAllSubmissionsController);

/**
 * @swagger
 * /api/v1/submission/task/{taskId}:
 *   get:
 *     summary: Get submissions by task ID
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of submissions for the task
 */
router.get("/task/:taskId", getSubmissionsByTaskIdController);

/**
 * @swagger
 * /api/v1/submission/student/{studentId}/stats:
 *   get:
 *     summary: Get submission statistics by student ID
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Submission statistics for the student
 */
router.get("/student/:studentId/stats", getSubmissionStatsByStudentIdController);

/**
 * @swagger
 * /api/v1/submission/student/{studentId}/due-buckets:
 *   get:
 *     summary: Get task due date buckets by student ID
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tasks grouped by due date buckets
 */
router.get("/student/:studentId/due-buckets", getTasksDueDateBucketsController);

/**
 * @swagger
 * /api/v1/submission/student/{studentId}:
 *   get:
 *     summary: Get submissions by student ID
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of submissions for the student
 */
router.get("/student/:studentId", getSubmissionsByStudentIdController);

/**
 * @swagger
 * /api/v1/submission/{id}:
 *   get:
 *     summary: Get submission by ID
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Submission found
 *       404:
 *         description: Submission not found
 */
router.get("/:id", getSubmissionByIdController);

/**
 * @swagger
 * /api/v1/submission/{id}/submit:
 *   patch:
 *     summary: Submit task work
 *     tags: [Submissions]
 *     description: Student submits their work for a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               fileUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Task submitted successfully
 *       404:
 *         description: Submission not found
 */
router.patch("/:id/submit", submitTaskController);

// ─── Restricted (instructor / admin only) ────────────────────────────────────

router.use(restrictedToController("admin", "instructor"));

/**
 * @swagger
 * /api/v1/submission:
 *   post:
 *     summary: Create a new submission
 *     tags: [Submissions]
 *     description: Create a new submission (instructor/admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - taskId
 *               - studentId
 *             properties:
 *               taskId:
 *                 type: string
 *               studentId:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Submission created
 *       400:
 *         description: Validation error
 */
router.post("/", createSubmissionController);

/**
 * @swagger
 * /api/v1/submission/{id}:
 *   patch:
 *     summary: Update submission
 *     tags: [Submissions]
 *     description: Update a submission (instructor/admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               fileUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Submission updated
 *       404:
 *         description: Submission not found
 */
router.patch("/:id", updateSubmissionByIdController);

/**
 * @swagger
 * /api/v1/submission/{id}/status:
 *   patch:
 *     summary: Update submission status
 *     tags: [Submissions]
 *     description: Update the status of a submission (instructor/admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [submitted, graded, returned]
 *     responses:
 *       200:
 *         description: Submission status updated
 *       404:
 *         description: Submission not found
 */
router.patch("/:id/status", updateSubmissionStatusController);

/**
 * @swagger
 * /api/v1/submission/{id}/review:
 *   patch:
 *     summary: Review submission
 *     tags: [Submissions]
 *     description: Instructor reviews and grades a submission
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               grade:
 *                 type: number
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Submission reviewed
 *       404:
 *         description: Submission not found
 */
router.patch("/:id/review", reviewSubmissionController);

/**
 * @swagger
 * /api/v1/submission/{id}:
 *   delete:
 *     summary: Delete submission
 *     tags: [Submissions]
 *     description: Delete a submission (instructor/admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Submission deleted
 *       404:
 *         description: Submission not found
 */
router.delete("/:id", deleteSubmissionByIdController);

export default router;
