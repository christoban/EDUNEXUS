# AGENTS.md — Guide officiel des agents IA sur EduNexus

> Ce fichier est lu automatiquement par les agents IA (Claude Code, opencode, etc.) travaillant sur EduNexus.
> Il définit **comment** travailler. Il prime sur les habitudes de l'agent, et s'ajoute à la tâche donnée.
> Documents projet à connaître : [ARCHITECTURE.md](ARCHITECTURE.md) · [MODULE_INDEX.md](MODULE_INDEX.md) · [FEATURES.md](FEATURES.md) · [CONVENTIONS.md](CONVENTIONS.md)

---

## 0. Avant toute chose — quels documents lire

Selon la tâche, lis **d'abord** (dans l'ordre) :
1. **Cette page** (méthode).
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — comprendre l'organisation générale.
3. **[MODULE_INDEX.md](MODULE_INDEX.md)** — trouver **où** intervenir.
4. **[FEATURES.md](FEATURES.md)** — comprendre la fonctionnalité et ses interactions.
5. **[CONVENTIONS.md](CONVENTIONS.md)** — écrire du code cohérent.
6. Si frontend : **`frontend/AGENTS.md`** (Next.js « pas celui que tu connais »).

Puis explore le **code réel** concerné avant de conclure quoi que ce soit.

---

## 1. Comment analyser une tâche (workflow obligatoire)

1. **Reformule l'objectif** en une phrase, et identifie le périmètre explicite (ce qui est demandé) **et** la section « CE QU'IL NE FAUT PAS TOUCHER ».
2. **Analyse préalable** : localise dans le code réel les fichiers concernés (via MODULE_INDEX + recherche). **Restitue** cette analyse (fichiers/lignes, décisions) avant d'agir.
3. **En mode Tech Lead / architecte** (par défaut, sauf demande explicite de coder) : produis un **PLAN** au format standard (§4) au lieu d'écrire le code.
4. **Signale les ambiguïtés** : si un choix te manque ou si le périmètre est flou, **pose la question / documente l'hypothèse** — ne devine pas, n'élargis pas.
5. **Implémente** (si demandé) le strict nécessaire, en respectant les conventions.
6. **Vérifie** (§5) et **rends le rapport** (§6).

---

## 2. Règles d'or (résumé — détail dans CONVENTIONS.md)

- **Fais EXACTEMENT ce qui est demandé, rien de plus.** N'élargis jamais le périmètre de ta propre initiative.
- **Limite les modifications aux seuls fichiers nécessaires.** Ne « refactore » pas au passage. Ne reformate pas des fichiers non concernés.
- **Zéro régression** : ne casse pas l'existant. En cas de doute, préfère un ajout guardé (repli sûr) à une modification globale. Vérifie les non-régressions annoncées dans la Definition of Done.
- **Respecte les conventions** ([CONVENTIONS.md](CONVENTIONS.md)) : nommage FR pour le métier, styles inline + tokens CSS, i18n via `useT` + parité fr/en, source unique `resolveLanguage`, hexagonal côté backend.
- **Ne prétends jamais « fait/vérifié » sans preuve** (sortie de commande). Sois honnête sur ce qui n'a pas pu être testé.
- **Protection des données** : aucune suppression (colonne, fichier, donnée) sans preuve « zéro usage » + justification. En cas de doute : garder + documenter.
- **Jamais** de `git commit/push` ni d'opération destructive sauf demande explicite.
- **N'invente rien** : si un fichier/feature supposé n'existe pas, signale-le.

---

## 3. Stack & environnement (Windows) — rappels critiques

- Backend : **Bun + Express + Prisma + PostgreSQL**, **hexagonal**. Pas de build backend (`bun run dev`/`start`). Build = **frontend uniquement** (`bun run build`).
- IA : **Groq** via `@ai-sdk/groq`, façade `generateWithGroq()` / `groqModel` (`backend/src/services/groq.ts`).
- **Vérif TS** : `cd backend && ./node_modules/.bin/tsc --noEmit` (et/ou `frontend/`). **Jamais `npx tsc`.**
- **Migrations** : `npx prisma migrate dev --name <nom> --skip-generate` (depuis `backend/`).
- **`prisma generate` échoue** (EPERM verrou DLL Windows) — attendu. Nouveau modèle → `(prisma as any).monModele` au runtime.
- **Smoke tests** : fichier `_smoke_*.ts` **dans `backend/`** (jamais `/tmp`), `bun _smoke.ts`, puis **supprime-le**.
- La recherche d'outil peut renvoyer « No matches » à tort → recoupe avec `grep -rn`.
- Ne laisse **aucun fichier parasite** (ex. `nul` créé par une redirection Windows).
- **Base de test VIDE** (aucune école/élève) → pas de démo live de bout en bout ; vérifie par `tsc` + smoke déterministes, et dis honnêtement ce qui n'a pas été testé en conditions réelles.

---

## 4. Format de PLAN standard (obligatoire)

Quand tu produis un plan (mode par défaut), utilise **toujours** cette structure, dans cet ordre :

```
1. Objectif                — le résultat attendu, en 1–2 phrases
2. Contexte                — état actuel du code concerné (fichiers/lignes réels)
3. Impact sur l'architecture — couches/modules touchés ; respect des conventions ; risque de couplage
4. Fichiers concernés      — liste exacte (chemins), créés/modifiés
5. Étapes (Étape 1, 2, 3…) — actions atomiques et ordonnées ; pour CHAQUE étape : difficulté + IA recommandée (voir §5 table)
6. Dépendances             — entre étapes, et externes (migration, service, clé API…)
7. Risques                 — régressions possibles, points sensibles, données à protéger
8. Critères de validation  — Definition of Done vérifiable
9. Plan de test            — comment prouver que ça marche (tsc, smoke, parcours, parité i18n…)
10. Retour arrière (Rollback) — comment annuler proprement si ça tourne mal
```

But : que **toutes les IA** travaillent avec un format identique → moins d'ambiguïté.

---

## 5. Estimation de complexité & IA recommandée (par étape)

Attribue à **chaque étape** du plan une difficulté et une IA recommandée :

| Difficulté | Type de travail typique | IA recommandée |
|---|---|---|
| **Faible** | Créer/ajuster un composant React, ajouter des clés i18n, texte/style | IA « exécutante » (ex. DeepSeek / autre modèle) |
| **Moyenne** | Modifier une logique métier localisée, un use case, un endpoint | IA « exécutante » (avec ce guide) |
| **Élevée** | Refactorer plusieurs modules, toucher au container/bootstrap, migration schéma | **Claude Code** |
| **Très élevée** | Revue/décision d'architecture, changement de flux transverse, sécurité/RBAC | **Claude Code** (Tech Lead) |

Format recommandé dans le plan :

| Étape | Description | Difficulté | IA recommandée |
|---|---|---|---|
| 1 | … | Faible | DeepSeek |
| 2 | … | Moyenne | DeepSeek |
| 3 | … | Élevée | Claude Code |

---

## 6. Vérification avant de terminer

- **`tsc` clean** (backend et/ou frontend selon la tâche) — montre la sortie.
- **Smoke test** du chemin le plus risqué — montre la sortie. (Bulletins PDF : patcher `PDFDocument.prototype.text` pour capturer les libellés dessinés.)
- **i18n** : si texte UI ajouté → parité fr/en vérifiée (mêmes clés).
- **Non-régression** : re-vérifier les points listés dans la Definition of Done.
- Supprimer tous les fichiers temporaires `_smoke_*`.

---

## 7. Livrable — rapport final (format imposé)

Rapport **en français, structuré** :
1. **Analyse préalable** restituée (fichiers/lignes, décisions) ;
2. Pour chaque décision non triviale (surtout suppression) : **justification + preuve grep** ;
3. **Résultats de vérification** : `tsc` + smoke, **avec la sortie réelle** ;
4. **Liste des fichiers modifiés/créés** ;
5. **Note d'honnêteté** : ce qui n'a pas pu être testé en conditions réelles (base vide) ;
6. Confirmation que les `_smoke_*` sont supprimés.

Ne considère la tâche « terminée » que si **tous** les critères de fin sont couverts, preuves à l'appui.

---

## 8. Synchronisation de la documentation

Les documents `ARCHITECTURE.md`, `FEATURES.md`, `MODULE_INDEX.md`, `CONVENTIONS.md` et ce guide **font partie du projet**. Si ta tâche change l'architecture, un flux, un module, un rôle ou une convention, **propose la mise à jour** du/des documents concernés dans le même lot, pour qu'ils restent synchronisés avec le code.
