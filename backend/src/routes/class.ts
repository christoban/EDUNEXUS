import express from "express";
import {
  createClass,
  updateClass,
  deleteClass,
  getAllClasses,
} from "../controllers/class.ts";
import { authorize, protect } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";
import { createClassBodySchema, idParamSchema, updateClassBodySchema } from "../validation/schemas.ts";

const classRouter = express.Router();

classRouter.post(
  "/create",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin"]),
  validate({ body: createClassBodySchema }),
  createClass
);
classRouter.get("/", protect, authorize(["admin", "teacher", "parent"]), getAllClasses);
classRouter.patch(
  "/update/:id",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin"]),
  validate({ params: idParamSchema, body: updateClassBodySchema }),
  updateClass
);
classRouter.delete(
  "/delete/:id",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin"]),
  validate({ params: idParamSchema }),
  deleteClass
);

export default classRouter;