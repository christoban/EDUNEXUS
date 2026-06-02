-- Add DRAFT value to SchoolStatus enum
ALTER TYPE "SchoolStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
