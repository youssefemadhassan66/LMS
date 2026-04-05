import express from "express";
import {
  getAllExternalHWController,
  getExternalHWByIdController,
  getMyExternalHWController,
  getMyExternalHWByIdController,
  getExternalHWByCourseController,
  createExternalHWController,
  updateExternalHWController,
  deleteExternalHWController,
  markExternalHWCompleteController,
} from "../Controllers/ExternalHwController.js";
import { protectionController as protectRoute, restrictedToController as restrictTo } from "../Controllers/AuthController.js";

const router = express.Router();

// ─── All routes require authentication ────────────────────────────────
router.use(protectRoute);

/**
 * @swagger
 * /api/v1/external-hw/my:
 *   get:
 *     summary: Get my external homework
 *     tags: [External Homework]
 *     description: Get all external homework assigned to the logged-in student
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of external homework
 */
router.get("/my", getMyExternalHWController);

/**
 * @swagger
 * /api/v1/external-hw/my/{id}:
 *   get:
 *     summary: Get my external homework by ID
 *     tags: [External Homework]
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
 *         description: External homework found
 *       404:
 *         description: Not found
 */
router.get("/my/:id", getMyExternalHWByIdController);

/**
 * @swagger
 * /api/v1/external-hw/course/{courseId}:
 *   get:
 *     summary: Get external homework by course ID
 *     tags: [External Homework]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of external homework for the course
 */
router.get("/course/:courseId", getExternalHWByCourseController);

/**
 * @swagger
 * /api/v1/external-hw:
 *   get:
 *     summary: Get all external homework
 *     tags: [External Homework]
 *     description: Get all external homework (admin/instructor only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all external homework
 */
router.get("/", restrictTo("admin", "instructor"), getAllExternalHWController);

/**
 * @swagger
 * /api/v1/external-hw:
 *   post:
 *     summary: Create external homework
 *     tags: [External Homework]
 *     description: Create a new external homework (admin/instructor only)
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
 *               - courseId
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               courseId:
 *                 type: string
 *               link:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: External homework created
 *       400:
 *         description: Validation error
 */
router.post("/", restrictTo("admin", "instructor"), createExternalHWController);

/**
 * @swagger
 * /api/v1/external-hw/{id}:
 *   get:
 *     summary: Get external homework by ID
 *     tags: [External Homework]
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
 *         description: External homework found
 *       404:
 *         description: Not found
 */
router.get("/:id", getExternalHWByIdController);

/**
 * @swagger
 * /api/v1/external-hw/{id}:
 *   patch:
 *     summary: Update external homework
 *     tags: [External Homework]
 *     description: Update an external homework (admin/instructor only)
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
 *               link:
 *                 type: string
 *     responses:
 *       200:
 *         description: External homework updated
 *       404:
 *         description: Not found
 */
router.patch("/:id", restrictTo("admin", "instructor"), updateExternalHWController);

/**
 * @swagger
 * /api/v1/external-hw/{id}:
 *   delete:
 *     summary: Delete external homework
 *     tags: [External Homework]
 *     description: Delete an external homework (admin/instructor only)
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
 *         description: External homework deleted
 *       404:
 *         description: Not found
 */
router.delete("/:id", restrictTo("admin", "instructor"), deleteExternalHWController);

/**
 * @swagger
 * /api/v1/external-hw/{id}/complete:
 *   patch:
 *     summary: Mark external homework as complete
 *     tags: [External Homework]
 *     description: Mark external homework as completed (student only)
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
 *         description: External homework marked as complete
 *       404:
 *         description: Not found
 */
router.patch("/:id/complete", restrictTo("student"), markExternalHWCompleteController);

export default router;
