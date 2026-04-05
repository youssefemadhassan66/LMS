import express from "express";
import { protectionController, restrictedToController } from "../Controllers/AuthController.js";

import {
  createTaskController,
  getAllTasksController,
  getTaskByIdController,
  getTasksBySessionIdController,
  getTasksByStudentIdController,
  getTasksStatsByStudentIdController,
  updateTaskByIdController,
  deleteTaskByIdController,
  updateTaskStatusController,
} from "../Controllers/TaskController.js";

const router = express.Router();

router.use(protectionController);

/**
 * @swagger
 * /api/v1/task:
 *   get:
 *     summary: Get all tasks
 *     tags: [Tasks]
 *     description: Retrieve all tasks
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tasks
 */
router.get("/", getAllTasksController);

/**
 * @swagger
 * /api/v1/task/session/{id}:
 *   get:
 *     summary: Get tasks by session ID
 *     tags: [Tasks]
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
 *         description: List of tasks for the session
 */
router.get("/session/:id", getTasksBySessionIdController);

/**
 * @swagger
 * /api/v1/task/student/{id}:
 *   get:
 *     summary: Get tasks by student ID
 *     tags: [Tasks]
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
 *         description: List of tasks for the student
 */
router.get("/student/:id", getTasksByStudentIdController);

/**
 * @swagger
 * /api/v1/task/student/{id}/stats:
 *   get:
 *     summary: Get task statistics by student ID
 *     tags: [Tasks]
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
 *         description: Task statistics for the student
 */
router.get("/student/:id/stats", getTasksStatsByStudentIdController);

/**
 * @swagger
 * /api/v1/task/{id}:
 *   get:
 *     summary: Get task by ID
 *     tags: [Tasks]
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
 *         description: Task found
 *       404:
 *         description: Task not found
 */
router.get("/:id", getTaskByIdController);

// Restricted routes (only instructor/admin)
router.use(restrictedToController("admin", "instructor"));

/**
 * @swagger
 * /api/v1/task:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     description: Create a new task (instructor/admin only)
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
 *               - sessionId
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               sessionId:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date
 *               assignedTo:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Task created
 *       400:
 *         description: Validation error
 */
router.post("/", createTaskController);

/**
 * @swagger
 * /api/v1/task/{id}:
 *   patch:
 *     summary: Update task
 *     tags: [Tasks]
 *     description: Update a task (instructor/admin only)
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
 *               dueDate:
 *                 type: string
 *     responses:
 *       200:
 *         description: Task updated
 *       404:
 *         description: Task not found
 */
router.patch("/:id", updateTaskByIdController);

/**
 * @swagger
 * /api/v1/task/{id}/status:
 *   patch:
 *     summary: Update task status only
 *     tags: [Tasks]
 *     description: Update only the status of a task (instructor/admin only)
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
 *                 enum: [pending, in_progress, completed, overdue]
 *     responses:
 *       200:
 *         description: Task status updated
 *       404:
 *         description: Task not found
 */
router.patch("/:id/status", updateTaskStatusController);

/**
 * @swagger
 * /api/v1/task/{id}:
 *   delete:
 *     summary: Delete task
 *     tags: [Tasks]
 *     description: Delete a task (instructor/admin only)
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
 *         description: Task deleted
 *       404:
 *         description: Task not found
 */
router.delete("/:id", deleteTaskByIdController);

export default router;
