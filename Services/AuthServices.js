import User from "../Models/User.js";
import Token from '../Models/Token.js'
import AppErrorHelper from "../Utilities/AppErrorHelper";
import { ComparePasswordHelper , hashPasswordHelper } from "../Utilities/HashHelper.js";
import { generateToken, verifyRefreshToken ,verifyAccessToken } from "../Utilities/JwtHelper.js";
import { randomUUID } from "crypto"
async function SendTokenHelper(user)
{

    const tokenId = randomUUID()
    const {accessToken , refreshToken}  = generateToken(user,tokenId);

    const tokenHash = await hashPasswordHelper(refreshToken);
    const expiresAt = new Date(Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '9') * 24 * 60 * 60 * 1000);
    await Token.create({
        userId : user._id,
        tokenHash:tokenHash,
        expiresAt:expiresAt,
        tokenId:tokenId
    })
    return{
        user,
        accessToken,
        refreshToken
    }
}


const SignUpHelper = async  (userData) => {
    const user = {...userData}
    
    return await User.create({
        FullName: user.FullName,
        UserName: user.UserName,
        Email:user.Email,
        password:user.password,
        role:user.role,
        avatar:user.avatar,
        isActive:user.isActive
    })
}

const LoginHelper = async (email,password) => {
 

    const user = await User.findOne({email}).select("+password");

    if(!user){
        throw new AppErrorHelper("Password doesn't match !",404);
    }
    if(! await ComparePasswordHelper(password,user.password)){
        throw new AppErrorHelper("User password doesn't match ",404);
    }


    return SendTokenHelper(user);

}

const refreshTokenHelper = async (cookieToken) => {

    const payload = verifyRefreshToken(cookieToken);
    const storedToken = await Token.findOne({tokenId:payload.tokenId})

    if(!storedToken){
        throw new AppErrorHelper("Invalid Token Please login again !",404);
    }

    const IsValidToken = await ComparePasswordHelper(cookieToken,storedToken.tokenHash);
    
    if(!IsValidToken){
        await Token.deleteMany({userId:payload.userId})
        throw new AppErrorHelper("Invalid Token Please login again !",401);
    }

    await Token.findByIdAndDelete(storedToken._id);
    
    const user = await User.findById(storedToken.userId);

    return SendTokenHelper(user);
  
}

const LogOutHelper = async (userId) => {
    return await Token.deleteMany({userId:userId});
}

const ProtectionHelper = async function(req){

    let accessToken

    if(req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ')){
            accessToken = req.headers['authorization'].split(' ')[1]
    }
    else if(req.cookies.accessToken){
        accessToken = req.cookies.accessToken;
    }
    if(!accessToken){
        throw new AppErrorHelper("Please login to access this route !" , 401)
    }

    const verifiedToken = verifyAccessToken(accessToken)
    
    // Check for the user if he is still active 

    const user = await User.findById(verifiedToken.id)
   
    if(!user || !user.isActive){
        throw new AppErrorHelper("User not found " , 404);
    }

    return user;

}

const restrictedToHelper = async function (){

} 


export {
    refreshTokenHelper,
    LogOutHelper,
    LoginHelper,
    SignUpHelper,
    ProtectionHelper,
    restrictedToHelper
}