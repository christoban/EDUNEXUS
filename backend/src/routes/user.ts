 import express from "express";

const userRoutes = express.Router();

import { register, login, updateUser, deleteUser, logoutUser, getUserProfile, getUsers } from "../controllers/user.ts";
import { protect, authorize } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { authLimiter, sensitiveWriteLimiter } from "../middleware/rateLimit.ts";
import { loginBodySchema, registerBodySchema, updateUserBodySchema, userIdParamSchema } from "../validation/schemas.ts";

// make sure to protect to get access to the user token
userRoutes.post(
  "/register",
  authLimiter,
  protect,
  authorize(["admin"]),
  validate({ body: registerBodySchema }),
  register
);
userRoutes.post("/login", authLimiter, validate({ body: loginBodySchema }), login);
userRoutes.post("/logout", sensitiveWriteLimiter, logoutUser);
userRoutes.get("/profile", protect, getUserProfile); // Get User Profile
// teacher should be able to fetch all students
userRoutes.get("/", protect, authorize(["admin", "teacher"]), getUsers);
// here you can use either put or patch
userRoutes.put(
  "/update/:id",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin"]),
  validate({ params: userIdParamSchema, body: updateUserBodySchema }),
  updateUser
);
// Allow users to update their own profile (for parent language preference, etc)
userRoutes.patch(
  "/:id",
  sensitiveWriteLimiter,
  protect,
  validate({ params: userIdParamSchema, body: updateUserBodySchema }),
  updateUser
);
userRoutes.delete(
  "/delete/:id",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin"]),
  validate({ params: userIdParamSchema }),
  deleteUser
);

export default userRoutes;

// next we protect routes, also add rolebased access