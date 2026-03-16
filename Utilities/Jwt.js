import jwt, { sign }  from "jsonwebtoken";



const signAccessToken  = async(user) => {
    const accessToken =  jwt.sign(
        {id:user.id,role:user.role},
        process.env.JWT_TOKEN_SECRET,
        {expiresIn:process.env.JWT_TOKEN_EXPIRES_IN}
    )
    return accessToken
}
const signRefreshToken = async(user) => {
    const RefreshToken =  jwt.sign(
        {id:user.id},
        process.env.JWT_REFRESH_EXPIRES_IN,
        {expiresIn:process.env.JWT_REFRESH_TOKEN_SECRET}
    )
    return RefreshToken
}


const generateToken = async(user)=>{
    await signAccessToken(user);
    await signRefreshToken(user);
}

const verifyAccessToken = (accessToken) =>{
    return  jwt.verify(accessToken,process.env.JWT_TOKEN_SECRET)
}
const verifyRefreshToken = (refreshToken) =>{
    return  jwt.verify(refreshToken,process.env.JWT_REFRESH_TOKEN_SECRET)
}

export {
    signAccessToken,signRefreshToken,generateToken,verifyAccessToken,verifyRefreshToken
}