import express from "express";
import { protectionController, restrictedToController } from "../Controllers/AuthController.js";
import {
  deleteSessionByIdController,
  UpdateSessionByIdController,
  getSessionByIdController,
  getSessionsByStudentController,
  getSessionsByInstructorController,
  getAllSessionsController,
  CreateSessionController,
} from "../Controllers/SessionController.js";

const router = express.Router();

router.use(protectionController);

/**
 * @swagger
 * /api/v1/session:
 *   get:
 *     summary: Get all sessions
 *     tags: [Sessions]
 *     description: Retrieve all sessions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of sessions
 */
router.get("/", getAllSessionsController);

/**
 * @swagger
 * /api/v1/session/student/{id}:
 *   get:
 *     summary: Get sessions by student ID
 *     tags: [Sessions]
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
 *         description: List of sessions for the student
 */
router.get("/student/:id", getSessionsByStudentController);

/**
 * @swagger
 * /api/v1/session/instructor/{id}:
 *   get:
 *     summary: Get sessions by instructor ID
 *     tags: [Sessions]
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
 *         description: List of sessions for the instructor
 */
router.get("/instructor/:id", getSessionsByInstructorController);

/**
 * @swagger
 * /api/v1/session/{id}:
 *   get:
 *     summary: Get session by ID
 *     tags: [Sessions]
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
 *         description: Session found
 *       404:
 *         description: Session not found
 */
router.get("/:id", getSessionByIdController);

router.use(restrictedToController("admin", "instructor"));

/**
 * @swagger
 * /api/v1/session:
 *   post:
 *     summary: Create a new session
 *     tags: [Sessions]
 *     description: Create a new session (instructor/admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - date
 *               - instructorId
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               duration:
 *                 type: number
 *               instructorId:
 *                 type: string
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Session created
 *       400:
 *         description: Validation error
 */
router.post("/", CreateSessionController);

/**
 * @swagger
 * /api/v1/session/{id}:
 *   patch:
 *     summary: Update session
 *     tags: [Sessions]
 *     description: Update a session (instructor/admin only)
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session updated
 *       404:
 *         description: Session not found
 *   delete:
 *     summary: Delete session
 *     tags: [Sessions]
 *     description: Delete a session (instructor/admin only)
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
 *         description: Session deleted
 *       404:
 *         description: Session not found
 */
router.route("/:id").patch(UpdateSessionByIdController).delete(deleteSessionByIdController);

export default router;
