# 🏗️ Migration vers Architecture Multi-Tenant avec Base Master

## 📋 Vue d'ensemble

Tu gardes tes bases séparées par école, mais tu ajoutes:
1. **Base MASTER centralisée** → gère la liste des écoles et leurs connection strings
2. **Routing dynamique** → après login, route vers la bonne base d'école
3. **Gestion de configs** → chaque école a ses propres configurations (système de notes, matières, etc.)

---

## 🎯 Fichiers créés (déjà faits)

### Modèles MASTER DB
- `backend/src/models/school.ts` — Registre des écoles (1 ligne = 1 école)
- `backend/src/models/schoolComplex.ts` — Groupes d'écoles (ex: complexe primaire + secondaire)
- `backend/src/models/masterUser.ts` — Admins du platform (super_admin, platform_admin, etc.)
- `backend/src/models/schoolConfig.ts` — Configs par école (système de notes, matières, etc.)

### Logique de routing
- `backend/src/config/dbRouter.ts` — Gestionnaire des connexions MongoDB dynamiques
- `backend/src/middleware/authMultiTenant.ts` — Middlewares pour router l'authentification

### APIs du Master
- `backend/src/controllers/masterAdmin.ts` — Contrôleur pour créer/lister/configurer les écoles
- `backend/src/routes/masterAdmin.ts` — Routes `/api/master/*`

---

## ⚙️ Étapes d'intégration (sans casser l'existant)

### Étape 1: Mise à jour du serveur (AVANT de toucher aux routes existantes)

**Fichier:** `backend/src/server.ts`

Changes:
```typescript
// 1. Importer le dbRouter
import { dbRouter } from "./config/dbRouter.ts";

// 2. Avant connectDB() existant, initialiser la MASTER DB
const initializeAllDatabases = async () => {
  try {
    // Initialise MASTER DB
    const masterUrl = process.env.MASTER_MONGO_URL || process.env.MONGO_URL;
    await dbRouter.initMasterDB(masterUrl);
    
    // La connexion "par défaut" (existante) reste pour le mode simple
    // Cette ligne existante reste inchangée
    await connectDB();
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
};

// 3. Appeler cette fonction au démarrage
connectDB().then(() => {
  initializeAllDatabases().then(() => {
    // Les routes existent ensuite...
  });
});

// 4. Ajouter routes du master AVANT les routes existantes
app.use("/api/master", masterAdminRouter); // NOUVEAU

// Les routes existantes restent inchangées
app.use("/api/users", userRoutes);
// ...
```

### Étape 2: Mettre à jour le JWT pour inclure schoolId

**Fichier:** `backend/src/controllers/user.ts` (lors du login)

Current:
```typescript
const token = jwt.sign(
  { id: user._id },
  process.env.JWT_SECRET as string,
  { expiresIn: "30d" }
);
```

Devient:
```typescript
const token = jwt.sign(
  { 
    id: user._id,
    schoolId: req.headers["x-school-id"], // Depuis header ou session
  },
  process.env.JWT_SECRET as string,
  { expiresIn: "30d" }
);
```

### Étape 3: Migrer progressivement vers protectSchool

**Phase A (court terme - SANS casser l'existant):**
- Garder `protect` middleware existant (sur connexion par défaut)
- Ajouter `protectSchool` pour les nouvelles routes
- Les routes existantes continuent de fonctionner

**Phase B (plus tard - après tests):**
- Migrer progressivement les routes vers `protectSchool`
- Mettre à jour les contrôleurs pour utiliser `req.schoolConnection`

### Étape 4: Variables d'environnement

Ajoute au `.env`:
```env
# Base MASTER (centralisée)
MASTER_MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/edunexus_master

# Base par défaut (pour mode simple école)
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/edunexus_school_1

# JWT secret (existant)
JWT_SECRET=your_secret_key
```

---

## 🚀 Plan d'exécution (Phase 8 pilot)

### Phase 8.1: Setup Master (Semaine 1)
- [ ] Initialiser MASTER_MONGO_URL (nouvelle base)
- [ ] Créer les 2 école pilotes dans MASTER DB (Francophone, Anglophone)
- [ ] Test: `POST /api/master/auth/login` → JWT
- [ ] Test: `GET /api/master/schools` → liste des écoles

### Phase 8.2: Routing dynamique (Semaine 2)
- [ ] Intégrer `dbRouter` au `server.ts`
- [ ] Test: Login utilisateur → JWT avec schoolId
- [ ] Test: Request avec schoolId → router vers bonne base
- [ ] Test: 2 écoles, données isolées

### Phase 8.3: Gestion de configs (Semaine 3)
- [ ] `POST /api/master/schools/{id}/config` → Chaque école a ses propres configs
- [ ] Frontend charge les configs depuis master lors du login
- [ ] UI adapte le rendu selon la config

### Phase 8.4: Complexes scolaires (Semaine 4)
- [ ] Créer 1 complexe test (Primaire + Secondaire)
- [ ] Tester routage vers campus différents
- [ ] Rapport de stabilité

---

## 💾 Données pilot à tester

```json
{
  "masters": [
    {
      "schools": [
        {
          "schoolName": "Lycée Saint-Rémi",
          "systemType": "francophone",
          "structure": "simple",
          "dbName": "edunexus_college_sacre_coeur"
        },
        {
          "schoolName": "Shiloh Academy",
          "systemType": "anglophone",
          "structure": "simple",
          "dbName": "edunexus_shiloh_academy"
        },
        {
          "schoolName": "Collège Bilingue Complexe",
          "systemType": "bilingual",
          "structure": "complex",
          "parentComplex": "ID_COMPLEX_1",
          "dbName": "edunexus_complex_ecole_bilingue"
        }
      ]
    }
  ]
}
```

---

## ⚠️ Points critiques (ne pas oublier)

1. **Connection String par école**
   - Chaque école a sa propre URL MongoDB
   - Stockée chiffrée en MASTER DB
   - Validée au create

2. **Cache des connexions**
   - `dbRouter` maintient un cache pour éviter reconnexions
   - TTL configurable si besoin

3. **Backward compatibility**
   - Routes existantes restent sur `protect` (base simple)
   - Nouvelles routes peuvent utiliser `protectSchool`
   - Pas de breaking change

4. **Timeout connexions**
   - Ajouter heartbeat toutes les 30min pour garder les connexions vivantes
   - Fermer les connexions inutilisées après 1h

---

## 📊 Exemple flux utilisateur

```
1. USER logs in (frontend) → POST /api/users/login
   ✓ Master DB cherche pas (c'est une école unique)
   
2. JWT créé avec schoolId
   ✓ Stocké en httpOnly cookie

3. Requête suivante: GET /api/classes
   ✓ Middleware protectSchool active
   ✓ Lit schoolId du JWT
   ✓ Cherche École en MASTER DB
   ✓ Récupère dbConnectionString
   ✓ Router vers cette base
   ✓ Requête exécutée dans le bon DB

4. Réponse retourne avec données isolées
   ✓ Aucun risque de mélange d'écoles
```

---

## 🔒 Sécurité

- [ ] Chaque schoolId validé avant routage
- [ ] Connection strings **jamais** exposées au frontend
- [ ] JWT signé avec HS512
- [ ] httpOnly cookies obligatoire
- [ ] Audit trail de toute création d'école

---

## ✅ Checklist de validation

- [ ] Master DB initialisée avec 2 écoles
- [ ] Login platform: `/api/master/auth/login`
- [ ] JWT contient schoolId
- [ ] protectSchool route vers bonne base
- [ ] 2 écoles testées sans mélange de données
- [ ] Créer nouvelle école via API
- [ ] Configurer école (matières, système notes)
- [ ] Frontend affiche config par école
- [ ] Pilots FR/EN/Bilingual testées
