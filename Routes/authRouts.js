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
router.get('/logout',logoutController)


// Protection 
router.use(protectionController);
router.post('/refresh',RefreshController);

export default router












