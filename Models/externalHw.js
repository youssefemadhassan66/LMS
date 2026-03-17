import mongoose from "mongoose";
import validator from "validator"

const externalHWSchema = new mongoose.Schema({
    title:{
        type:String
    },
    description:{
        type:String
    },
    dueDate:{
        type:Date,
    },
    Status:{
        type:String,
        enum:["Finished","Pending","Canceled"],
        default:"Pending"
    },
    SubmissionDate:{
        type:Date
    },
    IsSubmitted:{
        type:Boolean,
    },
    notes:{
        type:String
    },

    externalCourse:{
        type:mongoose.Schema.ObjectId,
        ref:"ExternalCourse",
    },
    Status:{
        type:String,
        enum:["Completed","Pending","Canceled","Late submission"],
        default:"Pending"
    },

    

},{timestamps:true})


externalHWSchema.methods.markComplete = async function () {
        this.Status == "Completed"
        this.SubmissionDate = new Date();
        this.IsSubmitted = true
}


const ExternalHW = new mongoose.model("ExternalHW",externalHWSchema);

export default ExternalHW
