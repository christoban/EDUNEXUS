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


ALTER TYPE "BulletinTemplate" ADD VALUE 'ANNUAL';
ALTER TYPE "BulletinTemplate" ADD VALUE 'MONTHLY';

-- AlterEnum
ALTER TYPE "SlotKind" ADD VALUE 'TD';

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "period" "AttendancePeriod" NOT NULL DEFAULT 'MORNING',
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "teacherId" TEXT;

-- AlterTable
ALTER TABLE "FeePlan" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "isRefundable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "sectionId" TEXT;

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "oralScore" DOUBLE PRECISION,
ADD COLUMN     "selfDevelopmentScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "GradeFormula" ALTER COLUMN "schoolId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MentionRule" ALTER COLUMN "schoolId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "campayRef" TEXT,
ADD COLUMN     "campayStatus" TEXT,
ADD COLUMN     "operatorRef" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "webhookData" JSONB;

-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN     "rankTrimestre1" INTEGER,
ADD COLUMN     "rankTrimestre2" INTEGER,
ADD COLUMN     "rankTrimestre3" INTEGER;

-- AlterTable
ALTER TABLE "ReportCardSubjectLine" ADD COLUMN     "competenceLabel" TEXT,
ADD COLUMN     "oralScore" DOUBLE PRECISION,
ADD COLUMN     "selfDevelopmentScore" DOUBLE PRECISION,
ADD COLUMN     "seq3Score" DOUBLE PRECISION,
ADD COLUMN     "seq4Score" DOUBLE PRECISION,
ADD COLUMN     "seq5Score" DOUBLE PRECISION,
ADD COLUMN     "seq6Score" DOUBLE PRECISION,
ADD COLUMN     "weightedScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "SchoolTemplate" ADD COLUMN     "ownership" "SchoolOwnership" NOT NULL DEFAULT 'PRIVATE_SECULAR';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "schoolId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "GradeType";

-- AddForeignKey
ALTER TABLE "SchoolInvite" ADD CONSTRAINT "SchoolInvite_invitedByMasterId_fkey" FOREIGN KEY ("invitedByMasterId") REFERENCES "MasterUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolConfig" ADD CONSTRAINT "SchoolConfig_moderatorUserId_fkey" FOREIGN KEY ("moderatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_subGroupId_fkey" FOREIGN KEY ("subGroupId") REFERENCES "ClassSubGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundedById_fkey" FOREIGN KEY ("refundedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPromotion" ADD CONSTRAINT "ClassPromotion_fromClassId_fkey" FOREIGN KEY ("fromClassId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPromotion" ADD CONSTRAINT "ClassPromotion_toClassId_fkey" FOREIGN KEY ("toClassId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPromotion" ADD CONSTRAINT "ClassPromotion_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_fromClassId_fkey" FOREIGN KEY ("fromClassId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_toClassId_fkey" FOREIGN KEY ("toClassId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_promotedById_fkey" FOREIGN KEY ("promotedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineQueue" ADD CONSTRAINT "OfflineQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
