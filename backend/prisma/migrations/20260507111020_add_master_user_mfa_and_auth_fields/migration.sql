DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'MasterUser'
	) THEN
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MasterUserRole') THEN
			CREATE TYPE "MasterUserRole" AS ENUM ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'SCHOOL_MANAGER', 'SUPPORT');
		END IF;

		ALTER TABLE "MasterUser"
			ADD COLUMN IF NOT EXISTS "assignedSchoolIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
			ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
			ADD COLUMN IF NOT EXISTS "loginEmailOtpAttempts" INTEGER NOT NULL DEFAULT 0,
			ADD COLUMN IF NOT EXISTS "loginEmailOtpExpiresAt" TIMESTAMP(3),
			ADD COLUMN IF NOT EXISTS "loginEmailOtpHash" TEXT,
			ADD COLUMN IF NOT EXISTS "loginEmailOtpSentAt" TIMESTAMP(3),
			ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
			ADD COLUMN IF NOT EXISTS "mfaRecoveryCodeGeneratedAt" TIMESTAMP(3),
			ADD COLUMN IF NOT EXISTS "mfaRecoveryCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
			ADD COLUMN IF NOT EXISTS "mfaSecret" TEXT,
			ADD COLUMN IF NOT EXISTS "mfaTempSecret" TEXT,
			ADD COLUMN IF NOT EXISTS "passwordChangeEmailOtpAttempts" INTEGER NOT NULL DEFAULT 0,
			ADD COLUMN IF NOT EXISTS "passwordChangeEmailOtpExpiresAt" TIMESTAMP(3),
			ADD COLUMN IF NOT EXISTS "passwordChangeEmailOtpHash" TEXT,
			ADD COLUMN IF NOT EXISTS "passwordChangeEmailOtpSentAt" TIMESTAMP(3),
			ADD COLUMN IF NOT EXISTS "role" "MasterUserRole" NOT NULL DEFAULT 'SUPPORT';

		CREATE INDEX IF NOT EXISTS "MasterUser_loginEmailOtpExpiresAt_idx"
			ON "MasterUser"("loginEmailOtpExpiresAt");

		CREATE INDEX IF NOT EXISTS "MasterUser_passwordChangeEmailOtpExpiresAt_idx"
			ON "MasterUser"("passwordChangeEmailOtpExpiresAt");
	END IF;
END
$$;
