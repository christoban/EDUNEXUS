# Phase 8 Pilot Deployment Guide

Date: 2026-04-17
Scope: EDUNEXUS Phase 8 - quality hardening and pilot rollout.

## 1. Objectives
- Validate rule-engine behavior in real pilot contexts.
- Secure rollout before broader deployment.
- Produce operational evidence for FR, EN, bilingual, and complex schools.

## 2. Prerequisites
- Backend and frontend dependencies installed.
- MongoDB instance available for pilot environment.
- Environment variables configured for API, email, and SMS providers.
- Admin user ready for configuration and verification.

## 3. Quality Gate Commands
Run all commands from repository root.

```powershell
Set-Location -LiteralPath "backend"; bun test src/tests; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Set-Location -LiteralPath "..\backend"; bun x tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Set-Location -LiteralPath "..\frontend"; bun x tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

Expected result:
- All tests pass.
- No TypeScript diagnostics in backend or frontend.

## 4. Pilot Dataset Setup
Reference dataset file:
- docs/pilot/PHASE8_PILOT_DATASETS.json

Scenarios covered:
- FR secondary
- EN secondary
- Bilingual primary
- Complex multi-cycle

Recommended import process:
1. Create school settings per scenario.
2. Create subsystem and section mapping.
3. Create sample students and class assignments.
4. Seed grades, attendance, and invoice balances exactly as listed.
5. Trigger report-card generation and verify outcomes.

## 5. Validation Checklist per School
1. Grading normalization
- scoreOn20 and percentage are coherent.
- Label formatting matches grading scale.

2. Council decision policy
- Manual mode returns TO_BE_REVIEWED.
- Automatic mode resolves PROMOTED, REMEDIAL, ABSENCE_REVIEW, or CONDUCT_REVIEW correctly.

3. Finance hold policy
- Bulletin is blocked only when unpaid balance exceeds allowed threshold.
- Finance and report-card UIs show consistent blocked/eligible status.

4. Localization
- FR and EN labels are correctly rendered.
- Parent and manager flows preserve language context.

## 6. Pilot Execution Plan (First Batch)
1. Batch composition
- 1 FR school
- 1 EN school
- 1 bilingual school
- 1 complex multi-cycle school

2. Monitoring window
- Minimum 2 full reporting cycles (or equivalent simulated periods).

3. Success criteria
- Zero blocking regressions.
- Report-card generation success >= 99% on pilot data.
- No contradictory outcomes between rules engine and UI status.

## 7. Incident Triage During Pilot
Priority levels:
- P0: Data corruption, unauthorized access, wrong promotion decisions at scale.
- P1: Incorrect bulletin blocking, broken report generation for a section.
- P2: UI mismatch or non-blocking translation/status issues.

Required incident record:
- Scenario ID
- Steps to reproduce
- Expected vs actual
- Impacted module
- Proposed fix and rollback note

## 8. Exit Criteria for Phase 8
- Unit and integration tests green.
- Pilot datasets executed and verified for all 4 scenarios.
- Deployment checklist completed and signed off by product + technical lead.
- First pilot school batch declared ready.

## 9. Recommended Next Step
After pilot sign-off, publish a short Phase 8 completion report containing:
- Test summary
- Scenario-by-scenario validation results
- Open issues with mitigation owners
- Go/No-Go decision for scale-up
