# CODE_REVIEW_NOTES.md

> Fichier de suivi des violations/notes repérées en passant mais non corrigées (règle §3 de AGENTS.md).
> Format : `[AAAA-MM-JJ] fichier:ligne — règle violée — description courte`

## Résolu

- [2026-08-27] `backend/src/infrastructure/http/controllers/DevController.ts` — dev-only (`NODE_ENV !== 'production'`), réimplémentait la logique métier prod (effectiveSerieCode, computeSlotsFromGrid, EDT, distribution notes) au lieu des vrais UC. **Résolu : supprimé** (2026-09-28) — jamais en prod, aucun test ne le référençait, duplication de logique métier = dette supprimée plutôt que UC sur-ingénierie pour un seed tool.

## Dette acceptée (documentée, non bloquante)

- [2026-08-27] `backend/src/infrastructure/http/controllers/AssistantController.ts:84` — `ActionContext.prisma` requis par ~106 appels `ctx.prisma.*` dans les catalogues copilot (`teacher/student/staff/parent/adminActionCatalog.ts`, `catalogShared.ts`). Le controller ne fait plus AUCUNE requête Prisma directe (17 → 0 via `AssistantContextQueryRepository`), mais `prismaClient` est injecté dans `ActionContext` pour le catalogue. Ponytail : découpler 106 sites = sur-ingénierie pour un chantier non demandé. À traiter dans le chantier "copilot IA consomme des ports" si priorité métier.
