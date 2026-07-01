# PROMPT MISSION — EduNexus (3 étapes finales : C.2, D.1, D.2)

## CONTEXTE PROJET

Tu travailles sur **EduNexus**, un SaaS de gestion scolaire pour établissements camerounais.
Architecture hexagonale : backend Bun/Express/TypeScript/Prisma/PostgreSQL, frontend Next.js 19 App Router/React/Tailwind.
Répertoire racine : `e:/My long journey towards becoming the best programmer ever by God's Grace/Personal matters/EDUNEXUS/`
Backend dans `backend/`, frontend dans `frontend/`.

---

## RÈGLE ABSOLUE N°1 — LIS AVANT D'ÉCRIRE

Avant de modifier ou créer QUOI QUE CE SOIT sur une étape, tu dois obligatoirement :

1. Lire les fichiers existants liés à cette étape
2. Identifier les patterns déjà utilisés dans le projet
3. Repérer ce qui EXISTE DÉJÀ pour ne pas le recréer
4. Résumer ce que tu as compris
5. Seulement APRÈS, implémenter

Si tu ne peux pas lire un fichier, dis-le et attends avant de continuer.

---

## RÈGLE ABSOLUE N°2 — PATTERNS NON NÉGOCIABLES

Lis ces fichiers de référence pour confirmer les patterns avant d'implémenter :

**Référence backend :**
- `backend/src/infrastructure/http/controllers/PedagogieController.ts` → pattern controller (class + méthodes arrow functions, gestion d'erreurs via `next(e)`)
- `backend/src/infrastructure/http/routes/pedagogie.routes.ts` → pattern fichier routes
- `backend/src/infrastructure/config/hexagonal.bootstrap.ts` → pattern enregistrement des routes

**Pattern critique Prisma :**
Les modèles récents utilisent `(prisma as any).nomDuModele` car le client Prisma ne peut pas être régénéré (DLL lock Windows). Exemple dans `PedagogieController.ts` :
```typescript
await (this.prisma as any).programme.findMany({ ... })
```
JAMAIS `prisma.programme` directement pour les nouveaux modèles. Pour les anciens modèles typés (user, class, subject, etc.), utiliser `this.prisma.user` normalement.

**Pattern frontend — lis ces références :**
- `frontend/src/app/admin/dashboard/_components/SectionPedagogie.tsx` → pattern composant admin (inline styles, tabs, fetchApi)
- `frontend/src/app/admin/dashboard/_types.ts` → comment ajouter une section
- `frontend/src/app/admin/dashboard/_components/AdminSidebar.tsx` → comment ajouter une entrée sidebar
- `frontend/src/app/admin/dashboard/page.tsx` → comment enregistrer une section (import + SECTION_TITLES + rendu conditionnel)

**Règles frontend :**
- Inline styles uniquement dans les composants (pas de classes Tailwind dans le JSX des nouvelles sections)
- `fetchApi` de `@/lib/fetchApi` pour tous les appels API — jamais `fetch` directement
- Même structure pour chaque nouvelle section : type dans `_types.ts` → sidebar → titre dans `page.tsx` → import → rendu conditionnel

**Sécurité — NE JAMAIS MODIFIER :**
- Admin : `christophendzana12@gmail.com` / `jene7pas`
- Tous les autres (teachers, staff, students, superadmin) : `chris123456789`
- Censeur (staff) : `ndzanachristophe12@gmail.com`
- schoolId de test : `f91c2219-13ad-465c-979e-41d448612894`

---

## CE QUI EST DÉJÀ FAIT — NE PAS RETOUCHER

- A.1 — Certificats PDF + QR de vérification
- A.2 — Import Excel des notes
- A.3 — Tableau d'honneur + PV de délibération PDF
- A.4 — Reçus de paiement + relances automatiques
- A.5 — Notifications discipline + seuil d'absences
- B.1 — Dashboard statistiques avec graphes (Recharts)
- B.2 — Publipostage SMS/email en masse
- B.3 — Génération automatique emploi du temps (greedy + Groq)
- C.1 — Module Pédagogie complet (Programme, Chapitre, CahierDeTexte + tous endpoints + frontend)

---

## ÉTAPES RESTANTES (dans l'ordre strict)

---

### ÉTAPE C.2 — Module Gestion des Ressources Humaines

**Avant de commencer, lis obligatoirement ces fichiers :**
- `backend/prisma/schema.prisma` — sections `TeacherProfile`, `StaffProfile`, `User` (comprendre ce qui existe déjà en RH avant d'ajouter quoi que ce soit)
- `backend/src/infrastructure/config/hexagonal.bootstrap.ts` — pattern d'enregistrement des routes (lignes avec `app.use`)
- `backend/src/infrastructure/http/controllers/PedagogieController.ts` — pattern controller à reproduire
- `backend/src/utils/` ou `backend/src/services/` — cherche s'il existe un service de génération PDF (PdfKit, PDFDocument, ou autre) pour savoir comment générer les documents RH
- `frontend/src/app/admin/dashboard/_types.ts`
- `frontend/src/app/admin/dashboard/_components/AdminSidebar.tsx`
- `frontend/src/app/admin/dashboard/page.tsx`
- `frontend/src/app/admin/dashboard/_components/SectionPedagogie.tsx` — référence de style à reproduire

**Nouveaux modèles Prisma à ajouter à la fin de `schema.prisma` :**

```prisma
model EmployeeFile {
  id            String    @id @default(cuid())
  userId        String    @unique
  schoolId      String
  dateNaissance DateTime?
  diplomes      Json      @default("[]")
  numeroCNPS    String?
  typeContrat   String?
  dateEmbauche  DateTime?
  echelonActuel String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  user          User      @relation("EmployeeFileUser", fields: [userId], references: [id], onDelete: Cascade)
  school        School    @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@index([schoolId])
}

enum CareerEventType {
  PROMOTION
  MUTATION
  AVANCEMENT_ECHELON
  SANCTION
}

model CareerEvent {
  id          String          @id @default(cuid())
  userId      String
  schoolId    String
  type        CareerEventType
  date        DateTime
  observation String?
  createdAt   DateTime        @default(now())
  user        User            @relation("EmployeeCareerEvents", fields: [userId], references: [id], onDelete: Cascade)
  school      School          @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([schoolId])
}

enum StaffAttendanceStatus {
  PRESENT
  ABSENT
  RETARD
}

model StaffAttendance {
  id        String                @id @default(cuid())
  userId    String
  schoolId  String
  date      DateTime
  statut    StaffAttendanceStatus @default(PRESENT)
  note      String?
  createdAt DateTime              @default(now())
  user      User                  @relation("StaffAttendanceUser", fields: [userId], references: [id], onDelete: Cascade)
  school    School                @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([schoolId])
}

enum LeaveType {
  CONGE_ANNUEL
  MALADIE
  MATERNITE
  AUTORISATION
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
}

model LeaveRequest {
  id          String      @id @default(cuid())
  userId      String
  schoolId    String
  type        LeaveType
  dateDebut   DateTime
  dateFin     DateTime
  motif       String?
  statut      LeaveStatus @default(PENDING)
  validatedBy String?
  validatedAt DateTime?
  createdAt   DateTime    @default(now())
  user        User        @relation("EmployeeLeaveRequests", fields: [userId], references: [id], onDelete: Cascade)
  school      School      @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  validator   User?       @relation("LeaveRequestValidator", fields: [validatedBy], references: [id])

  @@index([userId])
  @@index([schoolId])
}

model LeaveBalance {
  id           String   @id @default(cuid())
  userId       String
  schoolId     String
  annee        Int
  soldeInitial Float    @default(30)
  soldeRestant Float    @default(30)
  updatedAt    DateTime @updatedAt
  user         User     @relation("EmployeeLeaveBalance", fields: [userId], references: [id], onDelete: Cascade)
  school       School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@unique([userId, annee])
  @@index([schoolId])
}

model MissionOrder {
  id         String   @id @default(cuid())
  userId     String
  schoolId   String
  motif      String
  lieu       String
  dateDebut  DateTime
  dateFin    DateTime
  signataire String?
  createdAt  DateTime @default(now())
  user       User     @relation("EmployeeMissionOrders", fields: [userId], references: [id], onDelete: Cascade)
  school     School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([schoolId])
}
```

Après avoir ajouté ces modèles, ajoute les back-relations correspondantes sur les modèles `School` et `User` existants (même pattern que ce qui a déjà été fait pour `CahierDeTexte` — lis le schéma existant pour voir comment c'est fait).

**Endpoints à créer dans `HRController.ts` :**
- `GET /api/v2/hr/employees` — liste du personnel (TEACHER + STAFF) avec leur dossier si existant
- `GET /api/v2/hr/employees/:id` — détail d'un employé
- `GET/POST/PATCH /api/v2/hr/employees/:id/file` — dossier personnel (EmployeeFile)
- `POST /api/v2/hr/employees/:id/career-events` — ajouter événement carrière
- `GET /api/v2/hr/employees/:id/career-events` — historique carrière
- `POST /api/v2/hr/attendance` — pointer un ou plusieurs employés
- `GET /api/v2/hr/attendance?date=&userId=` — consulter le pointage
- `POST /api/v2/hr/leave-requests` — déposer une demande de congé
- `PATCH /api/v2/hr/leave-requests/:id` — valider (APPROVED) ou rejeter (REJECTED)
- `GET /api/v2/hr/leave-requests` — liste des demandes (filtrables par userId, statut)
- `GET /api/v2/hr/leave-balance/:userId` — solde de congés de l'employé
- `GET /api/v2/hr/employees/:id/attestation-travail` → PDF attestation de travail
- `GET /api/v2/hr/employees/:id/certificat-travail` → PDF certificat de travail
- `POST /api/v2/hr/mission-orders` — créer un ordre de mission
- `GET /api/v2/hr/mission-orders/:id/pdf` → PDF ordre de mission

Pour les PDF : utilise le même service/bibliothèque PDF déjà en place dans le projet (lis `backend/src/utils/` ou `backend/src/services/` pour identifier ce qui existe avant de coder quoi que ce soit).

**Frontend :**
- Ajouter `'rh'` dans `AdminSection` dans `_types.ts`
- Ajouter entrée `{ id: 'rh', icon: '👔', label: 'Ressources Humaines' }` dans `AdminSidebar.tsx`
- Ajouter `rh: 'Ressources Humaines'` dans `SECTION_TITLES` dans `page.tsx`
- Créer `SectionRH.tsx` avec 4 onglets :
  - **Personnel** : liste des enseignants et du staff, bouton pour ouvrir la fiche détaillée (dossier, carrière, solde congés)
  - **Congés** : demandes en attente (PENDING) avec boutons Approuver/Rejeter, et historique
  - **Pointage** : saisie du pointage journalier (sélecteur de date, statut PRESENT/ABSENT/RETARD par employé)
  - **Documents** : formulaire pour générer attestation, certificat, ou ordre de mission pour un employé sélectionné

**Definition of Done :**
- Dossier employé consultable et modifiable depuis l'interface
- Workflow congé fonctionnel : PENDING → APPROVED → solde mis à jour
- Les trois PDF (attestation, certificat, ordre de mission) se génèrent avec de vraies données

---

### ÉTAPE D.1 — Sauvegarde automatique et restauration

**Avant de commencer, lis obligatoirement :**
- Tous les fichiers dans `backend/src/` qui contiennent "inngest" ou "job" ou "cron" — cherche comment les jobs existants sont structurés et enregistrés
- `backend/src/infrastructure/config/hexagonal.bootstrap.ts` — comment les jobs Inngest sont initialisés
- `backend/.env` ou `backend/src/infrastructure/config/` — variables d'environnement disponibles (DATABASE_URL notamment)
- `backend/src/infrastructure/http/routes/masterAdminHex.routes.ts` — pattern des routes MasterAdmin existantes

**Ce qu'il faut implémenter :**

1. **Job Inngest quotidien `BackupSchoolDataJob`** :
   - Exporte toutes les données de chaque école active en JSON (tables : users, students, grades, payments, invoices, reportCards, attendances)
   - Stocke le fichier avec timestamp dans un dossier `backups/` local (créer si absent)
   - Conserve un historique glissant de 30 jours : supprime automatiquement les fichiers plus anciens

2. **Endpoint `POST /api/v2/master/backup/trigger`** (MasterUser uniquement) :
   - Déclenche le backup immédiatement sans attendre le job quotidien
   - Retourne le chemin du fichier créé

3. **Endpoint `GET /api/v2/master/backup/list`** (MasterUser uniquement) :
   - Liste les fichiers de backup disponibles avec leur date et taille

4. **Endpoint `GET /api/v2/school/last-backup`** (Admin) :
   - Retourne la date et le nom du dernier fichier de backup disponible pour cette école

5. **Frontend** :
   - Dans `SectionSettings.tsx`, ajouter une section lecture seule "Dernière sauvegarde" qui affiche la date du dernier backup via `GET /api/v2/school/last-backup`

**Definition of Done :** le job déclenché manuellement crée un fichier JSON vérifiable dans `backups/` ; l'interface admin affiche la date du dernier backup.

---

### ÉTAPE D.2 — Export RGPD + rétention des logs

**Avant de commencer, lis obligatoirement :**
- `backend/prisma/schema.prisma` — modèles `ActivitiesLog`, `EmailLog`, `SmsLog`, `BroadcastLog` (vérifie qu'ils existent et leur structure exacte)
- `backend/src/infrastructure/http/controllers/` — contrôleur school ou settings existant pour savoir où ajouter l'endpoint d'export
- `backend/src/infrastructure/http/routes/school-config.routes.ts` ou `schoolSettings.routes.ts` — où ajouter la route
- `frontend/src/app/admin/dashboard/_components/SectionSettings.tsx` — pour ajouter le bouton export

**Ce qu'il faut implémenter :**

1. **`GET /api/v2/school/export`** (Admin uniquement, `requireRole('ADMIN')`) :
   - Génère un fichier JSON unique contenant toutes les données de l'école de l'utilisateur connecté :
     - `eleves` : tous les StudentProfile avec User associé
     - `notes` : toutes les Grade validées
     - `paiements` : tous les Payment + Invoice
     - `personnel` : tous les User TEACHER + STAFF avec leur profil
     - `bulletins` : tous les ReportCard
     - `presences` : toutes les Attendance
   - Retourne le fichier en téléchargement direct (`Content-Disposition: attachment; filename="export-[schoolName]-[date].json"`)

2. **Champ `logRetentionDays`** dans `SchoolSettings` :
   - Vérifie d'abord si ce champ existe déjà dans le schéma
   - Si absent, l'ajouter avec valeur par défaut 90
   - L'ajouter dans le formulaire des paramètres existant

3. **Job Inngest hebdomadaire `PurgeOldLogsJob`** :
   - Supprime les `ActivitiesLog`, `EmailLog`, `SmsLog`, `BroadcastLog` plus anciens que `logRetentionDays` jours (90 par défaut)
   - Loggue le nombre d'entrées supprimées

4. **Frontend** :
   - Dans `SectionSettings.tsx`, ajouter un bouton "Exporter toutes mes données (JSON)" qui appelle `GET /api/v2/school/export` et déclenche le téléchargement
   - Ajouter le champ `Rétention des logs (jours)` dans le formulaire des paramètres si le champ `logRetentionDays` a été ajouté au schéma

**Definition of Done :** l'admin clique "Exporter" → fichier JSON téléchargeable avec données réelles ; le job de purge est enregistré dans Inngest.

---

## MÉTHODOLOGIE OBLIGATOIRE POUR CHAQUE ÉTAPE

1. **Annonce** les fichiers que tu vas lire et pourquoi
2. **Lis-les** effectivement avant de coder
3. **Résume** ce que tu as compris (modèles existants, patterns, ce qui existe déjà)
4. **Présente ton plan** d'implémentation avant de coder
5. **Implémente** en respectant exactement les patterns du projet
6. **Vérifie la compilation** à la fin :
   - Backend : `cd backend && bunx tsc --noEmit`
   - Frontend : `cd frontend && node_modules/.bin/tsc --noEmit`
   - **Zéro erreur TypeScript = condition sine qua non pour valider l'étape**

Ne commence pas l'étape suivante avant que la précédente soit compilée sans erreur et confirmée.

---

Commence par **C.2**. Annonce d'abord les fichiers que tu vas lire.
