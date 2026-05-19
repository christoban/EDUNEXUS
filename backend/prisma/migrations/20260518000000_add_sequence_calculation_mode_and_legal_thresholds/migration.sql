-- AlterTable: add sequenceCalculationMode and legal contribution thresholds to SchoolConfig
ALTER TABLE "SchoolConfig"
  ADD COLUMN IF NOT EXISTS "sequenceCalculationMode" TEXT NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS "legalMaxContributionFirstCycle" INTEGER NOT NULL DEFAULT 7500,
  ADD COLUMN IF NOT EXISTS "legalMaxContributionSecondCycle" INTEGER NOT NULL DEFAULT 10000;
