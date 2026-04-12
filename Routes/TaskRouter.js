import express from "express";
import { protectionController, restrictedToController } from "../Controllers/AuthController.js";

import {
  createTaskController,
  getAllTasksController,
  getAllMyTasksController,
  getTaskByIdController,
  getTasksBySessionIdController,
  getTasksByStudentIdController,
  getTasksStatsByStudentIdController,
  getMyTasksStatsController,
  getMyTaskByIdController,
  updateTaskByIdController,
  deleteTaskByIdController,
  updateTaskStatusController,
} from "../Controllers/TaskController.js";

const router = express.Router();

router.use(protectionController);




router.get("/me", restrictedToController("student","parent") ,  getAllMyTasksController);

router.get("/me/:id",restrictedToController("student","parent") ,  getMyTaskByIdController);

router.get("/:id", getTaskByIdController);

router.use(restrictedToController("admin", "instructor"));

router.get("/student/:id/stats", getTasksStatsByStudentIdController);

router.get("/student/:id", getTasksByStudentIdController);

router.get("/:id", getTaskByIdController);

router.get("/", getAllTasksController);

router.get("/session/:id", getTasksBySessionIdController);

router.post("/", createTaskController);

router.patch("/:id", updateTaskByIdController);

router.patch("/:id/status", updateTaskStatusController);

  
router.delete("/:id", deleteTaskByIdController);

export default router;
