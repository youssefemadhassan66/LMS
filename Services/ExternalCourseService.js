import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import ApiFeatures from "../Utilities/ApiFeatures.js";
import User from "../Models/user.js";
import ExternalCourse from "../Models/externalCourse.js";
import StudentProfile from "../Models/studentProfile.js";
import mongoose from "mongoose";

const createExternalCourseService = async (data) => {
  const { teacher, subject, createdBy, studentProfileId, studentId, color } = { ...data };

  let resolvedStudentProfileId = studentProfileId;

  if (!resolvedStudentProfileId && studentId) {
    const studentProfile = await StudentProfile.findOne({ user: studentId });
    if (!studentProfile) {
      throw new AppErrorHelper("Student profile not found!", 404);
    }
    resolvedStudentProfileId = studentProfile._id;
  }

  if (!resolvedStudentProfileId) {
    throw new AppErrorHelper("Student profile id is required!", 400);
  }

  const studentProfile = await StudentProfile.findById(resolvedStudentProfileId);
  if (!studentProfile) {
    throw new AppErrorHelper("Student profile not found!", 404);
  }

  return await ExternalCourse.create({
    teacher: teacher,
    subject: subject,
    createdBy: createdBy,
    studentProfileId: resolvedStudentProfileId,
    color: color,
  });
};

const getMyExternalCourseByIdService = async (user, courseId) => {
  const exCourse = await ExternalCourse.findById(courseId)
    .populate({ path: "studentProfileId", select: "user grade", populate: { path: "user", select: "FullName UserName" } })
    .populate("createdBy", "FullName UserName");

  if (!exCourse) {
    throw new AppErrorHelper("Course not found", 404);
  }

  if (user.role === "student") {
    const studentProfile = await StudentProfile.findOne({ user: user._id });
    if (!studentProfile || exCourse.studentProfileId._id.toString() !== studentProfile._id.toString()) {
      throw new AppErrorHelper("Not allowed !", 403);
    }
  } else if (user.role === "parent") {
    const childProfile = await StudentProfile.findOne({
      _id: exCourse.studentProfileId._id,
      parents: new mongoose.Types.ObjectId(user._id),
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
    const studentProfile = await StudentProfile.findOne({ user: user._id });
    if (!studentProfile) {
      return [];
    }
    mongooseQuery = ExternalCourse.find({ studentProfileId: studentProfile._id }).populate({ path: "studentProfileId", select: "user grade", populate: { path: "user", select: "FullName UserName" } });
  } else if (user.role === "parent") {
    const childrenProfiles = await StudentProfile.find({ parents: user._id }, { _id: 1 });

    if (!childrenProfiles.length) {
      return [];
    }

    const childrenIds = childrenProfiles.map((profile) => profile._id);

    mongooseQuery = ExternalCourse.find({ studentProfileId: { $in: childrenIds } }).populate({ path: "studentProfileId", select: "user grade", populate: { path: "user", select: "FullName UserName" } });
  } else {
    throw new AppErrorHelper("Not allowed", 403);
  }

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

const getExternalCourseByStudentService = async (studentProfileId, queryString = {}) => {
  const features = new ApiFeatures(ExternalCourse.find({ studentProfileId }), queryString).sort().fields().pagination();
  return await features.mongooseQuery;
};

const updateExternalCourseService = async (exCourseId, data) => {
  const options = {
    new: true,
    runValidators: true,
  };

  const updateData = { ...data };

  if (updateData.studentId) {
    const studentProfile = await StudentProfile.findOne({ user: updateData.studentId });
    if (!studentProfile) {
      throw new AppErrorHelper("Student profile not found!", 404);
    }
    updateData.studentProfileId = studentProfile._id;
    delete updateData.studentId;
  }

  if (updateData.student && !updateData.studentProfileId) {
    const studentProfile = await StudentProfile.findById(updateData.student);
    if (!studentProfile) {
      throw new AppErrorHelper("Student profile not found!", 404);
    }
    updateData.studentProfileId = studentProfile._id;
    delete updateData.student;
  }

  const exCourse = await ExternalCourse.findByIdAndUpdate(exCourseId, updateData, options);

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
