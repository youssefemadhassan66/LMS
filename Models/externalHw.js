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
    submissionDate:{
        type:Date
    },
    IsSubmitted:{
        type:Boolean,
        default:false,
    },
    notes:{
        type:String
    },

    externalCourse:{
        type:mongoose.Schema.ObjectId,
        ref:"ExternalCourse",
    },
    submissionLinks : [{
        name: { type: String, required: true },
        url: { type: String, required: true },
    }],
    status:{
        type:String,
        enum:["Completed","Pending","Canceled","Late submission"],
        default:"Pending"
    },

    

},{timestamps:true})

externalHWSchema.pre("save" , function () {
    if(this.status === "Completed"){
        this.IsSubmitted = true;
        
    }
    
} )

externalHWSchema.pre(/^find/,function(){
    this.populate({
        path:"externalCourse" , select:"student subject teacher",
        populate:{
            path:"student" , select:"FullName UserName "
        }
    })
})

externalHWSchema.methods.markComplete = async function () {
        this.Status == "Completed"
        this.SubmissionDate = new Date();
        this.IsSubmitted = true
}


const ExternalHW = new mongoose.model("ExternalHW",externalHWSchema);

export default ExternalHW
