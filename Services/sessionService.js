import Session from "../Models/Session.js";
import User from "../Models/User.js";
import StudentProfile from "../Models/studentProfile.js";
import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import ApiFeatures from "../Utilities/ApiFeatures.js";

const createSessionService = async (data) => {
  const { title, description, recapVideoLinks, attachmentsLinks, studentProfileId, instructorId, date, StudentAttended } = data;

  const studentProfile = await StudentProfile.findById(studentProfileId);
  if (!studentProfile) {
    throw new AppErrorHelper("Student profile not found!", 404);
  }

  const instructor = await User.findById(instructorId);
  if (!instructor) {
    throw new AppErrorHelper("Instructor not found!", 404);
  }

  const student = await User.findById(studentProfile.user);
  if (!student) {
    throw new AppErrorHelper("Student user not found!", 404);
  }

  if (student.role !== "student" || instructor.role !== "instructor") {
    throw new AppErrorHelper("Wrong assignment of roles!", 400);
  }

  return await Session.create({
    title: title,
    description: description,
    recapVideoLinks: recapVideoLinks || [],
    attachmentsLinks: attachmentsLinks || [],
    studentProfileId: studentProfile._id,
    instructorId: instructor._id,
    date: date,
    StudentAttended: StudentAttended ?? true,
  });
};

const getSessionByIdService = async (SessionId) => {
  const session = await Session.findById(SessionId).populate([
    { path: "studentProfileId" },
    { path: "instructorId", select: "FullName Email" },
  ]);

  if (!session) {
    throw new AppErrorHelper("Session not found!", 404);
  }
  return session;
};



const getAllSessionsService = async (queryString) => {
  const features = new ApiFeatures(Session.find({}), queryString).filter().sort().fields().pagination();

  const sessions = await features.mongooseQuery;
  return sessions;
};




const getSessionsByStudentService = async (studentProfileId, queryString = {}) => {
  const features = new ApiFeatures(Session.find({ studentProfileId }), queryString).sort().fields().pagination();
  return await features.mongooseQuery;
};

const getSessionsByInstructorService = async (instructorId, queryString = {}) => {
  const features = new ApiFeatures(Session.find({ instructorId }), queryString).sort().fields().pagination();
  return await features.mongooseQuery;
};



const getMySessionService = async (user)=>{

  
}





const UpdateSessionByIdService = async (SessionId, data) => {
  const options = {
    new: true,
    runValidators: true,
  };
  const session = await Session.findByIdAndUpdate(SessionId, data, options);

  if (!session) {
    throw new AppErrorHelper("Session not found ! ", 404);
  }

  return session;
};

const deleteSessionByIdService = async (SessionId) => {
  const session = await Session.findByIdAndDelete(SessionId);

  if (!session) {
    throw new AppErrorHelper("Session not found!", 404);
  }
  return session;
};

export { createSessionService, getAllSessionsService, getSessionsByInstructorService, getSessionByIdService, getSessionsByStudentService, UpdateSessionByIdService, deleteSessionByIdService };
