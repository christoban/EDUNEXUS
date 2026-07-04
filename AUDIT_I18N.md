# Audit i18n EduNexus — cohérence des langues par sous-système

> **Passe 1 : rapport uniquement. Aucune correction appliquée.**
> Date : 2026-07-03 · Périmètre : frontend + backend + PDF + SMS/email + prompts Groq.

---

## 0. Synthèse express

| Couche | État | Verdict |
|---|---|---|
| **Interface frontend** | Aucun framework i18n. 119 fichiers `.tsx` en **français en dur**. | 🔴 Mono-langue FR |
| **Rôles de direction (FR/EN)** | Correspondance **définie et appliquée** (StaffPermissionRules + PDF signatures). | 🟢 Correct (2 fuites mineures) |
| **Bulletins PDF** | 6 templates ; langue **figée par template**. 2 templates forcent le FR. | 🟠 Partiel |
| **Emails** | Infrastructure **bilingue** (emailTemplates.ts) mais appelants forcent `'fr'`. | 🟠 Sous-utilisé |
| **SMS** | 6 messages **français en dur**, aucun aiguillage. | 🔴 Mono-langue FR |
| **Prompts Groq** | **Tous** codés « Réponds en français » (10+ sites), y compris le nouveau copilot. | 🔴 Mono-langue FR |
| **Onboarding conversationnel** | Questionnaire **français uniquement** ; sous-système collecté en cours de route. | 🔴 Mono-langue FR |
| **`languageHelper.ts`** | Module de résolution de langue **jamais appelé** (code mort). | 🔴 Inutilisé |

**Conclusion générale :** EduNexus est aujourd'hui un produit **de facto francophone**. Toute la logique de langue « intelligente » (`languageHelper.ts`, champs DB de préférence) existe mais **n'est branchée nulle part**. La seule vraie bascule FR/EN fonctionnelle est **au niveau des templates de bulletins et des signatures PDF**. Un établissement **anglophone** verrait aujourd'hui : interface FR, SMS FR, emails FR, réponses de l'assistant IA FR, et certains bulletins (ANNUAL, primaire) en FR.

---

## 1. Comment la langue est déterminée aujourd'hui

Il n'existe **pas de source unique de vérité**. On trouve au moins **5 mécanismes concurrents**, la plupart inertes :

| Source | Fichier | Statut réel |
|---|---|---|
| `School.subsystem` (`FRANCOPHONE`/`ANGLOPHONE`/`BILINGUAL`) | `schema.prisma` enum `SchoolSubsystem` (l.1635) | Utilisé pour la **structure** (séries, titres staff), **pas** pour la langue d'affichage |
| `SchoolConfig.schoolLanguageMode` (String, défaut `"francophone"`) | `schema.prisma:159` | Non lu pour l'affichage |
| `SchoolSettings.locale` (String, défaut `"fr-CM"`) | `schema.prisma:183` | Non lu |
| `Section.code` (`SectionLanguage` = `FR`/`EN`) | `schema.prisma:373` + enum l.1414 | Utile pour le cas bilingue, mais non exploité pour l'UI/IA/SMS |
| `languageHelper.resolveUserLanguage()` | `backend/src/utils/languageHelper.ts` | **Code mort** — importé 1× dans `inngest/functions.ts:4`, **jamais appelé** |

> **Vérification faite :** `grep resolveUserLanguage( / getBulletinLanguage( / isOfficialBulletin( / getLegalNotice(` sur tout `backend/src` → **0 appel**. Le module entier est inutilisé.

**Frontend :** aucune dépendance i18n (`next-intl`, `react-i18next`, `lingui`…) dans `frontend/package.json`. Les libellés sont des **littéraux français** dans le JSX.

---

## 2. INTERFACE UTILISATEUR (catégorie 1)

**Problème structurel :** pas de système de traduction. 119 fichiers `.tsx`, chaînes FR en dur. Non listables ligne à ligne de façon utile — voici des **exemples représentatifs** prouvant le caractère systémique.

| Fichier:ligne | Texte en dur | S'affiche à | Correction proposée |
|---|---|---|---|
| `AdminSidebar.tsx:52-65` | `'Tableau de bord'`, `'Utilisateurs'`, `'Matières'`, `'Présences'`, `'Notes'`, `'Bulletins'`, `'Emploi du temps'`, `'Conseil de classe'` | **Tous** les admins (dont anglophones) | Passer par une fonction `t()` alimentée par la langue de l'établissement |
| `SectionUsers.tsx:85-89` | `ROLE_LABEL` = `TEACHER:'Enseignant'`, `STUDENT:'Élève'`, `PARENT:'Parent'` | Tous | Table de correspondance FR/EN (`Teacher/Student/Parent`) |
| `page.tsx (admin):40-58` | `SECTION_TITLES` (16 titres FR en dur) | Tous | idem |
| ~117 autres `.tsx` | boutons, placeholders, toasts, messages de validation FR | Tous | Extraction dans un dictionnaire i18n |

**Nuance positive :** la liste déroulante des **titres de staff** (`SectionUsers.tsx:763`) est **déjà** alimentée par `getStaffTitlesForTemplate` (subsystem-aware) → un établissement anglophone y voit bien « Vice-Principal / Bursar / HOD » et pas « Censeur ». ✅

**Correction de fond recommandée :** introduire un vrai socle i18n (dictionnaire `fr`/`en` + hook `useT()` prenant la langue du `School`/`Section`). C'est le **plus gros chantier** (voir §8).

---

## 3. DOCUMENTS GÉNÉRÉS — BULLETINS PDF (catégorie 2)

Le service PDF (`PdfKitBulletinService.ts:3`) utilise `utils/reportCards/templates.ts`. **6 templates**, langue **figée** dans chaque `drawBulletinFooter({ language })` :

| Template | `language` | Fichier:ligne | Problème |
|---|---|---|---|
| FR_SECONDARY | `"fr"` | `templates.ts:91` | OK (francophone) |
| EN_SECONDARY | `"en"` | `templates.ts:118` | OK (anglophone) |
| TECHNICAL_FR | `"fr"` | `templates.ts:158` | OK si technique = FR uniquement (à confirmer) |
| **PRIMARY** | **`"fr"`** | `templates.ts:186` | 🔴 **Un primaire anglophone (EN_PRIMAIRE) obtient un bulletin FR** (libellés + mention `getMentionApc` FR + signatures FR) |
| **ANNUAL** | **`"fr"`** | `templates.ts:221` | 🔴 **Le bulletin annuel d'un secondaire anglophone rend en FR** (« Moyenne générale », « Mention », signatures « Professeur Principal / Censeur / Proviseur ») |
| MONTHLY | `"en"` | `templates.ts` (bloc ~245) | OK (anglophone) |

**Détail des libellés (branche `language`) — `helpers.ts` :**
- `helpers.ts:305-306` : `avgLabel`/`mentionLabel` = `Moyenne générale`/`Mention` (fr) vs `General Average`/`Grade` (en). ✅ correct.
- `helpers.ts:324-326` : blocs de signature :
  - FR : `["Professeur Principal", "Censeur / VP", "Proviseur", "Visa Parent"]`
  - EN : `["Class Master", "Vice-Principal", "Principal", "Parent Signature"]`
  - 🟠 **Fuite mineure** : en bulletin **francophone**, `"Censeur / VP"` contient l'abréviation anglaise **VP**. → devrait être `"Censeur"` seul.

**Incohérence entre les deux systèmes de templates :**
- `reportCardTemplates.ts` (`getTemplateLabels`, branche EN) utilise `teacherSignature:"Class Teacher"` et `principalSignature:"Principal"`.
- `helpers.ts` (branche EN) utilise `"Class Master"` / `"Vice-Principal"` / `"Principal"`.
- 🟠 Deux vocabulaires EN différents (`Class Teacher` vs `Class Master`) selon le chemin de rendu. La consigne demande **Class Master** → aligner sur `helpers.ts`, ou clarifier lequel est réellement utilisé (à ce stade `PdfKitBulletinService` passe par `templates.ts`/`helpers.ts`, donc **Class Master** est le rendu effectif ; `reportCardTemplates.ts` semble être un **second système possiblement orphelin** — à vérifier en passe 2).

**Corrections proposées :**
1. `PRIMARY` et `ANNUAL` : remplacer `language: "fr"` en dur par un paramètre `language` dérivé du sous-système/section (`data.language`).
2. `helpers.ts:325` : `"Censeur / VP"` → `"Censeur"`.
3. Trancher entre `templates.ts` et `reportCardTemplates.ts` (dédupliquer) et aligner le vocabulaire EN sur **Class Master**.

> **Autres documents (certificats, cartes, lettres de transfert, tableaux d'honneur, PV, attestations RH)** : non trouvés comme générateurs PDF distincts dans ce périmètre de recherche. À confirmer en passe 2 — s'ils existent, ils suivent très probablement le même schéma « FR en dur » (aucun d'eux ne consomme `languageHelper`, qui est mort).

---

## 4. NOTIFICATIONS & COMMUNICATIONS (catégorie 3)

### 4.1 SMS — `SmsNotificationService.ts` 🔴 tout en français, aucun aiguillage

| Ligne | Texte exact | S'affiche à |
|---|---|---|
| `:134` | `` `EduNexus: ${studentName} a été marqué(e) absent(e) le ${dateStr}...` `` | Parents (tous sous-systèmes) |
| `:159` | `` `EduNexus: Paiement de ${amountStr} XAF reçu pour ${studentName}. Merci !` `` | Parents |
| `:183` | `` `EduNexus: RAPPEL — Facture "..." ... est en retard de ... jour(s). Veuillez régulariser.` `` | Parents |
| `:203` | `` `EduNexus: ${studentName} a fait l'objet d'une sanction (...). Motif : ... Contactez l'établissement...` `` | Parents |
| `:225` | `` `EduNexus: ALERTE — ${studentName} cumule ${count} absences non justifiées...` `` | Parents |
| `:246` | `` `EduNexus: Le bulletin de ${studentName} (${periodName}) est disponible. Connectez-vous...` `` | Parents |

**Correction :** introduire des variantes EN et choisir selon `School.subsystem` (+ préférence parent si dispo). Aucune infra i18n SMS n'existe → à créer (petit dictionnaire dédié).

### 4.2 Emails — infrastructure bilingue **mais mal alimentée** 🟠

- `emailTemplates.ts` gère **fr/en** proprement (`isFr`, blocs `Bonjour`/`Hello`, l.80/90/104/122/155). ✅ bonne base.
- **Mais** défaut `language = "fr"` (l.71,115,150) et les **appelants ne passent pas la bonne langue** :
  - `InviterEcoleUseCase.ts:94` → `language: 'fr'` **en dur** → email d'invitation toujours FR même pour une école anglophone.
  - Email « bulletin prêt » (inngest) : `resolveUserLanguage` importé mais **jamais appelé** → retombe sur le défaut FR.
- **Correction :** faire dériver `language` du sous-système/section à chaque appel ; supprimer les `'fr'` en dur.

### 4.3 Notifications in-app & publipostage

- Notifications in-app : à auditer en passe 2 (probables littéraux FR ; non couvert par un système i18n).
- Publipostage en masse : les **modèles** sont saisis par l'utilisateur → contenu dans sa langue ; **les libellés d'interface autour** restent FR (cf. §2).

---

## 5. ONBOARDING CONVERSATIONNEL (catégorie 4)

- **Réponse à la question posée dans le brief** (« la langue est-elle connue au début ? ») : **Non.** `ConversationalOnboarding.tsx` est un questionnaire **entièrement en français**. Le sous-système est **collecté au milieu du flux** via `SUBSYSTEM_OPTIONS` (l.80-82) — dont les libellés sont d'ailleurs partiellement bilingues (`'Anglophone (English as language of instruction)'`).
- Conséquence : un directeur d'école **anglophone** fait tout son onboarding **en français**. Aucune bascule de la langue du questionnaire après le choix du sous-système.
- Le récapitulatif final et les questions sont des littéraux FR (pas de `t()`).
- **Correction proposée :** poser **la langue en toute première question** (ou détecter `navigator.language` par défaut), puis re-render le questionnaire dans cette langue. Nécessite l'extraction i18n du composant.

---

## 6. ASSISTANT IA (Groq) — prompts (catégorie 5) 🔴

**Tous** les prompts système forcent le français. Aucun n'injecte une instruction de langue dynamique selon le sous-système.

| Fichier:ligne | Instruction en dur | Impact |
|---|---|---|
| `services/gemini.ts:29` | défaut : « Réponds toujours en français… » | Base de **tous** les appels sans systemPrompt |
| `AIController.ts:25` | prompt insight admin (FR) | Insight FR pour école anglophone |
| `AIController.ts:90` | commentaire de bulletin « …En français, 2-4 phrases… » | Commentaire de bulletin **anglophone** rédigé en FR |
| `AIController.ts:105` | `chat` systemPrompt (FR) | Assistant FR |
| `AIController.ts:148-153` | `assistantChat` « Réponds en français » | Assistant contextualisé FR |
| `AIController.ts:187` | `detectRisk` (FR) | Analyse FR |
| **`AssistantController.ts` (`buildSystemPrompt`)** | **« Réponds toujours en français »** | 🔴 **Le nouveau copilot exécutant** répond toujours en FR (régression i18n introduite avec cette feature — à corriger) |
| `GeminiIAService.ts:33` | défaut « …Réponds en français… » | Indice santé FR |
| `TimetableAutoController.ts:332` | « Réponds en français… » | Explications EDT FR |
| `TimetableAutoController.ts:404` | prompt FR | idem |

**Correction proposée (transversale) :** ajouter un utilitaire `instructionLangue(subsystem, section?)` renvoyant « Réponds en français. » / « Answer in English. », et l'injecter dans **chaque** systemPrompt (au lieu de la constante FR). Le contexte école (déjà chargé par `assistantChat`/`buildSystemPrompt`) contient `subsystem` → l'info est disponible sans requête supplémentaire.

> `inngest/functions.ts:256` (génération d'EDT) : le prompt produit un **schéma JSON structuré** (pas de langue naturelle destinée à l'utilisateur) → non concerné.

---

## 7. RÔLES DE DIRECTION — vérification prioritaire (le point « déjà traité »)

**Globalement conforme** ✅ — la correspondance est définie ET appliquée là où elle compte :

| Rôle FR | Rôle EN | Défini | Appliqué |
|---|---|---|---|
| Censeur | Vice-Principal | `StaffPermissionRules.ts:19/62` (jeux FR vs EN séparés) | ✅ dropdown staff subsystem-aware ; ✅ signatures PDF |
| Surveillant Général | Discipline Master | `StaffPermissionRules.ts:25/68` | ✅ |
| Intendant / Économe | Bursar | `StaffPermissionRules.ts:28/71` | ✅ |
| Proviseur | Principal | (chef = ADMIN) | ✅ signatures PDF `helpers.ts:325-326` |
| Professeur Principal | Class Master | — | ✅ `helpers.ts:326` (`Class Master`) ; 🟠 mais `reportCardTemplates.ts` dit `Class Teacher` |
| Proviseur Adjoint (FR) | Vice-Principal (EN) | `BILINGUAL_*_TITLES` (`StaffPermissionRules.ts:142+`) | ✅ jeu bilingue distinct |

**Fuites détectées :**
1. 🟠 `helpers.ts:325` — bulletin **FR** affiche `"Censeur / VP"` (le « VP » anglais ne doit pas apparaître en contexte francophone).
2. 🟠 `reportCardTemplates.ts` (branche EN) — `"Class Teacher"` au lieu de `"Class Master"` (vocabulaire EN incohérent entre deux systèmes de templates).
3. 🟢 Aucune occurrence de « Vice-Principal / Bursar / Discipline Master » **en dur** dans une interface francophone n'a été trouvée (ces libellés viennent tous du jeu de titres subsystem-aware, pas de littéraux) — la contrainte du brief est respectée côté rôles staff.

---

## 8. Ce qui est DÉJÀ correct

- ✅ Jeux de titres staff FR vs EN (`StaffPermissionRules.ts`) + consommation subsystem-aware dans l'UI (`SectionUsers.tsx:763`).
- ✅ Signatures PDF FR/EN branchées sur `language` (`helpers.ts:324-326`).
- ✅ Templates de bulletins FR_SECONDARY / EN_SECONDARY / MONTHLY correctement typés en langue.
- ✅ Infrastructure email **bilingue** (`emailTemplates.ts`) — il « suffit » de bien l'alimenter.
- ✅ Mentions académiques : `getMentionFr` / `getMentionEn` / `getMentionApc` existent et sont sélectionnées par template dans `GenererBulletinUseCase.ts:137-153`.

---

## 9. Estimation de l'effort & priorisation

### Volume de travail

| Chantier | Ampleur | Effort estimé |
|---|---|---|
| **A. Socle i18n frontend** (dictionnaire fr/en + hook `useT()` + extraction de ~119 fichiers) | 🔴 Très gros | **5–8 j** (le plus lourd, de loin) |
| **B. Prompts Groq** (helper `instructionLangue` injecté sur ~10 sites, dont le copilot) | 🟢 Petit, transverse | **0,5–1 j** |
| **C. SMS bilingues** (6 messages + aiguillage subsystem) | 🟢 Petit | **0,5 j** |
| **D. Emails** (dériver `language` chez les appelants ; retirer les `'fr'` en dur) | 🟢 Petit | **0,5 j** |
| **E. Bulletins PDF** (PRIMARY/ANNUAL dynamiques + `Censeur/VP` + dédup templates.ts/reportCardTemplates.ts) | 🟠 Moyen | **1–2 j** |
| **F. Onboarding en 2 langues** (dépend de A ; langue en 1ʳᵉ question) | 🟠 Moyen | **1 j** (après A) |
| **G. Nettoyer/brancher la source de vérité langue** (choisir 1 mécanisme, câbler, supprimer `languageHelper` mort ou l'utiliser) | 🟠 Moyen | **1 j** |

**Total indicatif : ~10–14 jours**, dominé par le chantier A (frontend).

### Priorisation (visibilité utilisateur décroissante)

1. **P0 — Prompts Groq (B)** : rapide, très visible (l'assistant est mis en avant), **et corrige une régression** que je viens d'introduire avec le copilot. Rapport coût/impact imbattable.
2. **P0 — SMS (C) & Emails (D)** : touchent directement les **parents** (public le plus large), rapides.
3. **P1 — Bulletins PRIMARY/ANNUAL (E)** : document officiel remis aux familles ; un bulletin annuel anglophone en français est un défaut visible et sensible.
4. **P1 — Source de vérité langue (G)** : pré-requis de propreté avant d'industrialiser.
5. **P2 — Socle i18n frontend (A)** puis **Onboarding (F)** : chantier de fond, indispensable pour les écoles anglophones/bilingues, mais long — à planifier comme un lot dédié.
6. **P3 — `Censeur / VP` et `Class Teacher`/`Class Master`** : cosmétique, à corriger en même temps que E.

---

### Note d'honnêteté sur le périmètre couvert

- Recherche exhaustive faite sur : i18n libs, `School`/config langue, templates PDF de bulletins, SMS, emails, **tous** les sites d'appel Groq, rendu des rôles.
- **Non exhaustivement vérifié** (à confirmer en passe 2, probablement même schéma « FR en dur ») : notifications in-app, générateurs de certificats/attestations RH/cartes/lettres s'ils existent hors bulletins, et l'énumération **ligne par ligne** des ~119 fichiers frontend (caractérisée globalement plutôt que listée intégralement, car sans système i18n chaque libellé est un cas).
