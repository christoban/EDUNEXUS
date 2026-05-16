-- Revert Timetable to the original unique constraint
DROP INDEX IF EXISTS "Timetable_schoolId_classId_academicYearId_status_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "Timetable_schoolId_classId_academicYearId_key"
ON "Timetable"("schoolId", "classId", "academicYearId");
