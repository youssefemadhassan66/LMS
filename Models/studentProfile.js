import mongoose from "mongoose";

const studentProfileSchema = new mongoose.Schema({
    user:{
        type:mongoose.Schema.ObjectId,
        ref:"User",
        required:true,
    },
    parents:[
        {
            type:mongoose.Schema.ObjectId,
            ref:"User",
            required:true,
        }
    ],
    grade:{
        type:String
    },
    notes:{
        type:String
    },

},{timestamps:true});


const StudentProfile = new mongoose.model("StudentProfile",studentProfileSchema);

export default StudentProfile;

