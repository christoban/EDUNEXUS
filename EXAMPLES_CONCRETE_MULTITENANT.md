# 🔧 Exemples Concrets: Comment ça marche

## 1️⃣ Scénario: Création d'une nouvelle école

### Request (Master Admin)
```bash
curl -X POST http://localhost:5000/api/master/schools \
  -H "Authorization: Bearer JWT_MASTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schoolName": "Lycée Saint-Rémi",
    "schoolMotto": "Éducation d'\''Excellence",
    "systemType": "francophone",
    "dbName": "edunexus_lycee_saint_remi",
    "dbConnectionString": "mongodb+srv://user:pass@cluster.mongodb.net/edunexus_lycee_saint_remi",
    "foundedYear": 1987,
    "location": "Paris"
  }'
```

### Code Backend (`masterAdmin.ts`)
```typescript
export const createSchool = async (req: Request, res: Response) => {
  // 1. Vérification des droits
  if (req.masterUser?.role !== "super_admin") {
    return res.status(403).json({ message: "Forbidden" });
  }

  // 2. Connexion à MASTER DB
  const masterConn = dbRouter.getMasterConnection();
  const SchoolModel = masterConn.model("School", School.schema);

  // 3. Création du document
  const school = await SchoolModel.create({
    schoolName: req.body.schoolName,
    dbConnectionString: req.body.dbConnectionString,
    // ... autres champs
  });

  // 4. TODO: Initialiser la base de l'école
  // - Créer collections vides (Users, Classes, etc.)
  // - Créer SchoolSettings defaults
  // - Créer SubSystems par défaut

  return res.status(201).json(school);
};
```

### Base MASTER (après succès)
```javascript
db.schools.findOne()
// Retourne:
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "schoolName": "Lycée Saint-Rémi",
  "systemType": "francophone",
  "dbName": "edunexus_lycee_saint_remi",
  "dbConnectionString": "mongodb+srv://user:pass@...",
  "isActive": true,
  "createdBy": ObjectId("..."),
  "createdAt": ISODate("2026-04-17T...")
}
```

---

## 2️⃣ Scénario: Login utilisateur d'une école

### Frontend Request
```typescript
// frontend/src/lib/api.ts
const loginResponse = await axios.post("/api/users/login", {
  email: "teacher@lycee-saint-remi.fr",
  password: "password123"
});

// Stocke le JWT
const jwt = loginResponse.data.jwt;
// ✓ httpOnly cookie automtique
```

### Code Backend Login (`user.ts`)

**ÉTAPE 1: Vérifier credentials (si une seule base)**
```typescript
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Cherche l'utilisateur
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  // Vérifie le mot de passe
  const match = await user.matchPassword(password);
  if (!match) return res.status(401).json({ message: "Invalid credentials" });

  // ✅ IMPORTANT: Comment on sait quelle école?
  // Option 1: Le user a un champ schoolId dans son doc
  // Option 2: Le domaine email indique l'école (teacher@lycee-saint-remi.fr)
  // Option 3: Frontend envoie x-school-id header

  // Détermine le schoolId
  const schoolId = determineSchoolFromUser(user); // À implémenter

  // Crée JWT avec schoolId
  const token = jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      schoolId: schoolId, // ✅ C'EST LA CLÉE
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "30d" }
  );

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return res.json({ message: "Login successful", role: user.role });
};
```

### JWT résultant (payload)
```json
{
  "id": "507f1f77bcf86cd799439012",
  "email": "teacher@lycee-saint-remi.fr",
  "role": "teacher",
  "schoolId": "507f1f77bcf86cd799439011"
}
```

---

## 3️⃣ Scénario: Requête utilisateur vers `/api/classes`

### Frontend Request
```typescript
// frontend/src/hooks/useClasses.ts
const response = await axios.get("/api/classes"); 
// ✓ JWT dans cookies automtique
// ✓ Request headers:
//   - Cookie: jwt=eyJhbGc...
```

### Code Backend Middleware (`authMultiTenant.ts`)

**ÉTAPE 1: Protectschool middleware**
```typescript
export const protectSchool = async (req, res, next) => {
  // 1. Extrait JWT du cookie
  const token = req.cookies?.jwt;
  if (!token) return res.status(401).json({ message: "No token" });

  // 2. Décode le JWT
  const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
  // decoded = { id, email, role, schoolId }

  // 3. CHERCHE L'ÉCOLE dans MASTER DB
  const masterConn = dbRouter.getMasterConnection();
  const SchoolModel = masterConn.model("School", School.schema);
  
  const school = await SchoolModel.findById(decoded.schoolId);
  if (!school) return res.status(401).json({ message: "School not found" });

  // 4. ✅ ROUTE VERS LA BASE DE L'ÉCOLE
  const schoolConn = await dbRouter.getSchoolConnection(
    String(school._id),
    school.dbConnectionString
  );

  // 5. Cherche l'utilisateur dans LA BASE DE L'ÉCOLE
  const UserModel = schoolConn.model("User", User.schema);
  const user = await UserModel.findById(decoded.id).select("-password");
  if (!user) return res.status(401).json({ message: "User not found" });

  // 6. Attache tout au request
  req.user = user;
  req.schoolId = String(school._id);
  req.schoolConnection = schoolConn; // ✅ VOILÀ LA MAGIE

  next();
};
```

**ÉTAPE 2: Le contrôleur utilise `req.schoolConnection`**
```typescript
// backend/src/controllers/class.ts
export const getClasses = async (req: Request, res: Response) => {
  // ✅ Utilise la connexion de l'école
  const ClassModel = req.schoolConnection.model("Class", Class.schema);

  const classes = await ClassModel.find({})
    .populate("academicYear")
    .populate("classTeacher");

  // ✅ Les données retournées sont UNIQUEMENT de cette école
  // Pas de risque de mélange!
  return res.json({ classes, total: classes.length });
};
```

### Response
```json
{
  "classes": [
    {
      "_id": "507f...",
      "name": "Classe 10 A",
      "schoolId": "507f1f77bcf86cd799439011"
    }
  ],
  "total": 1
}
```

---

## 4️⃣ Scénario: Configuration d'une école

### Request
```bash
POST /api/master/schools/507f1f77bcf86cd799439011/config

{
  "gradingSystem": "over_20",
  "passingGrade": 10,
  "termsType": "trimesters_3",
  "termsNames": ["Trimestre 1", "Trimestre 2", "Trimestre 3"],
  "standardSubjects": [
    { "name": "Mathématiques", "code": "MATH", "coefficient": 3 },
    { "name": "Français", "code": "FR", "coefficient": 2 },
    { "name": "Anglais", "code": "EN", "coefficient": 2 }
  ]
}
```

### Code Backend
```typescript
export const setSchoolConfig = async (req: Request, res: Response) => {
  const masterConn = dbRouter.getMasterConnection();
  const SchoolConfigModel = masterConn.model("SchoolConfig", SchoolConfig.schema);

  const config = await SchoolConfigModel.findOneAndUpdate(
    { school: req.params.schoolId },
    {
      school: req.params.schoolId,
      ...req.body,
    },
    { new: true, upsert: true }
  );

  return res.json({ message: "Config updated", config });
};
```

### Base MASTER après
```javascript
db.schoolconfigs.findOne({ school: ObjectId("507f1f77bcf86cd799439011") })
// Retourne:
{
  "_id": ObjectId("..."),
  "school": ObjectId("507f1f77bcf86cd799439011"),
  "gradingSystem": "over_20",
  "passingGrade": 10,
  "standardSubjects": [
    { "name": "Mathématiques", "code": "MATH", "coefficient": 3 },
    // ...
  ]
}
```

---

## 5️⃣ Scénario: Deux écoles en parallèle (isolation)

### Teacher de Lycée Saint-Rémi
```
JWT: { ..., schoolId: "SCHOOL_A", ... }
Login → Middleware protectSchool
→ Cherche SCHOOL_A en MASTER
→ Connecte à: edunexus_lycee_saint_remi
→ GET /api/classes
→ Voit UNIQUEMENT les classes de Saint-Rémi
```

### Teacher de Shiloh Academy
```
JWT: { ..., schoolId: "SCHOOL_B", ... }
Login → Middleware protectSchool
→ Cherche SCHOOL_B en MASTER
→ Connecte à: edunexus_shiloh_academy
→ GET /api/classes
→ Voit UNIQUEMENT les classes de Shiloh
```

### Résultat
```
Saint-Rémi Classes: [Classe 10 A, Classe 10 B, ...]
Shiloh Classes: [Grade 9 A, Grade 9 B, ...]
✓ Complètement isolées
✓ Aucun mélange
✓ Sécurité forte
```

---

## 🔒 Sécurité: Tentative de hacking

### Attaque: Un user de Saint-Rémi essaie d'accéder aux données de Shiloh

```typescript
// Attacker intercepte un JWT de Shiloh
// Mais son cookie local contient son JWT Saint-Rémi

// Attacker: GET /api/classes (avec JWT Saint-Rémi)
// Backend middleware:
// 1. Lit schoolId du JWT: "SCHOOL_A" (Saint-Rémi)
// 2. Route vers edunexus_lycee_saint_remi
// 3. Cherche l'user en SCHOOL_A
// 4. ✓ User trouvé et autorisé

// ✓ PROTECTION: Même s'il tampère avec le JWT,
//   le signature est invalide → 401 Unauthorized
```

---

## 📊 Vue d'ensemble des connexions

```
┌─────────────┐
│   Frontend  │ (React + Vite)
└──────┬──────┘
       │ JWT en Cookie
       ↓
┌─────────────────────────────┐
│  Backend Express            │
│  server.ts                  │
└──────┬──────────────────────┘
       │
       ├─→ MASTER DB Middleware
       │   └─ Initialise dbRouter
       │   └─ `protectMaster` pour admins
       │
       └─→ SCHOOL Routes Middleware
           └─ `protectSchool`
               ├─ Lit JWT
               ├─ Récupère schoolId
               ├─ Cherche School en MASTER
               ├─ Route vers School DB
               └─ Request exécutée
```

---

## ⚡ Performance: Cache des connexions

```typescript
// Premier appel
dbRouter.getSchoolConnection(
  "SCHOOL_A",
  "mongodb://...SCHOOL_A..."
);
// ✓ Crée nouvelle connexion (+ 200ms)
// ✓ Stocke en cache

// 2e appel (même school)
dbRouter.getSchoolConnection(
  "SCHOOL_A",
  "mongodb://...SCHOOL_A..."
);
// ✓ Retourne du cache (< 1ms)
// ✓ Pas reconnexion

// Stats
dbRouter.getConnectionStats();
// {
//   masterReady: true,
//   activeSchoolConnections: 2,
//   schools: ["SCHOOL_A", "SCHOOL_B"]
// }
```

---

## 🎯 Points clés à retenir

1. **MASTER DB** = liste des écoles + connexion strings
2. **SCHOOL DB** = données réelles (users, classes, etc.)
3. **JWT contient schoolId** = clée pour le routage
4. **req.schoolConnection** = accès à la bonne base
5. **Cache des connexions** = pas de reconnexions coûteuses
6. **Isolation complète** = pas de risque de mélange
