import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";
import { inngest } from "../inngest/index.ts";

const DEFAULT_TEACHING_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MIN_PERIOD_DURATION_MINUTES = 40;
const LUNCH_BREAK_MINUTES = 60;

const toMinutes = (time: string) => {
  const parts = time.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
};

const normalizeSettings = (settings: any) => {
  const startTime = settings?.startTime;
  const endTime = settings?.endTime;

  if (!startTime || !endTime) {
    throw new Error("Start time and end time are required");
  }

  if (toMinutes(endTime) <= toMinutes(startTime)) {
    throw new Error("End time must be greater than start time");
  }

  const periodsPerDay = Number(settings?.periodsPerDay ?? settings?.periods ?? 5);
  if (!Number.isFinite(periodsPerDay) || periodsPerDay < 1) {
    throw new Error("Periods per day must be at least 1");
  }

  const teachingDays = Array.isArray(settings?.teachingDays)
    ? settings.teachingDays.filter((day: string) => DEFAULT_TEACHING_DAYS.includes(day))
    : DEFAULT_TEACHING_DAYS;

  if (teachingDays.length === 0) {
    throw new Error("At least one teaching day is required");
  }

  const totalDayMinutes = toMinutes(endTime) - toMinutes(startTime);
  const lunchBreak = periodsPerDay > 1 ? LUNCH_BREAK_MINUTES : 0;
  const teachingMinutes = totalDayMinutes - lunchBreak;

  if (teachingMinutes <= 0) {
    throw new Error("Time range is too short for the selected configuration");
  }

  const periodDuration = Math.floor(teachingMinutes / periodsPerDay);
  if (periodDuration < MIN_PERIOD_DURATION_MINUTES) {
    throw new Error(
      `Configuration is too tight. Increase time range or reduce periods per day (minimum ${MIN_PERIOD_DURATION_MINUTES} minutes per period).`
    );
  }

  return {
    startTime,
    endTime,
    periodsPerDay,
    teachingDays,
    periods: periodsPerDay,
    lunchBreakMinutes: lunchBreak,
    periodDuration,
  };
};

// @desc    Generate a Timetable using AI
// @route   POST /api/timetables/generate
// @access  Private/Admin
export const generateTimetable = async (req: Request, res: Response) => {
  try {
    const { classId, academicYearId, settings } = req.body;
    const normalizedSettings = normalizeSettings(settings);
    const schoolId = (req as any).user?.schoolId;

    const classData = await prisma.class.findFirst({
      where: { id: classId, ...(schoolId ? { schoolId } : {}) },
    });
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    const subjectRows = await prisma.subject.findMany({ where: { schoolId: classData.schoolId } });
    const subjectIds = subjectRows.map((s) => s.id);
    if (subjectIds.length === 0) {
      return res.status(400).json({
        message: "No subjects assigned to this class",
      });
    }

    const teacherProfiles = await prisma.teacherProfile.findMany({
      where: { teacherSubjects: { some: { subjectId: { in: subjectIds } } } },
      include: { teacherSubjects: true, user: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (teacherProfiles.length === 0) {
      return res.status(400).json({
        message: "No teachers assigned to these class subjects",
      });
    }

    const generation = await prisma.timetable.create({
      data: {
        schoolId: schoolId || "",
        classId,
        academicYearId,
        status: "DRAFT",
        generatedByAI: true,
      },
    });

    await inngest.send({
      name: "generate/timetable",
      data: {
        classId,
        academicYearId,
        settings: normalizedSettings,
        generationId: generation.id,
      },
    });
    const userId = (req as any).user.userId;
    await logActivity({
      userId,
      schoolId,
      action: `Requested timetable generation for class ID: ${classId}`,
    });
    res.status(200).json({
      message: "Timetable generation initiated",
      generationId: generation.id,
      status: generation.status,
      settings: normalizedSettings,
    });
  } catch (error: any) {
    const message = error?.message || "Server Error";
    const status =
      message.includes("required") ||
      message.includes("greater") ||
      message.includes("At least") ||
      message.includes("Periods per day")
        ? 400
        : 500;
    res.status(status).json({ message });
  }
};

// @desc    Get Timetable by Class
// @route   GET /api/timetables/:classId
export const getTimetable = async (req: Request, res: Response) => {
  try {
    const timetable = await prisma.timetable.findFirst({
      where: { classId: String(req.params.classId) },
      include: {
        slots: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!timetable)
      return res.status(404).json({ message: "Timetable not found" });

    res.json(timetable);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getTimetableGeneration = async (req: Request, res: Response) => {
  try {
    const generation = await prisma.timetable.findFirst({
      where: { id: String(req.params.id) },
      include: {
        class: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });

    if (!generation) {
      return res.status(404).json({ message: "Generation not found" });
    }

    res.json({ generation });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── HELPERS ─────────────────────────────────────────────────

const getSchoolId = (req: Request): string => (req as any).user?.schoolId as string;
const getUserId = (req: Request): string => (req as any).user?.userId as string;

const detectTeacherConflict = async (
  teacherId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeSlotId?: string
): Promise<{ conflict: boolean; conflictWith?: string }> => {
  const slots = await prisma.timetableSlot.findMany({
    where: {
      teacherId,
      dayOfWeek,
      ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
    },
    include: { timetable: { select: { classId: true, class: { select: { name: true } } } } },
  });

  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  for (const slot of slots) {
    const slotStart = toMinutes(slot.startTime);
    const slotEnd = toMinutes(slot.endTime);
    if (startMinutes < slotEnd && endMinutes > slotStart) {
      return {
        conflict: true,
        conflictWith: (slot.timetable as any)?.class?.name ?? "une autre classe",
      };
    }
  }
  return { conflict: false };
};

const getWeeklyHours = async (teacherId: string): Promise<number> => {
  const slots = await prisma.timetableSlot.findMany({
    where: { teacherId, kind: "CLASS" },
    select: { startTime: true, endTime: true },
  });

  const totalMinutes = slots.reduce((sum, slot) => {
    return sum + (toMinutes(slot.endTime) - toMinutes(slot.startTime));
  }, 0);

  return totalMinutes / 60;
};

// ─── CRÉER UN EDT MANUEL ──────────────────────────────────────

// @route   POST /api/timetables/manual
// @access  Private (Admin, STAFF avec MANAGE_TIMETABLE)
export const createManualTimetable = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const { classId, academicYearId } = req.body;

    if (!classId || !academicYearId) {
      return res.status(400).json({ message: "classId et academicYearId sont requis" });
    }

    const schoolClass = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!schoolClass) {
      return res.status(404).json({ message: "Classe introuvable" });
    }

    const existing = await prisma.timetable.findFirst({
      where: { classId, academicYearId, schoolId },
    });

    if (existing) {
      return res.json({ message: "EDT déjà existant", timetable: existing });
    }

    const timetable = await prisma.timetable.create({
      data: {
        schoolId,
        classId,
        academicYearId,
        status: "DRAFT",
        generatedByAI: false,
      },
    });

    await logActivity({ userId, schoolId, action: "Manual timetable created", details: `Classe ${classId}` });

    return res.status(201).json({ timetable });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── AJOUTER UN CRÉNEAU ───────────────────────────────────────

// @route   POST /api/timetables/:id/slots
// @access  Private (Admin, STAFF avec MANAGE_TIMETABLE)
export const addSlot = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const timetableId = String(req.params.id);
    const {
      subjectId,
      teacherId,
      dayOfWeek,
      startTime,
      endTime,
      room,
      kind = "CLASS",
      subGroupId,
    } = req.body;

    if (!dayOfWeek && dayOfWeek !== 0) {
      return res.status(400).json({ message: "dayOfWeek est requis (0=Lun, 1=Mar, ...)" });
    }
    if (!startTime || !endTime) {
      return res.status(400).json({ message: "startTime et endTime sont requis" });
    }

    const timetable = await prisma.timetable.findFirst({
      where: { id: timetableId, schoolId },
    });
    if (!timetable) {
      return res.status(404).json({ message: "Emploi du temps introuvable" });
    }

    if (teacherId && kind === "CLASS") {
      const { conflict, conflictWith } = await detectTeacherConflict(
        teacherId,
        Number(dayOfWeek),
        startTime,
        endTime
      );
      if (conflict) {
        return res.status(409).json({
          message: `Conflit détecté : cet enseignant a déjà un cours dans ${conflictWith} à ce créneau`,
          conflict: true,
        });
      }

      const teacher = await prisma.user.findUnique({
        where: { id: teacherId },
        include: { staffProfile: { include: { permissions: true } } },
      });

      const isAP = teacher?.staffProfile?.permissions.some(
        (p) => p.permission === "SUPERVISE_TEACHERS" || p.permission === "SUPERVISE_DEPARTMENT_TEACHERS"
      );

      if (isAP) {
        const currentHours = await getWeeklyHours(teacherId);
        const newSlotMinutes = toMinutes(endTime) - toMinutes(startTime);
        const newSlotHours = newSlotMinutes / 60;
        if (currentHours + newSlotHours > 14) {
          return res.status(409).json({
            message: `Volume horaire AP dépassé : ${currentHours.toFixed(1)}h actuelles + ${newSlotHours.toFixed(1)}h > 14h/semaine (Circulaire 32/09/MINESEC/IGE)`,
            conflict: true,
          });
        }
      }
    }

    const slot = await prisma.timetableSlot.create({
      data: {
        timetableId,
        subjectId: subjectId || null,
        teacherId: teacherId || null,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        room: room || null,
        kind: kind as any,
        subGroupId: subGroupId || null,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subGroup: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({ slot });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── MODIFIER UN CRÉNEAU ──────────────────────────────────────

// @route   PUT /api/timetables/:id/slots/:slotId
// @access  Private (Admin, STAFF avec MANAGE_TIMETABLE)
export const updateSlot = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const timetableId = String(req.params.id);
    const slotId = String(req.params.slotId);

    const timetable = await prisma.timetable.findFirst({ where: { id: timetableId, schoolId } });
    if (!timetable) {
      return res.status(404).json({ message: "Emploi du temps introuvable" });
    }

    const slot = await prisma.timetableSlot.findFirst({ where: { id: slotId, timetableId } });
    if (!slot) {
      return res.status(404).json({ message: "Créneau introuvable" });
    }

    const { subjectId, teacherId, dayOfWeek, startTime, endTime, room, kind, subGroupId } = req.body;

    const newTeacherId = teacherId !== undefined ? teacherId : slot.teacherId;
    const newDayOfWeek = dayOfWeek !== undefined ? Number(dayOfWeek) : slot.dayOfWeek;
    const newStartTime = startTime ?? slot.startTime;
    const newEndTime = endTime ?? slot.endTime;
    const newKind = kind ?? slot.kind;

    if (newTeacherId && newKind === "CLASS") {
      const { conflict, conflictWith } = await detectTeacherConflict(
        newTeacherId,
        newDayOfWeek,
        newStartTime,
        newEndTime,
        slotId
      );
      if (conflict) {
        return res.status(409).json({
          message: `Conflit : cet enseignant a un cours dans ${conflictWith} à ce créneau`,
          conflict: true,
        });
      }
    }

    const updated = await prisma.timetableSlot.update({
      where: { id: slotId },
      data: {
        ...(subjectId !== undefined ? { subjectId: subjectId || null } : {}),
        ...(teacherId !== undefined ? { teacherId: teacherId || null } : {}),
        ...(dayOfWeek !== undefined ? { dayOfWeek: Number(dayOfWeek) } : {}),
        ...(startTime !== undefined ? { startTime } : {}),
        ...(endTime !== undefined ? { endTime } : {}),
        ...(room !== undefined ? { room: room || null } : {}),
        ...(kind !== undefined ? { kind: kind as any } : {}),
        ...(subGroupId !== undefined ? { subGroupId: subGroupId || null } : {}),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return res.json({ slot: updated });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── SUPPRIMER UN CRÉNEAU ─────────────────────────────────────

// @route   DELETE /api/timetables/:id/slots/:slotId
// @access  Private (Admin, STAFF avec MANAGE_TIMETABLE)
export const deleteSlot = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const timetableId = String(req.params.id);
    const slotId = String(req.params.slotId);

    const timetable = await prisma.timetable.findFirst({ where: { id: timetableId, schoolId } });
    if (!timetable) {
      return res.status(404).json({ message: "Emploi du temps introuvable" });
    }

    await prisma.timetableSlot.deleteMany({ where: { id: slotId, timetableId } });

    return res.json({ message: "Créneau supprimé" });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── PUBLIER UN EDT ───────────────────────────────────────────

// @route   PUT /api/timetables/:id/publish
// @access  Private (Admin, STAFF avec MANAGE_TIMETABLE)
export const publishTimetable = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const timetableId = String(req.params.id);

    const timetable = await prisma.timetable.findFirst({
      where: { id: timetableId, schoolId },
      include: { slots: true },
    });
    if (!timetable) {
      return res.status(404).json({ message: "Emploi du temps introuvable" });
    }

    if (!timetable.slots.length) {
      return res.status(400).json({ message: "Impossible de publier un EDT vide" });
    }

    const updated = await prisma.timetable.update({
      where: { id: timetableId },
      data: { status: "PUBLISHED" },
    });

    await logActivity({
      userId,
      schoolId,
      action: "Timetable published",
      details: `EDT ${timetableId} publié`,
    });

    return res.json({ message: "EDT publié", timetable: updated });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── RÉCUPÉRER L'EDT AVEC CRÉNEAUX ────────────────────────────

// @route   GET /api/timetables/:classId/full
// @access  Private
export const getTimetableFull = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const classId = String(req.params.classId);

    const timetable = await prisma.timetable.findFirst({
      where: { classId, schoolId },
      include: {
        slots: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
            subGroup: { select: { id: true, name: true } },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
        class: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });

    if (!timetable) {
      return res.status(404).json({ message: "Emploi du temps introuvable" });
    }

    return res.json({ timetable });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── DEMANDE DE RATTRAPAGE ────────────────────────────────────

// @route   POST /api/timetables/catchup-requests
// @access  Private (Teacher, Admin)
export const createCatchupRequest = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const { classId, subjectId, proposedDate, proposedStartTime, proposedEndTime, reason } = req.body;

    if (!classId || !proposedDate) {
      return res.status(400).json({ message: "classId et proposedDate sont requis" });
    }

    await logActivity({
      userId,
      schoolId,
      action: "Catchup request created",
      details: `Classe ${classId} — ${proposedDate} ${proposedStartTime ?? ""}–${proposedEndTime ?? ""} — ${reason ?? ""}`,
    });

    await inngest.send({
      name: "catchup/requested",
      data: { schoolId, classId, subjectId, proposedDate, proposedStartTime, proposedEndTime, reason, requestedById: userId },
    });

    return res.status(201).json({ message: "Demande de rattrapage soumise", status: "pending" });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};