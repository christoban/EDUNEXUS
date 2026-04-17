import { type Request, type Response } from "express";
import AcademicPeriod from "../models/academicPeriod.ts";
import SchoolSettings from "../models/schoolSettings.ts";
import Section from "../models/section.ts";
import SubSystem from "../models/subSystem.ts";
import { logActivity } from "../utils/activitieslog.ts";
import {
  DEFAULT_SUBSYSTEMS,
  ensureDefaultSubSystems,
  resolveDefaultSubsystemCodeForSection,
} from "../utils/coreDomainDefaults.ts";

export const upsertDefaultSubSystems = async (req: Request, res: Response) => {
  try {
    await ensureDefaultSubSystems();

    await logActivity({
      userId: (req as any).user._id,
      action: "Upserted default SubSystems",
    });

    return res.json({ message: "Default SubSystems synchronized", total: DEFAULT_SUBSYSTEMS.length });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getSubSystems = async (_req: Request, res: Response) => {
  try {
    const subsystems = await SubSystem.find({}).sort({ code: 1 }).lean();
    return res.json({ subsystems, total: subsystems.length });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const updateSubSystem = async (req: Request, res: Response) => {
  try {
    const patch = { ...req.body } as any;

    if (patch.passThreshold !== undefined) {
      patch.passThreshold = Number(patch.passThreshold);
    }

    const subSystem = await SubSystem.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });

    if (!subSystem) {
      return res.status(404).json({ message: "SubSystem not found" });
    }

    await logActivity({
      userId: (req as any).user._id,
      action: `Updated subsystem ${subSystem.code}`,
      details: `gradingScale=${subSystem.gradingScale}, passThreshold=${subSystem.passThreshold}, bulletinTemplate=${subSystem.bulletinTemplate || "default"}`,
    });

    return res.json(subSystem);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const createSection = async (req: Request, res: Response) => {
  try {
    const settings = await SchoolSettings.findOne().select("_id").lean();
    const incomingSection = req.body as any;
    const providedSubSystemId = incomingSection.subSystem || incomingSection.subSystemId;

    let resolvedSubSystemId = providedSubSystemId;
    if (!resolvedSubSystemId) {
      await ensureDefaultSubSystems();
      const subsystemCode = resolveDefaultSubsystemCodeForSection(incomingSection.cycle, incomingSection.language);
      const subsystem = await SubSystem.findOne({ code: subsystemCode }).select("_id").lean();
      resolvedSubSystemId = subsystem?._id || null;
    }

    if (!resolvedSubSystemId) {
      return res.status(400).json({ message: "Unable to resolve subsystem for this section" });
    }

    const section = await Section.create({
      schoolSettings: settings?._id || null,
      subSystem: resolvedSubSystemId,
      ...req.body,
    });

    await logActivity({
      userId: (req as any).user._id,
      action: `Created section ${section.name}`,
    });

    return res.status(201).json(section);
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "Section name already exists for this school" });
    }
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getSections = async (_req: Request, res: Response) => {
  try {
    const sections = await Section.find({})
      .populate("subSystem", "code name gradingScale periodType hasCoefficientBySubject passThreshold")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ sections, total: sections.length });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const updateSection = async (req: Request, res: Response) => {
  try {
    const patch: any = { ...req.body };
    if (patch.subSystemId && !patch.subSystem) {
      patch.subSystem = patch.subSystemId;
    }
    delete patch.subSystemId;

    const section = await Section.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    await logActivity({
      userId: (req as any).user._id,
      action: `Updated section ${section.name}`,
    });

    return res.json(section);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const createAcademicPeriod = async (req: Request, res: Response) => {
  try {
    const payload = {
      ...req.body,
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate),
    };

    const period = await AcademicPeriod.create(payload);

    await logActivity({
      userId: (req as any).user._id,
      action: `Created academic period ${period.type}-${period.number}`,
    });

    return res.status(201).json(period);
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "Academic period already exists for this section/year" });
    }
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getAcademicPeriods = async (req: Request, res: Response) => {
  try {
    const query = ((req as any).validatedQuery || req.query) as any;
    const filter: any = {};

    if (query.sectionId) filter.section = query.sectionId;
    if (query.academicYearId) filter.academicYear = query.academicYearId;
    if (query.type) filter.type = query.type;

    const periods = await AcademicPeriod.find(filter)
      .populate("academicYear", "name")
      .populate("section", "name language cycle")
      .sort({ startDate: 1 })
      .lean();

    return res.json({ periods, total: periods.length });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const updateAcademicPeriod = async (req: Request, res: Response) => {
  try {
    const patch: any = { ...req.body };
    if (patch.startDate) patch.startDate = new Date(patch.startDate);
    if (patch.endDate) patch.endDate = new Date(patch.endDate);

    const period = await AcademicPeriod.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });

    if (!period) {
      return res.status(404).json({ message: "Academic period not found" });
    }

    await logActivity({
      userId: (req as any).user._id,
      action: `Updated academic period ${period.type}-${period.number}`,
    });

    return res.json(period);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};
