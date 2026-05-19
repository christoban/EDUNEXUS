/*
  Warnings:

  - Added the required column `schoolId` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AttendancePeriod" AS ENUM ('MORNING', 'AFTERNOON');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BulletinTemplate') THEN
    BEGIN
      ALTER TYPE "BulletinTemplate" ADD VALUE 'ANNUAL';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    BEGIN
      ALTER TYPE "BulletinTemplate" ADD VALUE 'MONTHLY';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$$;

-- AlterEnum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SlotKind') THEN
    BEGIN
      ALTER TYPE "SlotKind" ADD VALUE 'TD';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$$;

-- AlterTable
ALTER TABLE IF EXISTS "Attendance" ADD COLUMN     "period" "AttendancePeriod" NOT NULL DEFAULT 'MORNING',
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "teacherId" TEXT;

-- AlterTable
ALTER TABLE IF EXISTS "FeePlan" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "isRefundable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "sectionId" TEXT;

-- AlterTable
ALTER TABLE IF EXISTS "Grade" ADD COLUMN     "oralScore" DOUBLE PRECISION,
ADD COLUMN     "selfDevelopmentScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE IF EXISTS "GradeFormula" ALTER COLUMN "schoolId" DROP NOT NULL;

-- AlterTable
ALTER TABLE IF EXISTS "MentionRule" ALTER COLUMN "schoolId" DROP NOT NULL;

-- AlterTable
ALTER TABLE IF EXISTS "Payment" ADD COLUMN     "campayRef" TEXT,
ADD COLUMN     "campayStatus" TEXT,
ADD COLUMN     "operatorRef" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "webhookData" JSONB;

-- AlterTable
ALTER TABLE IF EXISTS "ReportCard" ADD COLUMN     "rankTrimestre1" INTEGER,
ADD COLUMN     "rankTrimestre2" INTEGER,
ADD COLUMN     "rankTrimestre3" INTEGER;

-- AlterTable
ALTER TABLE IF EXISTS "ReportCardSubjectLine" ADD COLUMN     "competenceLabel" TEXT,
ADD COLUMN     "oralScore" DOUBLE PRECISION,
ADD COLUMN     "selfDevelopmentScore" DOUBLE PRECISION,
ADD COLUMN     "seq3Score" DOUBLE PRECISION,
ADD COLUMN     "seq4Score" DOUBLE PRECISION,
ADD COLUMN     "seq5Score" DOUBLE PRECISION,
ADD COLUMN     "seq6Score" DOUBLE PRECISION,
ADD COLUMN     "weightedScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE IF EXISTS "SchoolTemplate" ADD COLUMN     "ownership" "SchoolOwnership" NOT NULL DEFAULT 'PRIVATE_SECULAR';

-- AlterTable
ALTER TABLE IF EXISTS "Submission" ADD COLUMN     "schoolId" TEXT NOT NULL;

-- DropEnum
DROP TYPE IF EXISTS "GradeType";

-- AddForeignKey
-- Foreign keys are intentionally omitted in this historical migration to keep
-- shadow database replay resilient with legacy baseline order.
