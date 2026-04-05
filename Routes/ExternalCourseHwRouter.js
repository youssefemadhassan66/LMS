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
import { protectRoute, restrictTo } from "../Middlewares/authMiddleware.js";

const router = express.Router();

// ─── All routes require authentication ────────────────────────────────
router.use(protectRoute);

// ─── Student / Parent routes ──────────────────────────────────────────
router.get("/my",     getMyExternalHWController);        // GET /api/v1/external-hw/my
router.get("/my/:id", getMyExternalHWByIdController);    // GET /api/v1/external-hw/my/:id

// ─── Course-specific HWs ──────────────────────────────────────────────
router.get("/course/:courseId", getExternalHWByCourseController); // GET /api/v1/external-hw/course/:courseId

// ─── Admin / Teacher only routes ──────────────────────────────────────
router.get(  "/",    restrictTo("admin", "instructor"), getAllExternalHWController);   // GET    /api/v1/external-hw
router.post( "/",    restrictTo("admin", "instructor"), createExternalHWController);  // POST   /api/v1/external-hw

router.get("/:id", getExternalHWByIdController);                                        // GET    /api/v1/external-hw/:id
router.patch( "/:id", restrictTo("admin", "instructor"), updateExternalHWController);         // PATCH  /api/v1/external-hw/:id
router.delete("/:id", restrictTo("admin", "instructor"), deleteExternalHWController);         // DELETE /api/v1/external-hw/:id

// ─── Mark as complete (student only) ─────────────────────────────────
router.patch("/:id/complete", restrictTo("student"), markExternalHWCompleteController);    // PATCH  /api/v1/external-hw/:id/complete

export default router;