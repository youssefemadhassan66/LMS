import express from "express";
import { createUserController, DeleteUserController, getAllUsersController, getPendingApprovalsController, getUserController, reviewUserApprovalController, UpdateUserController } from "../Controllers/UserController.js";
import { protectionController, restrictedToController } from "../Controllers/AuthController.js";
import { validate } from "../Middleware/validate.js";
import { adminCreateUserSchema, adminUpdateUserSchema } from "../Validation/userValidation.js";

const router = express.Router();

router.use(protectionController);
router.use(restrictedToController("admin"));

router.get("/", getAllUsersController);

router.post("/", validate(adminCreateUserSchema), createUserController);

router.get("/pending-approvals", getPendingApprovalsController);
router.patch("/:id/approval", reviewUserApprovalController);

router.route("/:id").get(getUserController).patch(validate(adminUpdateUserSchema), UpdateUserController).delete(DeleteUserController);

export default router;
