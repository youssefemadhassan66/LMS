import mongoose from "mongoose";
import validator from "validator"

const externalCourseSchema = new mongoose.Schema({
    teacher:{
        type:String
    },
    subject:{
        type:String,
        required:true
    },
    createdBy : {
        type:mongoose.Schema.ObjectId,
        ref:"User",
    },
    student:{
        type:mongoose.Schema.ObjectId,
        ref:"User",
        required:true
    },
    color: { type: String, }

},{timestamps:true})


externalCourseSchema.pre('save' , async function () {
    if (!this.color) {
        const randomColor ="#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");

        this.color = randomColor;
   }

  next();
    
})

const ExternalCourse = new mongoose.model("ExternalCourse",externalCourseSchema);


export default ExternalCourse
