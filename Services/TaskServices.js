import Task from "../Models/Task.js";
import ApiFeatures from "../Utilities/ApiFeatures.js";
import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import Session from "../Models/Session.js";
import User from "../Models/User.js";
import mongoose from "mongoose";

const createTaskServices = async (data) => {
  if (!data) {
    throw new AppErrorHelper("Data is missing ! ", 404);
  }

  const { sessionId, studentId, instructorId, title, dueDate, taskLinks, description, status } = data;

  const student = await User.findById(studentId);
  const instructor = await User.findById(instructorId);
  const session = await Session.findById(sessionId);

  if (!student || !instructor) {
    throw new AppErrorHelper(" User not found  ! ", 404);
  }

  if (!session) {
    throw new AppErrorHelper(" session not found  ! ", 404);
  }

  if (student.role !== "student" || instructor.role !== "instructor") {
    throw new AppErrorHelper("Wrong assignment of roles !", 400);
  }

  return await Task.create({
    sessionId: sessionId,
    studentId: studentId,
    instructorId: instructorId,
    title: title || "",
    taskLinks: taskLinks || [],
    description: description || "",
    dueDate: dueDate || Date.now(),
    status: status,
  });
};

const getAllTasksService = async (queryString = {}) => {
  const features = new ApiFeatures(Task.find({}), queryString).filter().sort().fields().pagination();

  return await features.mongooseQuery;
};

const getTaskByIdService = async (taskId) => {
  const task = await Task.findById(taskId);

  if (!task) {
    throw new AppErrorHelper(" No task found ! ", 404);
  }

  return task;
};

const getTasksBySessionIdService = async (sessionId, queryString = {}) => {
  const features = new ApiFeatures(Task.find({ sessionId: sessionId }), queryString).filter().sort().fields().pagination();

  return await features.mongooseQuery;
};

const getTasksByStudentIdService = async (studentId, queryString = {}) => {
  const features = new ApiFeatures(Task.find({ studentId: studentId }), queryString).filter().sort().fields().pagination();

  return await features.mongooseQuery;
};

const updateTaskByIdService = async (TaskId, data) => {
  const options = {
    new: true,
    runValidators: true,
  };
  const task = await Task.findByIdAndUpdate(TaskId, data, options);

  if (!task) {
    throw new AppErrorHelper("Task not found!", 404);
  }

  return task;
};

const updateTaskStatusService = async (TaskId, status) => {
  const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
  const statusAliasMap = { cancelled: "canceled" };
  const finalStatus = statusAliasMap[normalizedStatus] || normalizedStatus;
  const allowedFields = ["completed", "pending", "canceled"];

  if (!allowedFields.includes(finalStatus)) {
    throw new AppErrorHelper("Invalid Status !", 400);
  }
  const options = {
    new: true,
    runValidators: true,
  };

  const task = await Task.findByIdAndUpdate(TaskId, { status: finalStatus }, options);

  if (!task) {
    throw new AppErrorHelper("Task not found!", 404);
  }

  return task;
};

const deleteTaskByIdService = async (TaskId) => {
  const deletedTask = await Task.findByIdAndDelete(TaskId);

  if (!deletedTask) throw new AppErrorHelper("Task not found!", 404);

  return deletedTask;
};

const getTasksStatsByStudentIdService = async (studentId) => {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw new AppErrorHelper("Invalid student id!", 400);
  }

  const stats = await Task.aggregate([
    {
      $match: { studentId: new mongoose.Types.ObjectId(studentId) },
    },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: {
          $sum: {
            $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
          },
        },
        pendingTasks: {
          $sum: {
            $cond: [{ $eq: ["$status", "pending"] }, 1, 0],
          },
        },
        canceledTasks: {
          $sum: {
            $cond: [{ $eq: ["$status", "canceled"] }, 1, 0],
          },
        },
      },
    },
    {
      $addFields: {
        completionRate: {
          $cond: [
            { $eq: ["$totalTasks", 0] },
            0,
            {
              $multiply: [{ $divide: ["$completedTasks", "$totalTasks"] }, 100],
            },
          ],
        },
      },
    },
  ]);

  return stats[0] || {};
};

export { createTaskServices, getAllTasksService, getTaskByIdService, getTasksBySessionIdService, getTasksByStudentIdService, getTasksStatsByStudentIdService, updateTaskByIdService, updateTaskStatusService, deleteTaskByIdService };
