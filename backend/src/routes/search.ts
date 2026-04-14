import express from "express";
import { protect, authorize } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { globalSearchQuerySchema } from "../validation/schemas.ts";
import { globalSearch } from "../controllers/search.ts";

const searchRouter = express.Router();

searchRouter.get(
  "/global",
  protect,
  authorize(["admin"]),
  validate({ query: globalSearchQuerySchema }),
  globalSearch
);

export default searchRouter;
