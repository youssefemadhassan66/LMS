import User from "../Models/User.js";
import ApiFeatures from "../Utilities/ApiFeatures.js";
import StudentProfile from "../Models/studentProfile.js";

// Admin only
const getAllUsersService = async (query) => {
  const features = new ApiFeatures(User.find({}), query).filter().sort().fields().pagination();
  const users = await features.mongooseQuery;

  return users;
};

const getUserByIDService = async (id) => {
  const user = await User.findById(id);
  return user;
};

const UpdateUserByIDService = async (id, data) => {
  const options = {
    new: true,
    runValidators: true,
  };
  const user = await User.findByIdAndUpdate(id, data, options);

  return user;
};
const SoftDeleteUserByIDService = async (id) => {
  const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });
  return user;
};
const createUserService = async (data) => {
  const user = { ...data };

  return await User.create({
    FullName: user.FullName,
    UserName: user.UserName,
    Email: user.Email,
    password: user.password,
    role: user.role,
    avatar: user.avatar,
    isActive: user.isActive,
  });
};

// parent

const getMyStudentsService = async (parentID) => {
  const students = StudentProfile.find({ parents: parentID }).populate("user");

  return students;
};

export {
  getAllUsersService,
  getUserByIDService,
  UpdateUserByIDService,
  SoftDeleteUserByIDService,
  createUserService,
  // Parent
  getMyStudentsService,
};
