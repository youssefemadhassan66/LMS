import jwt  from "jsonwebtoken";

const signAccessToken  = (user) => {
    const accessToken =  jwt.sign(
        {id:user.id,role:user.role},
        process.env.JWT_TOKEN_SECRET,
        {expiresIn:process.env.JWT_TOKEN_EXPIRES_IN}
    )
    return accessToken
}
const signRefreshToken = (user) => {
    const refreshToken = jwt.sign(
        {id:user.id},
        process.env.JWT_REFRESH_TOKEN_SECRET,
        {expiresIn:process.env.JWT_REFRESH_EXPIRES_IN}
    )
    return refreshToken
}

const generateToken = async(user)=>{
    const accessToken = await signAccessToken(user);
    const refreshToken = await signRefreshToken(user);

    return {accessToken , refreshToken} 
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