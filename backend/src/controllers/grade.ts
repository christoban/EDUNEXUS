import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";
import { inngest } from "../inngest/index.ts";

// ─── HELPERS ─────────────────────────────────────────────────

const getSchoolId = (req: Request): string => (req as any).user?.schoolId as string;
const getUserId = (req: Request): string => (req as any).user?.userId as string;
const getRole = (req: Request): string => (req as any).user?.role as string;
const getPermissions = (req: Request): string[] => (req as any).user?.permissions ?? [];

const hasPermission = (req: Request, permission: string): boolean =>
  getRole(req) === "ADMIN" || getPermissions(req).includes(permission);

/**
 * Vérifier qu'un enseignant est bien assigné à une matière
 */
const isTeacherAssignedToSubject = async (
  teacherUserId: string,
  subjectId: string
): Promise<boolean> => {
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: teacherUserId },
    include: { teacherSubjects: { where: { subjectId } } },
  });
  return (teacherProfile?.teacherSubjects.length ?? 0) > 0;
};

/**
 * Calculer la moyenne d'une matière pour un élève sur une séquence
 * Formule selon GradeFormula de l'école
 */
const computeSequenceAverage = (
  grade: {
    sequenceScore?: number | null;
    classTestScore?: number | null;
    terminalExamScore?: number | null;
    theoreticalScore?: number | null;
    practicalScore?: number | null;
    maxValue: number;
    seq1Score?: number | null;
    seq2Score?: number | null;
    compositionScore?: number | null;
  },
  mode: "single" | "triple" | "weighted" = "single"
): number => {
  const max = grade.maxValue || 20;

  // Mode anglophone : ClassTest 30% + Exam 70%
  if (mode === "weighted") {
    if (grade.classTestScore !== null && grade.classTestScore !== undefined &&
        grade.terminalExamScore !== null && grade.terminalExamScore !== undefined) {
      return Math.min(grade.classTestScore * 0.3 + grade.terminalExamScore * 0.7, max);
    }
  }

  // Mode triple : (DS1 + DS2 + Compo×2) ÷ 4 — établissements privés
  if (mode === "triple") {
    const ds1 = grade.seq1Score ?? grade.sequenceScore;
    const ds2 = grade.seq2Score;
    const compo = grade.compositionScore;
    if (ds1 !== null && ds1 !== undefined &&
        ds2 !== null && ds2 !== undefined &&
        compo !== null && compo !== undefined) {
      return Math.min((ds1 + ds2 + compo * 2) / 4, max);
    }
  }

  // Mode single (défaut) : note DS unique
  if (grade.sequenceScore !== null && grade.sequenceScore !== undefined) {
    return Math.min(grade.sequenceScore, max);
  }

  // Fallback technique : théorie + pratique
  if (grade.theoreticalScore !== null && grade.theoreticalScore !== undefined &&
      grade.practicalScore !== null && grade.practicalScore !== undefined) {
    return Math.min((grade.theoreticalScore + grade.practicalScore) / 2, max);
  }

  // Fallback anglophone (mode single sans weighted explicite)
  if (grade.classTestScore !== null && grade.classTestScore !== undefined &&
      grade.terminalExamScore !== null && grade.terminalExamScore !== undefined) {
    return Math.min(grade.classTestScore * 0.3 + grade.terminalExamScore * 0.7, max);
  }

  return 0;
};

/**
 * Calculer la moyenne générale pondérée d'un élève pour une séquence
 */
const computeGeneralAverage = async (
  studentId: string,
  classId: string,
  sequenceId: string,
  schoolId: string
): Promise<{ average: number; rank: number; totalStudents: number }> => {
  // Récupérer toutes les notes validées de l'élève pour cette séquence
  const grades = await prisma.grade.findMany({
    where: {
      schoolId,
      studentId,
      classId,
      sequenceId,
      validationStatus: { in: ["VALIDATED", "LOCKED"] },
    },
    include: {
      subject: { select: { coefficient: true } },
    },
  });

  if (!grades.length) return { average: 0, rank: 0, totalStudents: 0 };

  const totalWeighted = grades.reduce((sum, g) => {
    const score = g.sequenceAverage ?? 0;
    const coeff = g.coefficient ?? g.subject.coefficient ?? 1;
    return sum + score * coeff;
  }, 0);

  const totalCoeff = grades.reduce((sum, g) => {
    return sum + (g.coefficient ?? g.subject.coefficient ?? 1);
  }, 0);

  const average = totalCoeff > 0 ? totalWeighted / totalCoeff : 0;

  // Calculer le rang dans la classe
  const classmatesAverages = await prisma.grade.groupBy({
    by: ["studentId"],
    where: {
      schoolId,
      classId,
      sequenceId,
      validationStatus: { in: ["VALIDATED", "LOCKED"] },
    },
    _avg: { sequenceAverage: true },
    orderBy: { _avg: { sequenceAverage: "desc" } },
  });

  const rank = classmatesAverages.findIndex((c) => c.studentId === studentId) + 1;

  return {
    average: Math.round(average * 100) / 100,
    rank: rank || 0,
    totalStudents: classmatesAverages.length,
  };
};

// ─── SAISIR UNE NOTE ─────────────────────────────────────────

// @desc    Saisir ou mettre à jour une note
// @route   POST /api/grades
// @access  Private (Teacher, Admin)
export const createGrade = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const role = getRole(req);

    const {
      studentId,
      subjectId,
      classId,
      academicYearId,
      sequenceId,
      sequenceScore,
      classTestScore,
      terminalExamScore,
      theoreticalScore,
      practicalScore,
      professionalAttitude,
      oralScore,
      selfDevelopmentScore,
      coefficient,
      maxValue,
    } = req.body;

    // Validation des champs obligatoires
    if (!studentId || !subjectId || !classId || !academicYearId || !sequenceId) {
      res.status(400).json({ message: "studentId, subjectId, classId, academicYearId, sequenceId sont requis" });
      return;
    }

    // Vérifier que l'enseignant est assigné à cette matière
    if (role === "TEACHER") {
      const assigned = await isTeacherAssignedToSubject(userId, subjectId);
      if (!assigned) {
        res.status(403).json({ message: "Tu n'es pas assigné à cette matière" });
        return;
      }
    }

    // Vérifier que l'élève appartient bien à la classe
    const studentProfile = await prisma.studentProfile.findFirst({
      where: { userId: studentId, classId },
    });
    if (!studentProfile) {
      res.status(400).json({ message: "Cet élève n'appartient pas à cette classe" });
      return;
    }

    // Vérifier que la séquence appartient à l'année scolaire
    const sequence = await prisma.academicSequence.findFirst({
      where: { id: sequenceId, schoolId, academicPeriod: { academicYearId } },
    });
    if (!sequence) {
      res.status(404).json({ message: "Séquence introuvable pour cette année scolaire" });
      return;
    }

    const schoolConfig = await prisma.schoolConfig.findUnique({
      where: { schoolId },
      select: { sequenceCalculationMode: true },
    });
    const calcMode = (schoolConfig?.sequenceCalculationMode ?? "single") as "single" | "triple" | "weighted";

    // Calculer la moyenne de la séquence
    const gradeData = {
      sequenceScore: sequenceScore !== undefined ? Number(sequenceScore) : null,
      classTestScore: classTestScore !== undefined ? Number(classTestScore) : null,
      terminalExamScore: terminalExamScore !== undefined ? Number(terminalExamScore) : null,
      theoreticalScore: theoreticalScore !== undefined ? Number(theoreticalScore) : null,
      practicalScore: practicalScore !== undefined ? Number(practicalScore) : null,
      professionalAttitude: professionalAttitude !== undefined ? Number(professionalAttitude) : null,
      oralScore: oralScore !== undefined ? Number(oralScore) : null,
      selfDevelopmentScore: selfDevelopmentScore !== undefined ? Number(selfDevelopmentScore) : null,
      maxValue: Number(maxValue ?? 20),
    };

    const sequenceAverage = computeSequenceAverage({
      ...gradeData,
      seq1Score: req.body.seq1Score !== undefined ? Number(req.body.seq1Score) : null,
      seq2Score: req.body.seq2Score !== undefined ? Number(req.body.seq2Score) : null,
      compositionScore: req.body.compositionScore !== undefined ? Number(req.body.compositionScore) : null,
    }, calcMode);

    // Vérifier si une note existe déjà pour cet élève/matière/séquence
    const existing = await prisma.grade.findUnique({
      where: { studentId_subjectId_sequenceId: { studentId, subjectId, sequenceId } },
    });

    if (existing) {
      // Bloquer la modification si déjà validée
      if (existing.validationStatus === "VALIDATED" || existing.validationStatus === "LOCKED") {
        res.status(409).json({
          message: "Cette note est déjà validée et ne peut plus être modifiée",
          validationStatus: existing.validationStatus,
        });
        return;
      }
    }

    const grade = await prisma.grade.upsert({
      where: { studentId_subjectId_sequenceId: { studentId, subjectId, sequenceId } },
      create: {
        schoolId,
        studentId,
        subjectId,
        classId,
        academicYearId,
        sequenceId,
        ...gradeData,
        coefficient: Number(coefficient ?? 1),
        sequenceAverage,
        validationStatus: "DRAFT",
        recordedById: userId,
      },
      update: {
        ...gradeData,
        coefficient: Number(coefficient ?? 1),
        sequenceAverage,
        validationStatus: "DRAFT",
        recordedById: userId,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logActivity({
      userId,
      schoolId,
      action: "Grade recorded",
      details: `${grade.student.firstName} ${grade.student.lastName} — ${grade.subject.name} : ${sequenceAverage}/${gradeData.maxValue}`,
    });

    res.status(201).json({ grade, sequenceAverage });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── MODIFIER UNE NOTE ────────────────────────────────────────

// @route   PUT /api/grades/:id
// @access  Private (Teacher, Admin)
export const updateGrade = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const role = getRole(req);

    const grade = await prisma.grade.findFirst({
      where: { id: String(req.params.id), schoolId },
    });

    if (!grade) {
      res.status(404).json({ message: "Note introuvable" });
      return;
    }

    if (grade.validationStatus !== "DRAFT" && grade.validationStatus !== "REJECTED") {
      res.status(409).json({
        message: `Impossible de modifier une note en statut ${grade.validationStatus}`,
        validationStatus: grade.validationStatus,
      });
      return;
    }

    if (role === "TEACHER") {
      const assigned = await isTeacherAssignedToSubject(userId, grade.subjectId);
      if (!assigned) {
        res.status(403).json({ message: "Tu n'es pas assigné à cette matière" });
        return;
      }
    }

    const schoolConfig = await prisma.schoolConfig.findUnique({
      where: { schoolId },
      select: { sequenceCalculationMode: true },
    });
    const calcMode = (schoolConfig?.sequenceCalculationMode ?? "single") as "single" | "triple" | "weighted";

    const gradeData = {
      sequenceScore: req.body.sequenceScore !== undefined ? Number(req.body.sequenceScore) : grade.sequenceScore,
      classTestScore: req.body.classTestScore !== undefined ? Number(req.body.classTestScore) : grade.classTestScore,
      terminalExamScore: req.body.terminalExamScore !== undefined ? Number(req.body.terminalExamScore) : grade.terminalExamScore,
      theoreticalScore: req.body.theoreticalScore !== undefined ? Number(req.body.theoreticalScore) : grade.theoreticalScore,
      practicalScore: req.body.practicalScore !== undefined ? Number(req.body.practicalScore) : grade.practicalScore,
      professionalAttitude: req.body.professionalAttitude !== undefined ? Number(req.body.professionalAttitude) : grade.professionalAttitude,
      oralScore: req.body.oralScore !== undefined ? Number(req.body.oralScore) : grade.oralScore,
      selfDevelopmentScore: req.body.selfDevelopmentScore !== undefined ? Number(req.body.selfDevelopmentScore) : grade.selfDevelopmentScore,
      maxValue: req.body.maxValue !== undefined ? Number(req.body.maxValue) : Number(grade.maxValue),
    };

    const sequenceAverage = computeSequenceAverage({
      ...gradeData,
      seq1Score: req.body.seq1Score !== undefined ? Number(req.body.seq1Score) : null,
      seq2Score: req.body.seq2Score !== undefined ? Number(req.body.seq2Score) : null,
      compositionScore: req.body.compositionScore !== undefined ? Number(req.body.compositionScore) : null,
    }, calcMode);

    const updated = await prisma.grade.update({
      where: { id: grade.id },
      data: {
        ...gradeData,
        sequenceAverage,
        validationStatus: "DRAFT",
        rejectionReason: null,
        recordedById: userId,
      },
      include: {
        subject: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json({ grade: updated });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── SOUMETTRE POUR VALIDATION ────────────────────────────────

// @route   POST /api/grades/:id/submit
// @access  Private (Teacher, Admin)
export const submitGrade = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const role = getRole(req);

    const grade = await prisma.grade.findFirst({
      where: { id: String(req.params.id), schoolId },
    });

    if (!grade) {
      res.status(404).json({ message: "Note introuvable" });
      return;
    }

    if (grade.validationStatus !== "DRAFT" && grade.validationStatus !== "REJECTED") {
      res.status(409).json({
        message: `Cette note est déjà en statut ${grade.validationStatus}`,
      });
      return;
    }

    if (grade.sequenceAverage === null) {
      res.status(400).json({ message: "Impossible de soumettre une note sans valeur" });
      return;
    }

    if (role === "TEACHER") {
      const assigned = await isTeacherAssignedToSubject(userId, grade.subjectId);
      if (!assigned) {
        res.status(403).json({ message: "Tu n'es pas assigné à cette matière" });
        return;
      }
    }

    const updated = await prisma.grade.update({
      where: { id: grade.id },
      data: { validationStatus: "SUBMITTED" },
      include: {
        subject: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Déclencher la relance Inngest (48h → Censeur, 72h → Admin)
    await inngest.send({
      name: "grade/submitted",
      data: {
        gradeId: grade.id,
        schoolId,
        classId: grade.classId,
        subjectId: grade.subjectId,
        sequenceId: grade.sequenceId,
        submittedAt: new Date().toISOString(),
      },
    });

    res.json({ grade: updated, message: "Note soumise pour validation" });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── VALIDER UNE NOTE ─────────────────────────────────────────

// @route   POST /api/grades/:id/validate
// @access  Private (STAFF avec VALIDATE_GRADES, Admin)
export const validateGrade = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);

    if (!hasPermission(req, "VALIDATE_GRADES")) {
      res.status(403).json({ message: "Permission VALIDATE_GRADES requise" });
      return;
    }

    const grade = await prisma.grade.findFirst({
      where: { id: String(req.params.id), schoolId },
    });

    if (!grade) {
      res.status(404).json({ message: "Note introuvable" });
      return;
    }

    if (grade.validationStatus !== "SUBMITTED") {
      res.status(409).json({
        message: `Seules les notes en statut SUBMITTED peuvent être validées. Statut actuel : ${grade.validationStatus}`,
      });
      return;
    }

    const updated = await prisma.grade.update({
      where: { id: grade.id },
      data: {
        validationStatus: "VALIDATED",
        validatedById: userId,
        validatedAt: new Date(),
        rejectionReason: null,
      },
      include: {
        subject: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logActivity({
      userId,
      schoolId,
      action: "Grade validated",
      details: `${updated.student.firstName} ${updated.student.lastName} — ${updated.subject.name}`,
    });

    res.json({ grade: updated, message: "Note validée" });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── REJETER UNE NOTE ─────────────────────────────────────────

// @route   POST /api/grades/:id/reject
// @access  Private (STAFF avec VALIDATE_GRADES, Admin)
export const rejectGrade = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);

    if (!hasPermission(req, "VALIDATE_GRADES")) {
      res.status(403).json({ message: "Permission VALIDATE_GRADES requise" });
      return;
    }

    const reason = String(req.body?.reason || "").trim();
    if (!reason) {
      res.status(400).json({ message: "Un motif de rejet est obligatoire" });
      return;
    }

    const grade = await prisma.grade.findFirst({
      where: { id: String(req.params.id), schoolId },
    });

    if (!grade) {
      res.status(404).json({ message: "Note introuvable" });
      return;
    }

    if (grade.validationStatus !== "SUBMITTED") {
      res.status(409).json({
        message: `Seules les notes en statut SUBMITTED peuvent être rejetées`,
      });
      return;
    }

    const updated = await prisma.grade.update({
      where: { id: grade.id },
      data: {
        validationStatus: "DRAFT",
        rejectionReason: reason,
      },
      include: {
        subject: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logActivity({
      userId,
      schoolId,
      action: "Grade rejected",
      details: `${updated.student.firstName} ${updated.student.lastName} — ${updated.subject.name} — Motif: ${reason}`,
    });

    res.json({ grade: updated, message: "Note rejetée" });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── VALIDATION EN BLOC ───────────────────────────────────────

// @route   POST /api/grades/bulk-validate
// @access  Private (STAFF avec VALIDATE_GRADES, Admin)
export const bulkValidateGrades = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);

    if (!hasPermission(req, "VALIDATE_GRADES")) {
      res.status(403).json({ message: "Permission VALIDATE_GRADES requise" });
      return;
    }

    const { classId, subjectId, sequenceId } = req.body;

    if (!sequenceId) {
      res.status(400).json({ message: "sequenceId est requis" });
      return;
    }

    const where: any = {
      schoolId,
      sequenceId,
      validationStatus: "SUBMITTED",
      ...(classId ? { classId } : {}),
      ...(subjectId ? { subjectId } : {}),
    };

    const result = await prisma.grade.updateMany({
      where,
      data: {
        validationStatus: "VALIDATED",
        validatedById: userId,
        validatedAt: new Date(),
        rejectionReason: null,
      },
    });

    await logActivity({
      userId,
      schoolId,
      action: "Bulk grade validation",
      details: `${result.count} notes validées — séquence ${sequenceId}${classId ? ` — classe ${classId}` : ""}${subjectId ? ` — matière ${subjectId}` : ""}`,
    });

    res.json({
      message: `${result.count} note(s) validée(s)`,
      count: result.count,
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── RÉCUPÉRER LES NOTES ──────────────────────────────────────

// @route   GET /api/grades
// @access  Private (Teacher, Admin, Staff, Student, Parent)
export const getGrades = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const role = getRole(req);

    const {
      classId,
      subjectId,
      sequenceId,
      studentId,
      validationStatus,
      page = "1",
      limit = "50",
    } = req.query as Record<string, string>;

    const where: any = {
      schoolId,
      ...(classId ? { classId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(sequenceId ? { sequenceId } : {}),
      ...(validationStatus ? { validationStatus } : {}),
    };

    // Restrictions par rôle
    if (role === "STUDENT") {
      where.studentId = userId;
    } else if (role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId },
        include: { teacherSubjects: true },
      });
      const assignedSubjectIds = teacherProfile?.teacherSubjects.map((ts) => ts.subjectId) ?? [];
      if (assignedSubjectIds.length === 0) {
        res.json({ grades: [], pagination: { total: 0, page: 1, pages: 0 } });
        return;
      }
      where.subjectId = { in: assignedSubjectIds };
    } else if (role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId },
        include: { children: { include: { studentProfile: true } } },
      });
      const childIds = parentProfile?.children
        .map((c) => c.studentProfile?.userId)
        .filter((id): id is string => Boolean(id)) ?? [];
      if (childIds.length === 0) {
        res.json({ grades: [], pagination: { total: 0, page: 1, pages: 0 } });
        return;
      }
      where.studentId = studentId && childIds.includes(studentId) ? studentId : { in: childIds };
    } else if (studentId) {
      where.studentId = studentId;
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [total, grades] = await Promise.all([
      prisma.grade.count({ where }),
      prisma.grade.findMany({
        where,
        include: {
          subject: { select: { id: true, name: true, code: true, coefficient: true } },
          student: { select: { id: true, firstName: true, lastName: true } },
          validatedBy: { select: { id: true, firstName: true, lastName: true } },
          recordedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ classId: "asc" }, { subjectId: "asc" }, { studentId: "asc" }],
        skip,
        take: limitNum,
      }),
    ]);

    res.json({
      grades,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── RÉCUPÉRER LES NOTES EN ATTENTE (vue Censeur) ────────────

// @route   GET /api/grades/pending
// @access  Private (STAFF avec VALIDATE_GRADES, Admin)
export const getPendingGrades = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = getSchoolId(req);

    if (!hasPermission(req, "VALIDATE_GRADES")) {
      res.status(403).json({ message: "Permission VALIDATE_GRADES requise" });
      return;
    }

    const { classId, subjectId, sequenceId } = req.query as Record<string, string>;

    const where: any = {
      schoolId,
      validationStatus: "SUBMITTED",
      ...(classId ? { classId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(sequenceId ? { sequenceId } : {}),
    };

    const grades = await prisma.grade.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ classId: "asc" }, { subjectId: "asc" }],
    });

    // Grouper par classe et matière pour faciliter la validation en bloc
    const grouped: Record<string, Record<string, typeof grades>> = {};
    for (const grade of grades) {
      const classKey = grade.classId;
      const subjectKey = grade.subjectId;
      if (!grouped[classKey]) grouped[classKey] = {};
      if (!grouped[classKey][subjectKey]) grouped[classKey][subjectKey] = [];
      grouped[classKey][subjectKey].push(grade);
    }

    res.json({
      grades,
      grouped,
      total: grades.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── STATUT DES NOTES PAR CLASSE (vue Admin) ─────────────────

// @route   GET /api/grades/status/:classId
// @access  Private (Admin, STAFF)
export const getGradeStatusByClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = getSchoolId(req);
    const { classId } = req.params;
    const { sequenceId } = req.query as { sequenceId?: string };

    const where: any = {
      schoolId,
      classId,
      ...(sequenceId ? { sequenceId } : {}),
    };

    const grades = await prisma.grade.findMany({
      where,
      select: {
        id: true,
        subjectId: true,
        studentId: true,
        validationStatus: true,
        sequenceAverage: true,
        subject: { select: { name: true } },
        student: { select: { firstName: true, lastName: true } },
      },
    });

    // Statistiques par statut
    const stats = {
      total: grades.length,
      DRAFT: grades.filter((g) => g.validationStatus === "DRAFT").length,
      SUBMITTED: grades.filter((g) => g.validationStatus === "SUBMITTED").length,
      VALIDATED: grades.filter((g) => g.validationStatus === "VALIDATED").length,
      LOCKED: grades.filter((g) => g.validationStatus === "LOCKED").length,
      REJECTED: grades.filter((g) => g.validationStatus === "REJECTED").length,
    };

    // Regrouper par matière
    const bySubject: Record<string, { subjectName: string; grades: typeof grades }> = {};
    for (const grade of grades) {
      if (!bySubject[grade.subjectId]) {
        bySubject[grade.subjectId] = { subjectName: grade.subject.name, grades: [] };
      }
      bySubject[grade.subjectId].grades.push(grade);
    }

    // Vérifier si le bulletin peut être généré (toutes notes VALIDATED ou LOCKED)
    const canGenerateReportCard = grades.length > 0 &&
      grades.every((g) => g.validationStatus === "VALIDATED" || g.validationStatus === "LOCKED");

    res.json({
      classId,
      stats,
      bySubject,
      canGenerateReportCard,
      grades,
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── MOYENNE GÉNÉRALE D'UN ÉLÈVE ──────────────────────────────

// @route   GET /api/grades/average/:studentId
// @access  Private
export const getStudentAverage = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId } = req.params;
    const { classId, sequenceId } = req.query as { classId?: string; sequenceId?: string };

    if (!classId || !sequenceId) {
      res.status(400).json({ message: "classId et sequenceId sont requis" });
      return;
    }

    const result = await computeGeneralAverage(
      String(studentId), String(classId), String(sequenceId), schoolId
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};
