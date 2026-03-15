import mongoose from "mongoose";
import validator, { trim } from 'validator'
import {ComparePasswordHelper,hashPasswordHelper} from "../Utilities/HashHelper.js"
import crypto from 'crypto'
import { type } from "os";
import { kMaxLength } from "buffer";
import { compare } from "bcryptjs";

const schema = mongoose.Schema

const userSchema = new schema({
    FullName:{
        type:string,
        required:true,
        trim:true,
        validator:{
            validator(value){
                return validator.isAlpha(value);
            },
            message:"Invalid Name , Name should only contain letters"
        }
    },
    UserName:{
        type:String,
        required:true,
        maxlength:[30,"'User name must be less than 30 characters "],
        minlength:[5,"User name must be more than 3 characters "],
        unique:true
    },
    Email:{
         type:String,
        required:true,
        unique:true,
        lowercase:true,
        validator: {
            validator(value){
                return validator.isEmail(value)
            },
            message:"Invalid Email"
        }
    },
    password:{
        type:String,
        required:true,
        minlength:[8,"Password must be at least 8 characters"],
        select:false        
    },
    role:{
        type:String,
        required:true,
        enum:["instructor", "student","parent","admin"],
    },
    avatar:{
        type:string
    },
    isActive:{
        type:Boolean,
        default:true
    },
    refreshToken: 
    {
      type:String,
      select:false
    },
    refreshTokenExpire:{
       type:Date,
      select:false
    },
 

},{timestamps:true});


userSchema.pre(/^find/,function(){
    this.find({isActive:{ $ne:false } } );
})


userSchema.pre('save',async function(){
    if(!this.isModified("password")){
       return
    }
    this.password = hashPasswordHelper(this.password)
})


userSchema.methods.MatchUserPassword = async function (CandidatePassword) {
    return ComparePasswordHelper(CandidatePassword,this.password);
}





const User =  mongoose.model("User",userSchema);

export default User;