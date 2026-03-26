import express from "express";
import {  
    getStudentProfileController,
    updateStudentProfileController,
    createStudentProfileController,
} from "../Controllers/StudentProfileController.js";
import { protectionController,restrictedToController } from "../Controllers/AuthController.js";

const router = express.Router();

router.use(protectionController,restrictedToController("admin","parent","student"));


router.get("/id",getStudentProfileController)


router.route("/:id")
.post(createStudentProfileController)
.patch(updateStudentProfileController)


export default router;
