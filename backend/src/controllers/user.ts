import { type Request, type Response } from "express";
import User from "../models/user.ts";
import Subject from "../models/subject.ts";
import { generateToken } from "../utils/generateToken.ts";
import { logActivity } from "../utils/activitieslog.ts";
import type { AuthRequest } from "../middleware/auth.ts";

const toIdStrings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(Boolean).map((item) => String(item))
    : [];

const syncTeacherSubjects = async (
  teacherId: string,
  previousSubjectIds: string[],
  nextSubjectIds: string[]
) => {
  const previousSet = new Set(previousSubjectIds);
  const nextSet = new Set(nextSubjectIds);

  const subjectIdsToAdd = nextSubjectIds.filter((id) => !previousSet.has(id));
  const subjectIdsToRemove = previousSubjectIds.filter((id) => !nextSet.has(id));

  await Promise.all([
    subjectIdsToAdd.length
      ? Subject.updateMany(
          { _id: { $in: subjectIdsToAdd } },
          { $addToSet: { teacher: teacherId } }
        )
      : Promise.resolve(),
    subjectIdsToRemove.length
      ? Subject.updateMany(
          { _id: { $in: subjectIdsToRemove } },
          { $pull: { teacher: teacherId } }
        )
      : Promise.resolve(),
  ]);
};

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Private (Admin & Teacher only)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,  
      email,
      password,
      role,
      studentClass,
      teacherSubject,
      teacherSubjects,
      isActive,
      parentId,
    } = req.body;

    const resolvedTeacherSubjects = teacherSubjects ?? teacherSubject;

    // check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    // Validate role-specific requirements
    if (role === "student" && !studentClass) {
      res.status(400).json({ message: "Student must be assigned to a class" });
      return;
    }

    if (role === "teacher" && (!resolvedTeacherSubjects || !Array.isArray(resolvedTeacherSubjects) || resolvedTeacherSubjects.length === 0)) {
      res.status(400).json({ message: "Teacher must be assigned to at least one subject" });
      return;
    }

    // create user
    const newUser = await User.create({
      name,
      email,
      password,
      role,
      studentClass: role === "student" ? studentClass : null,
      teacherSubject: role === "teacher" ? resolvedTeacherSubjects : [],
      parentId: role === "student" ? parentId : null,
      isActive,
    });

    if (newUser.role === "teacher") {
      await syncTeacherSubjects(
        newUser._id.toString(),
        [],
        toIdStrings(resolvedTeacherSubjects)
      );
    }

    if (newUser) {
      // we don't have req.user type defined, so we use a type assertion
      if ((req as any).user) {
        await logActivity({
          userId: (req as any).user._id,
          action: "Registered User",
          details: `Registered user with email: ${newUser.email} as ${newUser.role}`,
        });
      }
      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        studentClass: newUser.studentClass || null,
        teacherSubject: newUser.teacherSubject || [],
        teacherSubjects: newUser.teacherSubject || [],
        parentId: newUser.parentId || null,
        message: "User registered successfully",
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    // check if user exists and password matches
    if (user && (await user.matchPassword(password))) {
      // generate token
      generateToken(user.id.toString(), res);
      res.json(user);
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update user (Admin)
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      const previousTeacherSubjectIds = toIdStrings(user.teacherSubject);
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.role = req.body.role || user.role;
      user.isActive =
        req.body.isActive !== undefined ? req.body.isActive : user.isActive;
      
      // Handle studentClass (only for students)
      if (user.role === "student") {
        if (req.body.studentClass !== undefined) {
          user.studentClass = req.body.studentClass;
        }
        if (req.body.parentId !== undefined) {
          user.parentId = req.body.parentId;
        }
      } else {
        user.studentClass = null;
        user.parentId = null;
      }
      
      // Handle teacherSubject (only for teachers)
      const incomingTeacherSubjects =
        req.body.teacherSubjects ?? req.body.teacherSubject;
      if (user.role === "teacher") {
        if (incomingTeacherSubjects !== undefined) {
          user.teacherSubject = incomingTeacherSubjects;
        }
      } else {
        user.teacherSubject = [];
      }
      
      if (req.body.password) {
        user.password = req.body.password;
      }
      const updatedUser = await user.save();
      const nextTeacherSubjectIds =
        updatedUser.role === "teacher"
          ? incomingTeacherSubjects !== undefined
            ? toIdStrings(incomingTeacherSubjects)
            : toIdStrings(updatedUser.teacherSubject)
          : [];

      await syncTeacherSubjects(
        updatedUser._id.toString(),
        previousTeacherSubjectIds,
        nextTeacherSubjectIds
      );
      
      if ((req as any).user) {
        await logActivity({
          userId: (req as any).user._id.toString(),
          action: "Updated User",
          details: `Updated user with email: ${updatedUser.email}`,
        });
      }
      
      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        studentClass: updatedUser.studentClass || null,
        teacherSubject: updatedUser.teacherSubject || [],
        teacherSubjects: updatedUser.teacherSubject || [],
        parentId: updatedUser.parentId || null,
        message: "User updated successfully",
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get all users (With Pagination & Filtering)
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Parse Query Params safely
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const role = req.query.role as string;
    const search = req.query.search as string; // Optional: Add search later

    const skip = (page - 1) * limit;

    // 2. Build Filter Object
    const filter: any = {};

    if (role && role !== "all" && role !== "") {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    // 3. Fetch Users with Pagination & Filtering
    const [total, users] = await Promise.all([
      User.countDocuments(filter), // Get total count for pagination logic
      User.find(filter)
        .select("-password")
        .populate("studentClass", "_id name")
        .populate("teacherSubject", "_id name code")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    // 4. Send Response
    res.json({
      users: users.map((u) => {
        const userObject = u.toObject();
        return {
          ...userObject,
          teacherSubjects: userObject.teacherSubject,
        };
      }),
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// next
// @desc    Delete user (Admin)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      await user.deleteOne();
      if ((req as any).user) {
        // here we passing userId as objectId instead of string
        // we also have other problem
        await logActivity({
          userId: (req as any).user._id.toString(),
          action: "Deleted User",
          details: `Deleted user with email: ${user.email}`,
        });
      }
      res.json({ message: "User deleted successfully" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get user profile (via cookie)
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("studentClass", "_id name")
      .populate("teacherSubject", "_id name code");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({
      user: {
        ...user.toObject(),
        teacherSubjects: user.teacherSubject,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/users/logout
// @access  Public
export const logoutUser = async (req: Request, res: Response) => {
  try {
    res.cookie("jwt", "", {
      httpOnly: true,
      expires: new Date(0), //expire the cookie immediately
    });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};