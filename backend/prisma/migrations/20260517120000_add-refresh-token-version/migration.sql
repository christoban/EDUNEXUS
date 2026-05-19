-- Add refreshTokenVersion column to User
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "refreshTokenVersion" INTEGER NOT NULL DEFAULT 0;
