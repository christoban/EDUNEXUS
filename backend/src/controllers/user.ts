import { type Request, type Response } from "express";
import User from "../models/user.ts";
import Subject from "../models/subject.ts";
import School from "../models/school.ts";
import { dbRouter } from "../config/dbRouter.ts";
import { generateToken } from "../utils/generateToken.ts";
import { logActivity } from "../utils/activitieslog.ts";
import type { AuthRequest } from "../middleware/auth.ts";

const toIdStrings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(Boolean).map((item) => String(item))
    : [];

const isValidSection = (value: unknown): value is "francophone" | "anglophone" | "bilingual" =>
  value === "francophone" || value === "anglophone" || value === "bilingual";

const isValidLanguage = (value: unknown): value is "fr" | "en" =>
  value === "fr" || value === "en";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const getScopedModels = async (schoolId?: unknown) => {
  if (!schoolId || !objectIdRegex.test(String(schoolId))) {
    return { UserModel: User, SubjectModel: Subject };
  }

  try {
    const masterConn = dbRouter.getMasterConnection();
    const SchoolModel: any = masterConn.model("School", School.schema);
    const school: any = await SchoolModel.findById(String(schoolId))
      .select("_id isActive dbConnectionString")
      .lean();

    if (!school || !school.isActive) {
      return { UserModel: User, SubjectModel: Subject };
    }

    const schoolConn = await dbRouter.getSchoolConnection(
      String(school._id),
      String(school.dbConnectionString)
    );

    return {
      UserModel: schoolConn.model("User", User.schema),
      SubjectModel: schoolConn.model("Subject", Subject.schema),
    };
  } catch {
    return { UserModel: User, SubjectModel: Subject };
  }
};

const resolveSchoolFromIdentifier = async (schoolIdentifier?: string) => {
  if (!schoolIdentifier || !schoolIdentifier.trim()) {
    return null;
  }

  const rawValue = schoolIdentifier.trim();
  const masterConn = dbRouter.getMasterConnection();
  const SchoolModel: any = masterConn.model("School", School.schema);

  if (objectIdRegex.test(rawValue)) {
    return await SchoolModel.findById(rawValue)
      .select("_id schoolName dbName isActive dbConnectionString onboardingStatus")
      .lean();
  }

  const escaped = rawValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return await SchoolModel.findOne({
    $or: [{ dbName: rawValue }, { schoolName: { $regex: `^${escaped}$`, $options: "i" } }],
  })
    .select("_id schoolName dbName isActive dbConnectionString onboardingStatus")
    .lean();
};

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
      parentLanguagePreference,
      schoolSection,
      uiLanguagePreference,
    } = req.body;

    const currentSchoolId = (req as any)?.user?.schoolId;
    const { UserModel, SubjectModel } = await getScopedModels(currentSchoolId);

    const resolvedTeacherSubjects = teacherSubjects ?? teacherSubject;

    // check if user already exists
    const existingUser = await UserModel.findOne({ email });

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
    const newUser = await UserModel.create({
      name,
      email,
      password,
      role,
      studentClass: role === "student" ? studentClass : null,
      teacherSubject: role === "teacher" ? resolvedTeacherSubjects : [],
      parentId: role === "student" ? parentId : null,
      parentLanguagePreference:
        role === "parent" && isValidLanguage(parentLanguagePreference)
          ? parentLanguagePreference
          : "fr",
      schoolSection:
        role === "student" || role === "teacher"
          ? isValidSection(schoolSection)
            ? schoolSection
            : "francophone"
          : "francophone",
      uiLanguagePreference:
        role === "admin"
          ? isValidLanguage(uiLanguagePreference)
            ? uiLanguagePreference
            : undefined
          : role === "teacher" && schoolSection === "bilingual"
          ? isValidLanguage(uiLanguagePreference)
            ? uiLanguagePreference
            : undefined
          : undefined,
      isActive,
      schoolId: currentSchoolId || null,
    });

    if (newUser.role === "teacher") {
      const teacherId = newUser._id.toString();
      const subjectIdsToAssign = toIdStrings(resolvedTeacherSubjects);
      if (subjectIdsToAssign.length > 0) {
        await SubjectModel.updateMany(
          { _id: { $in: subjectIdsToAssign } },
          { $addToSet: { teacher: teacherId } }
        );
      }
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
        parentLanguagePreference: newUser.parentLanguagePreference || "fr",
        schoolSection: newUser.schoolSection || "francophone",
        uiLanguagePreference: newUser.uiLanguagePreference,
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
    const { email, password, schoolIdentifier } = req.body;

    const selectedSchool: any = await resolveSchoolFromIdentifier(schoolIdentifier);
    if (schoolIdentifier && !selectedSchool) {
      res.status(404).json({ message: "School not found" });
      return;
    }

    if (selectedSchool && !selectedSchool.isActive) {
      res.status(403).json({ message: "School is not active yet" });
      return;
    }

    const { UserModel } = selectedSchool
      ? await getScopedModels(selectedSchool._id)
      : { UserModel: User };

    const query: any = { email };
    if (selectedSchool?._id) {
      query.schoolId = selectedSchool._id;
    }

    const user = await UserModel.findOne(query);

    // check if user exists and password matches
    if (user && (await user.matchPassword(password))) {
      // ✅ MULTI-TENANT: Generate token with schoolId
      const effectiveSchoolId = user.schoolId?.toString() || selectedSchool?._id?.toString() || null;
      generateToken(user.id.toString(), res, effectiveSchoolId);
      
      res.json({
        ...user.toObject(),
        schoolId: effectiveSchoolId,
        school: selectedSchool
          ? {
              _id: selectedSchool._id,
              schoolName: selectedSchool.schoolName,
              dbName: selectedSchool.dbName,
              onboardingStatus: selectedSchool.onboardingStatus,
            }
          : undefined,
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update user (Admin)
// @desc    Update user
// @route   PUT /api/users/update/:id (admin only)
// @route   PATCH /api/users/:id (self or admin)
// @access  Private/Admin or Self
export const updateUser = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const targetUserId = req.params.id;
    const { UserModel, SubjectModel } = await getScopedModels(currentUser?.schoolId);
    
    // Check authorization: must be admin or updating own profile
    const isAdmin = currentUser.role === "admin";
    const isOwnProfile = String(currentUser._id) === String(targetUserId);
    
    if (!isAdmin && !isOwnProfile) {
      return res.status(403).json({ message: "Not authorized to update this user" });
    }

    const user = await UserModel.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const previousTeacherSubjectIds = toIdStrings(user.teacherSubject);
    
    // Fields that only admin can update
    if (isAdmin) {
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

      if (req.body.schoolSection !== undefined) {
        if (!isValidSection(req.body.schoolSection)) {
          return res.status(400).json({ message: "Invalid schoolSection. Must be francophone, anglophone, or bilingual" });
        }

        if (user.role === "student" || user.role === "teacher") {
          user.schoolSection = req.body.schoolSection;
        }
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
    }
    
    // Fields that users can update for themselves (or admins can update for anyone)
    if (isOwnProfile || isAdmin) {
      if (user.role === "parent" && req.body.parentLanguagePreference !== undefined) {
        // Validate language preference
        if (isValidLanguage(req.body.parentLanguagePreference)) {
          user.parentLanguagePreference = req.body.parentLanguagePreference;
        } else {
          return res.status(400).json({ message: "Invalid language preference. Must be 'fr' or 'en'" });
        }
      }

      if (req.body.uiLanguagePreference !== undefined) {
        if (!isValidLanguage(req.body.uiLanguagePreference)) {
          return res.status(400).json({ message: "Invalid uiLanguagePreference. Must be 'fr' or 'en'" });
        }

        if (user.role === "admin") {
          user.uiLanguagePreference = req.body.uiLanguagePreference;
        } else if (user.role === "teacher" && user.schoolSection === "bilingual") {
          user.uiLanguagePreference = req.body.uiLanguagePreference;
        } else {
          return res.status(400).json({
            message:
              "uiLanguagePreference can only be set for admins, or teachers assigned to bilingual section",
          });
        }
      }
    }

    const updatedUser = await user.save();
    const nextTeacherSubjectIds =
      updatedUser.role === "teacher"
        ? req.body.teacherSubjects !== undefined || req.body.teacherSubject !== undefined
          ? toIdStrings(req.body.teacherSubjects ?? req.body.teacherSubject)
          : toIdStrings(updatedUser.teacherSubject)
        : [];

    const teacherId = updatedUser._id.toString();
    const previousSet = new Set(previousTeacherSubjectIds);
    const nextSet = new Set(nextTeacherSubjectIds);
    const subjectIdsToAdd = nextTeacherSubjectIds.filter((id) => !previousSet.has(id));
    const subjectIdsToRemove = previousTeacherSubjectIds.filter((id) => !nextSet.has(id));

    await Promise.all([
      subjectIdsToAdd.length
        ? SubjectModel.updateMany(
            { _id: { $in: subjectIdsToAdd } },
            { $addToSet: { teacher: teacherId } }
          )
        : Promise.resolve(),
      subjectIdsToRemove.length
        ? SubjectModel.updateMany(
            { _id: { $in: subjectIdsToRemove } },
            { $pull: { teacher: teacherId } }
          )
        : Promise.resolve(),
    ]);
    
    if (currentUser) {
      await logActivity({
        userId: currentUser._id.toString(),
        action: "Updated User",
        details: `Updated user with email: ${updatedUser.email}`,
      });
    }
    
    res.json({
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        studentClass: updatedUser.studentClass || null,
        teacherSubject: updatedUser.teacherSubject || [],
        teacherSubjects: updatedUser.teacherSubject || [],
        parentId: updatedUser.parentId || null,
        parentLanguagePreference: updatedUser.parentLanguagePreference || "fr",
        schoolSection: updatedUser.schoolSection || "francophone",
        uiLanguagePreference: updatedUser.uiLanguagePreference,
      },
      message: "User updated successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get all users (With Pagination & Filtering)
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { UserModel } = await getScopedModels((req as any)?.user?.schoolId);
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
      UserModel.countDocuments(filter), // Get total count for pagination logic
      UserModel.find(filter)
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
    const { UserModel } = await getScopedModels((req as any)?.user?.schoolId);
    const user = await UserModel.findById(req.params.id);
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

    const { UserModel } = await getScopedModels(req.user.schoolId);

    const user = await UserModel.findById(req.user._id)
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