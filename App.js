import express from  "express"
import path from 'path'
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express();
import authRouter from "./Routes/authRouts.js"
import GlobalErrorHandler from './Middleware/GlobalErrorHandler.js'
import CatchAsync from "./Utilities/CatchAsync.js";
import AppErrorHelper from "./Utilities/AppErrorHelper.js";
import cookieParser from "cookie-parser"



app.use(cookieParser())

app.use("/uploads", express.static("uploads"))
app.use(express.json());
app.use(express.urlencoded({ extended: true }))



app.use('/api/v1/auth',authRouter);


app.all(/.*/, (req,res,next)=>{
    next(new AppErrorHelper (`Can't find ${req.originalUrl} on this server!`, 404))
})

app.use(GlobalErrorHandler)

export default app 