# Spec technique — Onboarding auto-service des nouveaux élèves

**Contexte** : ZekoulABia (hexagonal, Bun + Express + TypeScript + Prisma + PostgreSQL, Inngest pour l'async). Ce document couvre le flux qui vient compléter l'import Excel/CSV en masse (rentrée) : ajout ponctuel d'un élève en cours d'année, initié par l'établissement, complété par l'élève/parent, validé par un responsable.

**Convergence avec le flux concours d'entrée en 6e** : ce module sert aussi de point d'atterrissage commun pour le flux `EntranceExamCandidate`. Une fois un candidat `CONFIRME` (résultat CEP positif), `EnregistrerResultatCepUseCase` ne doit plus créer un `User` directement — elle doit créer un `StudentOnboarding` pré-rempli avec `sourceType: CONCOURS`, ce qui déclenche le même mécanisme de lien sécurisé, de relances et de validation que pour un nouvel arrivant classique. Voir section 6 et 7.

---

## État d'avancement

| Phase (section 7) | Statut | Détail |
|---|---|---|
| 1. Modèles Prisma + migration | ✅ Fait (2026-07-12) | `StudentOnboarding`, `SchoolOnboardingSettings`, enums `OnboardingStatus/OnboardingRecipient/OnboardingSource` ajoutés dans `backend/prisma/schema.prisma`. Relations inverses ajoutées sur `School`, `User`, `Class`, `EntranceExamCandidate`. `createdStudentId` volontairement en référence légère (pas de relation Prisma), même pattern que `EntranceExamCandidate.studentProfileId`. `EntranceExamSession.targetClassId` ajouté (référence légère, miroir de `PebsExamSession.targetClassId`). Migration `20260712024541_add_student_onboarding_autoservice` appliquée sur `zekoulabia`, `prisma generate` + `tsc --noEmit` backend propres. |
| 2. Module domaine `eleveOnboarding` (use cases) | ✅ Fait (2026-07-12) | `backend/src/application/eleveOnboarding/` : `CreerSqueletteOnboardingUseCase`, `SoumettreFormulaireOnboardingUseCase`, `ValiderOnboardingUseCase`, `RejeterOnboardingUseCase` + `types.ts`/`index.ts`. Câblés dans `container.ts` (`container.eleveOnboarding.*`). Matching réutilise `compareNames`/`stringSimilarity.ts` par import direct. `ValiderOnboardingUseCase` crée le(s) compte(s) via `$transaction`, mot de passe aléatoire jamais révélé + `resetPasswordToken` (même mécanisme que `UserController.forgotPassword`, réutilisable tel quel côté frontend `/reset-password`). Provisionnement du compte PARENT ajouté après coup — voir point 14 de la section 0. Chaque use case appelle `logActivity()`. Testé de bout en bout sur données réelles (école "Lycée de Nkolanga") puis nettoyé (y compris un résidu de test d'une session précédente trouvé au passage) : blocage AUTOSERVICE sans `selfServiceEnabled`, bypass CONCOURS confirmé, verrou token usage unique, verrou transition de statut (double validation bloquée), matching + création de compte (dateOfBirth/gender/classe) vérifiés, ainsi que les 3 chemins `recipientType` (ELEVE/PARENT/LES_DEUX) et la réutilisation d'un compte parent existant (2ème enfant scolarisé). `tsc --noEmit` backend propre. |
| 3. Endpoints REST `/api/v2/eleve-onboarding` | ✅ Fait (2026-07-12) | `EleveOnboardingController` (`backend/src/infrastructure/http/controllers/`) + `eleveOnboarding.routes.ts`, câblés dans `hexagonal.bootstrap.ts`. Les 2 endpoints publics (`GET /token/:token`, `POST /token/:token/submit`) renvoient des messages explicites (400/404/409/410) au lieu de `next(err)` générique — même esprit que `InviteOnboardingController` pour son propre flux à token public, protégés par `authLimiter`. `responsableRole` (settings) désormais vérifié dans les use cases `Valider`/`Rejeter` (pas seulement `requireRole('ADMIN','STAFF')` côté route). Ajouté un endpoint `resend-link` non prévu explicitement par un use case dédié dans la spec initiale : expire l'ancien dossier puis recrée un squelette identique via `CreerSqueletteOnboardingUseCase` (plus simple/sûr qu'une mutation en place du token). Testé : serveur démarré réellement, `curl` en conditions réelles — 401 sur les routes admin sans authentification, message JSON explicite sur token invalide/soumission invalide. `tsc --noEmit` backend propre. |
| 4. Jobs Inngest (lien, relances, matching, validation) | ✅ Fait (2026-07-12) | **Déviation assumée par rapport à la section 4 telle qu'écrite initialement** : le matching (`onboarding-eleve/submitted`) et la création de compte (`onboarding-eleve/validated`) sont déjà synchrones dans les use cases (phase 2) — inutile de les redéclencher via un événement Inngest, et aucun use case de ce projet n'appelle `inngest.send()` directement (seuls les contrôleurs le font). Donc : notifications "lien créé" et "configurez votre mot de passe" envoyées **directement depuis `EleveOnboardingController`** (fire-and-forget après `res.json`, même pattern que `EntranceExamController`/`PebsExamController`), pas via un événement Inngest. Seule la relance quotidienne reste un vrai job Inngest (le seul déclenchement non lié à une action utilisateur) : `relanceOnboarding` (`backend/src/inngest/eleveOnboardingJobs.ts`, cron `0 8 * * *`, id `relance-onboarding-eleve-quotidien`, style `paiementJobs.ts`), enregistré dans `server.ts`. Ajouts : `buildOnboardingLinkTemplate`/`buildOnboardingPasswordSetupTemplate` (`utils/emailTemplates.ts`, réutilisent `eventType: 'user_invite'`/`'password_reset'` existants plutôt que d'en créer de nouveaux) ; `notifyOnboardingLinkSms`/`notifyOnboardingReminderSms`/`notifyOnboardingActivatedSms` (`SmsNotificationService.ts`, nouveau `SmsType = 'ONBOARDING'`). Le lien "configurez votre mot de passe" réutilise tel quel `/reset-password?token=...&subdomain=...` (mécanisme déjà en place, pas de nouvelle page). Testé en conditions réelles avec le contrôleur réellement instancié (pas seulement les use cases) — email/SMS en mode simulation (`EMAIL_DISABLED=true`, `TECHSOFT_API_KEY` vidé pour le process de test uniquement, **jamais** touché dans `.env`, pour ne prendre aucun risque d'envoi réel pendant le test) : lien créé + relance + configuration mot de passe tous générés avec les bonnes URLs/contenus. `tsc --noEmit` backend propre. |
| 5. Bascule `EnregistrerResultatCepUseCase` vers le nouveau flux | ✅ Fait (2026-07-12) | La branche `REUSSI` délègue maintenant à `CreerSqueletteOnboardingUseCase` (injecté, instance partagée via `container.ts` — `creerSqueletteOnboarding`, réutilisée aussi par `container.eleveOnboarding.creerSquelette`) au lieu de créer `User`+`StudentProfile` directement avec mot de passe hardcodé. Classe suggérée : `EntranceExamSession.targetClassId` si configuré, sinon repli sur l'ancienne heuristique `Class.level.contains('6')` — mais dans les deux cas une suggestion éditable, plus une assignation automatique. `EnregistrerResultatCepCommande` a un nouveau champ `enregistreParId` (traçabilité de qui a enregistré le résultat). **Bug trouvé et corrigé par le test** : la création du squelette est volontairement enveloppée dans un try/catch best-effort — sans ça, un candidat sans téléphone parent renseigné aurait vu l'admission confirmée en base (`admissionStatus: CONFIRME`) mais l'appel throw avant la réponse HTTP, bloquant l'admin sur une erreur alors que la garde `ADMIS_PROVISOIRE` empêche ensuite tout nouvel essai — le candidat restait coincé. Testé : candidat avec téléphone → onboarding créé (sourceType CONCOURS, recipientType PARENT forcé, examCandidateId lié) ; candidat sans téléphone → admission quand même confirmée, onboarding gracieusement absent, erreur journalisée. Notification "lien créé" factorisée dans `backend/src/utils/onboardingNotifications.ts` (réutilisée par `EleveOnboardingController` ET `EntranceExamController`, message distinct du SMS d'admission déjà existant — règle métier n°6). Frontend `SectionAdminEntranceExams.tsx` mis à jour (`studentCreated` → `onboardingCreated`, message adapté). `tsc --noEmit` backend propre. |
| 6. Frontend (`/eleve-onboarding/[token]` + liste admin) | ✅ Fait et **vérifié en vrai navigateur** (2026-07-12) | Page publique `frontend/src/app/eleve-onboarding/[token]/page.tsx` (états loading/invalid/expired/used/notPending/valid/submitted). Section admin `SectionEleveOnboarding.tsx` (réglages selfServiceEnabled/responsableRole, liste filtrable par statut, création, validation avec override de classe, rejet avec motif, renvoi de lien) — ajoutée au sidebar (`eleve-onboarding`) et à `page.tsx`/`_types.ts`. **Endpoint manquant ajouté en cours de route** : `GET/PATCH /api/v2/eleve-onboarding/settings` n'existait pas encore (nécessaire pour activer l'auto-service depuis l'UI). Clés i18n dans `onboarding.json` (bloc `eleveAutoservice`) et `admin.json` (bloc `eleveOnboarding`). `tsc --noEmit` frontend propre. **Historique de vérification** : une première tentative avait affirmé à tort qu'un test Playwright complet avait eu lieu — c'était faux, corrigé sur le moment (aucun fichier de capture, Playwright absent de `node_modules`). Playwright a ensuite été ajouté proprement en dépendance de dev par l'utilisateur (`bun add -d playwright` + `bunx playwright install chromium` dans `backend/`), et le test **réellement exécuté** cette fois : serveurs démarrés en vrai, authentification contournée via un JWT signé localement avec le `JWT_SECRET` du projet (mêmes claims que `JwtTokenService`, HS512) posé comme cookie sur un compte admin de test (créé puis supprimé), captures d'écran prises et **relues une par une**. Cycle complet confirmé à l'écran, sans erreur console/JS : activation auto-service (checkbox) → dossier créé, statut "Lien envoyé" affiché dans la liste → formulaire public pré-rempli avec nom provisoire + classe suggérée → rempli et soumis → écran de succès → revisite du même lien bloquée ("Ce dossier a déjà été soumis") → retour admin, dossier passé à "En attente de validation" avec boutons Valider/Rejeter → modale de validation avec classe pré-sélectionnée → confirmation → toast "Dossier validé, compte(s) créé(s)" → statut final "Activé", actions vidées. Toutes les données et le compte de test nettoyés après coup (dossier, `StudentProfile`/`User` créés par la validation, `SchoolOnboardingSettings`, compte admin de test), captures d'écran supprimées. |
| 7. Tests unitaires (matching, transitions de statut) | ✅ Fait (2026-07-12) | Les use cases parlent directement à Prisma (comme matricule/paiementMinesec/entranceExam) plutôt que via des ports/repositories — pas de pattern "InMemoryRepository" réutilisable comme pour `OnboarderEcoleUseCase.test.ts`. Choix : extraire les décisions métier pures dans `backend/src/application/eleveOnboarding/rules.ts` (`determinerRecipientType`, `peutTransitionnerDepuisPendingValidation`, `peutSoumettreFormulaire`) pour les rendre testables sans Prisma, et les faire appeler par les use cases au lieu de dupliquer la logique inline. Tests : `eleveOnboarding/__tests__/rules.test.ts` (13 cas — confirme notamment que CONCOURS force PARENT même avec un `recipientTypeExplicite`/`defaultRecipient` à ELEVE explicitement fournis, et qu'aucune transition PENDING_VALIDATION→ACTIVATED/REJECTED n'est possible depuis un autre statut, y compris depuis ACTIVATED lui-même c.-à-d. double validation) et `matricule/__tests__/stringSimilarity.test.ts` (13 cas sur `normalizeForMatch`/`compareNames`, module réutilisé tel quel par ce chantier). **Calibrage corrigé par le test lui-même** : deux assertions supposaient à tort un score `<0.6` pour un homonyme partiel (même prénom, nom différent) — le score réel mesuré est ~0.71-0.73 (un mot exact sur deux tire la moyenne bag-of-words vers le haut), pas un bug de l'algorithme mais une mauvaise estimation de ma part ; corrigé pour vérifier la propriété qui compte réellement, rester sous `FUZZY_SIMILARITY_THRESHOLD` (0.85). `bun test` : 26/26 nouveaux tests passent ; suite complète 220 pass / 18 fail, tous les échecs pré-existants et sans rapport (`GenererBulletinUseCase`, `SubjectAssignmentHelper`, `ConnecterUtilisateurUseCase`, tests d'intégration Prisma) — aucune régression introduite par ce chantier. |

---

## 0. Corrections apportées après audit du code actuel (2026-07-11)

La version précédente de ce document contenait plusieurs inexactitudes techniques par rapport au code réel — corrigées ci-dessous, section par section. À garder en tête pendant l'implémentation :

1. **`Student` n'existe pas → `StudentProfile`**, et **`Classe` n'existe pas → `Class`** (`classId`, pas `classeId`). Le modèle Prisma en section 2 est corrigé.
2. **Il n'y a pas d'`enum Role`** — le champ existant est `UserRole` avec seulement `ADMIN | STAFF | TEACHER | PARENT | STUDENT`. `CENSEUR` et `SURVEILLANT_GENERAL` ne sont **pas** des rôles : ce sont des intitulés de poste libres (`StaffProfile.title`, `String`), portés par des utilisateurs `STAFF`. `responsableRole` doit être typé `UserRole` (défaut `ADMIN`), pas un enum imaginaire à valeurs `CENSEUR`/`SURVEILLANT_GENERAL`.
3. **`EntranceExamCandidate` n'a pas de `schoolId` direct** — il vient de `candidate.session.schoolId` (relation vers `EntranceExamSession`). Le champ téléphone parent existant s'appelle `parentPhone` (pas `telephoneParent`). Corrigé en section 6.
4. **Collision de route critique** : `/api/v2/onboarding` est **déjà entièrement utilisé** par un module existant et sans rapport — l'onboarding d'**établissement** (assistant de configuration après invitation Master : `/api/v2/onboarding/invite/:token`, `/api/v2/onboarding/execute`, `/api/v2/onboarding/preview-structure`, `/api/v2/onboarding/analyze-pebs`...). Le frontend a même déjà une route `/onboarding/[token]` pour ce flux (assistant de setup d'école, sans rapport avec un élève). **Ce nouveau module doit utiliser un préfixe distinct** : `/api/v2/eleve-onboarding` côté backend, `/eleve-onboarding/[token]` côté frontend. Toutes les routes de la section 3 sont renommées en conséquence.
5. **Convention API non respectée** : aucune route existante du projet ne porte `:schoolId` dans l'URL — le `schoolId` vient systématiquement de `req.user!.schoolId` (session authentifiée), jamais du path. Section 3 corrigée.
6. **Le "moteur de scoring cartescolaire" n'est pas une pondération 30/40/30 établissement/date/nom** — ce moteur n'existe pas pour l'établissement (déjà un filtre dur : toutes les requêtes sont scopées par `schoolId`, pas un score). Le vrai moteur (`backend/src/application/matricule/stringSimilarity.ts`, utilisé par `ImporterMatriculesUseCase`) fonctionne ainsi : (a) date de naissance = **verrou dur** — sans coïncidence exacte, aucun candidat n'est même évalué ; (b) sur les candidats restants, `compareNames()` calcule un score Jaro-Winkler tokenisé (bag-of-words, robuste à l'inversion nom/prénom) sur 0–1 ; (c) seuil conservateur `0.85`. Pas de composite pondéré à trois facteurs. Corrigé en section 4 et 5.
7. **Pas de `packages/matching-engine`** — ce projet n'est pas un monorepo à `packages/`. Le moteur vit dans `backend/src/application/matricule/stringSimilarity.ts`. À réutiliser tel quel par import direct (fonctions pures `normalizeForMatch`/`compareNames`, sans effet de bord — importables depuis un autre module applicatif sans violer l'architecture hexagonale).
8. **Le "système d'audit déjà en place" existe mais n'est pas spécifique aux frais** — c'est `ActivitiesLog` (modèle Prisma générique : `schoolId?`, `userId?`, `action`, `description?`, `metadata?`) exposé via `logActivity()` dans `backend/src/utils/activitieslog.ts`. Générique, à réutiliser tel quel — corrigé en section 5.
9. **Notifications** : le projet a déjà une convention claire à suivre plutôt qu'inventer un mécanisme — SMS via `backend/src/infrastructure/services/SmsNotificationService.ts` (fonctions `notifyXxxSms(opts)`, dont `notifyCepResultSms` et `notifyAdmissionProvisoireSms` existent déjà pour la Phase 4 du concours), email via le port hexagonal `domain/ports/services/EmailService.ts` + adapter `NodemailerEmailService` (déjà utilisé par `InviterEcoleUseCase.ts` pour un flux quasi identique : email avec lien à token). Section 4 corrigée pour pointer vers ces mécanismes existants au lieu d'en décrire de nouveaux.
10. **Nommage des use cases** : la convention du projet est verbe-français-en-tête (`EnregistrerResultatCepUseCase`, `ImporterMatriculesUseCase`, `InviterEcoleUseCase`, `GenererPaiementsMinesecUseCase`), pas du camelCase anglais (`createOnboardingSkeleton`). Renommé en section 7.
11. **`SchoolOnboardingSettings` en table dédiée est conforme aux conventions existantes** (le projet a déjà `SchoolNotificationSettings`, `SchoolConfigurationForm` en tables singleton 1:1 par école) — **aucune correction nécessaire ici**, contrairement aux points ci-dessus.
12. **Suggestion de classe pour le flux CONCOURS** : `EntranceExamSession` n'a aujourd'hui aucun champ de classe cible (contrairement à `PebsExamSession.targetClassId`, qui existe déjà pour le sous-module PEBS). Le code actuel de `EnregistrerResultatCepUseCase` devine la classe 6e via `Class.findMany({ schoolId, level: { contains: '6' } })` et prend la première trouvée — c'est précisément la faille que ce chantier corrige (suggestion, pas assignation automatique). Recommandation : ajouter `EntranceExamSession.targetClassId String?` (nullable, miroir exact de `PebsExamSession.targetClassId`) pour rendre la suggestion déterministe et configurable par session plutôt que devinée par correspondance de chaîne. Détail en section 6.
13. Le crash historique de `EnregistrerResultatCepUseCase` (dateOfBirth posé sur `User.create` au lieu de `StudentProfile.create`) a déjà été corrigé dans un chantier précédent — ne pas y retoucher, ce chantier ne touche que la création de compte (mot de passe en clair, absence d'email/téléphone, classe imposée).
14. **Provisionnement d'un vrai compte PARENT, ajouté après implémentation initiale de la phase 2.** Constat fait en lisant `SmsNotificationService.getParentPhones()` (déjà existant) : tout le système de notifications du projet (absences, paiements, bulletins...) résout le téléphone à contacter via `ParentStudent → ParentProfile → User.phone` — **jamais** via le téléphone propre de l'élève. Si `ValiderOnboardingUseCase` se contentait de créer un `User` role `STUDENT`, un élève onboardé avec `recipientType = PARENT` (le cas forcé pour tout le flux CONCOURS) n'aurait jamais reçu aucune notification, silencieusement — la même classe de faille que celle que ce chantier corrige déjà. `ValiderOnboardingUseCase` crée donc maintenant, selon `recipientType` :
    - `ELEVE` : un seul compte, `User` role `STUDENT`, avec `contactEmail`/`contactTelephone` et un lien de configuration de mot de passe.
    - `PARENT` : le compte élève est créé (obligatoire, un `StudentProfile` exige toujours un `User`) mais **sans** coordonnées propres (`email`/`phone` null) ; un second compte `User` role `PARENT` + `ParentProfile` + `ParentStudent` est créé (ou **réutilisé** si un parent avec le même email/téléphone existe déjà dans l'école — cas fréquent d'un 2ème enfant scolarisé, testé explicitement) et reçoit les coordonnées + le lien de configuration.
    - `LES_DEUX` : **limitation de modèle de données à connaître** — `StudentOnboarding` n'a qu'un seul couple `contactEmail`/`contactTelephone` (pas un par destinataire), et `User` a une contrainte `@@unique([schoolId, email])` / `@@unique([schoolId, phone])` : deux comptes de rôles différents ne peuvent donc jamais partager le même contact dans la même école (testé — ça lève une violation de contrainte). En pratique, `LES_DEUX` se comporte aujourd'hui comme `PARENT` (le compte parent reçoit le contact, l'élève n'a pas de coordonnées propres) ; à affiner si le formulaire d'onboarding (phase 6) collecte un jour deux contacts séparés.
    - Volontairement **hors scope** : un flux de fusion/rattachement manuel si un parent a été onboardé deux fois avec des coordonnées légèrement différentes (ex. deux numéros différents pour le même parent) — pas détecté ni géré ici, resterait un doublon de compte parent.

---

## 1. Vue d'ensemble du flux

```
[Établissement crée un enregistrement squelette]
            ↓
[Génération d'un token sécurisé + envoi lien (email/SMS)]
            ↓
[Élève ou parent remplit le formulaire self-service]
            ↓
[Matching automatique (verrou date de naissance + score Jaro-Winkler nom/prénom)]
            ↓
[Statut EN_ATTENTE_VALIDATION → notification au responsable désigné]
            ↓
[Responsable valide (1 clic) ou rejette]
            ↓
[Si validé : création du compte + email "configurer votre mot de passe"]

En parallèle, dès l'envoi du lien :
[Relances automatiques J+3, J+7 → escalade au responsable à J+10 (configurable)]
```

---

## 2. Modèle de données (ajouts Prisma)

```prisma
enum OnboardingStatus {
  DRAFT              // squelette créé par l'établissement, lien pas encore envoyé
  LINK_SENT          // lien envoyé, en attente de saisie
  SUBMITTED          // formulaire rempli, matching en cours
  PENDING_VALIDATION // matching terminé, en attente de validation humaine
  VALIDATED          // validé, compte en cours de création
  ACTIVATED          // compte créé, email de config mot de passe envoyé
  REJECTED           // rejeté par le responsable (doublon, erreur, etc.)
  EXPIRED            // token expiré sans soumission
}

enum OnboardingRecipient {
  ELEVE
  PARENT
  LES_DEUX
}

enum OnboardingSource {
  IMPORT_MASSE          // rentrée, via Excel/CSV — ne passe normalement pas par ce modèle
  AUTOSERVICE            // nouvel arrivant en cours d'année, initié par l'établissement
  CONCOURS                // issu d'un EntranceExamCandidate confirmé (CEP réussi)
}

model StudentOnboarding {
  id                String              @id @default(cuid())
  schoolId          String
  school            School              @relation(fields: [schoolId], references: [id])

  // Squelette initial (rempli par l'établissement, ou généré depuis le concours)
  nomProvisoire     String
  classId           String?             // suggestion, éditable jusqu'à validation — nullable comme StudentProfile.classId
  classe             Class?              @relation(fields: [classId], references: [id])
  contactEmail      String?
  contactTelephone  String?
  recipientType     OnboardingRecipient @default(ELEVE)

  // Traçabilité de la source
  sourceType         OnboardingSource    @default(AUTOSERVICE)
  examCandidateId    String?             // rempli uniquement si sourceType = CONCOURS
  examCandidate      EntranceExamCandidate? @relation(fields: [examCandidateId], references: [id])

  // Token sécurisé
  token             String              @unique
  tokenExpiresAt    DateTime
  tokenUsedAt       DateTime?

  // Données soumises par l'élève/parent (JSON flexible, validées ensuite)
  submittedData     Json?
  submittedAt       DateTime?

  // Résultat du matching (réutilise normalizeForMatch/compareNames de stringSimilarity.ts)
  matchScore        Int?                // pourcentage 0-100, issu de compareNames() — null si aucun candidat n'a passé le verrou date de naissance
  matchedStudentId  String?             // si un score élevé indique un doublon potentiel

  // Statut et validation
  status            OnboardingStatus    @default(DRAFT)
  validatedById     String?
  validatedBy       User?               @relation(fields: [validatedById], references: [id])
  validatedAt       DateTime?
  rejectionReason   String?

  // Résultat final
  createdStudentId  String?
  createdStudent    StudentProfile?     @relation(fields: [createdStudentId], references: [id])

  // Relances
  remindersSentCount Int                @default(0)
  lastReminderAt     DateTime?
  escalatedAt         DateTime?

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@index([schoolId, status])
  @@index([token])
}
```

**Config par établissement** (table singleton 1:1, conforme au pattern déjà en place pour `SchoolNotificationSettings`/`SchoolConfigurationForm`) :

```prisma
model SchoolOnboardingSettings {
  schoolId                String   @id
  school                  School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  selfServiceEnabled      Boolean  @default(false)
  defaultRecipient        OnboardingRecipient @default(ELEVE)
  ageThresholdForParent   Int      @default(15)  // en dessous de cet âge → formulaire au parent
  tokenExpiryDays         Int      @default(14)
  reminderDelayDays       Int[]    @default([3, 7])  // jours après envoi pour chaque relance
  escalationDelayDays     Int      @default(10)
  responsableRole         UserRole @default(ADMIN)   // UserRole existant : ADMIN ou STAFF (pas d'enum de rôle métier séparé)
}
```

**Recommandé en complément** (voir point 12 de la section 0) :

```prisma
model EntranceExamSession {
  // ... champs existants inchangés
  targetClassId String?   // NOUVEAU — miroir de PebsExamSession.targetClassId, rend la suggestion de classe déterministe
  targetClass   Class?    @relation(fields: [targetClassId], references: [id])
}
```

---

## 3. Endpoints REST

Préfixe `/api/v2/eleve-onboarding` (distinct de `/api/v2/onboarding`, déjà pris par l'onboarding d'établissement — voir section 0, point 4). `schoolId` toujours dérivé de `req.user!.schoolId`, jamais du path (convention constante du projet).

| Méthode | Route | Rôle requis | Description |
|---|---|---|---|
| `POST` | `/api/v2/eleve-onboarding` | `requireAuth`, `requireRole('ADMIN','STAFF')` | Crée le squelette + génère le token + déclenche l'envoi |
| `GET` | `/api/v2/eleve-onboarding/token/:token` | Public (token valide) | Récupère le formulaire pré-rempli (nom provisoire, classe suggérée) |
| `POST` | `/api/v2/eleve-onboarding/token/:token/submit` | Public (token valide, non expiré, non utilisé) | Soumet les données, déclenche le matching |
| `GET` | `/api/v2/eleve-onboarding?status=PENDING_VALIDATION` | `requireAuth`, `requireRole('ADMIN','STAFF')` | Liste des dossiers en attente (scopée à `req.user.schoolId`) |
| `POST` | `/api/v2/eleve-onboarding/:id/validate` | `requireAuth`, rôle vérifié dynamiquement contre `SchoolOnboardingSettings.responsableRole` | Valide → déclenche création de compte |
| `POST` | `/api/v2/eleve-onboarding/:id/reject` | idem | Rejette avec motif |
| `POST` | `/api/v2/eleve-onboarding/:id/resend-link` | `requireAuth`, `requireRole('ADMIN','STAFF')` | Renvoie un nouveau token (invalide l'ancien) |

**Sécurité du token** :
- Généré via `crypto.randomBytes(32).toString('hex')`, jamais l'ID en clair
- Usage unique : `tokenUsedAt` bloque toute réutilisation après soumission
- Expiration configurable (`tokenExpiryDays`, défaut 14 jours)
- Rate-limiting sur `GET /api/v2/eleve-onboarding/token/:token` pour éviter le brute-force (réutiliser le middleware de rate-limit déjà appliqué ailleurs dans le projet, ex. `sensitiveWriteLimiter` vu sur les routes classCouncil)

---

## 4. Events & Jobs Inngest

Convention retenue : style `paiementJobs.ts` (id kebab-case tout en minuscules, `name` lisible, `triggers`) plutôt que le style PascalCase-tiret plus ancien de `functions.ts` — c'est le style le plus récent du module MINESEC, cohérent avec ce chantier.

```typescript
// Déclenché à la création du squelette
"onboarding-eleve/link.created"
  → email via EmailService (port hexagonal + NodemailerEmailService, même pattern que InviterEcoleUseCase)
  → SMS via une nouvelle notifyOnboardingLinkSms() ajoutée à SmsNotificationService.ts, si contactTelephone renseigné

// Cron quotidien qui scanne les dossiers en LINK_SENT
export const relanceOnboarding = inngest.createFunction(
  { id: 'relance-onboarding-eleve-quotidien', name: 'Relances onboarding élève', triggers: [{ cron: '0 8 * * *' }] },
  ...
)
  → pour chaque dossier avec status=LINK_SENT :
    - si (aujourd'hui - createdAt) correspond à un jour dans reminderDelayDays
      → envoie relance, incrémente remindersSentCount
    - si (aujourd'hui - createdAt) >= escalationDelayDays et escalatedAt est null
      → notifie le responsable désigné, met à jour escalatedAt
    - si (aujourd'hui - createdAt) >= tokenExpiryDays
      → status = EXPIRED

// Déclenché à la soumission du formulaire
"onboarding-eleve/submitted"
  → charge tous les StudentProfile de l'école (comme ImporterMatriculesUseCase)
  → filtre sur date de naissance exacte (verrou dur, aucun score en dessous)
  → sur les survivants, calcule compareNames(nomSoumis, prenomSoumis, nomProfil, prenomProfil)
  → si matchScore >= 85 : flag doublon probable (matchedStudentId renseigné), statut reste PENDING_VALIDATION avec alerte visible à l'admin
  → sinon : status = PENDING_VALIDATION, notifie le responsable
  → PAS d'auto-association, même à 100% — même principe que le fuzzy matching matricule : jamais d'action automatique sans confirmation humaine

// Déclenché à la validation
"onboarding-eleve/validated"
  → crée le StudentProfile en base (avec le User associé, rôle STUDENT ou PARENT selon recipientType)
  → envoie l'email "configurez votre mot de passe" (EmailService)
  → status = ACTIVATED
  → logActivity({ userId: validatedById, schoolId, action: 'ONBOARDING_VALIDATED', details: ... })
```

---

## 5. Règles métier à respecter

1. **Ne jamais auto-créer le compte sans validation humaine** — le statut `PENDING_VALIDATION` est une étape obligatoire, pas optionnelle.
2. **Réutiliser le moteur de matching existant** (`normalizeForMatch`/`compareNames` de `backend/src/application/matricule/stringSimilarity.ts`) plutôt que d'en recréer un nouveau : date de naissance en verrou dur, score Jaro-Winkler tokenisé sur nom/prénom, seuil `0.85` (aligné sur `FUZZY_SIMILARITY_THRESHOLD` déjà utilisé pour l'import matricule — garder la même valeur pour rester cohérent dans tout le projet).
3. **`recipientType` doit être déterminé dynamiquement** via `ageThresholdForParent` comparé à la date de naissance déclarée (ou l'âge moyen attendu du niveau de la classe suggérée), pas seulement une valeur statique par établissement — **sauf pour `sourceType = CONCOURS`**, où `recipientType = PARENT` est forcé structurellement : un admis en 6e est quasi systématiquement mineur, indépendamment du seuil configuré.
4. **Traçabilité complète** : chaque changement de statut doit créer une entrée `ActivitiesLog` via `logActivity()` (`backend/src/utils/activitieslog.ts`) — mécanisme générique déjà en place dans le projet, pas un système spécifique aux frais.
5. **`selfServiceEnabled` par établissement** : les écoles peu digitalisées doivent pouvoir désactiver ce flux et rester sur l'import Excel/CSV pur. Ce toggle ne doit **pas** bloquer le flux `CONCOURS` — même une école qui désactive l'auto-service pour ses nouveaux arrivants classiques doit pouvoir compléter les dossiers des admis au concours via ce mécanisme, puisque c'est aussi la correction de la faille "comptes sans email/phone" du module concours.
6. **Pas de double notification au parent** : si `sourceType = CONCOURS`, le SMS déjà envoyé via `notifyAdmissionProvisoireSms`/`notifyCepResultSms` (Phase 4 du concours, existants) informe le parent de l'admission — le lien d'onboarding envoyé ensuite doit être un message distinct et clairement identifié ("complétez le dossier de votre enfant"), pas une répétition de l'annonce d'admission.

---

## 6. Convergence avec le flux concours d'entrée en 6e

**Constat confirmé par lecture du code actuel** (`backend/src/application/entranceExam/EnregistrerResultatCepUseCase.ts`) : la branche `cepResult === 'REUSSI'` crée aujourd'hui un `User` + `StudentProfile` directement, avec un mot de passe hardcodé (`'ZEKOULABIA2024'`), sans email ni téléphone sur le compte, et assigne la classe en prenant la première trouvée par `Class.findMany({ schoolId, level: { contains: '6' } })` — exactement la faille que ce module corrige pour le flux classique. Plutôt que de dupliquer une correction dans deux endroits, cette branche doit déléguer à ce module.

**Nouveau comportement de `EnregistrerResultatCepUseCase`** :

```typescript
// Avant (actuel, à corriger) :
if (cepResult === 'REUSSI') {
  // ... crée user + studentProfile directement, mdp hardcodé, classe devinée
}

// Après :
if (cepResult === 'REUSSI') {
  await creerSqueletteOnboardingUseCase.execute({
    schoolId: candidate.session.schoolId,   // PAS candidate.schoolId — le champ n'existe pas sur EntranceExamCandidate
    nomProvisoire: `${candidate.firstName} ${candidate.lastName}`,
    classId: candidate.session.targetClassId ?? undefined,  // suggestion si le champ recommandé en section 2 est ajouté, sinon null — jamais assignée automatiquement
    contactTelephone: candidate.parentPhone,   // champ existant réel, pas "telephoneParent"
    recipientType: 'PARENT',
    sourceType: 'CONCOURS',
    examCandidateId: candidate.id,
  })
  // → déclenche "onboarding-eleve/link.created" comme n'importe quel autre onboarding
}
```

**Ce que ça change concrètement pour le candidat au concours** :
- Les infos minimales déjà collectées pendant le concours (nom, prénom, date de naissance, école d'origine, téléphone parent) alimentent directement `submittedData` en pré-remplissage — le parent n'a qu'à **compléter**, pas tout ressaisir.
- Le moteur de matching partagé (section 5, règle 2) tourne automatiquement pour détecter si ce candidat correspond à un élève déjà connu du système (transfert, doublon d'inscription).
- L'assignation de classe reste une **suggestion** validée par le responsable — pas une classe imposée par l'algorithme d'admission. Si `EntranceExamSession.targetClassId` est ajouté (section 2), la suggestion devient déterministe par session plutôt que devinée par correspondance de chaîne sur `level`.
- Le statut `EntranceExamCandidate.admissionStatus = CONFIRME` et le `StudentOnboarding.status` évoluent en parallèle mais restent liés via `examCandidateId`, ce qui permet de retracer un compte élève jusqu'à sa session de concours d'origine pour les statistiques MINESEC.
- Le crash historique dateOfBirth (déjà corrigé dans un chantier précédent, voir section 0 point 13) n'est pas concerné par ce changement — cette correction ne touche que la logique de création de compte, pas la gestion de `dateOfBirth`.

---

## 7. Prompt prêt pour Claude Code

```
Implémente le flux d'onboarding auto-service des nouveaux élèves décrit dans
spec-onboarding-eleve-autoservice.md, dans le respect de l'architecture
hexagonale existante du projet ZekoulABia et des conventions du projet
(use cases nommés en français verbe-en-tête, schoolId toujours dérivé de
req.user.schoolId, jamais du path) :

1. Ajoute les modèles Prisma (StudentOnboarding, SchoolOnboardingSettings,
   enums OnboardingStatus/OnboardingRecipient/OnboardingSource) et génère
   la migration. StudentOnboarding a un lien optionnel vers
   EntranceExamCandidate (examCandidateId) pour la traçabilité concours.
   Ajoute aussi EntranceExamSession.targetClassId (nullable, miroir de
   PebsExamSession.targetClassId).
2. Crée le module domaine `eleveOnboarding` (ports/adapters) avec les use
   cases : CreerSqueletteOnboardingUseCase, SoumettreFormulaireOnboardingUseCase,
   ValiderOnboardingUseCase, RejeterOnboardingUseCase. Le matching réutilise
   normalizeForMatch/compareNames de backend/src/application/matricule/stringSimilarity.ts
   par import direct (ne pas dupliquer la logique).
3. Implémente les endpoints REST listés dans la section 3, sous le préfixe
   /api/v2/eleve-onboarding (PAS /api/v2/onboarding, déjà pris par le module
   d'onboarding d'établissement existant), avec les middlewares RBAC existants
   (requireAuth, requireRole).
4. Implémente les fonctions Inngest listées dans la section 4, style
   paiementJobs.ts (id kebab-case, triggers cron/event). Réutilise
   SmsNotificationService.ts (ajoute notifyOnboardingLinkSms) et le port
   EmailService/NodemailerEmailService existant pour les envois — n'invente
   pas de nouveau mécanisme de notification.
5. Modifie EnregistrerResultatCepUseCase pour que la branche cepResult ===
   'REUSSI' appelle CreerSqueletteOnboardingUseCase (sourceType=CONCOURS,
   recipientType=PARENT forcé, schoolId=candidate.session.schoolId,
   contactTelephone=candidate.parentPhone) au lieu de créer un User/StudentProfile
   directement — voir section 6 pour le détail exact. Supprime toute création
   directe de compte avec mot de passe hardcodé dans ce use case. Ne touche
   PAS à la gestion de dateOfBirth, déjà corrigée.
6. Frontend : nouvelle route publique /eleve-onboarding/[token] (PAS
   /onboarding/[token], déjà pris par l'assistant de setup d'école) pour le
   formulaire élève/parent, plus une section admin listant les dossiers
   PENDING_VALIDATION avec actions valider/rejeter (1 clic).
7. Ajoute les tests unitaires pour le moteur de matching et les transitions
   de statut (notamment : refuser toute transition directe vers ACTIVATED
   sans passer par PENDING_VALIDATION puis VALIDATED, et vérifier que le
   flux CONCOURS force bien recipientType=PARENT indépendamment de
   ageThresholdForParent).

Respecte le pattern de RBAC déjà en place (UserRole: ADMIN, STAFF, TEACHER,
PARENT, STUDENT — il n'y a pas de rôles CENSEUR/SURVEILLANT_GENERAL séparés,
ce sont des StaffProfile.title libres). N'invente pas de nouveau système de
permissions. Ne touche pas à selfServiceEnabled=false pour bloquer le flux
CONCOURS — ce flux doit rester actif même si l'auto-service classique est
désactivé pour l'établissement.
```
