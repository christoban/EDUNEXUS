# Spec technique — Onboarding auto-service des nouveaux élèves

**Contexte** : ZekoulABia (hexagonal, Bun + Express + TypeScript + Prisma + PostgreSQL/Neon, Inngest pour l'async). Ce document couvre le flux qui vient compléter l'import Excel/CSV en masse (rentrée) : ajout ponctuel d'un élève en cours d'année, initié par l'établissement, complété par l'élève/parent, validé par un responsable.

**Convergence avec le flux concours d'entrée en 6e** : ce module sert aussi de point d'atterrissage commun pour le flux `EntranceExamSession` (voir `spec-corrections-concours-prioritaires.md`). Une fois un candidat `CONFIRME` (résultat CEP positif), la Phase 5 du concours ne doit plus créer un `User` directement — elle doit créer un `StudentOnboarding` pré-rempli avec `sourceType: CONCOURS`, ce qui déclenche le même mécanisme de lien sécurisé, de relances et de validation que pour un nouvel arrivant classique. Voir section 2bis et 7.

---

## 1. Vue d'ensemble du flux

```
[Établissement crée un enregistrement squelette]
            ↓
[Génération d'un token sécurisé + envoi lien (email/SMS)]
            ↓
[Élève ou parent remplit le formulaire self-service]
            ↓
[Matching automatique via moteur de scoring (réutilise le module cartescolaire)]
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
  classeId          String
  classe            Classe              @relation(fields: [classeId], references: [id])
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

  // Résultat du matching (réutilise le moteur de scoring cartescolaire)
  matchScore        Int?
  matchedStudentId  String?             // si un score élevé indique un doublon potentiel

  // Statut et validation
  status            OnboardingStatus    @default(DRAFT)
  validatedById     String?
  validatedBy       User?               @relation(fields: [validatedById], references: [id])
  validatedAt       DateTime?
  rejectionReason   String?

  // Résultat final
  createdStudentId  String?
  createdStudent    Student?            @relation(fields: [createdStudentId], references: [id])

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

**Config par établissement** (à ajouter au modèle `School` ou table `SchoolSettings`) :

```prisma
model SchoolOnboardingSettings {
  schoolId                String   @id
  school                  School   @relation(fields: [schoolId], references: [id])
  selfServiceEnabled      Boolean  @default(false)
  defaultRecipient        OnboardingRecipient @default(ELEVE)
  ageThresholdForParent   Int      @default(15)  // en dessous de cet âge → formulaire au parent
  tokenExpiryDays         Int      @default(14)
  reminderDelayDays       Int[]    @default([3, 7])  // jours après envoi pour chaque relance
  escalationDelayDays     Int      @default(10)
  responsableRole         Role     @default(ADMIN)   // ADMIN, CENSEUR, SURVEILLANT_GENERAL...
}
```

---

## 3. Endpoints REST

| Méthode | Route | Rôle requis | Description |
|---|---|---|---|
| `POST` | `/api/schools/:schoolId/onboarding` | ADMIN, SURVEILLANT_GENERAL | Crée le squelette + génère le token + déclenche l'envoi |
| `GET` | `/api/onboarding/:token` | Public (token valide) | Récupère le formulaire pré-rempli (nom provisoire, classe) |
| `POST` | `/api/onboarding/:token/submit` | Public (token valide, non expiré, non utilisé) | Soumet les données, déclenche le matching |
| `GET` | `/api/schools/:schoolId/onboarding?status=PENDING_VALIDATION` | ADMIN, CENSEUR, SURVEILLANT_GENERAL | Liste des dossiers en attente |
| `POST` | `/api/onboarding/:id/validate` | Rôle configuré via `responsableRole` | Valide → déclenche création de compte |
| `POST` | `/api/onboarding/:id/reject` | Rôle configuré via `responsableRole` | Rejette avec motif |
| `POST` | `/api/onboarding/:id/resend-link` | ADMIN, SURVEILLANT_GENERAL | Renvoie un nouveau token (invalide l'ancien) |

**Sécurité du token** :
- Généré via `crypto.randomBytes(32).toString('hex')`, jamais l'ID en clair
- Usage unique : `tokenUsedAt` bloque toute réutilisation après soumission
- Expiration configurable (`tokenExpiryDays`, défaut 14 jours)
- Rate-limiting sur `GET /api/onboarding/:token` pour éviter le brute-force

---

## 4. Events & Jobs Inngest

```typescript
// Déclenché à la création du squelette
"onboarding/link.created" → envoie l'email/SMS initial avec le lien

// Cron quotidien qui scanne les dossiers en LINK_SENT
"onboarding/reminder.check" (cron: "0 8 * * *")
  → pour chaque dossier avec status=LINK_SENT :
    - si (aujourd'hui - createdAt) correspond à un jour dans reminderDelayDays
      → envoie relance, incrémente remindersSentCount
    - si (aujourd'hui - createdAt) >= escalationDelayDays et escalatedAt est null
      → notifie le responsable désigné, met à jour escalatedAt
    - si (aujourd'hui - createdAt) >= tokenExpiryDays
      → status = EXPIRED

// Déclenché à la soumission du formulaire
"onboarding/submitted" 
  → lance le moteur de scoring (établissement + date de naissance + nom normalisé)
  → si matchScore >= 95 : flag doublon probable, statut reste PENDING_VALIDATION avec alerte
  → sinon : status = PENDING_VALIDATION, notifie le responsable

// Déclenché à la validation
"onboarding/validated"
  → crée le Student en base
  → crée le User associé (rôle STUDENT ou PARENT selon recipientType)
  → envoie l'email "configurez votre mot de passe"
  → status = ACTIVATED
```

---

## 5. Règles métier à respecter

1. **Ne jamais auto-créer le compte sans validation humaine** — le statut `PENDING_VALIDATION` est une étape obligatoire, pas optionnelle.
2. **Réutiliser le moteur de scoring existant** (établissement 30 / date de naissance 40 / nom 30, comme conçu pour cartescolaire) plutôt que d'en recréer un nouveau — factoriser dans un module partagé `packages/matching-engine`.
3. **`recipientType` doit être déterminé dynamiquement** via `ageThresholdForParent` comparé à la date de naissance déclarée dans la classe (ou l'âge moyen attendu du niveau), pas seulement une valeur statique par établissement — **sauf pour `sourceType = CONCOURS`**, où `recipientType = PARENT` est forcé structurellement : un admis en 6e est quasi systématiquement mineur, indépendamment du seuil configuré.
4. **Traçabilité complète** : chaque changement de statut doit créer une entrée d'audit log (qui, quand, quoi) — réutiliser le système d'audit déjà en place pour le workflow de publication des frais.
5. **`selfServiceEnabled` par établissement** : les écoles peu digitalisées doivent pouvoir désactiver ce flux et rester sur l'import Excel/CSV pur. Ce toggle ne doit **pas** bloquer le flux `CONCOURS` — même une école qui désactive l'auto-service pour ses nouveaux arrivants classiques doit pouvoir compléter les dossiers des admis au concours via ce mécanisme, puisque c'est aussi la correction de la faille #2 de l'audit (comptes sans email/phone).
6. **Pas de double notification au parent** : si `sourceType = CONCOURS`, le SMS déjà envoyé à la Phase 4 (résultat CEP) informe le parent de l'admission — le lien d'onboarding envoyé à la Phase 5 doit être un message distinct et clairement identifié ("complétez le dossier de votre enfant"), pas une répétition de l'annonce d'admission.

---

## 6. Convergence avec le flux concours d'entrée en 6e

**Constat** : `EnregistrerResultatCepUseCase` (Phase 5 du concours) crée aujourd'hui un `User` directement, avec un mot de passe hardcodé et sans email/phone — exactement la faille que ce module corrige pour le flux classique. Plutôt que de dupliquer une correction dans deux endroits, la Phase 5 doit déléguer à ce module.

**Nouveau comportement de `EnregistrerResultatCepUseCase`** :

```typescript
// Avant (actuel, à corriger) :
if (cepResult === 'REUSSI') {
  await creerCompteDepuisCandidat(candidate) // crée User directement, mdp hardcodé
}

// Après :
if (cepResult === 'REUSSI') {
  await createOnboardingSkeleton({
    schoolId: candidate.schoolId,
    nomProvisoire: `${candidate.prenom} ${candidate.nom}`,
    classeId: sixiemeClasseSuggereeId,  // suggestion, pas assignation automatique (cf. faille #6)
    contactTelephone: candidate.telephoneParent,
    recipientType: 'PARENT',
    sourceType: 'CONCOURS',
    examCandidateId: candidate.id,
  })
  // → déclenche "onboarding/link.created" comme n'importe quel autre onboarding
}
```

**Ce que ça change concrètement pour le candidat au concours** :
- Les infos minimales déjà collectées pendant le concours (nom, prénom, date de naissance, école d'origine, téléphone parent) alimentent directement `submittedData` en pré-remplissage — le parent n'a qu'à **compléter**, pas tout ressaisir.
- Le moteur de scoring partagé (section 5, règle 2) tourne automatiquement pour détecter si ce candidat correspond à un élève déjà connu du système (transfert, doublon d'inscription).
- L'assignation de classe reste une **suggestion** validée par le responsable (cohérent avec la correction de la faille #6 sur le concours) — pas une classe imposée par l'algorithme d'admission.
- Le statut `EntranceExamCandidate.status = CONFIRME` et le `StudentOnboarding.status` évoluent en parallèle mais restent liés via `examCandidateId`, ce qui permet de retracer un compte élève jusqu'à sa session de concours d'origine pour les statistiques MINESEC.

---

## 7. Prompt prêt pour Claude Code

```
Implémente le flux d'onboarding auto-service des nouveaux élèves décrit dans 
spec-onboarding-eleve-autoservice.md, dans le respect de l'architecture 
hexagonale existante du projet ZekoulABia :

1. Ajoute les modèles Prisma (StudentOnboarding, SchoolOnboardingSettings, 
   enums OnboardingStatus/OnboardingRecipient/OnboardingSource) et génère 
   la migration. StudentOnboarding doit avoir un lien optionnel vers 
   EntranceExamCandidate (examCandidateId) pour la traçabilité concours.
2. Crée le module domaine `onboarding` (ports/adapters) avec les use cases :
   createOnboardingSkeleton, submitOnboardingForm, validateOnboarding, 
   rejectOnboarding.
3. Implémente les endpoints REST listés dans la section 3, avec les 
   middlewares RBAC existants.
4. Implémente les fonctions Inngest listées dans la section 4, en réutilisant 
   le moteur de scoring déjà conçu pour l'intégration cartescolaire.
5. Modifie EnregistrerResultatCepUseCase pour qu'il appelle 
   createOnboardingSkeleton (sourceType=CONCOURS, recipientType=PARENT forcé) 
   au lieu de créer un User directement — voir section 6 pour le détail exact 
   du nouveau comportement. Supprime toute création directe de compte avec 
   mot de passe hardcodé dans ce use case.
6. Ajoute les tests unitaires pour le moteur de matching et les transitions 
   de statut (notamment : refuser toute transition directe vers ACTIVATED 
   sans passer par PENDING_VALIDATION puis VALIDATED, et vérifier que le 
   flux CONCOURS force bien recipientType=PARENT indépendamment de 
   ageThresholdForParent).

Respecte le pattern de RBAC déjà en place pour les rôles (ADMIN, CENSEUR, 
SURVEILLANT_GENERAL). N'invente pas de nouveau système de permissions. 
Ne touche pas à selfServiceEnabled=false pour bloquer le flux CONCOURS — 
ce flux doit rester actif même si l'auto-service classique est désactivé 
pour l'établissement.
```
