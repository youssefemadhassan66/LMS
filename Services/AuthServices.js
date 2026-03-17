import User from "../Models/User.js";
import Token from '../Models/Token.js'
import AppErrorHelper from "../Utilities/AppErrorHelper";
import { ComparePasswordHelper , hashPasswordHelper } from "../Utilities/HashHelper";
import { generateToken, verifyRefreshToken } from "../Utilities/JwtHelper";

const SignUp = async  (userData) => {
    const user = {...userData}
    
        throw await User.create({
        FullName: user.FullName,
        UserName: user.UserName,
        Email:user.Email,
        password:user.password,
        role:user.role,
        avatar:user.avatar,
        isActive:user.isActive
    })
     
}

const Login = async (email,password) => {
    if(!email || !password){
        throw new AppErrorHelper("Email and password are required for login !",400)
    }

    const user = await User.findOne({email}).select("+password");

    if(!user){
        throw new AppErrorHelper("User not found !",404);
    }
    if(! await ComparePasswordHelper(password,user.password)){
        throw new AppErrorHelper("User password doesn't match ",404);
    }

    const {accessToken , refreshToken}  = generateToken(user);

    const tokenHash = await hashPasswordHelper(refreshToken);
    const expiresAt  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await Token.create({
        userId : user.id,
        tokenHash:tokenHash,
        expiresAt:expiresAt
    })
    return{
        user,
        accessToken,
        refreshToken
    }

}

const refreshToken = async (cookieToken) => {
    const payload = verifyRefreshToken(cookieToken);
    const storedToken = await Token.findOne({userId:payload.id})

    if(!storedToken){
        throw new AppErrorHelper("Invalid Token Please login again !",404);
    }

    const IsValidToken = ComparePasswordHelper(cookieToken,storedToken.tokenHash);
    
    if(!IsValidToken){
        await Token.deleteMany({userId:payload.id})
    }

    await Token.findByIdAndDelete(storedToken._id);
    
    const user = await User.findById(storedToken.userId);

    const {accessToken , refreshToken}  = generateToken(user);

    const tokenHash = await hashPasswordHelper(refreshToken);
    const expiresAt  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await Token.create({
        userId : storedToken.userId,
        tokenHash:tokenHash,
        expiresAt:expiresAt
    })
    return{
        user,
        accessToken,
        refreshToken
    }
}

const LogOut = async (userid) => {

    await Token.deleteMany({userId});

}




