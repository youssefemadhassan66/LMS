import express from "express";

import { protectionController, restrictedToController } from "../Controllers/AuthController.js";

import {
  createSessionReviewController,
  getAllSessionReviewsController,
  getAllMySessionReviewsController,
  getMySessionReviewController,
  getMySessionReviewStatsController,
  getSessionReviewsByStudentController,
  getSessionReviewsByInstructorController,
  getSessionReviewsBySessionController,
  updateSessionReviewByIdController,
  deleteSessionReviewByIdController,
  getStudentReviewStatsController,
} from "../Controllers/SessionReviewController.js";

const router = express.Router();

router.use(protectionController);


router.get("/", getAllSessionReviewsController);

router.get("/session/:id", getSessionReviewsBySessionController);

router.get("/me", getAllMySessionReviewsController);
router.get("/me/stats", getMySessionReviewStatsController);
router.get("/me/:id", getMySessionReviewController);

router.use(restrictedToController("admin", "instructor"));

router.get("/student/:id", getSessionReviewsByStudentController);
router.get("/student/:id/stats", getStudentReviewStatsController);
router.get("/instructor/:id", getSessionReviewsByInstructorController);


router.post("/", createSessionReviewController);


router.route("/:id").patch(updateSessionReviewByIdController).delete(deleteSessionReviewByIdController);

export default router;
