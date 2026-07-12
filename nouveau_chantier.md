# Roadmap d'implémentation — MatriculeNational & Paiements

**EduNexus — Architecture Hexagonale (Bun + Express + TypeScript + Prisma)**

*Document généré pour EduNexus — Architecture hexagonale Bun + Express + TypeScript + Prisma*
*Mise à jour : juin 2026*

---

## Périmètre couvert

- Intégration du matricule national MINESEC (`cartescolaire.cm`)
- Gestion des paiements officiels MINESEC (frais scolarité + examens) via opérateurs agréés
- Gestion des frais établissement (APE, cantine, etc.) via CampPay
- Vue consolidée des paiements par élève, surveillance automatique du statut de paiement

---

## Vue d'ensemble de la roadmap

| Phase | Nom | Durée estimée | Priorité |
|---|---|---|---|
| Phase 1 | Fondations — Modèle de données | 3–4 jours | 🔴 Critique |
| Phase 2 | Intégration matricule & onboarding élèves | 4–5 jours | 🔴 Critique |
| Phase 3 | Module Paiements MINESEC (frais officiels) | 3–4 jours | 🟠 Haute |
| Phase 4 | Module Paiements Établissement (CampPay) | 2–3 jours | 🟠 Haute |
| Phase 5 | Vue consolidée & Dashboard Paiements | 2–3 jours | 🟡 Moyenne |
| Phase 6 | Surveillance automatique (Polling/Webhook) | 3–4 jours | 🟡 Moyenne |
| Phase 7 | Module Examens — Liaison matricule/candidat | 2–3 jours | 🟡 Moyenne |

**Durée totale estimée : 3–4 semaines**

---

## Phase 1 — Fondations : Modèle de données

### Objectif
Étendre le schéma Prisma existant pour supporter le matricule national et le système de paiement dual (MINESEC + établissement).

### 1.1 — Mise à jour du modèle `Student`

```prisma
model Student {
  // ... champs existants (id, nom, prénom, dateNaissance, schoolId, etc.)

  // Matricule national MINESEC (cartescolaire.cm)
  matriculeNational    String?          @unique
  matriculeVerifieAt   DateTime?        // date de dernière vérification côté cartescolaire
  matriculeSource      MatriculeSource  @default(MANUAL)
  // MANUAL       = saisi à la main
  // EXCEL_IMPORT = importé depuis fichier Excel cartescolaire
  // AUTO_SYNC    = synchronisé automatiquement (futur)

  // Relations paiements
  paiementsMinesec PaiementMinesec[]
  paiementsEtab    PaiementEtablissement[]
  enrollments      Enrollment[]

  @@index([matriculeNational])
  @@index([schoolId])
}

enum MatriculeSource {
  MANUAL
  EXCEL_IMPORT
  AUTO_SYNC
}
```

### 1.2 — Nouveau modèle `Enrollment` (inscription annuelle)

L'enrollment représente l'inscription d'un élève dans une école pour une année scolaire donnée. C'est l'entité centrale qui relie l'élève à ses paiements annuels.

```prisma
model Enrollment {
  id             String   @id @default(cuid())
  studentId      String
  schoolId       String
  anneeScolaire  String   // "2024-2025"
  classe         String   // "3ème A", "Tle C"

  status EnrollmentStatus @default(PENDING)
  // PENDING          = dossier incomplet
  // ACTIVE           = inscrit et à jour
  // SUSPENDED        = suspendu (paiement en retard)
  // TRANSFERRED_OUT  = élève transféré vers autre école
  // TRANSFERRED_IN   = élève reçu par transfert

  transferOrigin String?    // schoolId d'origine si TRANSFERRED_IN
  transferDate   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  student Student @relation(fields: [studentId], references: [id])
  school  School  @relation(fields: [schoolId], references: [id])

  paiementsMinesec PaiementMinesec[]
  paiementsEtab    PaiementEtablissement[]

  @@unique([studentId, schoolId, anneeScolaire])
  @@index([schoolId, anneeScolaire])
  @@index([status])
}

enum EnrollmentStatus {
  PENDING
  ACTIVE
  SUSPENDED
  TRANSFERRED_OUT
  TRANSFERRED_IN
}
```

### 1.3 — Nouveau modèle `PaiementMinesec` (frais officiels)

```prisma
model PaiementMinesec {
  id            String   @id @default(cuid())
  studentId     String
  enrollmentId  String
  schoolId      String
  anneeScolaire String

  typeFrais TypeFraisMinesec
  // SCOLARITE          = contributions exigibles annuelles
  // EXAMEN_BEPC        = frais inscription BEPC
  // EXAMEN_PROBATOIRE  = frais probatoire
  // EXAMEN_BAC         = frais baccalauréat
  // EXAMEN_GCE_OL      = GCE Ordinary Level
  // EXAMEN_GCE_AL      = GCE Advanced Level

  montantAttendu Float             // montant officiel MINESEC (FCFA)
  montantPaye    Float?
  operateur      OperateurMinesec? // MTN_MOMO | ORANGE_MONEY | CAMPOST | EXPRESS_UNION | AFRILAND

  numeroRecu       String?  // numéro de reçu fourni par l'opérateur
  recuVerifie      Boolean  @default(false)
  recuVerifieAt    DateTime? // statut de vérification sur cartescolaire.cm

  status PaiementStatus @default(IMPAYE) // IMPAYE | PARTIELLEMENT_PAYE | PAYE | VERIFIE

  dateEcheance  DateTime? // deadline de paiement fixée par MINESEC
  datePaiement  DateTime?
  notes         String?

  student    Student    @relation(fields: [studentId], references: [id])
  enrollment Enrollment @relation(fields: [enrollmentId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([studentId, anneeScolaire])
  @@index([schoolId, status])
  @@index([typeFrais, status])
}

enum TypeFraisMinesec {
  SCOLARITE
  EXAMEN_BEPC
  EXAMEN_PROBATOIRE
  EXAMEN_BAC
  EXAMEN_GCE_OL
  EXAMEN_GCE_AL
}

enum OperateurMinesec {
  MTN_MOMO
  ORANGE_MONEY
  CAMPOST
  EXPRESS_UNION
  AFRILAND
}

enum PaiementStatus {
  IMPAYE
  PARTIELLEMENT_PAYE
  PAYE
  VERIFIE
  LITIGE
}
```

### 1.4 — Nouveau modèle `PaiementEtablissement` (frais hors MINESEC)

```prisma
model PaiementEtablissement {
  id            String @id @default(cuid())
  studentId     String
  enrollmentId  String
  schoolId      String
  anneeScolaire String

  typeFrais String // Flexible : "APE", "Cantine T1", "Uniforme", "Voyage scolaire Kribi"
                    // configuré par l'établissement dans SchoolConfig

  montantAttendu Float
  montantPaye    Float          @default(0)
  status         PaiementStatus @default(IMPAYE)

  // CampPay
  campPayTransactionId String? @unique
  campPayReference     String?
  campPayOperateur     String? // "MTN_MOMO" | "ORANGE_MONEY"
  campPayWebhookData   Json?   // raw payload webhook stocké

  recu         String?   // URL ou numéro du reçu généré par EduNexus
  datePaiement DateTime?

  student    Student    @relation(fields: [studentId], references: [id])
  enrollment Enrollment @relation(fields: [enrollmentId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([studentId, anneeScolaire])
  @@index([schoolId, typeFrais, status])
  @@index([campPayTransactionId])
}
```

### 1.5 — Nouveau modèle `MatriculeImportJob` (suivi des imports Excel)

```prisma
model MatriculeImportJob {
  id            String       @id @default(cuid())
  schoolId      String
  uploadedBy    String       // userId
  fileName      String
  status        ImportStatus @default(PENDING) // PENDING | PROCESSING | COMPLETED | FAILED

  totalRows      Int @default(0)
  matchedRows    Int @default(0) // élèves trouvés dans EduNexus
  unmatchedRows  Int @default(0) // élèves non trouvés → à vérifier
  errorRows      Int @default(0) // erreurs de parsing

  resultDetails Json? // [{row: 3, name: "Dupont", status: "UNMATCHED", reason: "..."}]

  processedAt DateTime?
  createdAt   DateTime @default(now())
}

enum ImportStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

---

## Phase 2 — Intégration matricule & Onboarding des élèves

### Architecture hexagonale

```
src/modules/student-enrollment/
  domain/
    Student.ts                    // entité domaine (matriculeNational inclus)
    Enrollment.ts                 // entité domaine
    MatriculeImportResult.ts      // value object résultat d'import
  application/
    usecases/
      ImportMatriculeExcel.usecase.ts
      TransferStudent.usecase.ts
      ValidateMatricule.usecase.ts
      EnrollNewStudent.usecase.ts
      GetStudentWithPaymentStatus.usecase.ts
  infrastructure/
    StudentPrismaRepository.ts
    EnrollmentPrismaRepository.ts
    CarteScolaireScraperAdapter.ts   // scraping cartescolaire.cm
    MatriculeExcelParser.ts          // parsing fichier Excel MINESEC
  http/
    StudentEnrollmentRouter.ts
    ImportMatriculeController.ts
    TransferStudentController.ts
```

### 2.1 — Use case : `ImportMatriculeExcel`

**Déclencheur :** le proviseur télécharge la liste Excel depuis `cartescolaire.cm` et l'upload dans EduNexus.

```typescript
// MatriculeExcelParser.ts
// Lit le fichier Excel MINESEC (colonnes: Nom, Prénom, Date Naissance, Établissement, Matricule)
// Retourne un tableau de { nom, prenom, dateNaissance, matricule, etablissement }
parseMatriculeExcel(buffer: Buffer): MatriculeRow[]

// ImportMatriculeExcel.usecase.ts
// Pour chaque ligne du fichier :
// 1. Cherche l'élève dans EduNexus par (nom + prenom + dateNaissance)
// 2. Si trouvé ET pas de matricule → met à jour
// 3. Si trouvé ET matricule différent → flag CONFLICT (cas rare)
// 4. Si non trouvé → marque UNMATCHED (à traiter manuellement)
// 5. Crée un MatriculeImportJob avec les résultats détaillés
execute(schoolId: string, fileBuffer: Buffer, uploadedBy: string): Promise<MatriculeImportJob>
```

**Ce que le secrétariat voit après l'import :**
- 850 élèves traités
- 823 matricules mis à jour ✓
- 27 élèves non trouvés → voir liste
- 0 conflits

**Résolution des "non trouvés" :** interface de matching manuel — le secrétariat voit la ligne Excel d'un côté, cherche l'élève EduNexus de l'autre, clique "associer".

### 2.2 — Use case : `EnrollNewStudent`

**Déclencheur :** inscription d'un nouvel élève (6ème, redoublant externe, transfert).

```typescript
// Étapes :
// 1. Saisie des infos de base (nom, prénom, date naissance, classe)
// 2. Champ matricule : OBLIGATOIRE avec avertissement si vide
//    → "Cet élève ne pourra pas payer les frais MINESEC ni s'inscrire aux examens sans matricule"
// 3. Vérification d'unicité : ce matricule existe-t-il déjà dans EduNexus ?
//    → Si OUI : "Matricule déjà utilisé — cet élève est-il un transfert ?"
// 4. Création Student + Enrollment (année scolaire courante)
// 5. Génération automatique des PaiementMinesec attendus selon la classe
//    (ex: élève en 3ème → SCOLARITE + EXAMEN_BEPC créés d'office comme IMPAYE)
execute(dto: EnrollStudentDTO): Promise<{ student: Student, enrollment: Enrollment }>
```

### 2.3 — Use case : `TransferStudent`

**Déclencheur :** un élève arrive d'un autre établissement (même réseau EduNexus ou extérieur).

```typescript
// 1. Recherche par matriculeNational (déjà unique dans la DB)
// 2. Si trouvé dans EduNexus (autre schoolId) :
//    → Clone les données pertinentes (historique scolaire, résultats)
//    → Crée nouveau Enrollment avec status TRANSFERRED_IN + transferOrigin
//    → Marque l'ancien Enrollment TRANSFERRED_OUT
// 3. Si non trouvé : création normale avec le matricule fourni
// 4. Rappel UI : "N'oubliez pas de faire la mise à jour sur cartescolaire.cm"
execute(matricule: string, newSchoolId: string, classe: string): Promise<Enrollment>
```

### 2.4 — Adapter : `CarteScolaireScraperAdapter`

**Rôle :** vérifier qu'un matricule est valide sur `cartescolaire.cm` et récupérer les infos associées.

```typescript
interface ICarteScolaireAdapter {
  // Vérifie si un matricule existe + retourne nom/etablissement/dateNaissance
  verifyMatricule(matricule: string): Promise<MatriculeInfo | null>

  // Vérifie si un paiement a été enregistré pour ce matricule (frais scolarité)
  checkPaiementStatus(matricule: string, anneeScolaire: string): Promise<CarteScolairePaymentStatus>
}

// CarteScolaireScraperAdapter.ts (implémentation)
// Utilise fetch() + cheerio pour scraper cartescolaire.cm/search-matricule
// et cartescolaire.cm/verify-payment
// Cache Redis TTL 30min pour éviter de surcharger le site
// Retry avec backoff exponentiel si rate limited
// IMPORTANT : ajouter User-Agent standard navigateur pour éviter blocage
```

---

## Phase 3 — Module Paiements MINESEC (frais officiels)

### Architecture

```
src/modules/paiement-minesec/
  domain/
    PaiementMinesec.ts
    TypeFraisConfig.ts              // montants officiels par niveau/année
  application/
    usecases/
      GeneratePaiementsMinesec.usecase.ts
      VerifyRecu.usecase.ts
      SyncFromCarteScolaire.usecase.ts
      GetPaiementsStatus.usecase.ts
  infrastructure/
    PaiementMinesecPrismaRepository.ts
    CarteScolairePaymentAdapter.ts
  http/
    PaiementMinesecRouter.ts
```

### 3.0 — Données de référence officielles MINESEC (à seeder en DB)

Les montants ci-dessous sont les contributions exigibles officielles et les frais d'examens réels. Le proviseur peut les modifier si le MINESEC publie une révision.

**Qui organise quoi — 3 organismes distincts**
- **DECC** (Direction des Examens et Concours) → BEPC, CAP industriel/commercial/ESF, Concours 6ème
- **OBC** (Office du Baccalauréat) → Probatoire ESG, BAC ESG, BAC Technique, BT, BTI
- **GCE Board** → GCE O-Level, GCE A-Level, ITC, ATC

```typescript
// src/infrastructure/seed/FraisMinesecDefaults.ts
export const FRAIS_MINESEC_DEFAULTS = {
  // ── CONTRIBUTIONS EXIGIBLES (frais de scolarité via opérateurs) ──
  SCOLARITE_PREMIER_CYCLE: 7_500,   // 6ème, 5ème, 4ème, 3ème — tous établissements
  SCOLARITE_SECOND_CYCLE: 10_000,   // 2nde, 1ère, Terminale

  // ── EXAMENS DECC (BEPC, CAP) ──
  EXAMEN_BEPC: 7_000,               // 3ème — BEPC général et bilingue
  EXAMEN_BEPC_BILINGUE: 7_000,      // même montant, série bilingue
  EXAMEN_CAP_INDUSTRIEL: 7_000,     // CAP industriel (technique)
  EXAMEN_CAP_COMMERCIAL: 7_000,     // CAP commercial
  EXAMEN_CAP_ESF: 7_000,            // CAP Économie Sociale et Familiale

  // ── EXAMENS OBC (Probatoire, BAC) ──
  // Hausse officielle de 9 500 → 12 000 FCFA effective depuis session 2024
  EXAMEN_PROBATOIRE_ESG: 12_000,    // 1ère — Probatoire Enseignement Secondaire
  EXAMEN_PROBATOIRE_TECH: 12_000,   // 1ère technique
  EXAMEN_BAC_ESG: 12_000,           // Terminale — Baccalauréat ESG (toutes séries A/B/C/D)
  EXAMEN_BAC_TECH: 12_000,          // Terminale technique
  EXAMEN_BT: 12_000,                // Brevet de Technicien
  EXAMEN_BTI: 12_000,               // Brevet de Technicien Industriel
  // Pénalité inscription tardive OBC : +15 000 FCFA après la date limite

  // ── EXAMENS GCE BOARD (système par matière — anglophone) ──
  // IMPORTANT : montant VARIABLE selon nombre de matières inscrites
  // Frais de base (inscription) :
  GCE_OL_BASE: 8_000,               // GCE Ordinary Level — frais fixes d'inscription
  GCE_AL_BASE: 9_000,               // GCE Advanced Level — frais fixes d'inscription
  GCE_ITC_BASE: 8_000,              // ITC (remplace CAP anglophone)
  GCE_ATC_BASE: 9_000,              // ATC (remplace BAC technique anglophone)

  // Frais par matière (s'ajoutent au montant de base) :
  GCE_OL_PAR_MATIERE: 1_000,        // 1 000 FCFA × nombre de matières O-Level
  GCE_AL_PAR_MATIERE: 2_000,        // 2 000 FCFA × nombre de matières A-Level
  GCE_PRATIQUE_PAR_MATIERE: 5_000,  // supplément pour chaque matière avec pratique
  GCE_TIMBRE_FORMULAIRE: 1_500,     // timbre formulaire G3/T3 (payé au chef de centre)

  // NB : tous les paiements GCE Board via MTN Mobile Money exclusivement
  // Un élève peut payer de 15 000 à 30 000+ FCFA selon ses matières
} as const

// ── CALCUL ESTIMÉ GCE (à utiliser dans BudgetScolaireAnnuel) ──
// Exemple : élève O-Level avec 8 matières dont 2 pratiques
// = 8 000 + (8 × 1 000) + (2 × 5 000) + 1 500 = 27 500 FCFA
export function estimerFraisGCE(params: {
  niveau: 'OL' | 'AL' | 'ITC' | 'ATC'
  nbMatieres: number
  nbMatieresAvecPratique: number
}): number {
  const base = (params.niveau === 'OL' || params.niveau === 'ITC')
    ? FRAIS_MINESEC_DEFAULTS.GCE_OL_BASE
    : FRAIS_MINESEC_DEFAULTS.GCE_AL_BASE

  const parMatiere = (params.niveau === 'OL' || params.niveau === 'ITC')
    ? FRAIS_MINESEC_DEFAULTS.GCE_OL_PAR_MATIERE
    : FRAIS_MINESEC_DEFAULTS.GCE_AL_PAR_MATIERE

  return base
    + (params.nbMatieres * parMatiere)
    + (params.nbMatieresAvecPratique * FRAIS_MINESEC_DEFAULTS.GCE_PRATIQUE_PAR_MATIERE)
    + FRAIS_MINESEC_DEFAULTS.GCE_TIMBRE_FORMULAIRE
}

// Note : les frais APEE ne font PAS partie des contributions exigibles MINESEC.
// Ils varient librement par établissement (12 500 à 30 000 FCFA typiquement).
// → Gérés dans PaiementEtablissement via CampPay
```

### 3.0b — Mécanisme "Budget Scolaire Annuel" (notification parent en début d'année)

C'est l'une des fonctionnalités différenciantes d'EduNexus : dès qu'un élève est inscrit pour l'année, le système génère automatiquement une fiche récapitulative de tous ses frais à venir et la communique au parent.

**Déclencheur :** création d'un `Enrollment` (inscription pour l'année scolaire courante).

**Use case : `GenerateBudgetScolaireAnnuel`**

```typescript
// Ce use case est appelé automatiquement après EnrollNewStudent
interface BudgetScolaireAnnuel {
  eleve: { nom: string; prenom: string; classe: string; matricule: string | null }
  anneeScolaire: string
  etablissement: string
  genereAt: Date
  lignes: BudgetLigne[]
  totalEstime: number
  hasEstimations: boolean  // true si GCE → montant non définitif
}

interface BudgetLigne {
  categorie: 'MINESEC_SCOLARITE' | 'MINESEC_EXAMEN' | 'ETABLISSEMENT'
  label: string
  montant: number
  estEstime: boolean       // true pour GCE Board (variable selon matières)
  echeance: Date | null
  modePaiement: string     // "Via *126*007# MTN" ou "Via EduNexus (CampPay)"
  organisme: string        // "MINESEC" | "OBC" | "DECC" | "GCE Board" | nom établissement
}

// Logique de génération :
// 1. Frais de scolarité MINESEC selon le cycle de la classe
// 2. Si classe d'examen (3ème/Form5/1ère/UpperSixth/Tle) → ajouter frais examen
//    - Francophone : montant fixe OBC/DECC
//    - Anglophone : montant estimé (base + estimation 6-8 matières typiques)
//    - Flag estEstime = true pour GCE
// 3. Frais établissement configurés dans FraisConfig pour cette année/classe
// 4. Calcul totalEstime avec note "* montant estimé" si GCE
execute(enrollmentId: string): Promise<BudgetScolaireAnnuel>
```

**Notification SMS envoyée automatiquement au parent via Techsoft :**

> EduNexus — [NomEcole] : [PrénomElève] est inscrit(e) en [Classe]. Budget 2025-2026 estimé : [Total] FCFA. Connectez-vous sur edunexus.cm ou contactez l'administration pour voir le détail et suivre vos paiements.

### 3.0c — Tableau de bord parent (suivi des paiements)

Vue accessible au parent ou à l'élève (portail ou envoi par SMS/lien).

```
// Réponse de l'endpoint GET /api/dashboard/student-payments/:studentId
// Exemple de rendu côté parent :
┌─────────────────────────────────────────────────────────────┐
│ Ndzana Jean — Tle C — Lycée Bilingue Yaoundé                 │
│ Année 2025-2026                                               │
├──────────────────────────────┬────────┬────────┬─────────────┤
│ Frais scolarité MINESEC       │ 10 000 │ 10 000 │ ✅ Vérifié  │
│ Frais BAC (OBC)                │ 12 000 │      0 │ ❌ Urgent   │
│ Cotisation APE                 │ 20 000 │ 20 000 │ ✅ Payé     │
│ Cantine Trimestre 1            │ 45 000 │ 45 000 │ ✅ Reçu     │
│ Cantine Trimestre 2            │ 45 000 │      0 │ 🕐 Futur    │
├──────────────────────────────┼────────┼────────┼─────────────┤
│ TOTAL                          │132 000 │ 75 000 │             │
└──────────────────────────────┴────────┴────────┴─────────────┘
[Vérifier paiement MINESEC →]   [Payer cantine T2 →]
```

**Statuts possibles :**
- `VERIFIE` : paiement confirmé via cartescolaire.cm
- `PAYE` : reçu saisi mais non vérifié en ligne
- `EN_RETARD` : non payé et date échéance dépassée
- `FUTUR` : date d'échéance pas encore atteinte
- `EN_ATTENTE` : transaction CampPay initiée, confirmation en cours

### 3.1 — Use case : `GeneratePaiementsMinesec`

**Déclencheur :** création d'un Enrollment OU début d'année scolaire.

```typescript
// Crée automatiquement les lignes PaiementMinesec attendues
// selon le niveau de la classe et le type d'établissement (public/privé)
// Règles de génération :
// 6ème → 5ème → 4ème → 3ème : SCOLARITE (montant selon niveau)
// 3ème uniquement : EXAMEN_BEPC (si inscrit aux examens)
// 2nde → 1ère : SCOLARITE
// 1ère uniquement : EXAMEN_PROBATOIRE (sous-système francophone)
// Tle uniquement : EXAMEN_BAC ou EXAMEN_GCE_AL
// BEPC : EXAMEN_BEPC (sous-système francophone) / EXAMEN_GCE_OL (anglophone)
execute(enrollmentId: string): Promise<PaiementMinesec[]>

// Données de référence à stocker dans SchoolConfig ou table dédiée
interface TypeFraisConfig {
  schoolId: string
  anneeScolaire: string
  niveau: string
  typeFrais: TypeFraisMinesec
  montantFCFA: number
  dateEcheance: Date
}
```

### 3.2 — Use case : `VerifyRecu`

**Déclencheur :** le secrétariat saisit le numéro de reçu fourni par le parent.

```typescript
// Option A — Vérification manuelle (secrétariat saisit le numéro de reçu)
// Le secrétariat entre le numéro de confirmation de l'opérateur
// EduNexus stocke le numéro + marque status PAYE (confiance secrétariat)

// Option B — Vérification semi-automatique via cartescolaire.cm
// EduNexus scrape cartescolaire.cm/verify-payment avec le matricule
// Compare le montant et l'année scolaire
// Si confirmé : status VERIFIE (confiance maximale)
// Si non trouvé : status reste PAYE (attente 48h pour synchronisation opérateur)
execute(paiementId: string, numeroRecu: string, verifyOnline: boolean): Promise<PaiementMinesec>
```

### 3.3 — Use case : `SyncFromCarteScolaire`

**Déclencheur :** cron job quotidien (nuit), ou déclenchement manuel par le secrétariat.

```typescript
// Pour tous les élèves avec matricule national dans l'établissement :
// 1. Appelle CarteScolairePaymentAdapter.checkPaiementStatus(matricule, anneeScolaire)
// 2. Si paiement détecté sur cartescolaire.cm et non encore dans EduNexus :
//    → Crée ou met à jour le PaiementMinesec avec status VERIFIE
// 3. Génère un rapport de synchronisation
execute(schoolId: string, anneeScolaire: string): Promise<SyncReport>

interface SyncReport {
  totalEleves: number
  nouveauxPaiements: number
  paiementsConfirmes: number
  elevesImpayes: number
  errors: string[]
  syncedAt: Date
}
```

---

## Phase 4 — Module Paiements Établissement (CampPay)

### Architecture

```
src/modules/paiement-etablissement/
  domain/
    PaiementEtablissement.ts
    FraisConfig.ts                // types de frais configurables par l'école
  application/
    usecases/
      InitiatePaiement.usecase.ts
      HandleCampPayWebhook.usecase.ts
      GenerateRecu.usecase.ts
      ConfigureFraisEtablissement.usecase.ts
  infrastructure/
    PaiementEtabPrismaRepository.ts
    CampPayAdapter.ts             // wrapper API CampPay (déjà existant dans EduNexus)
    RecuPdfGenerator.ts
  http/
    PaiementEtabRouter.ts
    CampPayWebhookController.ts   // endpoint /webhook/camppay
```

### 4.1 — Use case : `ConfigureFraisEtablissement`

**Déclencheur :** le proviseur configure les types de frais au début de l'année.

```typescript
// Crée la liste des frais de l'établissement pour l'année scolaire
// Exemples : APE = 10000 FCFA, Cantine Trimestre 1 = 45000 FCFA, etc.
interface FraisConfig {
  schoolId: string
  anneeScolaire: string
  label: string          // "Cotisation APE 2025-2026"
  montant: number        // FCFA
  obligatoire: boolean
  dateEcheance?: Date
  applicableTo: string[] // ["ALL"] ou ["6ème", "5ème"] pour ciblage par niveau
}

execute(schoolId: string, frais: FraisConfig[]): Promise<void>
// → Génère automatiquement les PaiementEtablissement IMPAYE pour tous les Enrollments concernés
```

### 4.2 — Use case : `InitiatePaiement`

**Déclencheur :** le secrétariat initie un paiement CampPay pour un parent.

```typescript
// 1. Crée la transaction CampPay (MTN MoMo ou Orange Money)
// 2. Envoie une demande de paiement au numéro du parent (push USSD)
// 3. Stocke campPayTransactionId dans PaiementEtablissement
// 4. Status → EN_ATTENTE pendant que le parent confirme sur son téléphone
execute(paiementId: string, numeroTelParent: string, operateur: 'MTN' | 'ORANGE'): Promise<{ campPayTransactionId: string }>
```

### 4.3 — Use case : `HandleCampPayWebhook`

**Déclencheur :** CampPay envoie une notification HTTP quand le paiement est confirmé.

```typescript
// Endpoint : POST /webhook/camppay (avec vérification signature HMAC)
// 1. Vérifie l'authenticité du webhook (signature CampPay)
// 2. Trouve le PaiementEtablissement par campPayTransactionId
// 3. Met à jour : status PAYE + datePaiement + campPayWebhookData
// 4. Génère automatiquement le reçu PDF
// 5. Déclenche une notification SMS au parent via Techsoft (si activé)
// 6. Recalcule le statut global de l'Enrollment
execute(webhookPayload: CampPayWebhookPayload): Promise<void>
```

### 4.4 — Use case : `GenerateRecu`

```typescript
// Génère un PDF de reçu officiel de l'établissement
// Inclut : nom élève, matricule, type de frais, montant, date, numéro transaction
// Stocke l'URL du PDF dans PaiementEtablissement.recu
// Format A5 ou demi-A4 pour impression économique
execute(paiementId: string): Promise<string> // retourne URL du PDF
```

---

## Phase 5 — Vue consolidée & Dashboard Paiements

### 5.1 — Use case : `GetStudentPaymentDashboard`

Le cœur de la valeur ajoutée — une vue unique par élève.

```typescript
// Retourne toutes les infos de paiement d'un élève pour une année scolaire
interface StudentPaymentDashboard {
  student: {
    id: string
    nom: string
    prenom: string
    classe: string
    matriculeNational: string | null
    matriculeStatus: 'OK' | 'MISSING' | 'UNVERIFIED'
  }
  enrollment: {
    id: string
    status: EnrollmentStatus
    anneeScolaire: string
  }
  paiementsMinesec: {
    type: TypeFraisMinesec
    label: string                 // "Frais de scolarité 2025-2026"
    montantAttendu: number
    status: PaiementStatus
    dateEcheance: Date | null
    recuVerifie: boolean
    carteScolaireUrl: string      // lien direct vérification
  }[]
  paiementsEtablissement: {
    label: string
    montantAttendu: number
    montantPaye: number
    status: PaiementStatus
    recu: string | null
  }[]
  totaux: {
    totalAttendu: number
    totalPaye: number
    totalRestant: number
    statutGlobal: 'A_JOUR' | 'PARTIELLEMENT_PAYE' | 'EN_RETARD'
  }
}
```

### 5.2 — Use case : `GetSchoolPaymentOverview`

Dashboard global pour le proviseur / intendant.

```typescript
// Vue d'ensemble des paiements de TOUT l'établissement
// Filtres : par classe, par type de frais, par statut, par période
interface SchoolPaymentOverview {
  anneeScolaire: string
  totalEleves: number

  // Par type de frais MINESEC
  scolariteMinesec: {
    totalEleves: number
    payesVerifies: number
    payesNonVerifies: number
    impayes: number
    tauxRecouvrement: number
  }

  // Par frais établissement
  fraisEtablissement: {
    [label: string]: {
      totalEleves: number
      collecte: number  // FCFA total collecté
      attendu: number   // FCFA total attendu
      tauxRecouvrement: number
    }
  }

  // Alertes
  elevesARelancer: { studentId: string, nom: string, fraisEnRetard: string[] }[]
}
```

### 5.3 — Permissions par rôle

```typescript
// Roles existants dans EduNexus → nouvelles permissions ajoutées

// SECRETAIRE
PERMISSION.VIEW_STUDENT_PAYMENTS      // voir paiements d'un élève
PERMISSION.RECORD_MINESEC_RECU        // saisir numéro reçu MINESEC
PERMISSION.INITIATE_CAMPPAY_PAYMENT   // initier paiement CampPay

// INTENDANT
PERMISSION.VIEW_SCHOOL_PAYMENT_OVERVIEW // dashboard global
PERMISSION.EXPORT_PAYMENT_REPORT        // export CSV/PDF
PERMISSION.CONFIGURE_FRAIS_ETAB         // configurer types de frais
PERMISSION.SYNC_CARTESCOLAIRE           // déclencher synchro manuelle

// PROVISEUR
PERMISSION.VIEW_SCHOOL_PAYMENT_OVERVIEW
PERMISSION.EXPORT_PAYMENT_REPORT
PERMISSION.CONFIGURE_FRAIS_ETAB
PERMISSION.IMPORT_MATRICULE_EXCEL       // importer fichier matricules

// PARENT (portail parent si implémenté)
PERMISSION.VIEW_OWN_CHILD_PAYMENTS      // voir uniquement son enfant
PERMISSION.DOWNLOAD_OWN_RECUS           // télécharger ses propres reçus
```

---

## Phase 6 — Surveillance automatique (Polling + Cron)

### 6.1 — Cron job : Synchronisation nocturne `cartescolaire.cm`

```typescript
// src/infrastructure/jobs/CarteScolaireNightlySync.job.ts
// Planification : tous les jours à 02h00 (heure de faible trafic MINESEC)
// Utilise BullMQ ou node-cron selon l'infrastructure existante

// Algorithme :
// 1. Récupère tous les schoolId actifs
// 2. Pour chaque école, récupère les Enrollment ACTIVE de l'année en cours
// 3. Par batch de 20 élèves (éviter rate limiting cartescolaire.cm)
//    → Scrape le statut de paiement pour chaque matricule
//    → Attend 500ms entre chaque requête
// 4. Met à jour les PaiementMinesec dont le statut a changé
// 5. Génère un rapport de synchro stocké en DB
// 6. Si nouveaux paiements détectés → Notification Techsoft SMS au secrétariat

// GESTION DES ERREURS :
// Si cartescolaire.cm non accessible → log + retry le lendemain
// Si scraping échoue pour un élève → marque comme SYNC_ERROR + continue
// Circuit breaker : si >50% d'erreurs sur un batch → pause 1h + alerte admin
```

### 6.2 — Cron job : Relances automatiques paiements en retard

```typescript
// src/infrastructure/jobs/PaiementReminderJob.job.ts
// Planification : tous les lundis à 08h00

// Pour chaque PaiementMinesec/Etablissement avec :
// status = IMPAYE ET dateEcheance dépassée de > 7 jours
// → Envoie SMS de rappel au parent via Techsoft
// → Log la relance dans une table PaiementReminder
```

**Template SMS :**

> EduNexus - [NomEcole] : Les frais [TypeFrais] de [NomEleve] d'un montant de [Montant] FCFA n'ont pas été réglés. Contactez l'administration au [Tel].

### 6.3 — Cron job : Détection élèves sans matricule

```typescript
// src/infrastructure/jobs/MatriculeAuditJob.job.ts
// Planification : chaque dimanche à 06h00

// Pour chaque Enrollment ACTIVE sans matriculeNational :
// → Ajoute un flag dans le tableau de bord du proviseur
// → Si l'établissement a uploadé un fichier matricule récemment,
//   tente un re-matching automatique

// Génère un rapport hebdomadaire :
// "X élèves sans matricule national dans votre établissement"
```

### 6.4 — Architecture des jobs (hexagonale)

```
src/infrastructure/jobs/
  CarteScolaireNightlySync.job.ts
  PaiementReminderJob.job.ts
  MatriculeAuditJob.job.ts
  JobScheduler.ts     // registre et planification de tous les jobs
  JobLogger.ts        // logging centralisé des exécutions

src/application/usecases/
  // Les jobs appellent des use cases existants, pas de logique métier dans les jobs
  SyncFromCarteScolaire.usecase.ts   // ← appelé par CarteScolaireNightlySync
  SendPaiementReminder.usecase.ts    // ← appelé par PaiementReminderJob
  AuditMatricules.usecase.ts         // ← appelé par MatriculeAuditJob
```

---

## Phase 7 — Module Examens : Liaison matricule/candidat

### Objectif
Quand un élève s'inscrit à un examen officiel (BEPC, BAC, Probatoire, GCE), EduNexus génère le dossier d'inscription pré-rempli avec son matricule national, et stocke le numéro de candidat reçu après inscription.

### 7.1 — Modèle `ExamRegistration`

```prisma
model ExamRegistration {
  id            String    @id @default(cuid())
  studentId     String
  enrollmentId  String
  schoolId      String
  anneeScolaire String
  typeExamen    TypeExamen
  session       Int       // 2025

  // Matricule MINESEC (requis avant inscription)
  matriculeNational String

  // Numéro de candidat attribué par OBC/DECC/GCE Board après inscription
  numeroCandidatExamen String?

  // Frais d'examen
  paiementMinesecId String? // FK vers PaiementMinesec type EXAMEN_*

  status ExamRegStatus @default(DRAFT)
  // DRAFT             = en cours de préparation
  // SUBMITTED         = dossier déposé au centre d'examen
  // CONFIRMED         = numéro candidat reçu
  // RESULT_AVAILABLE  = résultats publiés

  // Résultat (importé après publication)
  resultatStatus      String?   // "ADMIS" | "RECALE" | "ABSENT"
  resultatMention      String?  // "Passable", "AB", "Bien", "TB"
  resultatScore        Float?
  resultatSource        String? // "OBC_SCRAPE" | "MANUAL_IMPORT"
  resultatVerifiedAt   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  student Student @relation(fields: [studentId], references: [id])
}

enum TypeExamen {
  BEPC
  PROBATOIRE
  BAC
  GCE_OL
  GCE_AL
  CAP
  BT
}

enum ExamRegStatus {
  DRAFT
  SUBMITTED
  CONFIRMED
  RESULT_AVAILABLE
}
```

### 7.2 — Use case : `PrepareExamDossier`

```typescript
// Prépare le dossier d'inscription à un examen pour un élève
// Validations :
// 1. L'élève a un matriculeNational → sinon blocage avec message explicite
// 2. Le PaiementMinesec pour cet examen est status PAYE ou VERIFIE → sinon avertissement
// 3. La classe correspond au type d'examen (ex: 3ème → BEPC)

// Génère :
// - Un document PDF pré-rempli avec toutes les infos de l'élève
// - Une checklist des pièces à fournir au centre d'examen
// - QR code contenant le matricule (pour scan rapide au centre)
execute(studentId: string, typeExamen: TypeExamen, anneeScolaire: string): Promise<ExamDossier>
```

---

## Phase 8 — Assistant IA Parent (Chatbot éducatif intégré)

### Objectif
Un assistant conversationnel accessible depuis le portail parent et le tableau de bord élève. Il répond à toute question sur : les paiements, EduNexus, `cartescolaire.cm`, les examens, le système éducatif camerounais. En français et en anglais.

### Architecture

```
src/modules/ai-assistant/
  domain/
    AssistantContext.ts
    AssistantKnowledge.ts
  application/
    usecases/
      ChatWithAssistant.usecase.ts
      BuildAssistantContext.usecase.ts
  infrastructure/
    GeminiAssistantAdapter.ts  // Google Gemini déjà intégré dans EduNexus
  http/
    AssistantRouter.ts
    AssistantController.ts
```

### 8.1 — Ce que l'assistant doit savoir

L'assistant reçoit un system prompt enrichi à trois niveaux.

**Niveau 1 — Connaissance statique (hardcodée)**

Le prompt couvre :
- Sous-système francophone : cycles, séries BAC (A1–A5/B/C/D/E/F1-F4/G/H), examens DECC (BEPC/CAP) et OBC (Probatoire/BAC)
- Sous-système anglophone : O-Level (Form 5), A-Level (Upper Sixth), ITC, ATC
- Frais officiels MINESEC 2024-2025 : scolarité 7 500/10 000 FCFA, BEPC ~7 000, Probatoire/BAC 12 000
- GCE Board : 8 000 base O-Level + 1 000/matière, 9 000 base A-Level + 2 000/matière + 5 000/pratique
- Guide pas à pas pour payer sur `cartescolaire.cm` (MTN *126*007#, Orange #150#, Campost, EU)
- Inscription OBC : période oct-déc, pénalité retard +15 000 FCFA
- Ce qu'EduNexus gère vs ce que le MINESEC gère directement

**Niveau 2 — Contexte dynamique par élève (injecté à chaque session)**

```typescript
// BuildAssistantContext.usecase.ts
async buildContext(studentId: string, schoolId: string): Promise<string> {
  const student = await studentRepo.findWithEnrollment(studentId)
  const budget = await budgetRepo.getBudgetAnnuel(studentId)
  const school = await schoolRepo.findById(schoolId)

  return `
## Élève en cours de conversation
Nom : ${student.prenom} ${student.nom}
Classe : ${student.enrollment.classe} | École : ${school.nom}
Matricule : ${student.matriculeNational ?? "Non encore attribué"}
Sous-système : ${school.sousSysteme}

## Statut paiements actuels
${budget.lignes.map(l => `- ${l.label} : ${l.status} (${l.montant} FCFA)`).join('\n')}

## Frais en retard
${budget.lignes.filter(l => l.status === 'EN_RETARD')
  .map(l => `- ${l.label} : ${l.montant} FCFA dû depuis ${l.echeance}`)
  .join('\n') || "Aucun frais en retard"}
`
}
```

**Niveau 3 — Suggestions FAQ (affichées avant que l'utilisateur tape)**

```typescript
const FAQ_SUGGESTIONS = [
  "Comment payer les frais de scolarité ?",
  "Mon enfant a-t-il payé ses frais d'examen ?",
  "Comment obtenir le matricule de mon enfant ?",
  "Quand sont les examens officiels ?",
  "Comment télécharger le bulletin de notes ?",
  "Comment payer la cantine via EduNexus ?",
  "Quels documents pour inscrire mon enfant au BAC ?",
  "Comment vérifier si le paiement MINESEC est enregistré ?",
]
```

### 8.2 — Use case : `ChatWithAssistant`

```typescript
async execute(params: {
  studentId: string
  schoolId: string
  message: string
  history: { role: 'user' | 'assistant'; content: string }[]
}): Promise<string>

// Règles de comportement :
// - Max 20 échanges/session, ensuite rediriger vers administration
// - Détection langue automatique (fr/en selon message)
// - Ne jamais inventer un montant ou une date : si incertain, rediriger vers source officielle
// - Toutes les conversations loggées pour amélioration continue
// - Modèle : Gemini Flash (rapide, économique, déjà disponible dans EduNexus)
```

### 8.3 — Endpoints API

```
POST /api/assistant/chat
Body : { studentId, schoolId, message, history }
Retourne : { response: string, suggestions: string[] }

GET /api/assistant/faq/:schoolId
Retourne : FAQ nationale + FAQ personnalisée de l'établissement
```

---

## Phase 9 — Publication des frais d'établissement (workflow intendant → parents)

### Objectif
L'intendant configure les frais propres à l'établissement (APE, cantine, uniforme, etc.), les soumet **obligatoirement** au proviseur pour validation, puis publie. EduNexus :

1. Notifie tous les parents par SMS avec le détail des frais de leur enfant
2. Met à jour automatiquement la page de suivi des paiements de chaque élève en y ajoutant ces frais côte à côte avec les frais MINESEC déjà présents

La validation proviseur est **obligatoire** — aucune publication possible sans elle.

### 9.1 — Workflow complet (validation obligatoire)

```
ÉTAPE 1 — Configuration (Intendant)
Saisit les frais dans EduNexus :
┌─────────────────────────────────────────────┐
│ Label              Montant   Applicable à    │
│ Cotisation APE     25 000    Tous niveaux    │
│ Cantine T1         45 000    Optionnel       │
│ Informatique        5 000    Tous niveaux    │
│ Uniforme           15 000    6ème et 2nde seul│
└─────────────────────────────────────────────┘
→ Status : DRAFT (non visible par les parents, non notifié)

ÉTAPE 2 — Soumission au Proviseur (Intendant)
Bouton "Soumettre pour validation"
→ Status : PENDING_VALIDATION
→ Notification in-app + SMS au Proviseur : "Frais établissement soumis par [Intendant]"

ÉTAPE 3 — Validation Proviseur (OBLIGATOIRE)
Le Proviseur voit le récapitulatif complet :
  - Total attendu par niveau
  - Estimation du recouvrement global
  - Historique des frais des années précédentes (comparaison)
Deux actions possibles :
  → "Approuver" : status passe à APPROVED, intendant peut publier
  → "Rejeter avec commentaire" : status revient à DRAFT avec note du proviseur

ÉTAPE 4 — Publication (Intendant ou Proviseur)
Bouton "Publier et notifier" (actif uniquement si status = APPROVED)
→ EduNexus crée les PaiementEtablissement IMPAYE pour tous les Enrollment ACTIVE
→ La page de suivi des paiements de chaque élève est mise à jour immédiatement
  (frais établissement apparaissent côte à côte avec les frais MINESEC)
→ Envoi SMS Techsoft en batch à tous les parents
→ Status : PUBLISHED — impossible de modifier sans créer une nouvelle révision

ÉTAPE 5 — Suivi recouvrement (Intendant, temps réel)
APE : 423/580 élèves payés (72%) — 10 725 000 / 14 500 000 FCFA
Cantine T1 : 215/340 inscrits (63%)
Uniforme : 98/112 élèves concernés (87%)
```

### 9.2 — États du cycle de vie (`FraisConfigStatus`)

```typescript
enum FraisConfigStatus {
  DRAFT,              // En cours de saisie par l'intendant
  PENDING_VALIDATION, // Soumis au proviseur, en attente
  APPROVED,           // Validé par le proviseur, prêt à publier
  PUBLISHED,          // Publié et notifié aux parents
  REJECTED,           // Rejeté par le proviseur (retourne à DRAFT avec commentaire)
}
```

### 9.3 — Page de suivi élève — Vue complète après publication

Après publication, la page de suivi de chaque élève affiche tout en un seul endroit :

```
╔════════════════════════════════════════════════════════════════╗
║ Suivi des paiements — Ndzana Jean — Tle C — 2025-2026            ║
╠══════════════════════════════════╦═════════╦════════╦══════════╣
║ FRAIS MINESEC                     ║ Attendu ║ Payé   ║ Statut   ║
╠══════════════════════════════════╬═════════╬════════╬══════════╣
║ Frais scolarité (2nd cycle)       ║ 10 000  ║ 10 000 ║ ✅ Vérifié║
║ Frais BAC — OBC (session 2026)    ║ 12 000  ║      0 ║ ❌ Urgent║
╠══════════════════════════════════╬═════════╬════════╬══════════╣
║ FRAIS ÉTABLISSEMENT               ║ Attendu ║ Payé   ║ Statut   ║
╠══════════════════════════════════╬═════════╬════════╬══════════╣
║ Cotisation APE 2025-2026          ║ 25 000  ║ 25 000 ║ ✅ Payé  ║
║ Informatique                      ║  5 000  ║  5 000 ║ ✅ Payé  ║
║ Cantine Trimestre 1               ║ 45 000  ║      0 ║ ❌ En retard║
║ Cantine Trimestre 2               ║ 45 000  ║      0 ║ 🕐 Futur ║
╠══════════════════════════════════╬═════════╬════════╬══════════╣
║ TOTAL GÉNÉRAL                     ║142 000  ║ 40 000 ║ 102 000 dû║
╚════════════════════════════════════════════════════════════════╝

Actions disponibles :
[Payer frais BAC sur cartescolaire.cm →]  [Payer Cantine T1 via CampPay →]
[Télécharger reçu APE]                     [Contacter l'administration]
```

La séparation visuelle entre **FRAIS MINESEC** et **FRAIS ÉTABLISSEMENT** est importante :
- Les parents comprennent clairement que ce ne sont pas les mêmes organismes
- Le lien de paiement est différent selon la catégorie (`cartescolaire.cm` vs CampPay interne)
- Un parent peut régler ses frais établissement depuis EduNexus directement

### 9.4 — Use case : `PublishFraisEtablissement`

```typescript
async execute(params: {
  schoolId: string
  anneeScolaire: string
  publishedBy: string // userId — doit avoir PERMISSION.PUBLISH_FRAIS_ETAB
}): Promise<PublicationReport>

// Préconditions vérifiées :
// 1. FraisConfig.status === APPROVED (sinon erreur bloquante)
// 2. publishedBy a la permission PUBLISH_FRAIS_ETAB
// 3. Pas déjà publié pour cette année scolaire

// Actions :
// 1. Pour chaque Enrollment ACTIVE de l'école :
//    a. Filtre les frais applicables selon le niveau de l'élève
//    b. Crée PaiementEtablissement IMPAYE pour chaque frais applicable
//    c. Met à jour le BudgetScolaireAnnuel (page de suivi parent mise à jour en temps réel)
// 2. Construit le SMS personnalisé par élève (voir template)
// 3. Envoi Techsoft en batch (max 50 SMS/seconde pour respecter les limites)
// 4. Passe FraisConfig.status → PUBLISHED
// 5. Crée FraisPublicationHistory avec snapshot complet

interface PublicationReport {
  totalEleves: number
  smsSent: number
  smsErrors: string[]     // numéros en erreur pour relance manuelle
  paiementsCreated: number
  publishedAt: Date
}
```

### 9.5 — Template SMS publication

> EduNexus — [NomEcole]
> Frais établissement [PrenomEleve] ([Classe]) :
> • Cotisation APE: 25 000 FCFA
> • Informatique: 5 000 FCFA
> • Cantine T1: 45 000 FCFA
> TOTAL établissement: 75 000 FCFA
> Ces frais s'ajoutent aux frais MINESEC.
> Suivez tous les paiements sur EduNexus ou contactez l'administration.

### 9.6 — Modèles Prisma mis à jour

```prisma
model FraisConfig {
  // ... champs existants ...
  status FraisConfigStatus @default(DRAFT)

  submittedAt DateTime? // date soumission au proviseur
  submittedBy String?   // userId intendant

  validatedAt DateTime? // date validation proviseur
  validatedBy String?   // userId proviseur

  rejectedAt     DateTime?
  rejectedBy     String?
  rejectComment  String? // commentaire de rejet du proviseur

  publishedAt DateTime?
  publishedBy String?
}

enum FraisConfigStatus {
  DRAFT
  PENDING_VALIDATION
  APPROVED
  PUBLISHED
  REJECTED
}

model FraisPublicationHistory {
  id            String   @id @default(cuid())
  schoolId      String
  anneeScolaire String
  publishedBy   String
  validatedBy   String   // proviseur qui a approuvé
  publishedAt   DateTime @default(now())
  totalEleves   Int
  smsSent       Int
  smsErrors     Json     // liste des numéros en erreur
  fraisSnapshot Json     // snapshot exact des frais publiés
}
```

### 9.7 — Permissions

```typescript
PERMISSION.CONFIGURE_FRAIS_ETAB         // Intendant — saisie et modification (status DRAFT)
PERMISSION.SUBMIT_FRAIS_FOR_VALIDATION  // Intendant — soumettre au proviseur
PERMISSION.VALIDATE_FRAIS_ETAB          // Proviseur — approuver ou rejeter
PERMISSION.PUBLISH_FRAIS_ETAB           // Intendant ou Proviseur — publier (si APPROVED)
PERMISSION.VIEW_RECOUVREMENT            // Intendant + Proviseur — dashboard recouvrement
```

### 9.8 — Endpoints API

```
GET  /api/frais-etab/current/:schoolId/:anneeScolaire
     → Frais actuels avec status (DRAFT / PENDING / APPROVED / PUBLISHED)

POST /api/frais-etab/submit-for-validation
     → Intendant soumet au proviseur

POST /api/frais-etab/validate
     Body : { approved: boolean, comment?: string }
     → Proviseur approuve ou rejette

POST /api/frais-etab/publish
     → Publication + envoi SMS + mise à jour pages de suivi élèves

GET  /api/frais-etab/recouvrement/:schoolId/:anneeScolaire
     → Dashboard recouvrement en temps réel

GET  /api/frais-etab/publication-history/:schoolId
     → Historique des publications avec snapshots
```

---

## Résumé des endpoints API à créer

### Routes Matricule & Enrollment

```
POST  /api/enrollment/enroll-student            → EnrollNewStudent
POST  /api/enrollment/transfer-student           → TransferStudent
POST  /api/enrollment/import-matricules          → ImportMatriculeExcel (multipart)
GET   /api/enrollment/import-jobs/:schoolId       → Historique imports
GET   /api/enrollment/:enrollmentId               → Détail enrollment
GET   /api/students/:id/matricule-status          → Vérif matricule sur cartescolaire.cm
PATCH /api/students/:id/matricule                 → Mise à jour manuelle matricule
```

### Routes Paiements MINESEC

```
GET  /api/paiements-minesec/:studentId/:anneeScolaire  → Liste paiements MINESEC élève
POST /api/paiements-minesec/:id/verify-recu             → Saisie numéro reçu
POST /api/paiements-minesec/sync/:schoolId               → Synchro manuelle cartescolaire.cm
GET  /api/paiements-minesec/sync-history/:schoolId       → Historique synchros
```

### Routes Paiements Établissement

```
GET  /api/frais-config/:schoolId/:anneeScolaire  → Config frais établissement
POST /api/frais-config                            → Créer/modifier frais
POST /api/paiements-etab/initiate                  → Initier paiement CampPay
POST /webhook/camppay                              → Webhook CampPay (public, HMAC signé)
GET  /api/paiements-etab/:id/recu                   → Télécharger reçu PDF
```

### Routes Dashboard

```
GET  /api/dashboard/student-payments/:studentId  → Vue consolidée élève
GET  /api/dashboard/school-payments/:schoolId     → Vue globale établissement
GET  /api/dashboard/payment-alerts/:schoolId      → Élèves en retard
POST /api/reports/payments/export                  → Export CSV/PDF
```

### Routes Examens

```
POST /api/examens/register                  → Inscrire élève à un examen
GET  /api/examens/:studentId                  → Examens d'un élève
POST /api/examens/:id/set-candidate-number     → Enregistrer numéro candidat
POST /api/examens/import-results               → Import résultats OBC/GCE (CSV)
GET  /api/examens/:id/dossier-pdf              → Générer dossier PDF
```

---

## Points d'attention techniques

### Scraping `cartescolaire.cm` — Bonnes pratiques

```typescript
// 1. Rate limiting : max 1 requête/500ms par établissement
// 2. Cache Redis TTL 4h pour les vérifications de matricule (données stables)
// 3. Cache TTL 30min pour les statuts de paiement (changent souvent en début d'année)
// 4. Circuit breaker : si 5 erreurs consécutives → pause 30min + log
// 5. User-Agent : simuler un navigateur standard
// 6. Fallback : si scraping échoue → statut "NON_VERIFIE" dans l'UI + bouton lien direct
// 7. Respect du robots.txt → vérifier qu'il n'interdit pas le scraping
```

### Gestion offline (PWA)

```typescript
// Les paiements MINESEC ne peuvent pas être initiés offline (dépendent du scraping)
// Les paiements CampPay ne peuvent pas être initiés offline (API externe)
// MAIS : la consultation des paiements existants doit fonctionner offline
// → Indexer les PaiementMinesec et PaiementEtablissement dans Dexie.js
// → Sync au retour de connexion via Service Worker
```

### Multi-tenant — Isolation

```typescript
// Toutes les queries Prisma incluent schoolId dans le WHERE
// Middleware Express vérifie que le schoolId dans l'URL correspond au JWT tenant
// Les matricules nationaux sont globaux (pas de schoolId) → table Student partagée
// mais l'accès reste filtré par les Enrollments de l'établissement courant
```

### Dépendances npm à ajouter

```bash
# Parsing Excel (fichier matricules cartescolaire.cm)
bun add xlsx

# Scraping cartescolaire.cm
bun add cheerio

# Jobs planifiés
bun add node-cron
# ou si tu utilises déjà BullMQ → pas besoin d'ajout

# Génération PDF reçus
bun add puppeteer-core
# ou jspdf selon la complexité des reçus

# Cache (si pas déjà présent)
bun add ioredis
```

---

## Ordre d'implémentation recommandé

1. **Semaine 1 :** Phase 1 (schéma Prisma) + Phase 2 (import Excel + enrollment)
   - Priorité absolue : le secrétariat doit pouvoir importer les matricules existants
   - Test : importer une vraie liste `cartescolaire.cm` d'un lycée test

2. **Semaine 2 :** Phase 3 (paiements MINESEC) + début Phase 4 (CampPay)
   - Relier les paiements MINESEC aux enrollments existants
   - Scraping `cartescolaire.cm` pour vérification de reçus

3. **Semaine 3 :** Phase 4 (fin CampPay webhook) + Phase 5 (dashboard consolidé)
   - Vue unifiée par élève : le vrai différenciateur EduNexus

4. **Semaine 4 :** Phase 6 (jobs automatiques) + Phase 7 (examens)
   - Synchro nocturne + relances SMS
   - Dossiers d'inscription examens