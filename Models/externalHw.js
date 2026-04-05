import mongoose from "mongoose";
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
    isSubmitted:{
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
        name: { type: String },
        url: { type: String, },
    }],
    status:{
        type:String,
        enum:["Completed","Pending","Canceled","Late submission"],
        default:"Pending"
    },
    category: {
        type: String,
        enum: ["Essay", "Project", "Quiz", "Lab", "Presentation", "Other"],
        default:"project"
    },
   

    

},{timestamps:true})

externalHWSchema.pre("save" , function () {
    if(this.status === "Completed"){
        
        if(!this.submissionLinks || this.submissionLinks.length == 0){
           throw new Error("At least one submission link is required when marking as Completed");
        }

        this.isSubmitted = true;

        this.submissionDate = new Date();
        this.notes = `Great work submitted before due date ${this.dueDate}`;
        
        if(this.submissionDate > this.dueDate){
            this.status = "Late submission"
            this.notes = "submitted late"
        }

    }

     

    else if (this.status == "Pending"){
        this.submissionDate = undefined;
        this.notes = "Waiting for submission"
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
        this.status = "Completed";
        this.submissionDate = new Date();
        this.isSubmitted = true;
}


const ExternalHW = new mongoose.model("ExternalHW",externalHWSchema);

export default ExternalHW
