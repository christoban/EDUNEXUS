# CODE_REVIEW_NOTES.md

> Fichier de suivi des violations/notes repérées en passant mais non corrigées (règle §3 de AGENTS.md).
> Format : `[AAAA-MM-JJ] fichier:ligne — règle violée — description courte`

- [2026-08-27] `backend/src/infrastructure/http/controllers/DevController.ts:815` — Dev-only (`NODE_ENV !== 'production'`), réimplémente la logique métier prod (effectiveSerieCode, computeSlotsFromGrid, EDT, distribution notes) au lieu des vrais UC. Gardé tel quel — ponytail: créer des UC pour un seed tool = sur-ingénierie.
