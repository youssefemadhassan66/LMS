import mongoose from "mongoose";
import validator from 'validator'
import {ComparePasswordHelper,hashPasswordHelper} from "../Utilities/HashHelper.js"


const schema = mongoose.Schema

const userSchema = new schema({
    FullName:{
        type:string,
        required:true,
        trim:true,
        validate:{
            validate(value){
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
        validate: {
            validate(value){
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
        type:String
    },
    isActive:{
        type:Boolean,
        default:true
    },
},{timestamps:true});


userSchema.pre(/^find/,function(){
    this.find({isActive:{ $ne:false } } );
})


userSchema.pre('save',async function(){
    if(!this.isModified("password")){
       return
    }
    this.password = await hashPasswordHelper(this.password)
})


userSchema.methods.MatchUserPassword = async function (CandidatePassword) {
    return await ComparePasswordHelper(CandidatePassword,this.password);
}





const User =  mongoose.model("User",userSchema);

export default User;