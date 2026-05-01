import express from "express";
import { protectionController, restrictedToController } from "../Controllers/AuthController.js";
import {
  createExamController,
  getMyExamsController,
  getMyExamByIdController,
  getAllExamsController,
  getExamByIdController,
  getExamsByStudentController,
  updateExamController,
  deleteExamController,
} from "../Controllers/ExamController.js";

const router = express.Router();

router.use(protectionController);

router.get("/my-exams", restrictedToController("student", "parent"), getMyExamsController);
router.get("/my-exams/:id", restrictedToController("student", "parent"), getMyExamByIdController);

router.use(restrictedToController("admin", "instructor", "parent"));

router.get("/", getAllExamsController);
router.post("/", createExamController);
router.get("/:id/student", getExamsByStudentController);
router.get("/:id", getExamByIdController);
router.patch("/:id", updateExamController);
router.delete("/:id", deleteExamController);

export default router;
