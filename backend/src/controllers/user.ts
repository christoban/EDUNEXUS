import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { generateToken } from "../utils/generateToken.ts";
import { logActivity } from "../utils/activitieslog.ts";
import bcrypt from "bcryptjs";

// ─── HELPERS ─────────────────────────────────────────────────

const isValidSection = (value: unknown): value is "francophone" | "anglophone" | "bilingual" =>
  value === "francophone" || value === "anglophone" || value === "bilingual";

const isValidLanguage = (value: unknown): value is "fr" | "en" =>
  value === "fr" || value === "en";

const hashPassword = async (password: string) => bcrypt.hash(password, 10);
const comparePassword = async (plain: string, hash: string) => bcrypt.compare(plain, hash);

// ─── REGISTER ────────────────────────────────────────────────

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Private (Admin only)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      role,
      studentClassId,
      teacherSubjectIds,
      isActive,
      parentUserId,
      schoolSection,
      uiLanguagePreference,
      parentLanguagePreference,
    } = req.body;

    const schoolId = (req as any).user?.schoolId;
    if (!schoolId) {
      res.status(403).json({ message: "Aucun établissement associé" });
      return;
    }

    // Vérifier si l'utilisateur existe déjà dans cette école
    const existing = await prisma.user.findFirst({
      where: { schoolId, email },
    });

    if (existing) {
      res.status(400).json({ message: "Cet email existe déjà dans cet établissement" });
      return;
    }

    // Validations par rôle
    if (role === "STUDENT" && !studentClassId) {
      res.status(400).json({ message: "Un élève doit être assigné à une classe" });
      return;
    }

    if (role === "TEACHER" && (!teacherSubjectIds || teacherSubjectIds.length === 0)) {
      res.status(400).json({ message: "Un enseignant doit avoir au moins une matière" });
      return;
    }

    const passwordHash = await hashPassword(password);

    // Créer l'utilisateur de base
    const newUser = await prisma.user.create({
      data: {
        schoolId,
        role,
        email,
        phone,
        passwordHash,
        firstName,
        lastName,
        isActive: isActive ?? true,
      },
    });

    // Créer le profil selon le rôle
    if (role === "STUDENT") {
      await prisma.studentProfile.create({
        data: {
          userId: newUser.id,
          classId: studentClassId || null,
        },
      });

      // Lier au parent si fourni
      if (parentUserId) {
        const parentProfile = await prisma.parentProfile.findFirst({
          where: { userId: parentUserId },
        });
        if (parentProfile) {
          await prisma.parentStudent.create({
            data: {
              parentProfileId: parentProfile.id,
              studentProfileId: newUser.id,
            },
          });
        }
      }
    }

    if (role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.create({
        data: {
          userId: newUser.id,
          specialization: [],
        },
      });

      // Assigner les matières
      if (teacherSubjectIds?.length > 0) {
        await prisma.teacherSubject.createMany({
          data: teacherSubjectIds.map((subjectId: string) => ({
            teacherProfileId: teacherProfile.id,
            subjectId,
          })),
          skipDuplicates: true,
        });
      }
    }

    if (role === "PARENT") {
      await prisma.parentProfile.create({
        data: { userId: newUser.id },
      });
    }

    // Log activité
    if ((req as any).user) {
      await logActivity({
        userId: (req as any).user.userId,
        schoolId,
        action: "Registered User",
        details: `Utilisateur créé : ${newUser.email} en tant que ${role}`,
      });
    }

    res.status(201).json({
      id: newUser.id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      message: "Utilisateur créé avec succès",
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── LOGIN ───────────────────────────────────────────────────

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, schoolIdentifier } = req.body;

    // Résoudre l'école depuis le subdomain ou le nom
    let school = null;
    if (schoolIdentifier) {
      school = await prisma.school.findFirst({
        where: {
          OR: [
            { subdomain: schoolIdentifier.trim() },
            { name: { equals: schoolIdentifier.trim(), mode: "insensitive" } },
          ],
        },
      });

      if (!school) {
        res.status(404).json({ message: "Établissement introuvable" });
        return;
      }

      if (school.status !== "ACTIVE") {
        res.status(403).json({ message: "Cet établissement n'est pas encore actif" });
        return;
      }
    }

    // Chercher l'utilisateur
    const user = await prisma.user.findFirst({
      where: {
        email,
        ...(school ? { schoolId: school.id } : {}),
      },
    });

    if (!user || !user.passwordHash) {
      res.status(401).json({ message: "Email ou mot de passe incorrect" });
      return;
    }

    const passwordMatch = await comparePassword(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ message: "Email ou mot de passe incorrect" });
      return;
    }

    // Mettre à jour lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Générer le token avec schoolId dans le payload
    generateToken(user.id, res, user.schoolId);

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      school: school
        ? { id: school.id, name: school.name, subdomain: school.subdomain }
        : null,
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── GET USERS ───────────────────────────────────────────────

// @desc    Get all users with pagination & filtering
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = (req as any).user?.schoolId;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const role = req.query.role as string;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where: any = { schoolId };

    if (role && role !== "all") {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          studentProfile: {
            select: {
              class: { select: { id: true, name: true } },
            },
          },
          teacherProfile: {
            select: {
              teacherSubjects: {
                select: {
                  subject: { select: { id: true, name: true, code: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── GET PROFILE ─────────────────────────────────────────────

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ message: "Non authentifié" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        schoolId: true,
        avatarUrl: true,
        lastLogin: true,
        createdAt: true,
        studentProfile: {
          select: {
            class: { select: { id: true, name: true } },
            parents: {
              select: {
                parentProfile: {
                  select: { user: { select: { firstName: true, lastName: true } } },
                },
              },
            },
          },
        },
        teacherProfile: {
          select: {
            teacherSubjects: {
              select: {
                subject: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        parentProfile: {
          select: {
            children: {
              select: {
                studentProfile: {
                  select: {
                    user: { select: { firstName: true, lastName: true } },
                    class: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ message: "Utilisateur introuvable" });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── UPDATE USER ─────────────────────────────────────────────

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin or Self
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    const targetUserId = req.params.id;
    const schoolId = currentUser?.schoolId;

    const isAdmin = currentUser.role === "ADMIN";
    const isOwnProfile = currentUser.userId === targetUserId;

    if (!isAdmin && !isOwnProfile) {
      res.status(403).json({ message: "Non autorisé" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: targetUserId, schoolId },
    });

    if (!user) {
      res.status(404).json({ message: "Utilisateur introuvable" });
      return;
    }

    // Mise à jour des champs de base
    const updateData: any = {};
    if (isAdmin) {
      if (req.body.firstName) updateData.firstName = req.body.firstName;
      if (req.body.lastName) updateData.lastName = req.body.lastName;
      if (req.body.email) updateData.email = req.body.email;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
      if (req.body.password) updateData.passwordHash = await hashPassword(req.body.password);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: updateData,
      });
    }

    // Mise à jour matières enseignant
    if (isAdmin && user.role === "TEACHER" && req.body.teacherSubjectIds) {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: targetUserId },
      });

      if (teacherProfile) {
        await prisma.teacherSubject.deleteMany({
          where: { teacherProfileId: teacherProfile.id },
        });

        if (req.body.teacherSubjectIds.length > 0) {
          await prisma.teacherSubject.createMany({
            data: req.body.teacherSubjectIds.map((subjectId: string) => ({
              teacherProfileId: teacherProfile.id,
              subjectId,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    // Mise à jour classe élève
    if (isAdmin && user.role === "STUDENT" && req.body.studentClassId !== undefined) {
      await prisma.studentProfile.update({
        where: { userId: targetUserId },
        data: { classId: req.body.studentClassId },
      });
    }

    if (currentUser) {
      await logActivity({
        userId: currentUser.userId,
        schoolId,
        action: "Updated User",
        details: `Utilisateur mis à jour : ${user.email}`,
      });
    }

    res.json({ message: "Utilisateur mis à jour avec succès" });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── DELETE USER ─────────────────────────────────────────────

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = (req as any).user?.schoolId;

    const user = await prisma.user.findFirst({
      where: { id: req.params.id, schoolId },
    });

    if (!user) {
      res.status(404).json({ message: "Utilisateur introuvable" });
      return;
    }

    await prisma.user.delete({ where: { id: user.id } });

    await logActivity({
      userId: (req as any).user.userId,
      schoolId,
      action: "Deleted User",
      details: `Utilisateur supprimé : ${user.email}`,
    });

    res.json({ message: "Utilisateur supprimé avec succès" });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── LOGOUT ──────────────────────────────────────────────────

// @desc    Logout user
// @route   POST /api/users/logout
// @access  Public
export const logoutUser = async (req: Request, res: Response): Promise<void> => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
    });
    res.json({ message: "Déconnexion réussie" });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};