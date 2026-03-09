import express from  "express"
import path from 'path'
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express();

app.use("/uploads", express.static("uploads"))
app.use(express.json());
app.use(express.urlencoded({ extended: true }))





export default app 