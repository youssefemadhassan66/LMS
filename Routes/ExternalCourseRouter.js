import express from "express";
import { protectionController, restrictedToController } from "../Controllers/AuthController.js";
import {
  CreateExternalCourseController,
  getMyExternalCourseByIdController,
  getMyExternalCoursesController,
  getAllExternalCoursesController,
  getExternalCourseByIdController,
  getExternalCoursesByStudentController,
  updateExternalCourseController,
  deleteExternalCourseController,
} from "../Controllers/ExternalCourseController.js";

const router = express.Router();

router.use(protectionController);

router.get("/my-course", restrictedToController("student", "parent"), getMyExternalCoursesController);

router.get("/my-course/:id", restrictedToController("student", "parent"), getMyExternalCourseByIdController);

router.use(restrictedToController("admin", "instructor", "parent"));

router.get("/", getAllExternalCoursesController);

router.post("/", CreateExternalCourseController);

router.get("/:id/student", getExternalCoursesByStudentController);
router.get("/:id", getExternalCourseByIdController);
router.patch("/:id", updateExternalCourseController);
router.delete("/:id", deleteExternalCourseController);

export default router 