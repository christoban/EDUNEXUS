# PLAN D'IMPLÉMENTATION COMPLET
## Module Groupe Scolaire — Dashboard consolidé multi-établissements

> **Date de rédaction :** juillet 2026
> **Statut :** plan à valider avant tout début de code — aucune ligne écrite à ce stade.
> **Origine :** déjà esquissé dans `EduNexus_Carte_Complete_V2.md` (MODULE 21, section 1.8, diagramme §3.1) comme "Phase 5" — ce document reprend cette vision, la confronte à l'architecture réelle du code actuel, et la complète là où l'esquisse initiale ne suffit pas à coder.
> **Confirmé par la recherche de code :** aucune trace nulle part — pas de modèle `SchoolGroup`, pas de rôle `SCHOOL_GROUP_OWNER` (l'enum `UserRole` ne contient que `ADMIN | STAFF | TEACHER | PARENT | STUDENT`), pas d'écran, pas de route. C'est bien un trou complet, pas un chantier à moitié fait.

---

## SOMMAIRE

- Section 0 — Ce qui existe déjà et sur quoi s'appuyer
- Section 1 — La décision d'architecture centrale, qui change tout le reste
- Section 2 — Modèle de données
- Section 3 — Authentification du Fondateur de Groupe
- Section 4 — Agrégation cross-tenant en lecture seule (sans jamais casser l'isolation)
- Section 5 — Transferts d'élèves et d'enseignants entre établissements du groupe
- Section 6 — Permissions
- Section 7 — Plan tarifaire "Établissement+" et facturation consolidée
- Section 8 — Frontend
- Section 9 — Séquencement par phases
- Section 10 — Risques et points de vigilance
- Section 11 — Definition of Done
- Section 12 — Ce qui ne sera délibérément PAS fait dans ce premier jet

---

# SECTION 0 — CE QUI EXISTE DÉJÀ ET SUR QUOI S'APPUYER

Trois éléments déjà construits dans le code actuel sont directement réutilisables pour ce chantier, et changent la façon de l'aborder par rapport à une page blanche :

**1. Un compte séparé pour un acteur qui supervise plusieurs écoles existe déjà : `MasterUser`.**
`backend/prisma/schema.prisma` définit `MasterUser` (auth propre, cookie `master_jwt`, `tokenType: "master"`, secret JWT dédié `MASTER_JWT_SECRET`) avec un champ `assignedSchoolIds String[]` — **jamais utilisé nulle part dans le code** (zéro occurrence en dehors du schéma). C'est un champ fantôme : visiblement prévu pour scoper un `MasterUserRole.SCHOOL_MANAGER` à un sous-ensemble d'écoles, jamais câblé. Le mécanisme d'auth séparée (`protectMaster`/`authorizeMaster` dans `backend/src/middleware/authMultiTenant.ts`) est un modèle direct à suivre pour le Fondateur de Groupe — **mais `MasterUser` lui-même ne doit pas être réutilisé tel quel** (voir Section 1 : ce sont des rôles conceptuellement différents).

**2. Le transfert d'élève entre classes existe, mais explicitement borné à une seule école.**
`TransfererEleveUseCase.ts` vérifie `classeDestination.schoolId !== commande.schoolId` et `eleve.schoolId !== commande.schoolId` — il refuse un transfert inter-école par construction. Le transfert entre établissements du groupe n'est donc pas une extension de ce use case, c'est une fonctionnalité différente à concevoir (voir Section 5).

**3. Le squelette d'onboarding auto-service existe et est directement réutilisable pour le transfert.**
`CreerSqueletteOnboardingUseCase.ts` (déjà utilisé pour les admissions post-concours 6e/PEBS, avec un `sourceType` discriminant) crée un dossier pré-rempli nécessitant une validation humaine avant toute création de compte réel — jamais d'assignation automatique aveugle. C'est exactement le bon mécanisme pour qu'un transfert inter-école ne soit jamais une mutation brute de `schoolId` sur un `User` existant (voir Section 5, ce point est important).

**Rien d'autre n'existe** : pas de champ `PlanType.ETABLISSEMENT_PLUS` (l'enum ne contient que `DISCOVERY | STANDARD | PREMIUM`), pas de notion de facturation consolidée, pas de permission `MANAGE_GROUP_STUDENT_TRANSFER` (le MODULE 21 original liste la fonctionnalité "transfert d'élèves" mais oublie la permission correspondante — incohérence de l'esquisse initiale, corrigée ici).

---

# SECTION 1 — LA DÉCISION D'ARCHITECTURE CENTRALE

C'est le choix qui détermine tout le reste du plan, donc à valider en premier.

## Le problème

`User.schoolId` est un `String` **non-nullable, unique par utilisateur** (`@@unique([schoolId, email])`). Toute la plateforme — chaque contrôleur, chaque use case, chaque repository — part du principe qu'**un utilisateur appartient à exactement une école**, et la « règle absolue » déjà documentée dans `EduNexus_Carte_Complete_V2.md` §3.2 l'impose : *« Chaque requête qui concerne des données d'école DOIT filtrer par schoolId. Sans exception. »*

Un Fondateur de Groupe a besoin de voir des données agrégées sur **plusieurs** écoles à la fois. Ça ne rentre nulle part dans le modèle actuel tel quel.

## Deux options

**Option A — Étendre `User` avec un rôle `SCHOOL_GROUP_OWNER`** (ce que l'esquisse originale du MODULE 21 suggérait implicitement, diagramme `SchoolGroupOwner → User`).
Problème concret : quel serait le `schoolId` de ce `User` ? Aucune des écoles du groupe n'est plus "la sienne" que les autres. On serait obligé de rendre `schoolId` nullable sur `User` — ce qui casse silencieusement des dizaines d'endroits qui présument déjà `user.schoolId` non-null (middleware `authorizeSchool`, quasiment tous les contrôleurs). Risque élevé, chantier de migration risqué pour un gain qui ne le justifie pas.

**Option B — Compte séparé, sur le modèle de `MasterUser`** (recommandée).
Un `SchoolGroupOwner` n'est pas un `User` au sens de la plateforme — c'est un acteur d'un autre ordre, exactement comme `MasterUser` n'est pas non plus un `User` d'école. Authentification propre (JWT `tokenType: "group_owner"`, cookie dédié), dashboard séparé (`/group/dashboard`), et surtout : **aucune modification requise sur `User`, `authorizeSchool`, ou n'importe quel contrôleur existant.** Le blast radius est confiné à du code entièrement nouveau.

**Recommandation : Option B.** Elle coûte la création d'un mécanisme d'auth de plus (déjà fait une fois pour Master, donc le patron est connu et éprouvé), mais élimine le risque de casser l'isolation multi-tenant qui est la garantie de sécurité la plus fondamentale du produit — et que le dossier de candidature met justement en avant comme argument de confiance. Ce n'est pas un choix neutre : c'est directement lié à l'axe cybersécurité déjà central dans le positionnement du projet.

*(Point de validation avec toi avant de coder : confirmer ce choix, ou indiquer si tu préfères explorer l'Option A malgré le risque.)*

---

# SECTION 2 — MODÈLE DE DONNÉES

```prisma
model SchoolGroup {
  id            String              @id @default(cuid())
  name          String              // ex. "Groupe Scolaire Excellence"
  ownerId       String              @unique
  owner         SchoolGroupOwner    @relation(fields: [ownerId], references: [id])
  schools       School[]            // ajout d'un champ groupId sur School (voir plus bas)
  planTier      String              @default("ETABLISSEMENT_PLUS")
  createdAt     DateTime            @default(now())
}

model SchoolGroupOwner {
  id                         String       @id @default(cuid())
  email                      String       @unique
  passwordHash               String
  name                       String
  isActive                   Boolean      @default(true)
  mfaEnabled                 Boolean      @default(false)
  mfaSecret                  String?
  mfaTempSecret              String?
  mfaRecoveryCodeHashes      String[]     @default([])
  mfaRecoveryCodeGeneratedAt DateTime?
  loginEmailOtpHash          String?
  loginEmailOtpExpiresAt     DateTime?
  loginEmailOtpAttempts      Int          @default(0)
  loginEmailOtpSentAt        DateTime?
  createdAt                  DateTime     @default(now())
  updatedAt                  DateTime     @updatedAt
  group                      SchoolGroup?

  @@index([loginEmailOtpExpiresAt])
}
```

**Sur `School` :**
```prisma
model School {
  // ... champs existants
  groupId String?
  group   SchoolGroup? @relation(fields: [groupId], references: [id])
}
```
`groupId` nullable : la quasi-totalité des écoles restent hors-groupe (client individuel), seul un sous-ensemble rejoint un groupe. Aucune migration de données requise sur les écoles existantes — ajout de colonne nullable, zéro impact rétroactif.

**Champs MFA/OTP dupliqués de `MasterUser`/`User` volontairement** — cohérent avec l'exigence d'authentification renforcée déjà appliquée à Admin/Staff/Enseignant (section sécurité du dossier de candidature) : un Fondateur de Groupe a accès à des données agrégées sur plusieurs écoles, c'est un compte à privilèges au moins aussi sensible qu'un Admin — MFA obligatoire dès la première connexion, même logique, même garde-fous.

**Table de transfert inter-établissements** (voir Section 5) :
```prisma
model GroupTransferRequest {
  id                String              @id @default(cuid())
  groupId           String
  type              GroupTransferType   // STUDENT | STAFF
  sourceSchoolId    String
  targetSchoolId    String
  sourceUserId      String              // l'élève ou l'enseignant vacataire concerné
  status            GroupTransferStatus @default(PENDING_TARGET_ADMIN)
  onboardingId      String?             // lie vers l'enregistrement StudentOnboarding créé côté école cible
  requestedByOwnerId String
  createdAt         DateTime            @default(now())
  decidedAt         DateTime?
}

enum GroupTransferType { STUDENT STAFF }
enum GroupTransferStatus { PENDING_TARGET_ADMIN ACCEPTED REJECTED }
```

---

# SECTION 3 — AUTHENTIFICATION DU FONDATEUR DE GROUPE

Réplique directe du patron `protectMaster`/`authorizeMaster` (`authMultiTenant.ts`) :

- `POST /api/group/auth/login` → vérifie email+mot de passe sur `SchoolGroupOwner`, émet un JWT `{ tokenType: "group_owner", id, email }` signé avec un secret dédié (`GROUP_OWNER_JWT_SECRET`, sur le modèle de `MASTER_JWT_SECRET`), cookie `group_jwt`, `httpOnly`.
- Même flux MFA/OTP que Admin (réutilise directement les use cases déjà génériques construits pour `LoginEmailOtpUseCase`/`VerifierMfaConnexionUseCase` si leur signature le permet, sinon copie adaptée — à valider au moment du code selon leur couplage réel à `User`).
- `protectGroupOwner` middleware : vérifie le cookie, charge le `SchoolGroupOwner`, attache `req.groupOwner = { id, groupId, schoolIds: [...] }` à la requête (résout `schoolIds` une fois via `SchoolGroup.schools.map(s => s.id)`, pas à recalculer à chaque requête aval — mis en cache sur la requête).
- Aucune route existante ne doit accepter ce token — middleware entièrement séparé, jamais mélangé à `protectSchool`/`authorizeSchool`.

---

# SECTION 4 — AGRÉGATION CROSS-TENANT EN LECTURE SEULE

C'est le cœur technique du module, et le point où l'isolation doit être gardée avec le plus de rigueur.

**Principe non négociable :** aucune requête n'interroge jamais plusieurs écoles dans un seul `where: { schoolId: { in: [...] } }` sur les tables sensibles (élèves, notes, finances individuelles). À la place, chaque use case d'agrégation **itère école par école**, calcule un résultat AGRÉGÉ (somme, moyenne, compte) par école, et n'assemble que ces agrégats déjà anonymisés dans la réponse — jamais un enregistrement individuel d'élève ne traverse la frontière d'une école vers le dashboard du groupe.

```ts
// backend/src/application/schoolGroup/ObtenirKpisGroupeUseCase.ts
export class ObtenirKpisGroupeUseCase {
  async execute(groupId: string) {
    const schools = await this.prisma.school.findMany({ where: { groupId } });
    const parEcole = await Promise.all(schools.map(async (school) => ({
      schoolId: school.id,
      schoolName: school.name,
      effectifs: await this.prisma.studentProfile.count({ where: { user: { schoolId: school.id } } }),
      tauxReussite: await this.calculerTauxReussite(school.id),       // agrégat déjà calculé par école
      revenus: await this.calculerRevenusCumules(school.id),          // somme, jamais le détail des paiements individuels
      tauxAbsenteisme: await this.calculerTauxAbsenteisme(school.id),
    })));
    return {
      parEcole,
      totaux: {
        effectifsTotal: parEcole.reduce((s, e) => s + e.effectifs, 0),
        tauxReussiteGlobal: moyennePonderee(parEcole),
        revenusCumules: parEcole.reduce((s, e) => s + e.revenus, 0),
      },
    };
  }
}
```

**Vérification d'appartenance systématique** : chaque endpoint du dashboard groupe commence par vérifier que `groupId` (dérivé du token, jamais du paramètre de requête) correspond bien au groupe du `SchoolGroupOwner` authentifié — même réflexe de double-vérification déjà appliqué partout ailleurs dans ce projet (RBAC du copilot, permissions Staff, etc.).

**Nouveaux use cases nécessaires (lecture seule uniquement) :**
- `ObtenirKpisGroupeUseCase` — effectifs, taux de réussite, revenus, absentéisme, agrégés par école et au total.
- `ListerEcolesGroupeUseCase` — liste simple des écoles membres avec leurs infos publiques (nom, ville, type, plan).
- `ObtenirDetailEcoleGroupeUseCase` — vue détaillée d'UNE école du groupe (toujours des agrégats, jamais des listes d'élèves nominatives — un Fondateur de Groupe voit des chiffres, pas les mêmes écrans qu'un Admin de cette école).

---

# SECTION 5 — TRANSFERTS ENTRE ÉTABLISSEMENTS DU GROUPE

## Pourquoi ce n'est PAS une simple mutation de `schoolId`

Un `User` (élève ou enseignant) a des dizaines d'enregistrements liés à son `schoolId` actuel (notes, présences, paiements, sanctions disciplinaires...). Changer son `schoolId` en place casserait silencieusement l'intégrité de toutes ces relations (un `Grade.schoolId` qui ne correspond plus au `User.schoolId` de l'élève, par exemple), et mélangerait l'historique de deux écoles qui doivent rester des tenants isolés même en cas de transfert.

## Le mécanisme retenu — deux étapes, jamais une bascule automatique

**Étape 1 — Le Fondateur de Groupe initie la demande** (`POST /api/group/transfers`) : sélectionne l'élève/enseignant, l'école source, l'école cible. Crée un `GroupTransferRequest` en statut `PENDING_TARGET_ADMIN`. Aucune donnée n'est encore déplacée.

**Étape 2 — L'Admin de l'école CIBLE valide** (nouvel écran côté dashboard Admin, visible uniquement si `School.groupId` n'est pas null) : voit la demande, et à l'acceptation :
- Pour un élève : appelle `CreerSqueletteOnboardingUseCase` avec `sourceType: 'GROUPE_TRANSFERT'`, pré-rempli avec les informations de base (nom, date de naissance, niveau suggéré) lues en agrégat depuis l'école source par le use case du groupe — jamais une copie brute de l'ancien `User`. Le parent/élève complète et valide via le lien sécurisé, exactement comme un onboarding classique. Un NOUVEAU `User`/`StudentProfile` naît dans l'école cible ; l'ancien reste intact dans l'école source, marqué `studentStatus: TRANSFERE` (nouvelle valeur d'enum à ajouter) pour que son historique reste consultable là où il a eu lieu.
- Pour un enseignant vacataire : plus simple (pas de notes/présences élève à préserver au même degré) — création d'un nouveau compte `TEACHER` dans l'école cible via le flux d'invitation déjà existant (`InscrireUtilisateurUseCase`), avec `GroupTransferRequest.status = ACCEPTED` une fois fait.

**Ce que ça évite** : jamais de "téléportation" silencieuse d'un compte entre deux tenants, jamais de mélange d'historique, toujours une validation humaine côté école cible (même principe que "jamais d'action sur une supposition" déjà appliqué à l'onboarding post-concours).

---

# SECTION 6 — PERMISSIONS

Reprend et complète l'esquisse de `EduNexus_Carte_Complete_V2.md` §1.8, qui listait la fonctionnalité "transfert d'élèves" sans jamais lui donner de permission correspondante :

```
VIEW_ALL_SCHOOLS_IN_GROUP     — Accès au dashboard consolidé (lecture des KPIs agrégés)
VIEW_GROUP_FINANCIALS         — Performance financière agrégée
VIEW_GROUP_PEDAGOGY           — Taux de réussite agrégés par établissement/niveau
MANAGE_GROUP_STAFF_TRANSFER   — Initier une demande de transfert d'enseignant vacataire
MANAGE_GROUP_STUDENT_TRANSFER — Initier une demande de transfert d'élève (absente de l'esquisse initiale, ajoutée ici)
```

Un `SchoolGroupOwner` a-t-il TOUJOURS les 5, ou peut-il déléguer (ex. un collaborateur avec accès lecture seule) ? **Pour ce premier jet : toutes les permissions sont accordées d'office au propriétaire, pas de sous-comptes délégués** — cohérent avec le périmètre resserré déjà pratiqué pour d'autres chantiers de ce projet (voir Section 12). Une évolution future pourrait introduire des comptes secondaires par groupe, mais ce n'est pas nécessaire pour valider le concept.

---

# SECTION 7 — PLAN TARIFAIRE "ÉTABLISSEMENT+" ET FACTURATION

- Ajouter `ETABLISSEMENT_PLUS` à l'enum `PlanType` (actuellement `DISCOVERY | STANDARD | PREMIUM`).
- `SchoolGroup.planTier` porte le tarif dégressif négocié (texte libre ou structure simple `{ tarifParEcole: number, remisePct: number }`) — **la facturation elle-même reste hors périmètre de ce premier jet** (voir Section 12) : ce chantier construit la vue consolidée et les transferts, pas un moteur de facturation groupée automatisé. Le tarif "sur devis" mentionné dans le dossier reste, pour l'instant, une négociation commerciale manuelle enregistrée dans ce champ — pas un prélèvement automatique.

---

# SECTION 8 — FRONTEND

Nouveau dashboard complet, sur le modèle exact de `/master/dashboard` (déjà existant, à répliquer en structure) :

- `frontend/src/app/group/login/page.tsx` — connexion dédiée (email + mot de passe + MFA + OTP email, même stepper que le login classique).
- `frontend/src/app/group/dashboard/page.tsx` + `_components/` :
  - `SectionGroupOverview.tsx` — KPIs agrégés (cartes effectifs/réussite/revenus/absentéisme), un graphique comparatif simple par école.
  - `SectionGroupSchools.tsx` — liste des écoles membres, clic → vue détail agrégée d'une école (jamais les écrans internes de cette école).
  - `SectionGroupTransfers.tsx` — créer une demande de transfert (élève ou enseignant), suivre le statut des demandes en cours.
  - `SectionGroupSettings.tsx` — MFA (réutilise `MfaSettings.tsx` déjà générique, construit pour Admin/Staff/Enseignant ce trimestre), infos du groupe.
- Câblage : nouvel écran Admin **côté chaque école membre** pour voir/traiter les demandes de transfert entrantes (visible seulement si `School.groupId` non null) — nouvelle entrée sidebar Admin conditionnelle, même principe de gating déjà établi pour LV2/concours/PEBS (voir `Plan_Evenements_Calendrier_ZekoulABia.md`) : visible seulement s'il y a une demande `PENDING_TARGET_ADMIN` en attente, sinon masquée.

---

# SECTION 9 — SÉQUENCEMENT PAR PHASES

Même principe que tous les autres chantiers de ce projet : déploiement par couches, jamais tout d'un coup.

| Phase | Contenu | Dépend de |
|---|---|---|
| **A — Fondations** | Modèles Prisma (`SchoolGroup`, `SchoolGroupOwner`, `groupId` sur `School`), migration | Rien |
| **B — Auth** | JWT/cookie/middleware dédiés, écran de connexion, MFA | Phase A |
| **C — Lecture agrégée** | KPIs consolidés, liste des écoles, détail par école — tout en lecture seule | Phase B |
| **D — Transferts** | `GroupTransferRequest`, écran de demande côté groupe, écran de validation côté Admin cible | Phase C |
| **E — Tarification** | `ETABLISSEMENT_PLUS`, champ `planTier` | Peut se faire en parallèle de C/D |

Chaque phase testée et validée avant de passer à la suivante — même discipline que le reste du projet.

---

# SECTION 10 — RISQUES ET POINTS DE VIGILANCE

1. **Le risque principal, et le seul vraiment sérieux : une régression sur l'isolation multi-tenant.** Toute agrégation cross-école doit être écrite comme une boucle sur des requêtes mono-école déjà filtrées, jamais comme une requête unique avec `schoolId IN (...)` sur une table contenant des données individuelles sensibles. Revue de code systématique sur ce point précis avant tout merge.
2. **Créer un compte de test réaliste dès la Phase A** — sans clients réels ayant plusieurs écoles aujourd'hui, ce module ne sera testé qu'avec des données synthétiques ; prévoir un smoke test dédié qui crée 2-3 écoles factices regroupées, avec des données de test dans chacune, pour vérifier concrètement que l'agrégation ne fuite rien (même exigence que les smoke tests déjà pratiqués sur les chantiers précédents de cette session).
3. **`assignedSchoolIds` sur `MasterUser` reste un champ mort** — ce plan ne le réutilise pas (Section 1) ; à documenter/nettoyer séparément si jamais confirmé inutile, mais hors périmètre de ce chantier.
4. **Ne pas confondre avec l'accès DDES/DRES** (MODULE 22, également Phase 5 dans l'esquisse initiale) — rôle différent (autorité de tutelle, lecture seule sur une circonscription géographique) que ce plan ne couvre pas.

---

# SECTION 11 — DEFINITION OF DONE

- `tsc --noEmit` propre backend + frontend.
- Smoke test bout-en-bout : créer un groupe avec 2 écoles factices peuplées de données différentes, vérifier que les KPIs agrégés correspondent exactement à la somme/moyenne attendue, et qu'aucun endpoint du dashboard groupe ne renvoie une donnée individuelle nominative.
- Parité i18n FR/EN sur tout nouveau texte frontend.
- Un transfert d'élève de bout en bout (demande → validation Admin cible → onboarding complété) testé manuellement au moins une fois.
- Mise à jour de `EduNexus_Carte_Complete_V2.md` (MODULE 21 passe de ⬜ à 🟡/✅ selon ce qui est réellement livré) et du dossier de candidature si ce module change son statut de "sur la feuille de route" à "opérationnel" — même discipline de synchronisation documentation/code déjà appliquée tout au long de cette session.

---

# SECTION 12 — CE QUI NE SERA DÉLIBÉRÉMENT PAS FAIT DANS CE PREMIER JET

- Facturation consolidée automatisée (prélèvement Mobile Money groupé) — seulement un champ tarifaire enregistré manuellement.
- Comptes délégués/secondaires pour un groupe (lecture seule pour un collaborateur du Fondateur).
- Accès DDES/DRES (module distinct, MODULE 22).
- Héritage de calendrier scolaire à l'échelle du groupe (déjà noté comme extension possible mais non prioritaire dans `Plan_Evenements_Calendrier_ZekoulABia.md` §8.4).
- Tableau de bord marque blanche personnalisé par groupe (mentionné dans le dossier comme piste de revenu, pas dans le périmètre technique de ce chantier).

---

*Document de planification — ZekoulABia / EDUNEXUS. Ne pas commencer le code avant validation explicite de la Section 1 (décision d'architecture), qui conditionne toutes les sections suivantes.*
