import express from "express";
import {  
    getStudentProfileController,
    updateStudentProfileController,
    createStudentProfileController,
    getMyStudentProfileController,
    getMyStudentProfileByIdController,
    getAllStudentProfileController
} from "../Controllers/StudentProfileController.js";
import { protectionController,restrictedToController } from "../Controllers/AuthController.js";
import { validate } from "../Middleware/validate.js";
import {
    createStudentProfileSchema,
    updateStudentProfileSchema,
    profileIdSchema
} from "../Validation/studentProfileValidation.js";

const router = express.Router();

router.use(protectionController,restrictedToController("admin","parent","student"));

router.get("/me",getMyStudentProfileController);
router.get("/me/:id",getMyStudentProfileByIdController);
router.get("/all",getAllStudentProfileController);

router.get("/:id", validate(profileIdSchema, "params"), getStudentProfileController);


router.route("/:id")
.post(validate(profileIdSchema, "params"), validate(createStudentProfileSchema), createStudentProfileController)
.patch(validate(profileIdSchema, "params"), validate(updateStudentProfileSchema), updateStudentProfileController)


export default router;
