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

router.use(protectionController);

router.get("/me", restrictedToController("parent" ,"student") , getMyStudentProfileController);

router.get("/me/:id", restrictedToController("parent" ,"student") , getMyStudentProfileByIdController);

router.get("/:id", validate(profileIdSchema, "params"), getStudentProfileController);

router
  .route("/:id" , restrictedToController("parent" ,"student"))
  .post(validate(profileIdSchema, "params"), validate(createStudentProfileSchema), createStudentProfileController)
  .patch(validate(profileIdSchema, "params"), validate(updateStudentProfileSchema), updateStudentProfileController);


router.use(restrictedToController("admin"))


router.get("/all", getAllStudentProfileController);

 

export default router;
