import mongoose from "mongoose";
import validator from "validator"

const SessionReviewSchema = new mongoose.Schema({   
    session :{
        type: mongoose.Schema.ObjectId,
        ref :"Session",
        required:true
    },
    Student :{
        type: mongoose.Schema.ObjectId,
        ref :"User",
        required:true
    },  
    Instructor :{
        type: mongoose.Schema.ObjectId,
        ref :"User",
        required:true
    },  

    notes:{
        type:String,
    },
    Behavior:{
        type:Number,
        min:0,
        max:5,
        required:true
    },
    underStanding:{
        type:Number,
        min:0,
        max:5,
        required:true
    },
    participation:{
        type:Number,
        min:0,
        max:5,
        required:true
    },
    overAllRating:{
        type:Number
    }
},{timestamps:true})

 const SessionReview = mongoose.model("SessionReview",SessionReviewSchema);
 
 export default SessionReview
 