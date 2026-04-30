import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import CatchAsync from "../Utilities/CatchAsync.js";

import { refreshTokenService, LogOutService, LoginService, SignUpService, ProtectionService } from "../Services/AuthServices.js";

// ─── Helper ───────────────────────────────────────────────────────────────────
const CreateAndSendTokens = (req, res, accessToken, refreshToken) => {
  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    expires: new Date(Date.now() + 120 * 60 * 1000), // 120 minutes
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });
};

// ─── Sign Up ──────────────────────────────────────────────────────────────────
const signUpController = CatchAsync(async (req, res, next) => {
  let user = { ...req.body };

  if (Object.keys(user).length === 0) {
    throw new AppErrorHelper("User data is missing while signing up!", 400);
  }

  user = await SignUpService(user);

  res.status(201).json({
    status: "success",
    data: { user },
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────
const loginController = CatchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppErrorHelper("Email and password are required!", 400));
  }

  const { user, accessToken, refreshToken } = await LoginService(email, password);

  if (!user || !accessToken || !refreshToken) {
    return next(new AppErrorHelper("Login failed, please try again!", 500));
  }

  // Set cookies only after all checks pass
  CreateAndSendTokens(req, res, accessToken, refreshToken);

  res.status(200).json({
    status: "success",
    data: { user, token: accessToken },
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────
const logoutController = CatchAsync(async (req, res, next) => {
  if (!req.user?._id) {
    throw new AppErrorHelper("User not authenticated", 401);
  }

  await LogOutService(req.user._id);

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  res.status(200).json({ status: "success", message: "Logged out successfully" });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────
const RefreshController = CatchAsync(async (req, res, next) => {
  const CookieToken = req.cookies.refreshToken;

  if (!CookieToken) {
    throw new AppErrorHelper("No refresh token found!", 401);
  }

  const { accessToken, refreshToken } = await refreshTokenService(CookieToken);

  CreateAndSendTokens(req, res, accessToken, refreshToken);

  res.status(200).json({ 
    status: "success",    
    data: { token: accessToken }
  });
});

// ─── Protection Middleware ────────────────────────────────────────────────────
const protectionController = CatchAsync(async (req, res, next) => {
  const user = await ProtectionService(req);
  req.user = user;
  next();
});

// ─── Role Restriction Middleware ──────────────────────────────────────────────
const restrictedToController = (...allowedRoles) => {
  return CatchAsync(async (req, res, next) => {
    if (!req.user || !req.user.role) {
      throw new AppErrorHelper("You are not logged in!", 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppErrorHelper(`This role (${req.user.role}) doesn't have access to this route!`, 403);
    }

    next();
  });
};

export { signUpController, loginController, RefreshController, logoutController, protectionController, restrictedToController };
