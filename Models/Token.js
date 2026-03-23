import mongoose from "mongoose";

const RefreshTokenSchema = new mongoose.Schema({
    tokenId:{
        type:String,
        required:true
    },
    userId:{
        type:mongoose.Schema.ObjectId,
        ref:"User",
        required:true
    },
    expiresAt:{
        type:Date,
        required:true
    },
    tokenHash:{
        type:String,
        required:true
    }
},{timestamps:true})

const RefreshToken =  mongoose.model("RefreshToken",RefreshTokenSchema);
export default RefreshToken

