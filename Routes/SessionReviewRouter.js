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
  getStudentReviewStatsController
} from "../Controllers/SessionReviewController.js";

const router = express.Router();

router.use(protectionController);


// Get all reviews
router.get("/", getAllSessionReviewsController);

// Get reviews by session
router.get("/session/:id", getSessionReviewsBySessionController);

// Get reviews by student
router.get("/student/:id", getSessionReviewsByStudentController);

// Get student stats 
router.get("/student/:id/stats", getStudentReviewStatsController);

// Get reviews by instructor
router.get("/instructor/:id", getSessionReviewsByInstructorController);

//  Restricted routes (only instructor/admin can create/update/delete)
router.use(restrictedToController("admin", "instructor"));

// Create review
router.post("/", createSessionReviewController);

// Update & delete
router.route("/:id")
  .patch(updateSessionReviewByIdController)
  .delete(deleteSessionReviewByIdController);

export default router;
