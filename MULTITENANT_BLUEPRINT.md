# 📖 Multi-Tenant Blueprint - Résumé exécutif

## 🎯 Objectif final

```
AVANT:
├─ 1 MongoDB (MONGO_URL)
└─ Toutes les écoles mélangées ou une seule

APRÈS:
├─ MASTER DB (écoles + configs + admins)
└─ N × DB École (données isolées)
   ├─ École 1 (Francophone)
   ├─ École 2 (Anglophone)
   └─ École 3 (Bilingue)
```

---

## 📁 Fichiers à créer/modifier

### ✅ Déjà créés (prêts)

| Fichier | Rôle |
|---------|------|
| `backend/src/models/school.ts` | Modèle École (MASTER DB) |
| `backend/src/models/schoolComplex.ts` | Modèle Complexe Scolaire (MASTER DB) |
| `backend/src/models/masterUser.ts` | Modèle Admin Platform (MASTER DB) |
| `backend/src/models/schoolConfig.ts` | Modèle Config École (MASTER DB) |
| `backend/src/config/dbRouter.ts` | Routeur connexions MongoDB dynamiques |
| `backend/src/middleware/authMultiTenant.ts` | Middlewares protectSchool, authorizeMaster |
| `backend/src/controllers/masterAdmin.ts` | API: créer écoles, gérer configs |
| `backend/src/routes/masterAdmin.ts` | Routes `/api/master/*` |

### ⏳ À faire (étapes progressives)

| Étape | Fichier | Action |
|-------|---------|--------|
| 1 | `backend/src/server.ts` | Initialiser dbRouter + route master |
| 2 | `backend/src/models/user.ts` | Ajouter champ `schoolId` |
| 3 | `backend/src/scripts/migrate-phase8.ts` | Script migration users |
| 4 | `backend/src/controllers/user.ts` | JWT inclut schoolId |
| 5 | `.env` | Ajouter `MASTER_MONGO_URL` |
| 6 | Routes individuelles | Optionnel: migrer vers protectSchool |

---

## 🚀 Plan d'exécution (4 semaines)

### Semaine 1: Setup

**À faire:**
- [ ] Créer MASTER_MONGO_URL en .env
- [ ] Modifier `server.ts` (initialiser dbRouter)
- [ ] Tester GET /api/master/schools → [] (vide, c'est bon)

**Validation:** Aucune erreur au startup

---

### Semaine 2: Data migration

**À faire:**
- [ ] Modifier `user.ts`: ajouter champ `schoolId`
- [ ] Lancer `migrate-phase8.ts`
- [ ] Créer 2 écoles via API: `POST /api/master/schools`
- [ ] Mettre à jour JWT dans login

**Validation:**
```bash
GET /api/master/schools # Voir 2 écoles
JWT decode # Contient schoolId
```

---

### Semaine 3: Routing

**À faire:**
- [ ] Tester `protectSchool` middleware (route de test)
- [ ] Vérifier isolation de données
- [ ] Créer configs par école: `POST /api/master/schools/{id}/config`

**Validation:**
```bash
École 1 sees: ses données uniquement
École 2 sees: ses données uniquement
```

---

### Semaine 4: Stabilité + Pilot

**À faire:**
- [ ] Charge test (2+ écoles en parallèle)
- [ ] Vérifier cache connexions
- [ ] Phase 8 pilot déploiement

**Validation:**
- [ ] Zéro breaking change
- [ ] Performance OK
- [ ] 100% isolation données

---

## 💾 Variables d'environnement

```env
# MASTER DB (base centralisée)
MASTER_MONGO_URL=mongodb://localhost:27017/edunexus_master

# Base par défaut (pour compatibilité)
MONGO_URL=mongodb://localhost:27017/edunexus_school_1

# JWT (existant)
JWT_SECRET=your_secret_key
```

---

## 🔑 Concepts clés

### 1. MASTER DB
```
schools:
  - schoolName: "Lycée Saint-Rémi"
    systemType: "francophone"
    dbConnectionString: "mongodb://...school_1..."

  - schoolName: "Shiloh Academy"
    systemType: "anglophone"
    dbConnectionString: "mongodb://...school_2..."

schoolconfigs:
  - school: ObjectId(school_1)
    gradingSystem: "over_20"
    standardSubjects: [...]

masterusers:
  - email: "admin@platform.com"
    role: "super_admin"
```

### 2. SCHOOL DB (une par école)
```
edunexus_school_1:
  users: [...]
  classes: [...]
  exams: [...]
  ... (tout ce qui existe)

edunexus_school_2:
  users: [...]
  classes: [...]
  ... (copie structure)
```

### 3. JWT
```json
{
  "id": "user_mongo_id",
  "schoolId": "school_mongo_id",
  "role": "teacher",
  "email": "..."
}
```

### 4. Routing
```
Request → Middleware protectSchool
  ↓
Lit JWT
  ↓
Récupère schoolId
  ↓
Cherche School en MASTER DB
  ↓
Récupère dbConnectionString
  ↓
Route vers cette base
  ↓
Requête isolée à cette école ✓
```

---

## ⚡ Exemple real-world

### Scénario: 3 écoles, 2 users
```
MASTER DB:
  schools:
    - Saint-Rémi (ID_1) → edunexus_school_1
    - Shiloh (ID_2) → edunexus_school_2
    - Complexe (ID_3) → edunexus_school_3

USER 1: Jean@saint-remi.fr
  JWT: { schoolId: ID_1 }
  Login → Connecte à edunexus_school_1
  GET /api/classes → Voit uniquement Saint-Rémi

USER 2: Sarah@shiloh.edu
  JWT: { schoolId: ID_2 }
  Login → Connecte à edunexus_school_2
  GET /api/classes → Voit uniquement Shiloh

→ Zéro mélange ✓
```

---

## 🛡️ Sécurité

```
✓ JWT signé (HS512)
✓ httpOnly cookies
✓ schoolId validé avant routage
✓ Connection strings chiffrées
✓ Pas d'accès cross-school
✓ Audit trail des créations
```

---

## 📊 Architecture finale

```
┌────────────────────────────────────────┐
│           Frontend (React)              │
│  - Login form                          │
│  - Dashboard (école A ou B)            │
└────────────────┬───────────────────────┘
                 │ JWT + cookies
                 ↓
┌────────────────────────────────────────┐
│  Backend Express (server.ts)           │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ protectSchool middleware         │ │
│  │ - Lit JWT                        │ │
│  │ - Extrait schoolId               │ │
│  │ - Route vers école DB            │ │
│  └──────────────────────────────────┘ │
│                                        │
└────────────┬──────────────┬────────────┘
             │              │
        ┌────┴──────┐  ┌───┴──────┐
        ↓           ↓  ↓          ↓
    ┌────────┐  ┌────────┐   ┌─────────┐
    │ MASTER │  │ÉCOLE 1 │   │ ÉCOLE 2 │
    │   DB   │  │   DB   │   │   DB    │
    └────────┘  └────────┘   └─────────┘
    (config)    (données)    (données)
```

---

## ✅ Checklist go-live Phase 8

- [ ] MASTER DB initialized
- [ ] 2+ écoles créées (FR + EN)
- [ ] JWT inclut schoolId
- [ ] `protectSchool` teste OK
- [ ] Data isolation validée
- [ ] Routes v1 toujours OK (backward compat)
- [ ] Cache connexions fonctionne
- [ ] Logs show correct routing
- [ ] Perf acceptable (< 500ms par request)
- [ ] Zéro breaking change
- [ ] Phase 8 pilot ready

---

## 🆘 Dépannage rapide

| Problème | Solution |
|----------|----------|
| `MASTER DB not initialized` | Vérifier `MASTER_MONGO_URL` |
| `School not found` | Créer école en MASTER DB |
| `Wrong school data` | Vérifier JWT schoolId |
| `Connection timeout` | Vérifier dbConnectionString |
| `User not found` | User doit avoir schoolId |

---

## 📞 Support architecture

Pour questions sur:
- **Routing:** Voir `EXAMPLES_CONCRETE_MULTITENANT.md`
- **Migration:** Voir `MIGRATION_PROGRESSIVE_GUIDE.md`
- **Implementation:** Voir `INTEGRATION_MASTER_DB_PLAN.md`

---

## 🎉 Bénéfices finaux

```
✓ 1 école = 1 base MongoDB isolée
✓ N écoles = N bases complètement séparées
✓ ZERO risque de mélange de données
✓ Scalabilité: ajouter école = POST /api/master/schools
✓ Security: JWT route + isolation
✓ Performance: cache connexions
✓ Flexibility: configs par école
✓ Backward compatible: routes existantes restent OK
```

C'est prêt ! 🚀
