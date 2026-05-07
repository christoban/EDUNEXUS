-- CreateEnum
CREATE TYPE "MasterUserRole" AS ENUM ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'SCHOOL_MANAGER', 'SUPPORT');

-- AlterTable
ALTER TABLE "MasterUser" ADD COLUMN     "assignedSchoolIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "loginEmailOtpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loginEmailOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "loginEmailOtpHash" TEXT,
ADD COLUMN     "loginEmailOtpSentAt" TIMESTAMP(3),
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaRecoveryCodeGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "mfaRecoveryCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mfaSecret" TEXT,
ADD COLUMN     "mfaTempSecret" TEXT,
ADD COLUMN     "passwordChangeEmailOtpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordChangeEmailOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordChangeEmailOtpHash" TEXT,
ADD COLUMN     "passwordChangeEmailOtpSentAt" TIMESTAMP(3),
ADD COLUMN     "role" "MasterUserRole" NOT NULL DEFAULT 'SUPPORT';

-- CreateIndex
CREATE INDEX "MasterUser_loginEmailOtpExpiresAt_idx" ON "MasterUser"("loginEmailOtpExpiresAt");

-- CreateIndex
CREATE INDEX "MasterUser_passwordChangeEmailOtpExpiresAt_idx" ON "MasterUser"("passwordChangeEmailOtpExpiresAt");
