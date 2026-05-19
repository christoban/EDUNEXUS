import express from "express";
import {
  createAcademicYear,
  getCurrentAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
  getAllAcademicYears,
  setCurrentPeriod,
  getSequences,
  setCurrentSequence,
  updateSchoolCalendar,
  preCloseCheck,
  closeAcademicYear,
} from "../controllers/academicYear.ts";

import { authorize, protect } from "../middleware/auth.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";

const academicYearRouter = express.Router();

academicYearRouter
  .route("/")
  .get(protect, authorize(["admin", "teacher"]), getAllAcademicYears);

academicYearRouter
  .route("/create")
  .post(protect, authorize(["admin"]), createAcademicYear);

academicYearRouter.route("/current").get(protect, getCurrentAcademicYear);

academicYearRouter
  .route("/update/:id")
  .patch(protect, authorize(["admin"]), updateAcademicYear);

academicYearRouter
  .route("/delete/:id")
  .delete(protect, authorize(["admin"]), deleteAcademicYear);

academicYearRouter.get("/sequences", protect, getSequences);
academicYearRouter.patch("/sequences/:id/set-current", protect, setCurrentSequence);
academicYearRouter.patch("/:id/set-current-period", protect, setCurrentPeriod);
academicYearRouter.put("/calendar", protect, updateSchoolCalendar);

academicYearRouter.post(
  "/:id/pre-close-check",
  protect,
  preCloseCheck
);
academicYearRouter.post(
  "/:id/close",
  sensitiveWriteLimiter,
  protect,
  closeAcademicYear
);

export default academicYearRouter;