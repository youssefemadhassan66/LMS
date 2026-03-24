import express from "express";

import {    signUpController,
    loginController,
    RefreshController,
    logoutController,
    protectionController,
    restrictedToController,
} from '../Controllers/AuthController.js'


const router = express.Router()

router.post('/signup',signUpController)
router.post('/login',loginController)
router.post('/refresh',RefreshController);

router.use(protectionController);

router.get('/logout',logoutController)

export default router












