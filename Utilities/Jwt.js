import { jwt } from "jsonwebtoken";

 const SignAccessToken = async (user) => {

    try{
        const payload = {id:user._id,role:user.role};
        const Secret = process.env.JWT_TOKEN_SECRET;
        const options = {expiresIn: process.env.JWT_TOKEN_EXPIRES_IN };
        await jwt.sign(payload,Secret,options)

    }
    catch(err){
        console.log("Error while")
    }
    
 }