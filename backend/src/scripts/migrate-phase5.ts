import dotenv from "dotenv";
import { connectDB } from "../config/db.ts";
import SchoolSettings from "../models/schoolSettings.ts";
import Section from "../models/section.ts";
import SubSystem from "../models/subSystem.ts";
import { DEFAULT_SCHOOL_SETTINGS } from "../utils/schoolSettings.ts";
import {
  ensureDefaultSubSystems,
  resolveDefaultSubsystemCodeForSection,
} from "../utils/coreDomainDefaults.ts";

dotenv.config();

const resolveOfficialLanguages = (mode: string) => {
  if (mode === "anglophone") return ["en"];
  if (mode === "bilingual") return ["fr", "en"];
  return ["fr"];
};

const run = async () => {
  await connectDB();

  await ensureDefaultSubSystems();

  const settings = await SchoolSettings.findOne();
  if (!settings) {
    await SchoolSettings.create(DEFAULT_SCHOOL_SETTINGS);
    console.log("Created default school settings record.");
  } else {
    let changed = false;

    if (!settings.schoolName) {
      settings.schoolName = DEFAULT_SCHOOL_SETTINGS.schoolName;
      changed = true;
    }
    if (!settings.schoolMotto) {
      settings.schoolMotto = DEFAULT_SCHOOL_SETTINGS.schoolMotto;
      changed = true;
    }
    if (!settings.schoolLogoUrl) {
      settings.schoolLogoUrl = DEFAULT_SCHOOL_SETTINGS.schoolLogoUrl;
      changed = true;
    }
    if (!settings.academicCalendarType) {
      settings.academicCalendarType = DEFAULT_SCHOOL_SETTINGS.academicCalendarType;
      changed = true;
    }
    if (!settings.preferredLanguage) {
      settings.preferredLanguage = DEFAULT_SCHOOL_SETTINGS.preferredLanguage;
      changed = true;
    }
    if (!settings.schoolLanguageMode) {
      settings.schoolLanguageMode = DEFAULT_SCHOOL_SETTINGS.schoolLanguageMode;
      changed = true;
    }
    if (!settings.mode) {
      settings.mode =
        settings.schoolLanguageMode === "anglophone"
          ? "simple_en"
          : settings.schoolLanguageMode === "bilingual"
            ? "bilingual"
            : "simple_fr";
      changed = true;
    }
    if (!Array.isArray(settings.cycles) || settings.cycles.length === 0) {
      settings.cycles = DEFAULT_SCHOOL_SETTINGS.cycles;
      changed = true;
    }
    if (typeof settings.hasMultipleCycles !== "boolean") {
      settings.hasMultipleCycles = DEFAULT_SCHOOL_SETTINGS.hasMultipleCycles;
      changed = true;
    }
    if (!Array.isArray(settings.officialLanguages) || settings.officialLanguages.length === 0) {
      settings.officialLanguages = resolveOfficialLanguages(settings.schoolLanguageMode || "francophone");
      changed = true;
    }

    if (changed) {
      await settings.save();
      console.log(`Normalized school settings record ${String(settings._id)}.`);
    }
  }

  const sectionsWithoutSubsystem = await Section.find({
    $or: [{ subSystem: { $exists: false } }, { subSystem: null }],
  }).lean();

  let sectionUpdates = 0;
  for (const section of sectionsWithoutSubsystem) {
    const subsystemCode = resolveDefaultSubsystemCodeForSection(section.cycle, section.language);
    const subsystem = await SubSystem.findOne({ code: subsystemCode }).select("_id").lean();

    if (!subsystem?._id) {
      console.warn(`Skipped section ${String(section._id)} because subsystem ${subsystemCode} was not found.`);
      continue;
    }

    await Section.updateOne({ _id: section._id }, { $set: { subSystem: subsystem._id } });
    sectionUpdates += 1;
  }

  console.log(`Phase 5 migration completed. Sections backfilled: ${sectionUpdates}.`);
};

run().catch((error: any) => {
  console.error(error?.message || error);
  process.exit(1);
});