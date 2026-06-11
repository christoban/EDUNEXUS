-- Migration: add_onboarding_config
-- Adds onboardingConfig JSONB column to School table for storing extended onboarding configuration

ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "onboardingConfig" JSONB;
