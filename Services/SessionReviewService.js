import SessionReview from "../Models/SessionReview";
import User from "../Models/User";
import Session from "../Models/Session";
import AppErrorHelper from "../Utilities/AppErrorHelper";
import ApiFeatures from "../Utilities/ApiFeatures";
import mongoose from "mongoose";


const createSessionReviewService = async (data) => {
  if (!data) {
    throw new AppErrorHelper("Data is missing!", 400);
  }

  const {
    sessionId,
    studentId,
    instructorId,
    notes,
    Behavior,
    underStanding,
    participation,
    coding
  } = data;

  // 1. Check session exists
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new AppErrorHelper("Session not found!", 404);
  }

  
  const student = await User.findById(studentId);
  const instructor = await User.findById(instructorId);

  if (!student || !instructor) {
    throw new AppErrorHelper("User not found!", 404);
  }


  if (student.role !== "student" || instructor.role !== "instructor") {
    throw new AppErrorHelper("Wrong assignment of roles!", 400);
  }


  if (
    session.studentId.toString() !== studentId ||
    session.instructorId.toString() !== instructorId
  ) {
    throw new AppErrorHelper(
      "This session does not belong to this student/instructor",
      400
    );
  }

  if (!session.StudentAttended) {
    throw new AppErrorHelper(
      "Cannot review a session that student did not attend",
      400
    );
  }

  
  const review = await SessionReview.create({
    session: sessionId,
    Student: studentId,
    Instructor: instructorId,
    notes,
    Behavior,
    underStanding,
    participation,
    coding
  });

  return review;
};

const getAllSessionReviewsService = async (queryString) => {
  const features = new ApiFeatures(
    SessionReview.find({}),
    queryString
  ).filter().sort().fields().pagination();

  const reviews = await features.mongooseQuery;
  return reviews;
};


const getSessionReviewsByStudentService = async (studentId, queryString = {}) => {
  const features = new ApiFeatures(
    SessionReview.find({ Student: studentId }),
    queryString
  ).sort().fields().pagination();

  return await features.mongooseQuery;
};



const getSessionReviewsByInstructorService = async (instructorId, queryString = {}) => {
  const features = new ApiFeatures(
    SessionReview.find({ Instructor: instructorId }),
    queryString
  ).sort().fields().pagination();

  return await features.mongooseQuery;
};


const getSessionReviewsBySessionService = async (sessionId, queryString = {}) => {
  const features = new ApiFeatures(
    SessionReview.find({ session: sessionId }),
    queryString
  ).sort().fields().pagination();

  return await features.mongooseQuery;
};



const updateSessionReviewByIdService = async (reviewId, data) => {
  const options = {
    new: true,
    runValidators: true,
  };

  const review = await SessionReview.findByIdAndUpdate(
    reviewId,
    data,
    options
  );

  if (!review) {
    throw new AppErrorHelper("Review not found!", 404);
  }

  return review;
};



const deleteSessionReviewByIdService = async (reviewId) => {
  const review = await SessionReview.findByIdAndDelete(reviewId);

  if (!review) {
    throw new AppErrorHelper("Review not found!", 404);
  }

  return review;
};


const getStudentReviewStatsService = async (studentId) => {
  const stats = await SessionReview.aggregate([
    {
      $match:{Student:new mongoose.Types.ObjectId(studentId)}
    },
    {
      $group:{
        _id : null,
        avgOverAll:{$avg:"overAllRating"},
        avgBehavior:{$avg:"Behavior"},
        avgUnderstanding:{$avg:"underStanding"},
        avgParticipation: { $avg: "$participation" },
        avgCoding: { $avg: "$coding" },
        Count : {$sum: 1}
      }
    }
  ]);

  return stats[0] || {}
};


export {
  createSessionReviewService,
  getAllSessionReviewsService,
  getSessionReviewsByStudentService,
  getSessionReviewsByInstructorService,
  getSessionReviewsBySessionService,
  updateSessionReviewByIdService,
  deleteSessionReviewByIdService,
  getStudentReviewStatsService
};



  // const stats = await SessionReview.aggregate([
  //   {
  //     $match: { Student: mongoose.Types.ObjectId(studentId) }
  //   },
  //   {
  //     $group: {
  //       _id: "$Student",
  //       avgOverall: { $avg: "$overAllRating" },
  //       avgBehavior: { $avg: "$Behavior" },
  //       avgUnderstanding: { $avg: "$underStanding" },
  //       avgParticipation: { $avg: "$participation" },
  //       avgCoding: { $avg: "$coding" },
  //       totalSessions: { $sum: 1 }
  //     }
  //   }
  // ]);

  // return stats[0] || {};