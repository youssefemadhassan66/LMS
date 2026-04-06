import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import CatchAsync from "../Utilities/CatchAsync.js";
import { createSessionService, getAllSessionsService, getSessionsByInstructorService, getSessionByIdService, getSessionsByStudentService, UpdateSessionByIdService, deleteSessionByIdService } from "../Services/sessionService.js";

const CreateSessionController = CatchAsync(async (req, res, next) => {
  if (!req.body) {
    return next(new AppErrorHelper("Data is missing !", 404));
  }

  const session = await createSessionService(req.body);

  res.status(201).json({
    status: "success",
    data: {
      session: session,
    },
  });
});

const getAllSessionsController = CatchAsync(async (req, res, next) => {
  const docs = await getAllSessionsService(req.query);

  if (docs.length === 0 || !docs) {
    return next(new AppErrorHelper("No documents found !", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      results: docs.length,
      docs: docs,
    },
  });
});

const getSessionByIdController = CatchAsync(async (req, res, next) => {
  const session = await getSessionByIdService(req.params.id);

  if (!session) {
    return next(new AppErrorHelper("No document found !", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      session: session,
    },
  });
});

const getSessionsByInstructorController = CatchAsync(async (req, res, next) => {
  const docs = await getSessionsByInstructorService(req.params.id, req.query);
  if (docs.length === 0 || !docs) {
    return next(new AppErrorHelper("No documents found !", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      results: docs.length,
      docs: docs,
    },
  });
});

const getSessionsByStudentController = CatchAsync(async (req, res, next) => {
  const docs = await getSessionsByStudentService(req.params.id, req.query);

  if (docs.length === 0 || !docs) {
    return next(new AppErrorHelper("No documents found !", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      results: docs.length,
      docs: docs,
    },
  });
});

const UpdateSessionByIdController = CatchAsync(async (req, res, next) => {
  const session = await UpdateSessionByIdService(req.params.id, req.body);

  if (!session) {
    return next(new AppErrorHelper("No document found !", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      session: session,
    },
  });
});

const deleteSessionByIdController = CatchAsync(async (req, res, next) => {
  const session = await deleteSessionByIdService(req.params.id);

  if (!session) {
    return next(new AppErrorHelper("No document found !", 404));
  }

  res.status(200).json({
    status: "Document deleted successfully",
  });
});

export { deleteSessionByIdController, UpdateSessionByIdController, getSessionByIdController, getSessionsByStudentController, getSessionsByInstructorController, getAllSessionsController, CreateSessionController };
