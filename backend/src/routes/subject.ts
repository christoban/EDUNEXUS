import express from "express";
import { authorize, protect } from "../middleware/auth.ts";
import {
  createSubject,
  getAllSubjects,
  updateSubject,
  deleteSubject,
} from "../controllers/subject.ts";
import { validate } from "../middleware/validate.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";
import { createSubjectBodySchema, idParamSchema, updateSubjectBodySchema } from "../validation/schemas.ts";

const subjectRouter = express.Router();

subjectRouter
  .route("/create")
  .post(
    sensitiveWriteLimiter,
    protect,
    authorize(["admin"]),
    validate({ body: createSubjectBodySchema }),
    createSubject
  );

subjectRouter
  .route("/")
  .get(protect, authorize(["admin", "teacher"]), getAllSubjects);

subjectRouter
  .route("/delete/:id")
  .delete(
    sensitiveWriteLimiter,
    protect,
    authorize(["admin"]),
    validate({ params: idParamSchema }),
    deleteSubject
  );

subjectRouter
  .route("/update/:id")
  .patch(
    sensitiveWriteLimiter,
    protect,
    authorize(["admin"]),
    validate({ params: idParamSchema, body: updateSubjectBodySchema }),
    updateSubject
  );

export default subjectRouter;