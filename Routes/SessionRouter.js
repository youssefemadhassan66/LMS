import express from "express";
import { protectionController, restrictedToController } from "../Controllers/AuthController.js";
import {
  deleteSessionByIdController,
  UpdateSessionByIdController,
  getSessionByIdController,
  getSessionsByStudentController,
  getSessionsByInstructorController,
  getAllSessionsController,
  CreateSessionController,
  getMyAllSessionController,
  getMySessionByIdController,

} from "../Controllers/SessionController.js";

const router = express.Router();

router.use(protectionController);

router.get("/me/:id",restrictedToController("student" , "parent",getMySessionByIdController));

router.get("/me/",restrictedToController("student" , "parent",getMyAllSessionController));


router.use(restrictedToController("admin", "instructor"));

router.get("/", getAllSessionsController);

router.get("/student/:id", getSessionsByStudentController);

router.get("/instructor/:id", getSessionsByInstructorController);

router.get("/:id", getSessionByIdController);

router.post("/", CreateSessionController);

router.route("/:id").patch(UpdateSessionByIdController).delete(deleteSessionByIdController);

export default router;
