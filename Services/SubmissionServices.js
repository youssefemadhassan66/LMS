import Submission from "../Models/Submission.js";
import Task from "../Models/Task.js";
import User from "../Models/User.js";
import ApiFeatures from "../Utilities/ApiFeatures.js";
import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import mongoose from "mongoose";

const VALID_STATUSES = ["Pending", "Completed", "Reviewed", "Resubmitted", "Late submission"];

const createSubmissionService = async (data) => {

  if (!data) {
    throw new AppErrorHelper("Data is missing!", 400);
  }

  const { taskId, studentId, Task_links, note } = data;

  // Check task
  const task = await Task.findById(taskId);
  if (!task) {
    throw new AppErrorHelper("Task not found!", 404);
  }

  const student = await User.findById(studentId);
  if (!student) {
    throw new AppErrorHelper("Student not found!", 404);
  }

  if (student.role !== "student") {
    throw new AppErrorHelper("Invalid student role!", 400);
  }

  // Prevent duplicate submission
  const existing = await Submission.findOne({
    task: taskId,
    student: studentId
  });

  if (existing) {
    throw new AppErrorHelper("Submission already exists!", 400);
  }

  const submission = await Submission.create({
    task: taskId,
    student: studentId,
    Task_links: Task_links || [],
    note,
    status:"pending"

  });

  return submission;
};





const getAllSubmissionsService = async (queryString = {}) => {

  const features = new ApiFeatures(
    Submission.find({}),
    queryString
  ).filter().sort().fields().pagination();

  return await features.mongooseQuery;
};


const getSubmissionByIdService = async (submissionId) => {

  const submission = await Submission.findById(submissionId);

  if (!submission) {
    throw new AppErrorHelper("Submission not found!", 404);
  }

  return submission;
};


const getSubmissionsByTaskIdService = async (taskId, queryString = {}) => {
  const task = await Task.findById(taskId);
  if (!task) {
    throw new AppErrorHelper("Task not found!", 404);
  }
 
  const features = new ApiFeatures(
    Submission.find({ task: taskId }),
    queryString
  )
    .filter()
    .sort()
    .fields()
    .pagination();
 
  return await features.mongooseQuery;
};

const getSubmissionsByStudentIdService = async (studentId, queryString = {}) => {
  
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw new AppErrorHelper("Invalid student id!", 400);
  }

  const features = new ApiFeatures(
    Submission.find({ student: studentId }),
    queryString
  ).filter().sort().fields().pagination();

  return await features.mongooseQuery;
};

const updateSubmissionByIdService = async (submissionId, data) => {
  const { Task_links, note } = data;

  const safeUpdate = {};
  
  if (Task_links !== undefined) safeUpdate.Task_links = Task_links;
  
  if (note !== undefined) safeUpdate.note = note;
 
  const submission = await Submission.findByIdAndUpdate(
    submissionId,
    safeUpdate,
    { new: true, runValidators: true }
  );
 
  if (!submission) {
    throw new AppErrorHelper("Submission not found!", 404);
  }
 
  return submission;
};


const deleteSubmissionByIdService = async (submissionId) => {

  const submission = await Submission.findByIdAndDelete(submissionId);

  if (!submission) {
    throw new AppErrorHelper("Submission not found!", 404);
  }

  return submission;
};

const updateSubmissionStatusService = async (id, status) => {
  if (!VALID_STATUSES.includes(status)) {
    throw new AppErrorHelper(
      `Invalid status. Allowed values: ${VALID_STATUSES.join(", ")}`,
      400
    );
  }
 
  const submission = await Submission.findById(id);
  if (!submission) {
    throw new AppErrorHelper("Submission not found!", 404);
  }
 
  submission.status = status;
  return await submission.save();
};


// ─── Submit task (student action) 
const submitTaskService = async (submissionId, links) => {

  const submission = await Submission.findById(submissionId);

  if (!submission) {
    throw new AppErrorHelper("Submission not found!", 404);
  }

  if (!links || links.length === 0) {
    throw new AppErrorHelper("Submission links are required!", 400);
  }

  submission.Task_links = links;
  submission.status = "Completed";

  return await submission.save(); 
};



const reviewSubmissionService = async (submissionId, reviewData) => {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    throw new AppErrorHelper("Submission not found!", 404);
  }
 

  submission.review.score    = reviewData.score   ?? submission.review.score;
  submission.review.comment  = reviewData.comment ?? submission.review.comment;
  submission.review.reviewAt = new Date();
 
  submission.status = "Reviewed";
  return await submission.save();
};

 
const getSubmissionStatsByStudentIdService = async (studentId) => {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw new AppErrorHelper("Invalid student id!", 400);
  }
 
  const stats = await Submission.aggregate([
    { $match: { student: new mongoose.Types.ObjectId(studentId) } },
    {
      $group: {
        _id: null,
        totalSubmissions: { $sum: 1 },
        completed:   { $sum: { $cond: [{ $eq: ["$status", "Completed"] },      1, 0] } },
        pending:     { $sum: { $cond: [{ $eq: ["$status", "Pending"] },         1, 0] } },
        reviewed:    { $sum: { $cond: [{ $eq: ["$status", "Reviewed"] },        1, 0] } },
        resubmitted: { $sum: { $cond: [{ $eq: ["$status", "Resubmitted"] },     1, 0] } },
        late:        { $sum: { $cond: [{ $eq: ["$status", "Late submission"] }, 1, 0] } },
      },
    },
  ]);
 
  return stats[0] || {};
};


const getTasksDueDateBucketsService = async (studentId) => {
  const now = new Date();
  const next3Days = new Date();
  next3Days.setDate(now.getDate() + 3);
 
  return await Task.aggregate([
    { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
    {
      $addFields: {
        category: {
          $switch: {
            branches: [
              { case: { $lt:  ["$dueDate", now]       }, then: "overdue" },
              { case: { $lte: ["$dueDate", next3Days] }, then: "dueSoon" },
            ],
            default: "future",
          },
        },
      },
    },
    {
      $group: {
        _id: "$category",
        tasks: { $push: "$$ROOT" },
        count: { $sum: 1 },
      },
    },
  ]);
};



export {
  createSubmissionService,
  getAllSubmissionsService,
  getSubmissionByIdService,
  getSubmissionsByTaskIdService,
  getSubmissionsByStudentIdService,
  updateSubmissionByIdService,
  updateSubmissionStatusService,
  deleteSubmissionByIdService,
  submitTaskService,
  reviewSubmissionService,
  getSubmissionStatsByStudentIdService,
  getTasksDueDateBucketsService
};