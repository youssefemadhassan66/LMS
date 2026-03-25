import express from "express";
import { protectionController,restrictedToController } from "../Controllers/AuthController";
import {
        deleteSessionByIdController,
        UpdateSessionByIdController,
        getSessionByIdController,
        getSessionsByStudentController,
        getSessionsByInstructorController,
        getAllSessionsController,
        CreateSessionController
}from '../Controllers/SessionController.js'


const router = express.Router();

router.use(protectionController);

router.get("/:id",getSessionByIdController);
router.get("/",getAllSessionsController);
router.get("/student/:id",getSessionsByStudentController)
router.get("/instructor/:id",getSessionsByInstructorController)


router.use(restrictedToController("admin","instructor"));


router.post("/",CreateSessionController);
router.route("/:id")
.patch(UpdateSessionByIdController)
.delete(deleteSessionByIdController)


