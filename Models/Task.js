import mongoose from "mongoose";
import validator from "validator";


const TaskSchema = new mongoose.Schema({

    title:{
        type:String,
        required:true,
        unique:true
    },
    description:{
        type:true,
        required:true,
    },
    taskLink:[{
        title:{type:String},
        link:{type:String}
    }],
    dueDate:{
        type:Date,
        required:true,
    },
    session:{
        type:mongoose.Schema.ObjectId,
        ref:"Session",
        unique:true
    },
    student:{
        type:mongoose.Schema.ObjectId,
        ref:"User",
        required:true,

    },
    status:{
        type:String,
        enum:["pending","Done"],
        default:"pending"
    }
    
},{timestamps:true})


const Task = mongoose.model("Task",TaskSchema);

export default Task;