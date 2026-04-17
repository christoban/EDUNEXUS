import express from "express";
import { authorize, protect } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import {
  academicPeriodQuerySchema,
  createAcademicPeriodBodySchema,
  createSectionBodySchema,
  idParamSchema,
  updateSubSystemBodySchema,
  updateAcademicPeriodBodySchema,
  updateSectionBodySchema,
} from "../validation/schemas.ts";
import {
  createAcademicPeriod,
  createSection,
  getAcademicPeriods,
  getSections,
  getSubSystems,
  updateAcademicPeriod,
  updateSection,
  updateSubSystem,
  upsertDefaultSubSystems,
} from "../controllers/coreDomain.ts";

const coreDomainRouter = express.Router();

coreDomainRouter.get("/subsystems", protect, authorize(["admin", "teacher", "student", "parent"]), getSubSystems);
coreDomainRouter.post(
  "/subsystems/upsert-defaults",
  protect,
  authorize(["admin"]),
  upsertDefaultSubSystems
);
coreDomainRouter.patch(
  "/subsystems/:id",
  protect,
  authorize(["admin"]),
  validate({ params: idParamSchema, body: updateSubSystemBodySchema }),
  updateSubSystem
);

coreDomainRouter.post(
  "/sections",
  protect,
  authorize(["admin"]),
  validate({ body: createSectionBodySchema }),
  createSection
);
coreDomainRouter.get("/sections", protect, authorize(["admin", "teacher", "student", "parent"]), getSections);
coreDomainRouter.patch(
  "/sections/:id",
  protect,
  authorize(["admin"]),
  validate({ params: idParamSchema, body: updateSectionBodySchema }),
  updateSection
);

coreDomainRouter.post(
  "/academic-periods",
  protect,
  authorize(["admin"]),
  validate({ body: createAcademicPeriodBodySchema }),
  createAcademicPeriod
);
coreDomainRouter.get(
  "/academic-periods",
  protect,
  authorize(["admin", "teacher", "student", "parent"]),
  validate({ query: academicPeriodQuerySchema }),
  getAcademicPeriods
);
coreDomainRouter.patch(
  "/academic-periods/:id",
  protect,
  authorize(["admin"]),
  validate({ params: idParamSchema, body: updateAcademicPeriodBodySchema }),
  updateAcademicPeriod
);

export default coreDomainRouter;
