# 🚀 Guide de Migration Progressive (Zéro Breaking Change)

## 🎯 Principe clé

Tu vas **ajouter** la nouvelle architecture en parallèle, sans supprimer l'ancienne.
Les deux vont coexister pendant une phase de transition.

---

## Phase 0: État actuel (semaine 1)

```
┌─────────────────────────────┐
│  MongoDB (MONGO_URL)        │
│  edunexus_school_1          │
│  - users                    │
│  - classes                  │
│  - exams                    │
│  - reports                  │
└─────────────────────────────┘
       ↑
    connectDB()
       ↑
  Backend (Express)
```

**Risque:** Aucun. Tout continue de marcher.

---

## Phase 1: Ajouter MASTER DB (semaine 1-2)

### 1. Créer une 2e URL MongoDB

```env
# .env
# Ancienne (pour compatibilité)
MONGO_URL=mongodb://localhost:27017/edunexus_school_1

# Nouvelle MASTER DB
MASTER_MONGO_URL=mongodb://localhost:27017/edunexus_master
```

### 2. Importer et initialiser le dbRouter dans `server.ts`

```typescript
import { dbRouter } from "./config/dbRouter.ts";
import masterAdminRouter from "./routes/masterAdmin.ts";

// AVANT la ligne connectDB()
const initDatabases = async () => {
  try {
    // Initialise MASTER DB
    const masterUrl = process.env.MASTER_MONGO_URL || "mongodb://localhost:27017/edunexus_master";
    await dbRouter.initMasterDB(masterUrl);
    console.log("✓ MASTER DB initialized");

    // La connexion existante reste
    await connectDB();
    console.log("✓ Default DB initialized");
  } catch (error) {
    console.error("Database init failed:", error);
    process.exit(1);
  }
};

// Dans connectDB().then():
connectDB().then(() => {
  initDatabases().then(() => {
    initSocket(httpServer, process.env.CLIENT_URL);
    httpServer.listen(PORT, () => {
      console.log("Server running on port", PORT);
    });
  });
});

// NOUVELLE route du master (avant les autres)
app.use("/api/master", masterAdminRouter);

// Les routes existantes restent INCHANGÉES
app.use("/api/users", userRoutes);
app.use("/api/classes", classRouter);
// ... etc
```

**Vérifier:** `http://localhost:5000/api/master/schools` → doit retourner `[]` (empty, c'est normal)

---

## Phase 2: Enregistrer une école dans MASTER DB (semaine 2)

### 1. Créer école 1 (francophone)

```bash
curl -X POST http://localhost:5000/api/master/schools \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=MASTER_JWT" \
  -d '{
    "schoolName": "Lycée Saint-Rémi",
    "schoolMotto": "Excellence",
    "systemType": "francophone",
    "dbName": "edunexus_school_1",
    "dbConnectionString": "mongodb://localhost:27017/edunexus_school_1"
  }'
```

**Résultat:** La base `edunexus_school_1` (qui existe déjà) est maintenant enregistrée en MASTER DB.

### 2. Créer école 2 (anglophone) [optionnel pour pilot]

```bash
curl -X POST http://localhost:5000/api/master/schools \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=MASTER_JWT" \
  -d '{
    "schoolName": "Shiloh Academy",
    "schoolMotto": "Education Excellence",
    "systemType": "anglophone",
    "dbName": "edunexus_school_2",
    "dbConnectionString": "mongodb://localhost:27017/edunexus_school_2"
  }'
```

**Note:** Tu dois créer une 2e base MongoDB `edunexus_school_2` et copier la structure de `edunexus_school_1`.

**Vérifier:** `GET /api/master/schools` → doit voir les 2 écoles

---

## Phase 3: Ajouter schoolId aux users (semaine 2)

### 1. Mettre à jour le modèle User

**Fichier:** `backend/src/models/user.ts`

```typescript
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: userRoles;
  schoolId?: mongoose.Types.ObjectId; // ← NOUVEAU, optionnel
  schoolSection?: schoolSections;
  // ... rest unchanged
}

const userSchema: Schema<IUser> = new Schema(
  {
    // ... existing fields
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    // ... rest unchanged
  },
  { timestamps: true }
);
```

### 2. Migration: Mettre à jour les users existants

**Fichier:** `backend/src/scripts/migrate-phase8.ts`

```typescript
import mongoose from "mongoose";
import User from "../models/user.ts";
import { dbRouter } from "../config/dbRouter.ts";
import School from "../models/school.ts";

export const addSchoolIdToUsers = async () => {
  try {
    console.log("Starting migration: adding schoolId to users...");

    // 1. Récupère l'école "par défaut" de MASTER DB
    const masterConn = dbRouter.getMasterConnection();
    const SchoolModel = masterConn.model("School", School.schema);
    const defaultSchool = await SchoolModel.findOne({
      dbName: "edunexus_school_1", // L'école initiale
    });

    if (!defaultSchool) {
      console.error("Default school not found in MASTER DB");
      return;
    }

    // 2. Met à jour tous les users (ajout schoolId)
    const result = await User.updateMany(
      { schoolId: { $exists: false } }, // Users sans schoolId
      { $set: { schoolId: defaultSchool._id } }
    );

    console.log(`✓ Updated ${result.modifiedCount} users with schoolId`);
    console.log(`✓ School: ${defaultSchool.schoolName}`);
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
};
```

**Exécuter:**
```bash
# Ajouter ce script au package.json
"migrate:phase8": "bun src/scripts/migrate-phase8.ts"

# Lancer
bun migrate:phase8
```

**Vérifier:** `db.users.findOne()` → doit avoir `schoolId: ObjectId(...)`

---

## Phase 4: Mettre à jour le JWT (semaine 2)

### 1. Modifier le login existant

**Fichier:** `backend/src/controllers/user.ts`

```typescript
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ NOUVEAU: inclure schoolId dans JWT
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId || null, // ← NOUVEAU
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "30d", algorithm: "HS512" }
    );

    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: "Logged in successfully",
      role: user.role,
      schoolId: user.schoolId, // ← BONUS: pour debug frontend
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error.message || "Server error" });
  }
};
```

**Vérifier:** Decode le JWT → doit avoir `schoolId`

---

## Phase 5: Ajouter `protectSchool` middleware (semaine 3)

**Note:** On ne change PAS le `protect` existant, on ajoute juste `protectSchool` en parallèle.

**Fichier:** `backend/src/middleware/authMultiTenant.ts` ← créé

Les routes existantes restent sur `protect`:
```typescript
app.use("/api/users", userRoutes);     // Utilise protect (ancien)
app.use("/api/classes", classRouter);  // Utilise protect (ancien)
```

Les NOUVELLES routes pourront utiliser `protectSchool`:
```typescript
// Route de test pour valider le multi-tenant
router.get("/test-school-isolation", protectSchool, (req, res) => {
  return res.json({
    schoolId: req.schoolId,
    userId: req.user._id,
    message: "You are correctly routed to your school DB",
  });
});
```

**Vérifier:** `GET /api/test-school-isolation` → doit retourner ta `schoolId`

---

## Phase 6: Migration progressives des routes (semaine 3-4)

### Option A: Migration immédiate (risqué)
```typescript
// Changement direct (attention au breaking change)
router.get("/", protectSchool, getAllClasses); // ← changé
```

### Option B: Migration progressive (recommandé)

**1. Créer des NOUVELLES routes**
```typescript
// backend/src/routes/classV2.ts
router.get("/v2/classes", protectSchool, getAllClassesV2);
```

**2. Le contrôleur V2 utilise `req.schoolConnection`**
```typescript
export const getAllClassesV2 = async (req: Request, res: Response) => {
  const ClassModel = req.schoolConnection.model("Class", Class.schema);
  // ✓ Requête exécutée dans la bonne base d'école
  const classes = await ClassModel.find({});
  return res.json({ classes });
};
```

**3. Frontend peut pointer vers v2 (optionnel)**
```typescript
// frontend/src/hooks/useClasses.ts
const response = await axios.get("/api/classes/v2"); // Optionnel
```

**4. Plus tard, supprimer v1 (après tests)**

---

## Phase 7: Tests de validation (semaine 4)

### Test 1: Isolation des données

```bash
# Login École 1 (Saint-Rémi)
curl -X POST http://localhost:5000/api/users/login \
  -d '{"email": "teacher1@lycee.fr", "password": "pass"}'

# Récupère JWT1
JWT1="eyJ..."

# Query 1
curl -H "Cookie: jwt=$JWT1" http://localhost:5000/api/classes
# Retourne classes de Saint-Rémi uniquement

---

# Login École 2 (Shiloh)
curl -X POST http://localhost:5000/api/users/login \
  -d '{"email": "teacher2@shiloh.edu", "password": "pass"}'

JWT2="eyJ..."

# Query 2
curl -H "Cookie: jwt=$JWT2" http://localhost:5000/api/classes
# Retourne classes de Shiloh uniquement

# ✓ SUCCÈS: Données isolées!
```

### Test 2: Configs par école

```bash
# Récupère config de Saint-Rémi
curl -H "Cookie: jwt=$MASTER_JWT" \
  http://localhost:5000/api/master/schools/{SCHOOL_1_ID}/config

# Retourne config FR: système /20, matières français, etc.

---

# Récupère config de Shiloh
curl -H "Cookie: jwt=$MASTER_JWT" \
  http://localhost:5000/api/master/schools/{SCHOOL_2_ID}/config

# Retourne config EN: système A-F, matières anglaises, etc.

# ✓ SUCCÈS: Configs séparées!
```

---

## 🛡️ Rollback safety

Si quelque chose casse:

```bash
# 1. Les routes anciennes continuent de marcher
GET /api/classes # ← Utilise protect (ancien), toujours OK

# 2. Si MASTER DB down, aucun impact
# Les requêtes sur /api/users, /api/classes, etc. continuent

# 3. Juste les routes /api/master/* qui cassent
# (Mais elles sont isolées)

# 4. Restart simple
docker restart backend
# ✓ Récupère instantanément
```

---

## 📋 Checklist de validation

- [ ] MASTER_MONGO_URL configurée
- [ ] dbRouter initialise sans erreur
- [ ] `GET /api/master/schools` retourne une liste
- [ ] User model inclut schoolId
- [ ] Migration `migrate:phase8` réussie
- [ ] JWT inclut schoolId
- [ ] `GET /api/test-school-isolation` fonctionne
- [ ] 2 écoles créées et testées
- [ ] Requêtes isolées (école 1 ne voit pas école 2)
- [ ] Routes v1 toujours opérationnelles

---

## ⚠️ Points critiques à ne pas oublier

1. **schoolId dans User obligatoire**
   - Tous les users DOIVENT avoir schoolId
   - Sinon le JWT échoue

2. **Migration de schéma**
   - Ajouter index `{ schoolId: 1 }` pour perfs
   - Backfill progressivement

3. **Test d'isolation**
   - Très important: vérifier que les données ne se mélangent PAS
   - Faire des tests avec JWT d'une autre école

4. **Performance**
   - Cache des connexions → check les stats
   - Nettoyer les connexions mortes
