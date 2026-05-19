-- Revert Timetable to the original unique constraint
DROP INDEX IF EXISTS "Timetable_schoolId_classId_academicYearId_status_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "Timetable_schoolId_classId_academicYearId_key"
ON "Timetable"("schoolId", "classId", "academicYearId");

DO $$
BEGIN
	IF to_regclass('public."SchoolInvite"') IS NOT NULL
		 AND to_regclass('public."MasterUser"') IS NOT NULL
		 AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchoolInvite_invitedByMasterId_fkey') THEN
		ALTER TABLE "SchoolInvite" ADD CONSTRAINT "SchoolInvite_invitedByMasterId_fkey" FOREIGN KEY ("invitedByMasterId") REFERENCES "MasterUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
	END IF;
END
$$;
DO $$
BEGIN
	IF to_regclass('public."SchoolConfig"') IS NOT NULL
		 AND to_regclass('public."User"') IS NOT NULL
		 AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchoolConfig_moderatorUserId_fkey') THEN
		ALTER TABLE "SchoolConfig" ADD CONSTRAINT "SchoolConfig_moderatorUserId_fkey" FOREIGN KEY ("moderatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
	END IF;
END
$$;

DO $$
BEGIN
	IF to_regclass('public."GradeFormula"') IS NOT NULL
		 AND to_regclass('public."School"') IS NOT NULL
		 AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GradeFormula_schoolId_fkey') THEN
		ALTER TABLE "GradeFormula" ADD CONSTRAINT "GradeFormula_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
	END IF;
END
$$;

DO $$
BEGIN
	IF to_regclass('public."MentionRule"') IS NOT NULL
		 AND to_regclass('public."School"') IS NOT NULL
		 AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentionRule_schoolId_fkey') THEN
		ALTER TABLE "MentionRule" ADD CONSTRAINT "MentionRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
	END IF;
END
$$;

DO $$
BEGIN
	IF to_regclass('public."TimetableSlot"') IS NOT NULL
		 AND to_regclass('public."ClassSubGroup"') IS NOT NULL
		 AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_subGroupId_fkey') THEN
		ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_subGroupId_fkey" FOREIGN KEY ("subGroupId") REFERENCES "ClassSubGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
	END IF;
END
$$;

DO $$
BEGIN
	IF to_regclass('public."TimetableSlot"') IS NOT NULL
		 AND to_regclass('public."User"') IS NOT NULL
		 AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_teacherId_fkey') THEN
		ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
	END IF;
END
$$;
