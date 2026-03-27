import mongoose, { model } from "mongoose";
import validator from "validator";
import Task from "./Task";

const SubmissionSchema = mongoose.Schema({
    task:{
        type:mongoose.Schema.ObjectId,
        ref:"Task",
    },
    student:{
        type:mongoose.Schema.ObjectId,
        ref:"User"
    },
    SubmissionDate:{
        type:Date,
        default:Date.now
    },
    Task_links:[{
        name:{type:String, required:true},
        url:{type:String, required:true}
    }],

    note:{
        type:String
    },
    status:{
        type:String,
        enum:["Completed","Pending","Reviewed","Resubmitted","Late submission"],
        default:"Pending"
    },
    review:{
        score:{
            type:Number,
            min:0,
            max:10
        },
        comment:{type:String},
        reviewAt:{type:Date},
        rating:{
            type:String,
            enum:["Full mark" ,"Excellent","Very Good", "Good" , "Fair"]
        }
    }

},{timestamps:true});


// Pre hooks 
SubmissionSchema.pre(/^find/,function (next) {
    this.populate('Task','title dueDate');
    next();
})


SubmissionSchema.pre('save',async function (next) {

    const task = await mongoose.model('Task').findById(this.task)
    
    
    if (this.status === "Completed" && (!this.Task_links || this.Task_links.length === 0)) {
        const error = new Error("At least one submission link is required when marking as Completed");
        return next(error);
    }
    
    if(task){
       
        if (this.status === "Completed"){
            this.SubmissionDate = new Date();
            this.note = "Great job" 
            if(this.SubmissionDate > task.dueDate ){
            this.status = 'Late submission'
            this.note = "Late submission"
        }
        }
        else if (this.status === "Pending"){
            this.SubmissionDate = undefined;
            this.note = "Waiting for submission !"
        }

        else if (this.status === "Resubmitted"){
            this.SubmissionDate = undefined;
            this.note = "Please review the task and submit again !"
        }
       
        // Only set rating if score exists
        if (this.review.score !== undefined && this.review.score !== null) {
            if (this.review.score >= 0 &&  this.review.score < 5){
                this.review.rating = "Fair"
            }
            if(this.review.score >= 5 &&  this.review.score < 7){
                this.review.rating = "Good"
            }
            if(this.review.score >= 7 &&  this.review.score <= 9){
                this.review.rating = "Excellent"
            }
            if(this.review.score > 9){
                this.review.rating = "Full mark"
            }
        }
        
    }
    next()
})

//Methods  
SubmissionSchema.methods.markComplete = async function () {
    this.status = 'completed'
    this.SubmissionDate = new Date() 
    const task = await mongoose.model("Task").findById(this.task);
        if(this.SubmissionDate > task.dueDate ){
            this.status = 'Late submission'
            this.note = "Late submission"
        }
    return this.save()
}



const Submission = mongoose.model("Submission",SubmissionSchema);

export default Submission 
