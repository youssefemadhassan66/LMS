import express from "express";

import { protectionController, restrictedToController } from "../Controllers/AuthController.js";

import {
  createSessionReviewController,
  getAllSessionReviewsController,
  getSessionReviewsByStudentController,
  getSessionReviewsByInstructorController,
  getSessionReviewsBySessionController,
  updateSessionReviewByIdController,
  deleteSessionReviewByIdController,
  getStudentReviewStatsController,
} from "../Controllers/SessionReviewController.js";

const router = express.Router();

router.use(protectionController);

/**
 * @swagger
 * /api/v1/sessionReview:
 *   get:
 *     summary: Get all session reviews
 *     tags: [Session Reviews]
 *     description: Retrieve all session reviews
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of session reviews
 */
router.get("/", getAllSessionReviewsController);

/**
 * @swagger
 * /api/v1/sessionReview/session/{id}:
 *   get:
 *     summary: Get reviews by session ID
 *     tags: [Session Reviews]
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
 *         description: List of reviews for the session
 */
router.get("/session/:id", getSessionReviewsBySessionController);

/**
 * @swagger
 * /api/v1/sessionReview/student/{id}:
 *   get:
 *     summary: Get reviews by student ID
 *     tags: [Session Reviews]
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
 *         description: List of reviews for the student
 */
router.get("/student/:id", getSessionReviewsByStudentController);

/**
 * @swagger
 * /api/v1/sessionReview/student/{id}/stats:
 *   get:
 *     summary: Get student review statistics
 *     tags: [Session Reviews]
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
 *         description: Review statistics for the student
 */
router.get("/student/:id/stats", getStudentReviewStatsController);

/**
 * @swagger
 * /api/v1/sessionReview/instructor/{id}:
 *   get:
 *     summary: Get reviews by instructor ID
 *     tags: [Session Reviews]
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
 *         description: List of reviews by the instructor
 */
router.get("/instructor/:id", getSessionReviewsByInstructorController);

router.use(restrictedToController("admin", "instructor"));

/**
 * @swagger
 * /api/v1/sessionReview:
 *   post:
 *     summary: Create a session review
 *     tags: [Session Reviews]
 *     description: Create a new session review (instructor/admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - studentId
 *             properties:
 *               sessionId:
 *                 type: string
 *               studentId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review created
 *       400:
 *         description: Validation error
 */
router.post("/", createSessionReviewController);

/**
 * @swagger
 * /api/v1/sessionReview/{id}:
 *   patch:
 *     summary: Update session review
 *     tags: [Session Reviews]
 *     description: Update a session review (instructor/admin only)
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
 *               rating:
 *                 type: number
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review updated
 *       404:
 *         description: Review not found
 *   delete:
 *     summary: Delete session review
 *     tags: [Session Reviews]
 *     description: Delete a session review (instructor/admin only)
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
 *         description: Review deleted
 *       404:
 *         description: Review not found
 */
router.route("/:id").patch(updateSessionReviewByIdController).delete(deleteSessionReviewByIdController);

export default router;
