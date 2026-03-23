import express from "express";
import {
    getAllUsersController,
    getUserController,
    UpdateUserController,
    DeleteUserController,
    createUserController
} 
from '../Controllers/UserController.js'
import { protectionController,restrictedToController } from "../Controllers/AuthController.js";

const router = express.Router()


router.use(protectionController);
router.use(restrictedToController("Admin"));

router.get("/",getAllUsersController);
router.post("/",createUserController);

router.route("/:id")
.get(getAllUsersController)
.patch(UpdateUserController)
.delete(DeleteUserController);



