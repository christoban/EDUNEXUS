import express from "express";
import { protect, authorize } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { emailLogsQuerySchema } from "../validation/schemas.ts";
import { getEmailLogs } from "../controllers/emailLog.ts";

const emailLogRouter = express.Router();

emailLogRouter.get(
  "/",
  protect,
  authorize(["admin"]),
  validate({ query: emailLogsQuerySchema }),
  getEmailLogs
);

export default emailLogRouter;
