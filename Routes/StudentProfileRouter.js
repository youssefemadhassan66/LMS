import express from "express";
import {
  getStudentProfileController,
  updateStudentProfileController,
  createStudentProfileController,
  getMyStudentProfileController,
  getMyStudentProfileByIdController,
  getAllStudentProfileController,
} from "../Controllers/StudentProfileController.js";
import { protectionController, restrictedToController } from "../Controllers/AuthController.js";
import { validate } from "../Middleware/validate.js";
import { createStudentProfileSchema, updateStudentProfileSchema, profileIdSchema } from "../Validation/studentProfileValidation.js";

const router = express.Router();

router.use(protectionController, restrictedToController("admin", "parent", "student"));

/**
 * @swagger
 * /api/v1/StudentProfile/me:
 *   get:
 *     summary: Get my student profile
 *     tags: [Student Profile]
 *     description: Get the logged-in user's student profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student profile found
 *       404:
 *         description: Profile not found
 */
router.get("/me", getMyStudentProfileController);

/**
 * @swagger
 * /api/v1/StudentProfile/me/{id}:
 *   get:
 *     summary: Get student profile by ID (accessible to me)
 *     tags: [Student Profile]
 *     description: Get a specific student profile by ID
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
 *         description: Profile found
 *       404:
 *         description: Profile not found
 */
router.get("/me/:id", getMyStudentProfileByIdController);

/**
 * @swagger
 * /api/v1/StudentProfile/all:
 *   get:
 *     summary: Get all student profiles
 *     tags: [Student Profile]
 *     description: Get all student profiles (admin/parent only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of student profiles
 */
router.get("/all", getAllStudentProfileController);

/**
 * @swagger
 * /api/v1/StudentProfile/{id}:
 *   get:
 *     summary: Get student profile by ID
 *     tags: [Student Profile]
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
 *         description: Profile found
 *       404:
 *         description: Profile not found
 */
router.get("/:id", validate(profileIdSchema, "params"), getStudentProfileController);

/**
 * @swagger
 * /api/v1/StudentProfile/{id}:
 *   post:
 *     summary: Create student profile
 *     tags: [Student Profile]
 *     description: Create a new student profile
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
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               grade:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Profile created
 *       400:
 *         description: Validation error
 */
router
  .route("/:id")
  .post(validate(profileIdSchema, "params"), validate(createStudentProfileSchema), createStudentProfileController)

  /**
   * @swagger
   * /api/v1/StudentProfile/{id}:
   *   patch:
   *     summary: Update student profile
   *     tags: [Student Profile]
   *     description: Update an existing student profile
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
   *               firstName:
   *                 type: string
   *               lastName:
   *                 type: string
   *               grade:
   *                 type: string
   *               address:
   *                 type: string
   *     responses:
   *       200:
   *         description: Profile updated
   *       404:
   *         description: Profile not found
   */
  .patch(validate(profileIdSchema, "params"), validate(updateStudentProfileSchema), updateStudentProfileController);

export default router;
