# CODE_REVIEW_NOTES.md

> Fichier de suivi des violations/notes repérées en passant mais non corrigées (règle §3 de AGENTS.md).
> Format : `[AAAA-MM-JJ] fichier:ligne — règle violée — description courte`

- [2026-08-27] `backend/src/infrastructure/http/controllers/DevController.ts:815` — Dev-only (`NODE_ENV !== 'production'`), réimplémente la logique métier prod (effectiveSerieCode, computeSlotsFromGrid, EDT, distribution notes) au lieu des vrais UC. Gardé tel quel — ponytail: créer des UC pour un seed tool = sur-ingénierie.

- [2026-08-27] `backend/src/infrastructure/http/controllers/AssistantController.ts:84` — ActionContext.prisma requis par ~59 appels `ctx.prisma.*` dans les catalogues copilot (`teacher/student/staff/parent/adminActionCatalog.ts`). Le controller ne fait plus AUCUNE requête Prisma directe (17 → 0 via `AssistantContextQueryRepository`), mais `prismaClient` est injecté dans `ActionContext` pour le catalogue. Hors périmètre §1.4 stricte — à découpler quand le catalogue consomme des ports (chantier assistant IA).
