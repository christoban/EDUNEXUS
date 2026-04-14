 import express from "express";

const userRoutes = express.Router();

import { register, login, updateUser, deleteUser, logoutUser, getUserProfile, getUsers } from "../controllers/user.ts";
import { protect, authorize } from "../middleware/auth.ts";

// make sure to protect to get access to the user token
userRoutes.post(
  "/register",
  protect,
  authorize(["admin", "teacher"]),
  register
);
userRoutes.post("/login", login);
userRoutes.post("/logout", logoutUser);
userRoutes.get("/profile", protect, getUserProfile); // Get User Profile
// teacher should be able to fetch all students
userRoutes.get("/", protect, authorize(["admin", "teacher"]), getUsers);
// here you can use either put or patch
userRoutes.put(
  "/update/:id",
  protect,
  authorize(["admin", "teacher"]),
  updateUser
);
userRoutes.delete(
  "/delete/:id",
  protect,
  authorize(["admin", "teacher"]),
  deleteUser
);

export default userRoutes;

// next we protect routes, also add rolebased access