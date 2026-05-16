-- AlterEnum
BEGIN;
CREATE TYPE "SchoolType_new" AS ENUM ('PRESCHOOL', 'PRIMARY', 'SECONDARY', 'MULTI');
ALTER TABLE "public"."School" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "School" ALTER COLUMN "type" TYPE "SchoolType_new" USING ("type"::text::"SchoolType_new");
ALTER TYPE "SchoolType" RENAME TO "SchoolType_old";
ALTER TYPE "SchoolType_new" RENAME TO "SchoolType";
DROP TYPE "public"."SchoolType_old";
ALTER TABLE "School" ALTER COLUMN "type" SET DEFAULT 'SECONDARY';
COMMIT;

-- DropIndex
DROP INDEX "Section_schoolId_language_key";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "refundTransactionId" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "refundedById" TEXT;

-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN     "sectionId" TEXT;

-- AlterTable
ALTER TABLE "School" DROP COLUMN "gradingSystem",
DROP COLUMN "language",
DROP COLUMN "system",
DROP COLUMN "templateType",
ADD COLUMN     "templateCode" TEXT;

-- AlterTable
ALTER TABLE "SchoolConfig" DROP COLUMN "passMark";

-- AlterTable
ALTER TABLE "SchoolInvite" ADD COLUMN     "invitedByMasterId" TEXT,
ADD COLUMN     "notes" TEXT,
ALTER COLUMN "schoolName" SET NOT NULL;

-- AlterTable
ALTER TABLE "Section" DROP COLUMN "language",
ADD COLUMN     "code" "SectionLanguage" NOT NULL,
ADD COLUMN     "gradingSystem" "GradingSystem" NOT NULL DEFAULT 'OUT_OF_20',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passmark" DOUBLE PRECISION NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "GradeFormula" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sectionId" TEXT,
    "label" TEXT NOT NULL,
    "evaluations" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentionRule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sectionId" TEXT,
    "rules" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MentionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPromotion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromClassId" TEXT NOT NULL,
    "toClassId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "promotedById" TEXT NOT NULL,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeFormula_schoolId_idx" ON "GradeFormula"("schoolId");

-- CreateIndex
CREATE INDEX "MentionRule_schoolId_idx" ON "MentionRule"("schoolId");

-- CreateIndex
CREATE INDEX "StudentPromotion_schoolId_idx" ON "StudentPromotion"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPromotion_studentId_academicYearId_key" ON "StudentPromotion"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_schoolId_code_key" ON "Section"("schoolId", "code");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_templateCode_fkey" FOREIGN KEY ("templateCode") REFERENCES "SchoolTemplate"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeFormula" ADD CONSTRAINT "GradeFormula_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeFormula" ADD CONSTRAINT "GradeFormula_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentionRule" ADD CONSTRAINT "MentionRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentionRule" ADD CONSTRAINT "MentionRule_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineRecord" ADD CONSTRAINT "DisciplineRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineRecord" ADD CONSTRAINT "DisciplineRecord_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCouncilSession" ADD CONSTRAINT "ClassCouncilSession_presidedById_fkey" FOREIGN KEY ("presidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCouncilDecision" ADD CONSTRAINT "ClassCouncilDecision_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
