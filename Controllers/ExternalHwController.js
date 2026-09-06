import CatchAsync from "../Utilities/CatchAsync.js";
import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import {
  getAllExternalHWService,
  getExternalHwByIdService,
  getMyExternalHWService,
  getExternalHWByCourseService,
  getMyExternalHwByIdService,
  createExternalHwService,
  updateExternalHwService,
  deleteExternalHwService,
  markExternalHwCompleteService,
} from "../Services/ExternalCourseHwService.js";

const getAllExternalHWController = CatchAsync(async (req, res) => {
  // An empty collection is a successful query, not a missing resource.
  // Returning 404 here made the dashboard show an error on a page that
  // simply had no homework in it yet.
  const docs = (await getAllExternalHWService(req.query)) || [];

  res.status(200).json({
    status: "success",
    data: {
      results: docs.length,
      docs,
    },
  });
});

// ─── Get HW by ID ─────────────────────────────────────────────────────
const getExternalHWByIdController = CatchAsync(async (req, res, next) => {
  const hw = await getExternalHwByIdService(req.params.id);

  res.status(200).json({
    status: "success",
    data: { hw },
  });
});

// ─── Get MY HW (student or parent) ───────────────────────────────────
const getMyExternalHWController = CatchAsync(async (req, res, next) => {
  const hws = await getMyExternalHWService(req.user, req.query);
  res.status(200).json({
    status: "success",
    results: hws.length,
    data: hws,
  });
});
const getMyExternalHWByIdController = CatchAsync(async (req, res, next) => {
  const hws = await getMyExternalHwByIdService(req.user, req.params.id);

  res.status(200).json({
    status: "success",
    data: hws,
  });
});

const getExternalHWByCourseController = CatchAsync(async (req, res) => {
  // Same as above: a course that has not been given homework yet is an empty
  // list, not a 404.
  const docs =
    (await getExternalHWByCourseService(req.params.courseId, req.query)) || [];

  res.status(200).json({
    status: "success",
    data: {
      results: docs.length,
      docs,
    },
  });
});

const createExternalHWController = CatchAsync(async (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new AppErrorHelper("Data is missing!", 400));
  }

  const hw = await createExternalHwService(req.user, req.body);

  res.status(201).json({
    status: "success",
    data: { hw },
  });
});

const updateExternalHWController = CatchAsync(async (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new AppErrorHelper("Data is missing!", 400));
  }

  const hw = await updateExternalHwService(req.user, req.params.id, req.body);

  res.status(200).json({
    status: "success",
    data: { hw },
  });
});

// ─── Delete HW ────────────────────────────────────────────────────────
const deleteExternalHWController = CatchAsync(async (req, res, next) => {
  await deleteExternalHwService(req.user, req.params.id);

  res.status(200).json({
    status: "Document deleted successfully",
  });
});

// ─── Mark HW as Complete ──────────────────────────────────────────────
const markExternalHWCompleteController = CatchAsync(async (req, res, next) => {
  const hw = await markExternalHwCompleteService(req.user, req.params.id);

  res.status(200).json({
    status: "success",
    data: { hw },
  });
});

export {
  getAllExternalHWController,
  getExternalHWByIdController,
  getMyExternalHWController,
  getMyExternalHWByIdController,
  getExternalHWByCourseController,
  createExternalHWController,
  updateExternalHWController,
  deleteExternalHWController,
  markExternalHWCompleteController,
};
