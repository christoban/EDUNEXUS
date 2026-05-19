import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";

// @desc    Create a new Academic Year
// @route   POST /api/academic-years
// @access  Private/Admin
export const createAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, fromYear, toYear, isCurrent } = req.body;
    const schoolId = (req as any).user?.schoolId;

    if (!schoolId) {
      res.status(403).json({ message: "Aucun établissement associé" });
      return;
    }

    const existingYear = await prisma.academicYear.findFirst({
      where: { schoolId, name },
    });
    if (existingYear) {
      res.status(400).json({ message: "Academic Year already exists" });
      return;
    }
    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: { schoolId },
        data: { isCurrent: false },
      });
    }
    const academicYear = await prisma.academicYear.create({
      data: {
        schoolId,
        name,
        startDate: new Date(fromYear),
        endDate: new Date(toYear),
        isCurrent: Boolean(isCurrent),
      },
    });
    await logActivity({
      userId: (req as any).user.userId,
      schoolId,
      action: `Created academic year ${name}`,
    });
    res.status(201).json(academicYear);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get all Academic Years (Paginated & Searchable)
// @route   GET /api/academic-years
// @access  Private/Admin
export const getAllAcademicYears = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const schoolId = (req as any).user?.schoolId;

    const where: any = {
      ...(schoolId ? { schoolId } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const [total, years] = await Promise.all([
      prisma.academicYear.count({ where }),
      prisma.academicYear.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      years,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get the current active Academic Year
// @route   GET /api/academic-years/current
// @access  Public or Protected
export const getCurrentAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const schoolId = (req as any).user?.schoolId;
    const currentYear = await prisma.academicYear.findFirst({
      where: {
        ...(schoolId ? { schoolId } : {}),
        isCurrent: true,
      },
    });
    if (!currentYear) {
      res.status(404).json({ message: "No current academic year found" });
      return;
    } else {
      res.status(200).json(currentYear);
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update Academic Year
// @route   PUT /api/academic-years/:id
// @access  Private/Admin
export const updateAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { isCurrent } = req.body;
    const schoolId = (req as any).user?.schoolId;
    const academicYearId = String(req.params.id);
    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: {
          ...(schoolId ? { schoolId } : {}),
          id: { not: academicYearId },
        },
        data: { isCurrent: false },
      });
    }
    const updatedYear = await prisma.academicYear.update({
      where: { id: academicYearId },
      data: {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.fromYear !== undefined ? { startDate: new Date(req.body.fromYear) } : {}),
        ...(req.body.toYear !== undefined ? { endDate: new Date(req.body.toYear) } : {}),
        ...(isCurrent !== undefined ? { isCurrent: Boolean(isCurrent) } : {}),
      },
    });
    if (!updatedYear) {
      res.status(404).json({ message: "Academic Year not found" });
      return;
    }
    await logActivity({
      userId: (req as any).user.userId,
      schoolId,
      action: `Created academic year ${updatedYear?.name}`,
    });
    res.status(200).json(updatedYear);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Delete Academic Year
// @route   DELETE /api/academic-years/:id
// @access  Private/Admin
export const deleteAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const schoolId = (req as any).user?.schoolId;
    const academicYearId = String(req.params.id);
    const year = await prisma.academicYear.findFirst({
      where: {
        id: academicYearId,
        ...(schoolId ? { schoolId } : {}),
      },
    });
    if (!year) {
      res.status(404).json({ message: "Academic Year not found" });
      return;
    }
    if (year) {
      // Prevent deletion if it's the current academic year to avoid system breakage
      if (year.isCurrent) {
        res
          .status(400)
          .json({ message: "Cannot delete the current academic year" });
        return;
      }
    }
    await prisma.academicYear.delete({ where: { id: year.id } });

    await logActivity({
      userId: (req as any).user.userId,
      schoolId,
      action: `Deleted academic year ${year.name}`,
    });
    res.status(200).json({ message: "Academic Year deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get all sequences for the school
// @route   GET /api/academic-years/sequences
// @access  Private
export const getSequences = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = (req as any).user?.schoolId;
    const { academicPeriodId, currentOnly } = req.query;

    const where: any = { schoolId };
    if (academicPeriodId) where.academicPeriodId = String(academicPeriodId);
    if (currentOnly === "true") where.isCurrent = true;

    const sequences = await prisma.academicSequence.findMany({
      where,
      include: {
        academicPeriod: {
          include: {
            academicYear: { select: { id: true, name: true, isCurrent: true } },
          },
        },
      },
      orderBy: [{ academicPeriod: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    });

    res.json({ sequences });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Set a sequence as current (unsets others in the same period)
// @route   PATCH /api/academic-years/sequences/:id/set-current
// @access  Private/Admin
export const setCurrentSequence = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "ADMIN") {
      res.status(403).json({ message: "Only admins can set current sequence" });
      return;
    }
    const schoolId = currentUser?.schoolId;
    const sequenceId = String(req.params.id);

    const sequence = await prisma.academicSequence.findFirst({
      where: { id: sequenceId, schoolId },
    });

    if (!sequence) {
      res.status(404).json({ message: "Séquence introuvable" });
      return;
    }

    await prisma.academicSequence.updateMany({
      where: { academicPeriodId: sequence.academicPeriodId, schoolId },
      data: { isCurrent: false },
    });

    const updated = await prisma.academicSequence.update({
      where: { id: sequenceId },
      data: { isCurrent: true },
    });

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `Séquence courante: ${updated.name}`,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Set a period as current (unsets others in the same year)
// @route   PATCH /api/academic-years/:id/set-current-period
// @access  Private/Admin
export const setCurrentPeriod = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "ADMIN") {
      res.status(403).json({ message: "Only admins can set current period" });
      return;
    }
    const schoolId = currentUser?.schoolId;
    const periodId = String(req.params.id);

    const period = await prisma.academicPeriod.findFirst({
      where: { id: periodId, academicYear: { schoolId } },
    });

    if (!period) {
      res.status(404).json({ message: "Période introuvable" });
      return;
    }

    await prisma.academicPeriod.updateMany({
      where: { academicYearId: period.academicYearId },
      data: { isCurrent: false },
    });

    const updated = await prisma.academicPeriod.update({
      where: { id: periodId },
      data: { isCurrent: true },
    });

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `Période courante: ${updated.name}`,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update school calendar (periods + sequences dates/structure)
// @route   PUT /api/academic-years/calendar
// @access  Private/Admin
export const updateSchoolCalendar = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "ADMIN") {
      res.status(403).json({ message: "Only admins can update the calendar" });
      return;
    }
    const schoolId = currentUser?.schoolId;
    const { academicYearId, periods } = req.body;

    if (!academicYearId) {
      res.status(400).json({ message: "academicYearId est requis" });
      return;
    }
    if (!Array.isArray(periods) || !periods.length) {
      res.status(400).json({ message: "Un tableau de périodes est requis" });
      return;
    }

    const academicYear = await prisma.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
    });
    if (!academicYear) {
      res.status(404).json({ message: "Année académique introuvable" });
      return;
    }

    const results = await prisma.$transaction(async (tx) => {
      const updatedPeriods = [];
      for (const period of periods) {
        const dbPeriod = period.id
          ? await tx.academicPeriod.update({
              where: { id: period.id },
              data: {
                ...(period.name !== undefined ? { name: period.name } : {}),
                ...(period.type !== undefined ? { type: period.type } : {}),
                ...(period.orderIndex !== undefined ? { orderIndex: period.orderIndex } : {}),
                ...(period.startDate ? { startDate: new Date(period.startDate) } : {}),
                ...(period.endDate ? { endDate: new Date(period.endDate) } : {}),
              },
            })
          : await tx.academicPeriod.create({
              data: {
                academicYearId,
                name: period.name,
                type: period.type ?? "TRIMESTER",
                orderIndex: period.orderIndex ?? 0,
                startDate: new Date(period.startDate),
                endDate: new Date(period.endDate),
              },
            });

        const updatedSequences = [];
        for (const seq of period.sequences ?? []) {
          const dbSeq = seq.id
            ? await tx.academicSequence.update({
                where: { id: seq.id },
                data: {
                  ...(seq.name !== undefined ? { name: seq.name } : {}),
                  ...(seq.type !== undefined ? { type: seq.type } : {}),
                  ...(seq.orderIndex !== undefined ? { orderIndex: seq.orderIndex } : {}),
                  startDate: seq.startDate ? new Date(seq.startDate) : null,
                  endDate: seq.endDate ? new Date(seq.endDate) : null,
                },
              })
            : await tx.academicSequence.create({
                data: {
                  academicPeriodId: dbPeriod.id,
                  schoolId,
                  name: seq.name,
                  type: seq.type,
                  orderIndex: seq.orderIndex ?? 0,
                  startDate: seq.startDate ? new Date(seq.startDate) : null,
                  endDate: seq.endDate ? new Date(seq.endDate) : null,
                },
              });
          updatedSequences.push(dbSeq);
        }

        updatedPeriods.push({ ...dbPeriod, sequences: updatedSequences });
      }
      return updatedPeriods;
    });

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `Calendrier académique mis à jour`,
    });

    res.json({ message: "Calendrier mis à jour", periods: results });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const preCloseCheck = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId as string;

    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "admin") {
      return res.status(403).json({ message: "Réservé aux administrateurs" });
    }

    const yearId = String(req.params.id);
    const year = await prisma.academicYear.findFirst({ where: { id: yearId, schoolId } });
    if (!year) return res.status(404).json({ message: "Année scolaire introuvable" });

    const blockers: { type: string; message: string; count?: number }[] = [];

    const unvalidatedGrades = await prisma.grade.count({
      where: {
        schoolId,
        academicYearId: yearId,
        validationStatus: { notIn: ["VALIDATED", "LOCKED"] },
      },
    });
    if (unvalidatedGrades > 0) {
      blockers.push({
        type: "UNVALIDATED_GRADES",
        message: `${unvalidatedGrades} note(s) non validée(s)`,
        count: unvalidatedGrades,
      });
    }

    const classes = await prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });

    const periods = await prisma.academicPeriod.findMany({
      where: { academicYear: { id: yearId } },
      select: { id: true, name: true },
    });

    let missingReportCards = 0;
    for (const cls of classes) {
      const students = await prisma.studentProfile.count({ where: { classId: cls.id } });
      if (!students) continue;
      for (const period of periods) {
        const generated = await prisma.reportCard.count({
          where: {
            schoolId,
            academicYearId: yearId,
            academicPeriodId: period.id,
            isGenerated: true,
          },
        });
        if (generated < students) {
          missingReportCards += students - generated;
        }
      }
    }
    if (missingReportCards > 0) {
      blockers.push({
        type: "MISSING_REPORT_CARDS",
        message: `${missingReportCards} bulletin(s) non généré(s)`,
        count: missingReportCards,
      });
    }

    const lastPeriod = periods[periods.length - 1];
    if (lastPeriod) {
      const councilSessions = await prisma.classCouncilSession.findMany({
        where: { schoolId, academicPeriodId: lastPeriod.id, status: "LOCKED" },
        select: { classId: true },
      });
      const classesWithCouncil = new Set(councilSessions.map((s) => s.classId));
      const missingCouncils = classes.filter((cls) => !classesWithCouncil.has(cls.id));
      if (missingCouncils.length > 0) {
        blockers.push({
          type: "MISSING_COUNCIL_SESSIONS",
          message: `${missingCouncils.length} classe(s) sans Conseil de Classe pour ${lastPeriod.name}`,
          count: missingCouncils.length,
        });
      }
    }

    const canClose = blockers.length === 0;

    return res.json({
      canClose,
      blockers,
      year: { id: year.id, name: year.name },
      summary: {
        totalBlockers: blockers.length,
        unvalidatedGrades,
        missingReportCards,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

export const closeAcademicYear = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId as string;
    const userId = currentUser?.userId as string;

    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "admin") {
      return res.status(403).json({ message: "Réservé aux administrateurs" });
    }

    const yearId = String(req.params.id);
    const { force = false } = req.body;

    const year = await prisma.academicYear.findFirst({ where: { id: yearId, schoolId } });
    if (!year) return res.status(404).json({ message: "Année scolaire introuvable" });
    if (year.status === "ARCHIVED") {
      return res.status(409).json({ message: "Cette année est déjà archivée" });
    }

    if (!force) {
      const unvalidated = await prisma.grade.count({
        where: { schoolId, academicYearId: yearId, validationStatus: { notIn: ["VALIDATED", "LOCKED"] } },
      });
      if (unvalidated > 0) {
        return res.status(409).json({
          message: `Impossible de clôturer : ${unvalidated} note(s) non validée(s). Utilisez force=true pour forcer.`,
          blocked: true,
          unvalidated,
        });
      }
    }

    const periodIds = await prisma.academicPeriod.findMany({
      where: { academicYear: { id: yearId } },
      select: { id: true },
    }).then((ps) => ps.map((p) => p.id));

    const councilDecisions = await prisma.classCouncilDecision.findMany({
      where: { session: { schoolId, academicPeriodId: { in: periodIds } } },
      include: {
        session: { select: { classId: true } },
        student: { select: { id: true } },
      },
    });

    const promotionMappings = await prisma.classPromotion.findMany({
      where: { schoolId, academicYearId: yearId },
      select: { fromClassId: true, toClassId: true },
    });
    const promotionMap = new Map(promotionMappings.map((m) => [m.fromClassId, m.toClassId]));

    let promoted = 0;
    let repeated = 0;

    await prisma.$transaction(async (tx) => {
      await tx.academicYear.update({
        where: { id: yearId },
        data: { status: "ARCHIVED", isCurrent: false },
      });

      for (const councilDecision of councilDecisions) {
        const studentId = councilDecision.student.id;
        const classId = councilDecision.session.classId;

        if (councilDecision.decision === "PASS" || councilDecision.decision === "DELIBERATION") {
          const toClassId = promotionMap.get(classId);
          if (toClassId) {
            await tx.studentProfile.updateMany({
              where: { userId: studentId },
              data: { classId: toClassId },
            });
            await tx.studentPromotion.upsert({
              where: { studentId_academicYearId: { studentId, academicYearId: yearId } },
              create: { schoolId, studentId, fromClassId: classId, toClassId, academicYearId: yearId, promotedById: userId },
              update: { toClassId, promotedById: userId },
            });
            promoted++;
          }
        } else if (councilDecision.decision === "REPEAT") {
          await tx.studentPromotion.upsert({
            where: { studentId_academicYearId: { studentId, academicYearId: yearId } },
            create: { schoolId, studentId, fromClassId: classId, toClassId: classId, academicYearId: yearId, promotedById: userId },
            update: { toClassId: classId, promotedById: userId },
          });
          repeated++;
        }
      }
    });

    await logActivity({
      userId,
      schoolId,
      action: "Academic year closed",
      details: `Année ${year.name} archivée — ${promoted} promu(s), ${repeated} redoublant(s)`,
    });

    return res.json({
      message: `Année ${year.name} clôturée avec succès`,
      promoted,
      repeated,
      yearId,
    });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};