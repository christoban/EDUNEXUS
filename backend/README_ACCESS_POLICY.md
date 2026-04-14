# EDUNEXUS Backend Access Policy (Week 1)

Date: 2026-04-14

This document defines explicit API access policy and protection controls.

## Conventions
- `protect`: JWT cookie authentication required.
- `authorize([...])`: role-based authorization.
- `validate(...)`: Zod payload/params validation.
- `authLimiter`: stricter limit for auth endpoints.
- `sensitiveWriteLimiter`: limit for sensitive write operations.

---

## Users

| Method | Route | Access | Validation | Rate Limit |
|---|---|---|---|---|
| POST | `/api/users/register` | `admin` only | `registerBodySchema` | `authLimiter` |
| POST | `/api/users/login` | Public | `loginBodySchema` | `authLimiter` |
| POST | `/api/users/logout` | Public/Session | none | `sensitiveWriteLimiter` |
| GET | `/api/users/profile` | Authenticated | none | none |
| GET | `/api/users` | `admin`, `teacher` | none | none |
| PUT | `/api/users/update/:id` | `admin` only | `userIdParamSchema`, `updateUserBodySchema` | `sensitiveWriteLimiter` |
| DELETE | `/api/users/delete/:id` | `admin` only | `userIdParamSchema` | `sensitiveWriteLimiter` |

---

## Classes

| Method | Route | Access | Validation | Rate Limit |
|---|---|---|---|---|
| POST | `/api/classes/create` | `admin` | `createClassBodySchema` | `sensitiveWriteLimiter` |
| GET | `/api/classes` | `admin`, `teacher` | none | none |
| PATCH | `/api/classes/update/:id` | `admin` | `idParamSchema`, `updateClassBodySchema` | `sensitiveWriteLimiter` |
| DELETE | `/api/classes/delete/:id` | `admin` | `idParamSchema` | `sensitiveWriteLimiter` |

---

## Subjects

| Method | Route | Access | Validation | Rate Limit |
|---|---|---|---|---|
| POST | `/api/subjects/create` | `admin` | `createSubjectBodySchema` | `sensitiveWriteLimiter` |
| GET | `/api/subjects` | `admin`, `teacher` (teacher filtered to assigned subjects) | none | none |
| PATCH | `/api/subjects/update/:id` | `admin` | `idParamSchema`, `updateSubjectBodySchema` | `sensitiveWriteLimiter` |
| DELETE | `/api/subjects/delete/:id` | `admin` | `idParamSchema` | `sensitiveWriteLimiter` |

---

## Exams

| Method | Route | Access | Validation | Rate Limit |
|---|---|---|---|---|
| POST | `/api/exams/generate` | `teacher`, `admin` (teacher restricted by subject policy) | `triggerExamGenerationBodySchema` | `sensitiveWriteLimiter` |
| GET | `/api/exams` | `teacher`, `student`, `admin` | none | none |
| POST | `/api/exams/:id/submit` | `student`, `admin` | `idParamSchema`, `submitExamBodySchema` | `sensitiveWriteLimiter` |
| PATCH | `/api/exams/:id/status` | `teacher`, `admin` | `idParamSchema` | `sensitiveWriteLimiter` |
| GET | `/api/exams/:id/result` | `student`, `admin` | none | none |
| GET | `/api/exams/generation/:id` | `teacher`, `admin` | `idParamSchema` | none |
| GET | `/api/exams/:id` | `teacher`, `student`, `admin` | `idParamSchema` | none |
| DELETE | `/api/exams/:id` | `teacher`, `admin` | `idParamSchema` | `sensitiveWriteLimiter` |

---

## Timetable

| Method | Route | Access | Validation | Rate Limit |
|---|---|---|---|---|
| POST | `/api/timetables/generate` | `admin` | `generateTimetableBodySchema` | `sensitiveWriteLimiter` |
| GET | `/api/timetables/generation/:id` | `admin` | `generationIdParamSchema` | none |
| GET | `/api/timetables/:classId` | Authenticated | `classIdParamSchema` | none |

---

## Week 1 Security Baseline
- No write endpoint for users/classes/subjects/exams/timetable is left without payload/params validation.
- Explicit onboarding policy: user registration is admin-only.
- Auth and sensitive writes are rate limited.
