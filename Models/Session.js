import mongoose from "mongoose";
import validator from "validator";

const sessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    minlength: [5, "Session title have to more than 5 letters"],
  },
  description:{
    type:String,
    required:true,
    minlength: [5, "Session title have to more than 5 letters"],
  },
  recapVideoLinks:[ {
    title : {type: String},
    link : {type: String},
  }],
  attachmentsLinks: [
    {
      title:{type:String},
      attachmentLink: {
        String: true,
      },
    },
  ],
  student:{
    instructor: {
    type: mongoose.Schema.ObjectId(),
    ref: "User",
    required:true,
    },
  },
  date:{
    type:Date,
    required:true,
  },
  StudentAttend:{
    type: Boolean,
  },
},{timestamps:true});




const Session = mongoose.model("Session",sessionSchema);

export default Session;