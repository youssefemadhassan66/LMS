import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import ApiFeatures from "../Utilities/ApiFeatures.js";
import User from "../Models/User.js";
import ExternalCourse from "../Models/ExternalCourse.js";
import StudentProfile from "../Models/studentProfile.js";
import mongoose from "mongoose";

const createExternalCourseService = async (data) => {
  const { teacher, subject, createdBy, student, color } = { ...data };

  const studentData = await User.findById(student);

  if (!studentData) {
    throw new AppErrorHelper("User not found!", 404);
  }

  if (studentData.role !== "student") {
    throw new AppErrorHelper("Wrong assignment of roles!", 400);
  }

  return await ExternalCourse.create({
    teacher: teacher,
    subject: subject,
    createdBy: createdBy,
    student: student,
    color: color,
  });
};

const getMyExternalCourseByIdService = async (user, courseId) => {
  const exCourse = await ExternalCourse.findById(courseId).populate("student", "FullName UserName").populate("createdBy", "FullName UserName");

  if (!exCourse) {
    throw new AppErrorHelper("Course not found", 404);
  }

  if (user.role === "student") {
    if (exCourse.student._id.toString() !== user.id) {
      throw new AppErrorHelper("Not allowed !", 403);
    }
  } else if (user.role === "parent") {
    const childProfile = await StudentProfile.find({
      user: exCourse.student._id,
      parents: new mongoose.Types.ObjectId(user.id),
    });

    if (!childProfile) {
      throw new AppErrorHelper("Not allowed !", 403);
    }
  } else {
    throw new AppErrorHelper("Not allowed", 403);
  }

  return exCourse;
};

const getMyExternalCourseService = async (user, queryString) => {
  let mongooseQuery;

  if (user.role === "student") {
    mongooseQuery = ExternalCourse.find({ student: user.id }).populate("student", "FullName UserName");
  } else if (user.role === "parent") {
    const childrenProfiles = await StudentProfile.find({ parents: new mongoose.Types.ObjectId(user.id) }, { user: 1 });

    if (!childrenProfiles.length) {
      return [];
    }

    const childrenIds = childrenProfiles.map((profile) => profile.user);

    mongooseQuery = await ExternalCourse.find({ student: { $in: childrenIds } }).populate("student", "FullName UserName");
  } 
  
  else throw new AppErrorHelper("Not allowed", 403);

  const features = new ApiFeatures(mongooseQuery, queryString).filter().sort().fields().pagination();

  return await features.mongooseQuery;
};

const getAllExternalCoursesService = async (queryString = {}) => {
  const features = new ApiFeatures(ExternalCourse.find({}), queryString).filter().sort().fields().pagination();

  return features.mongooseQuery;
};

const getExternalCourseByIdService = async (exCourseId) => {
  const exCourse = await ExternalCourse.findById(exCourseId);

  if (!exCourse) {
    throw new AppErrorHelper("Course not found ! ", 404);
  }
  return exCourse;
};

const getExternalCourseByStudentService = async (studentId, queryString = {}) => {
  const features = new ApiFeatures(ExternalCourse.find({ student: studentId }), queryString).sort().fields().pagination();
  return await features.mongooseQuery;
};

const updateExternalCourseService = async (exCourseId, data) => {
  const options = {
    new: true,
    runValidators: true,
  };

  const exCourse = await ExternalCourse.findByIdAndUpdate(exCourseId, data, options);

  if (!exCourse) {
    throw new AppErrorHelper("Course not found ! ", 404);
  }

  return exCourse;
};

const deleteExternalCourseService = async (exCourseId) => {
  const deletedExCourse = await ExternalCourse.findByIdAndDelete(exCourseId);

  if (!deletedExCourse) {
    throw new AppErrorHelper("Course not found ! ", 404);
  }

  return deletedExCourse;
};

export {
  createExternalCourseService,
  getMyExternalCourseService,
  getMyExternalCourseByIdService,
  getAllExternalCoursesService,
  getExternalCourseByIdService,
  getExternalCourseByStudentService,
  updateExternalCourseService,
  deleteExternalCourseService,
};
