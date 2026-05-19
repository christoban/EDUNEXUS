import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.ts";
import { generateTokens, clearTokens } from "../utils/generateToken.ts";
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

    if (role === "STAFF") {
      const title = String(req.body.title || "Staff").trim();
      const sectionId = req.body.sectionId ? String(req.body.sectionId) : null;
      const permissions: string[] = Array.isArray(req.body.permissions) ? req.body.permissions : [];

      const defaultPermissions: Record<string, string[]> = {
        "Censeur": ["MANAGE_TIMETABLE", "VALIDATE_GRADES", "MANAGE_EXAMS", "SUPERVISE_TEACHERS", "MANAGE_CURRICULUM", "MANAGE_CATCHUP_REQUESTS", "VIEW_TEACHER_PERFORMANCE", "GENERATE_CLASS_COUNCIL_REPORT"],
        "Vice-Principal": ["MANAGE_TIMETABLE", "VALIDATE_GRADES", "MANAGE_EXAMS", "SUPERVISE_TEACHERS", "MANAGE_CURRICULUM", "MANAGE_CATCHUP_REQUESTS", "VIEW_TEACHER_PERFORMANCE", "GENERATE_CLASS_COUNCIL_REPORT"],
        "Surveillant Général": ["MANAGE_ATTENDANCE", "MANAGE_DISCIPLINE", "MANAGE_INCIDENTS"],
        "Discipline Master": ["MANAGE_ATTENDANCE", "MANAGE_DISCIPLINE", "MANAGE_INCIDENTS"],
        "Intendant": ["MANAGE_FINANCE", "VALIDATE_PAYMENTS", "GENERATE_REPORTS"],
        "Bursar": ["MANAGE_FINANCE", "VALIDATE_PAYMENTS", "GENERATE_REPORTS"],
        "Économe": ["MANAGE_FINANCE", "VALIDATE_PAYMENTS", "GENERATE_REPORTS"],
        "Chef des Travaux": ["MANAGE_ATELIERS", "MANAGE_PRACTICAL_GRADES", "MANAGE_INTERNSHIPS"],
        "Comptable-Matières": ["MANAGE_PATRIMOINE", "MANAGE_DEGRADATIONS"],
        "Documentaliste": ["MANAGE_LIBRARY"],
        "Conseiller d'Orientation": ["MANAGE_ORIENTATION"],
        "Animateur Pédagogique": ["VIEW_DEPARTMENT_GRADES", "SUPERVISE_DEPARTMENT_TEACHERS", "VALIDATE_DEPARTMENT_TIMETABLE", "GENERATE_DEPARTMENT_REPORTS", "VIEW_SUPERVISED_GRADES", "SUPERVISE_LESSON_PLANS", "GENERATE_PEDAGOGICAL_REPORTS", "MANAGE_CE_REPORTS"],
        "HOD": ["VIEW_DEPARTMENT_GRADES", "SUPERVISE_DEPARTMENT_TEACHERS", "VALIDATE_DEPARTMENT_TIMETABLE", "GENERATE_DEPARTMENT_REPORTS", "VIEW_SUPERVISED_GRADES", "SUPERVISE_LESSON_PLANS", "GENERATE_PEDAGOGICAL_REPORTS", "MANAGE_CE_REPORTS"],
      };

      const resolvedPermissions = permissions.length > 0 ? permissions : (defaultPermissions[title] ?? []);

      const staffProfile = await prisma.staffProfile.create({
        data: {
          schoolId,
          userId: newUser.id,
          title,
          ...(sectionId ? { sectionId } : {}),
        },
      });

      if (resolvedPermissions.length > 0) {
        await prisma.staffPermission.createMany({
          data: resolvedPermissions.map((permission) => ({
            staffProfileId: staffProfile.id,
            permission: permission as any,
          })),
          skipDuplicates: true,
        });
      }
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

    // Invalider tous les anciens refresh tokens puis enregistrer la nouvelle connexion
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        refreshTokenVersion: { increment: 1 },
      },
      select: {
        id: true,
        schoolId: true,
        role: true,
        refreshTokenVersion: true,
      },
    });

    // Récupérer les permissions STAFF si applicable
    let permissions: string[] = [];
    if (user.role === "STAFF") {
      const staffProfile = await prisma.staffProfile.findUnique({
        where: { userId: user.id },
        include: { permissions: true },
      });
      permissions = staffProfile?.permissions.map((p) => p.permission) ?? [];
    }

    // Générer access token (15min) + refresh token (7j) dans les cookies httpOnly
    generateTokens(user.id, user.schoolId, user.role, permissions, updatedUser.refreshTokenVersion, res);

    res.json({
      id:        user.id,
      firstName: user.firstName,
      lastName:  user.lastName,
      email:     user.email,
      role:      user.role,
      schoolId:  user.schoolId,
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
    const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const schoolId = currentUser?.schoolId;

    if (!targetUserId) {
      res.status(400).json({ message: "ID utilisateur invalide" });
      return;
    }

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
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!userId) {
      res.status(400).json({ message: "ID utilisateur invalide" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, schoolId },
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
export const logoutUser = async (_req: Request, res: Response): Promise<void> => {
  try {
    const token = _req.cookies?.refresh_token;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId?: string; tokenType?: string };

        if (decoded.tokenType === "refresh" && decoded.userId) {
          await prisma.user.updateMany({
            where: { id: decoded.userId },
            data: { refreshTokenVersion: { increment: 1 } },
          });
        }
      } catch {
        // Même si le refresh token est expiré ou invalide, on nettoie quand même les cookies.
      }
    }

    clearTokens(res);
    res.json({ message: "Déconnexion réussie" });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── REFRESH TOKEN ───────────────────────────────────────────

// @desc    Renouvelle l'access token depuis le refresh token cookie
// @route   POST /api/users/refresh-token
// @access  Public (cookie httpOnly requis)
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refresh_token;

    if (!token) {
      res.status(401).json({ message: "Refresh token manquant" });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch {
      res.status(401).json({ message: "Refresh token invalide ou expiré" });
      return;
    }

    if (decoded.tokenType !== "refresh") {
      res.status(401).json({ message: "Token de mauvais type" });
      return;
    }

    // Vérifier que l'utilisateur existe toujours et est actif
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        staffProfile: {
          include: { permissions: true },
        },
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ message: "Utilisateur introuvable ou inactif" });
      return;
    }

    if (typeof decoded.refreshTokenVersion !== "number" || decoded.refreshTokenVersion !== user.refreshTokenVersion) {
      res.status(401).json({ message: "Refresh token révoqué" });
      return;
    }

    // Vérifier que l'école est toujours active
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
    });

    if (!school || school.status !== "ACTIVE") {
      res.status(403).json({ message: "Établissement inactif" });
      return;
    }

    // Récupérer les permissions à jour et révoquer l'ancien refresh token
    const permissions = user.staffProfile?.permissions.map((p) => p.permission) ?? [];

    const rotatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenVersion: { increment: 1 },
      },
      select: {
        id: true,
        schoolId: true,
        role: true,
        refreshTokenVersion: true,
      },
    });

    // Rotation : générer un nouveau couple access + refresh token
    generateTokens(user.id, user.schoolId, user.role, permissions, rotatedUser.refreshTokenVersion, res);

    res.json({ message: "Token renouvelé" });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// @route   POST /api/users/import
// @access  Private (Admin)
export const importUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId as string;

    if (currentUser?.role !== "ADMIN") {
      res.status(403).json({ message: "Réservé aux administrateurs" });
      return;
    }

    const rows: any[] = Array.isArray(req.body.users) ? req.body.users : [];
    if (!rows.length) {
      res.status(400).json({ message: "Aucun utilisateur fourni" });
      return;
    }

    const results = { created: 0, errors: [] as { row: number; email: string; message: string }[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const email = String(row.email || "").trim().toLowerCase();
        const firstName = String(row.firstName || row.prenom || "").trim();
        const lastName = String(row.lastName || row.nom || "").trim();
        const role = String(row.role || "STUDENT").toUpperCase();
        const phone = String(row.phone || row.telephone || "").trim() || null;

        if (!email || !firstName || !lastName) {
          results.errors.push({ row: i + 1, email, message: "email, firstName et lastName sont requis" });
          continue;
        }

        const existing = await prisma.user.findFirst({ where: { schoolId, email } });
        if (existing) {
          results.errors.push({ row: i + 1, email, message: "Email déjà utilisé" });
          continue;
        }

        const passwordHash = await bcrypt.hash("Edunexus2025!", 10);
        const newUser = await prisma.user.create({
          data: {
            schoolId,
            email,
            firstName,
            lastName,
            phone,
            role: role as any,
            passwordHash,
            isActive: true,
          },
        });

        if (role === "STUDENT") {
          await prisma.studentProfile.create({ data: { userId: newUser.id, classId: row.classId || null } });
        } else if (role === "TEACHER") {
          await prisma.teacherProfile.create({ data: { userId: newUser.id } });
        } else if (role === "PARENT") {
          await prisma.parentProfile.create({ data: { userId: newUser.id } });
        } else if (role === "STAFF") {
          await prisma.staffProfile.create({ data: { schoolId, userId: newUser.id, title: String(row.title || "Staff").trim() } });
        }

        results.created++;
      } catch (err: any) {
        results.errors.push({ row: i + 1, email: String(rows[i]?.email || ""), message: err.message || "Erreur inconnue" });
      }
    }

    res.json({ message: `${results.created} utilisateur(s) créé(s), ${results.errors.length} erreur(s)`, ...results });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// @route   GET /api/users/export
export const exportUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId as string;

    if (currentUser?.role !== "ADMIN") {
      res.status(403).json({ message: "Réservé aux administrateurs" });
      return;
    }

    const role = req.query.role as string | undefined;
    const users = await prisma.user.findMany({
      where: { schoolId, ...(role && role !== "all" ? { role: role as any } : {}) },
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
        studentProfile: { select: { classId: true, matricule: true } },
      },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
    });

    const csvHeader = "id,prenom,nom,email,telephone,role,actif,classe,matricule,dernière_connexion,créé_le";
    const csvRows = users.map((u) => [
      u.id,
      u.firstName,
      u.lastName,
      u.email ?? "",
      u.phone ?? "",
      u.role,
      u.isActive ? "oui" : "non",
      u.studentProfile?.classId ?? "",
      u.studentProfile?.matricule ?? "",
      u.lastLogin ? new Date(u.lastLogin).toLocaleDateString("fr-FR") : "",
      new Date(u.createdAt).toLocaleDateString("fr-FR"),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const csv = [csvHeader, ...csvRows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="utilisateurs-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send("\uFEFF" + csv);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// @route   POST /api/students/:id/transfer
export const transferStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId as string;

    if (currentUser?.role !== "ADMIN") {
      res.status(403).json({ message: "Réservé aux administrateurs" });
      return;
    }

    const studentId = String(req.params.id);
    const { toClassId, academicYearId, reason } = req.body;

    if (!toClassId || !academicYearId) {
      res.status(400).json({ message: "toClassId et academicYearId sont requis" });
      return;
    }

    const studentProfile = await prisma.studentProfile.findFirst({
      where: { userId: studentId, user: { schoolId } },
    });

    if (!studentProfile) {
      res.status(404).json({ message: "Élève introuvable" });
      return;
    }

    const fromClassId = studentProfile.classId;
    if (!fromClassId) {
      res.status(400).json({ message: "L'élève n'est pas encore assigné à une classe" });
      return;
    }

    if (fromClassId === toClassId) {
      res.status(400).json({ message: "L'élève est déjà dans cette classe" });
      return;
    }

    const targetClass = await prisma.class.findFirst({ where: { id: toClassId, schoolId } });
    if (!targetClass) {
      res.status(404).json({ message: "Classe cible introuvable" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentProfile.update({ where: { userId: studentId }, data: { classId: toClassId } });
      await tx.studentPromotion.create({
        data: {
          schoolId,
          studentId,
          fromClassId,
          toClassId,
          academicYearId,
          promotedById: currentUser.userId,
        },
      });
    });

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: "Student transferred",
      details: `Élève ${studentId} : ${fromClassId} → ${toClassId}${reason ? ` (${reason})` : ""}`,
    });

    res.json({ message: "Transfert effectué", fromClassId, toClassId });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};