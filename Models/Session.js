import mongoose from "mongoose";
import AppErrorHelper from "../Utilities/AppErrorHelper.js";


const sessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    minlength: [4, "Session title have to more than 4 letters"],
    unique:true
  },

  description:{
    type:String,
    required:true,
    minlength: [3, "Session title have to more than 3 letters"],
  },
  recapVideoLinks:[ {
    title : {type: String},
    link : {type: String},
  }],
  attachmentsLinks: [
    {
      title:{type:String},
      attachmentLink: {
        type :String,
      },
    },
  ],
  studentId:{
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required:true,
  },
    instructorId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required:true,
    },
  date:{
    type:Date,
    required:true,
  },
  StudentAttended:{
    type: Boolean,
    default:true
  },
    notes:{
    type:String
  },
  summary:{
    type:String
  },
  status:{
    type:String,
    enum:["pending","completed","canceled","student canceled"],
    default:"pending"
  }
},{timestamps:true});


// sessionSchema.pre('save',async function(next){

//   if(new Date(this.date) < new Date()){
//     throw  new AppErrorHelper("Session Date Must be in the future")
//   }

//   next()
// })




const Session = mongoose.model("Session",sessionSchema);

export default Session;