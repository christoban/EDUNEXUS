-- Migration: fix_school_config_minesec
-- Correction MINESEC : gradesPerTerm 3 -> 2 (2 séquences par trimestre, pas 3)
-- Ajout des champs manquants : schoolLanguageMode, attendanceLateAsAbsence,
--   bulletinBlockOnUnpaidFees, councilPassMark, passMark

-- Corriger la valeur par défaut de gradesPerTerm
ALTER TABLE "SchoolConfig" ALTER COLUMN "gradesPerTerm" SET DEFAULT 2;

-- Ajouter les champs manquants (si absents)
ALTER TABLE "SchoolConfig"
  ADD COLUMN IF NOT EXISTS "schoolLanguageMode" TEXT NOT NULL DEFAULT 'francophone',
  ADD COLUMN IF NOT EXISTS "attendanceLateAsAbsence" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bulletinBlockOnUnpaidFees" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "councilPassMark" DOUBLE PRECISION NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "passMark" DOUBLE PRECISION NOT NULL DEFAULT 10;
