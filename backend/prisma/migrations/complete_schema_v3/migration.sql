-- CreateEnum
CREATE TYPE "ReportCardStatus" AS ENUM ('DRAFT', 'GENERATED', 'SENT');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('THEORETICAL', 'PRACTICAL', 'MIXED');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'GRADUATED', 'LEFT', 'TRANSFERRED');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'EXPRESS_UNION';

-- AlterTable
ALTER TABLE "SchoolConfig" ADD COLUMN     "absenceAlertThreshold" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "christmasBreakEnd" TIMESTAMP(3),
ADD COLUMN     "christmasBreakStart" TIMESTAMP(3),
ADD COLUMN     "easterBreakEnd" TIMESTAMP(3),
ADD COLUMN     "easterBreakStart" TIMESTAMP(3),
ADD COLUMN     "schoolYearStartDate" TIMESTAMP(3),
ADD COLUMN     "yearEndDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "exitYear" TEXT,
ADD COLUMN     "studentStatus" "StudentStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "filiere" TEXT,
ADD COLUMN     "serie" TEXT;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "subjectType" "SubjectType" NOT NULL DEFAULT 'THEORETICAL';

-- AlterTable
ALTER TABLE "BacCoefficient" DROP COLUMN "serieA",
ADD COLUMN     "serieA1" DOUBLE PRECISION,
ADD COLUMN     "serieA2" DOUBLE PRECISION,
ADD COLUMN     "serieA3" DOUBLE PRECISION,
ADD COLUMN     "serieA4" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "serieA5" DOUBLE PRECISION,
ADD COLUMN     "serieABI" DOUBLE PRECISION,
ADD COLUMN     "serieAC" DOUBLE PRECISION,
ADD COLUMN     "serieE" DOUBLE PRECISION,
ADD COLUMN     "serieSH" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ReportCard" DROP COLUMN "periodName",
ADD COLUMN     "absenceCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "academicPeriodId" TEXT NOT NULL,
ADD COLUMN     "aiComment" TEXT,
ADD COLUMN     "classMasterComment" TEXT,
ADD COLUMN     "conductGrade" TEXT,
ADD COLUMN     "template" "BulletinTemplate" NOT NULL DEFAULT 'FR_SECONDARY',
ADD COLUMN     "totalStudents" INTEGER,
ADD COLUMN     "validationStatus" "ReportCardStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "TimetableSlot" ADD COLUMN     "subGroupId" TEXT;

-- AlterTable
ALTER TABLE "FeePlan" ADD COLUMN     "feeType" "FeeType" NOT NULL DEFAULT 'TUITION';

-- CreateTable
CREATE TABLE "ReportCardSubjectLine" (
    "id" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "seq1Score" DOUBLE PRECISION,
    "seq2Score" DOUBLE PRECISION,
    "compositionScore" DOUBLE PRECISION,
    "classTestScore" DOUBLE PRECISION,
    "terminalExamScore" DOUBLE PRECISION,
    "theoreticalScore" DOUBLE PRECISION,
    "practicalScore" DOUBLE PRECISION,
    "professionalAttitude" DOUBLE PRECISION,
    "subjectAverage" DOUBLE PRECISION,
    "subjectRank" INTEGER,
    "teacherComment" TEXT,

    CONSTRAINT "ReportCardSubjectLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSubGroup" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ClassSubGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSubGroupAssignment" (
    "studentProfileId" TEXT NOT NULL,
    "subGroupId" TEXT NOT NULL,

    CONSTRAINT "StudentSubGroupAssignment_pkey" PRIMARY KEY ("studentProfileId","subGroupId")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetRoles" "UserRole"[],
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardSubjectLine_reportCardId_subjectId_key" ON "ReportCardSubjectLine"("reportCardId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubGroup_classId_name_key" ON "ClassSubGroup"("classId", "name");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_idx" ON "Announcement"("schoolId");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_isPinned_idx" ON "Announcement"("schoolId", "isPinned");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCard_studentId_academicPeriodId_key" ON "ReportCard"("studentId", "academicPeriodId");

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_academicPeriodId_fkey" FOREIGN KEY ("academicPeriodId") REFERENCES "AcademicPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardSubjectLine" ADD CONSTRAINT "ReportCardSubjectLine_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "ReportCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardSubjectLine" ADD CONSTRAINT "ReportCardSubjectLine_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubGroup" ADD CONSTRAINT "ClassSubGroup_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubGroupAssignment" ADD CONSTRAINT "StudentSubGroupAssignment_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubGroupAssignment" ADD CONSTRAINT "StudentSubGroupAssignment_subGroupId_fkey" FOREIGN KEY ("subGroupId") REFERENCES "ClassSubGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
