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
  updateTaskStatusController
} from "../Controllers/TaskController.js";

const router = express.Router();

router.use(protectionController);


router.get("/", getAllTasksController);

router.get("/session/:id", getTasksBySessionIdController);
router.get("/student/:id", getTasksByStudentIdController);
router.get("/student/:id/stats", getTasksStatsByStudentIdController);

router.get("/:id", getTaskByIdController);

// Restricted routes (only instructor/admin)
router.use(restrictedToController("admin", "instructor"));

// create task
router.post("/", createTaskController);

// update task
router.patch("/:id", updateTaskByIdController);

// update ONLY status 
router.patch("/:id/status", updateTaskStatusController);

// delete task
router.delete("/:id", deleteTaskByIdController);

export default router;