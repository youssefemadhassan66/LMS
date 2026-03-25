import express from "express";
import {  
    getStudentProfileController,
    updateStudentProfileController,
    createStudentProfileController,
} from "../Controllers/StudentProfileController.js";
import { protectionController,restrictedToController } from "../Controllers/AuthController.js";

const router = express.Router();

router.use(protectionController);


router.get("/id",getStudentProfileController)


router.use(restrictedToController("admin","parent"));

router.route("/:id")
.post(createStudentProfileController)
.patch(updateStudentProfileController)


export default router;
