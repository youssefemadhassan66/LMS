import express from  "express"
import path from 'path'
import cookieParser from "cookie-parser"

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express();
import GlobalErrorHandler from './Middleware/GlobalErrorHandler.js'
import AppErrorHelper from "./Utilities/AppErrorHelper.js";
import authRouter from "./Routes/authRouts.js"
import userRouter from './Routes/userRouts.js'
import StudentProfileRouter from "./Routes/StudentProfileRouter.js";
import SessionRouter from './Routes/SessionRouter.js';
import TaskRouter from './Routes/TaskRouter.js'
app.use(cookieParser())

app.use("/uploads", express.static("uploads"))
app.use(express.json());
app.use(express.urlencoded({ extended: true }))



app.use('/api/v1/auth',authRouter);
app.use('/api/v1/user',userRouter);
app.use('/api/v1/StudentProfile',StudentProfileRouter);
app.use('/api/v1/session',SessionRouter);
app.use('/api/v1/task', TaskRouter);



app.all(/.*/, (req,res,next)=>{
    next(new AppErrorHelper (`Can't find ${req.originalUrl} on this server!`, 404))
})

app.use(GlobalErrorHandler)

export default app 