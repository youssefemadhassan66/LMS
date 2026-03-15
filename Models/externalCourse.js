import mongoose from "mongoose";
import validator from "validator"

const externalCourseSchema = new mongoose.Schema({
    teacher:{
        type:String
    },
    Subject:{
        type:String,
        required:true
    },
    CreatedBy : {
        type:mongoose.Schema.ObjectId,
        ref:"User",
    },
    student:{
        type:mongoose.Schema.ObjectId,
        ref:"User",
    },
    color: { type: String, default: '#6366f1' }

},{timestamps:true})

const ExternalCourse = new mongoose.model("ExternalCourse",externalCourseSchema);

export default ExternalCourse
