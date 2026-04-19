import User from "../Models/User.js";
import Token from "../Models/Token.js";
import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import { ComparePasswordHelper, hashPasswordHelper } from "../Utilities/HashHelper.js";
import { generateToken, verifyRefreshToken, verifyAccessToken } from "../Utilities/JwtHelper.js";
import { randomUUID } from "crypto";

async function SendTokenService(user) {
  const tokenId = randomUUID();
  const { accessToken, refreshToken } = generateToken(user, tokenId);

  const tokenHash = await hashPasswordHelper(refreshToken);
  const expiresAt = new Date(Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRES_IN || "9") * 24 * 60 * 60 * 1000);
  await Token.create({
    userId: user._id,
    tokenHash: tokenHash,
    expiresAt: expiresAt,
    tokenId: tokenId,
  });

  user.password = undefined;

  return {
    user,
    accessToken,
    refreshToken,
  };
}

const SignUpService = async (userData) => {
  const user = { ...userData };

  const newUser = await User.create({
    FullName: user.FullName,
    UserName: user.UserName,
    Email: user.Email,
    password: user.password,
    role: user.role,
    avatar: user.avatar,
    isActive: user.isActive,
  });
  newUser.password = undefined;

  return newUser;
};
const LoginService = async (email, password) => {
  // Removed transaction support for standalone MongoDB (development environment)
  // Transactions require MongoDB replica set or sharded cluster
  
  const user = await User.findOne({ Email: email }).select("+password");

  if (!user) {
    throw new AppErrorHelper("User not found", 404);
  }

  // Clean up expired tokens
  await Token.deleteMany({ userId: user._id, expiresAt: { $lt: new Date() } });

  // Check token count and remove oldest if exceeds limit
  const tokenCount = await Token.countDocuments({ userId: user._id });

  if (tokenCount > 3) {
    const oldestToken = await Token.findOne({ userId: user._id }).sort({ createdAt: 1 });
    if (oldestToken) {
      await Token.deleteOne({ _id: oldestToken._id });
    }
  }

  // Validate password
  if (!(await ComparePasswordHelper(password, user.password))) {
    throw new AppErrorHelper("User password doesn't match", 404);
  }

  const result = await SendTokenService(user);

  return result;
};

const refreshTokenService = async (cookieToken) => {
  const payload = verifyRefreshToken(cookieToken);
  const storedToken = await Token.findOne({ tokenId: payload.tokenId });

  if (!storedToken) {
    throw new AppErrorHelper("Invalid Token Please login again !", 404);
  }

  const IsValidToken = await ComparePasswordHelper(cookieToken, storedToken.tokenHash);

  if (!IsValidToken) {
    await Token.deleteMany({ userId: payload.userId });
    throw new AppErrorHelper("Invalid Token Please login again !", 401);
  }

  await Token.findByIdAndDelete(storedToken._id);

  const user = await User.findById(storedToken.userId);

  return SendTokenService(user);
};

const LogOutService = async (userId) => {
  return await Token.deleteMany({ userId: userId });
};

const ProtectionService = async function (req) {
  let accessToken;

  if (req.headers["authorization"] && req.headers["authorization"].startsWith("Bearer ")) {
    accessToken = req.headers["authorization"].split(" ")[1];
  } else if (req.cookies.accessToken) {
    accessToken = req.cookies.accessToken;
  }
  if (!accessToken) {
    throw new AppErrorHelper("Please login to access this route !", 401);
  }

  const verifiedToken = verifyAccessToken(accessToken);

  // Check for the user if he is still active

  const user = await User.findById(verifiedToken.id).select("_id role isActive").lean();

  if (!user || !user.isActive) {
    throw new AppErrorHelper("User not found ", 404);
  }

  return user;
};

const restrictedToService = async function () {};

export { refreshTokenService, LogOutService, LoginService, SignUpService, ProtectionService, restrictedToService };
