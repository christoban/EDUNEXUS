# LA MÉTHODE — règles de travail permanentes (EDUNEXUS)

Applique cette méthode à TOUTE tâche demandée. Elle prime en cas de doute.

## 0. Posture
- **Analyse préalable D'ABORD** : avant d'écrire une ligne de code, explore le code réel concerné, puis **RESTITUE** ton analyse (fichiers/lignes trouvés, décisions, justifications). Ne code qu'ensuite.
- **Fais EXACTEMENT ce qui est demandé — rien de plus.** Respecte à la lettre la section « CE QU'IL NE FAUT PAS TOUCHER ». En cas de doute sur le périmètre, **n'élargis pas** : signale la question dans ton rapport.
- **Ne prétends jamais « fait » ou « vérifié » sans preuve** (sortie de commande à l'appui). Si un test échoue ou est sauté, dis-le franchement.

## 1. Stack & repo (stable)
- Backend : **Bun + Express + Prisma + PostgreSQL**, architecture **hexagonale** (`domain` / `application` / `infrastructure`). L'application layer n'accède pas à Prisma directement, sauf s'il est déjà injecté.
- Frontend : **Next.js App Router** (`frontend/`), composants à styles inline. Respecte le style/visuel existant.
- IA : **Groq** via `@ai-sdk/groq` (exposée par `generateWithGemini()` / `geminiModel` dans `backend/src/services/gemini.ts` — nom trompeur, c'est Groq).
- **Source UNIQUE de langue d'affichage** : `resolveLanguage(subsystem, sectionCode?)` + `instructionLangue()` dans `backend/src/utils/languageHelper.ts`. **Ne recrée jamais** une autre logique de résolution de langue ; le frontend consomme la langue exposée par le backend.

## 2. Environnement Windows & commandes (stable)
- **Vérif TypeScript backend** : `cd backend && ./node_modules/.bin/tsc --noEmit` (sortie vide = clean). **Vérif frontend** : `cd frontend && ./node_modules/.bin/tsc --noEmit`. **N'utilise jamais `npx tsc`.**
- **Migrations Prisma** : `npx prisma migrate dev --name <nom> --skip-generate` depuis `backend/`.
- **`prisma generate` ÉCHOUE sur Windows** (EPERM sur le rename de `query_engine-windows.dll.node`) — c'est ATTENDU. Pour un **nouveau modèle** Prisma, utilise `(prisma as any).monModele` (le délégué existe au runtime malgré l'échec du binaire). Avant de **supprimer** une colonne, retire d'abord TOUT code qui la lit/écrit.
- **Tests runtime (smoke)** : crée un fichier temporaire `_smoke_xxx.ts` **DANS `backend/`** (jamais dans `/tmp`, qui résout une mauvaise version de Prisma), lance `bun _smoke_xxx.ts`, puis **SUPPRIME-le**.
- La recherche par outil peut renvoyer « No matches » à tort sur certains fichiers → **recoupe avec `grep -rn` via bash** en cas de doute.
- Ne laisse **aucun fichier parasite** (ex. un fichier nommé `nul` créé par une redirection Windows).

## 3. Discipline de vérification (obligatoire à chaque tâche)
- À la fin, **`tsc` doit être clean** (backend et/ou frontend selon la tâche). Montre-le.
- **Teste le chemin le plus risqué** de la tâche par un smoke test déterministe, et **montre la sortie**.
- **La base de données de test est VIDE** (aucune école/élève) : pas de démo live de bout en bout possible. Vérifie par `tsc` + smoke tests déterministes, et sois **HONNÊTE** dans une « note d'honnêteté » sur ce qui n'a pas pu être testé en conditions réelles.
- Pour les **bulletins PDF** : PDFKit embarque des polices sous-ensembles → le texte n'est pas lisible en clair dans le buffer. Pour vérifier les libellés rendus, **patche `PDFDocument.prototype.text`** afin de capturer chaque chaîne dessinée, puis rends le document et inspecte les chaînes capturées.

## 4. Protection des données & sûreté (STRICTE)
- **Aucune suppression** (colonne DB, fichier, donnée, fonction) sans : (i) **preuve par recherche** qu'elle n'est lue/écrite/appelée nulle part, (ii) **liste claire** de ce qui serait perdu, (iii) **retrait préalable** de tout code qui la référence. **En cas de doute : GARDE + DOCUMENTE** au lieu de supprimer.
- **Jamais** de `git commit`, `git push`, `git reset --hard`, ni opération git destructive, **sauf demande explicite**.
- **N'invente rien** : si un fichier/générateur/fonctionnalité supposé n'existe pas, **signale-le** au lieu de le créer. Cette règle interdit d'ajouter des fonctionnalités non demandées.

## 5. Frontend (si la tâche y touche)
- Lis d'abord **`frontend/AGENTS.md`** et la doc Next locale (`node_modules/next/dist/docs/`) **avant** d'utiliser une API Next : cette version de Next diffère des habitudes. Vérifie la version (`grep '"next"' frontend/package.json`).
- La langue est **dérivée de l'utilisateur/établissement, PAS de l'URL** : n'introduis pas de routes préfixées par locale.

## 6. Livrable (format imposé)
Rends un **rapport final en français, structuré**, contenant :
1. l'**analyse préalable** restituée (fichiers/lignes, décisions) ;
2. pour chaque décision non triviale (surtout toute suppression) : **justification + preuve grep** ;
3. les **résultats de vérification** : `tsc` + smoke tests, **avec leur sortie réelle** ;
4. la **liste des fichiers modifiés/créés** ;
5. une **note d'honnêteté** sur ce qui n'a pas pu être testé en conditions réelles (base vide) ;
6. confirmation que tous les fichiers temporaires `_smoke_*` ont été supprimés.

Ne considère la tâche « terminée » que si tous les critères de fin (Definition of Done) de la tâche donnée sont couverts, preuves à l'appui.
