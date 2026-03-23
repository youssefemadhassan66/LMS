import CatchAsync from '../Utilities/CatchAsync.js';
import AppErrorHelper from '../Utilities/AppErrorHelper.js';

import {    
    refreshTokenHelper,
    LogOutHelper,
    LoginHelper,
    SignUpHelper,
    ProtectionHelper,
    restrictedToHelper} from '../Services/AuthServices.js'


const CreateAndSendTokens = (req, res, accessToken, refreshToken) => {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure:   isSecure,
    sameSite: 'lax', 
    expires: new Date(
      Date.now() + parseInt(process.env.JWT_TOKEN_EXPIRES_IN || '15')
      * 60 * 1000  
    )
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure:   isSecure,
    sameSite: 'lax',
    expires: new Date(
      Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '9')
      * 24 * 60 * 60 * 1000  
    )
  });
};





const signUpController = CatchAsync(async (req,res,next)=>{
    let user = {...req.body}
    if(Object.keys(user).length === 0){
        throw new AppErrorHelper("User data is missing while signing up !")
    }
    user =  await SignUpHelper(user);

    res.status(201).json({
        status:'success',
        data:{
            user:user
        }
    })

});

const loginController = CatchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password)
    throw new AppErrorHelper('Email and password are required', 400);

  const { user, accessToken, refreshToken } = await LoginHelper(email, password);

  CreateAndSendTokens(req, res, accessToken, refreshToken); 

  res.status(200).json({ status: 'success', data: { user, token: accessToken } });
});


const logoutController = CatchAsync(async (req, res, next) => {
  if (!req.user?._id)
    throw new AppErrorHelper('User not authenticated', 401);

  await LogOutHelper(req.user._id);

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});



const RefreshController = CatchAsync(async (req,res,next)=>{
    const CookieToken = req.cookies.refreshToken
    if(!CookieToken){
        throw new AppErrorHelper("No refresh token found !", 401)
    }

    const {accessToken,refreshToken} = await refreshTokenHelper(CookieToken);

    CreateAndSendTokens(req,res,accessToken,refreshToken);

    res.status(201).json({
        status:'success',

    })
})


const protectionController = CatchAsync(async (req,res,next)=>{

    let user = await ProtectionHelper(req);
    req.user = user;
    next()
})  

const restrictedToController = (...allowedRoles)=>{

    return CatchAsync(async(req,res,next)=>{
    
        if(!req.user || !req.user.role)
        {
            throw new AppErrorHelper("You are not logged in !" , 401)
        }
        
        if(!allowedRoles.includes(req.user.role)){
           throw new AppErrorHelper(`This role ${req.user.role} doesn't have access to this route `, 403);
        }

        next()
    })
}
// const forgotPassword = CatchAsync(async(req,res,next)=>{



// })


export {
    signUpController,
    loginController,
    RefreshController,
    logoutController,
    protectionController,
    restrictedToController,

}