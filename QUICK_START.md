# ⚡ QUICK START - Commandes à copier-coller

## 🏃 5 MINUTES POUR DÉMARRER

### Terminal 1: Installation des dépendances
```powershell
cd "e:\My long journey towards becoming the best programmer ever by God's Grace\Personal matters\EDUNEXUS"
cd backend
bun install
cd ..\frontend
bun install
cd ..\backend
```

### Terminal 1: Créer le Super Admin (1x seulement)
```powershell
bun create-admin.ts
```

**Résultat:**
```
✅ Super Admin created:
   Email: admin@edunexus.fr
   Password: SecurePassword123!
```

### Terminal 2: Lancer le Backend
```powershell
cd backend
bun run dev
```

**Attendre cette ligne:**
```
Server is running on port 5000
✓ Multi-tenant architecture enabled
✓ MASTER DB initialized
```

### Terminal 3: Lancer le Frontend
```powershell
cd frontend
bun dev
```

**Attendre cette ligne:**
```
➜  Local:   http://localhost:5173/
```

---

## 🔗 LES URLS PRINCIPALES

### Frontend
```
http://localhost:5173/                    → Page d'accueil
http://localhost:5173/master/login        → Login super admin
http://localhost:5173/master/schools      → Liste écoles
http://localhost:5173/master/schools/<ID> → Détail école
http://localhost:5173/master/email-history → Historique emails
http://localhost:5173/login               → Login école
http://localhost:5173/onboarding/school   → Créer école (candidat)
```

### Backend (Health Check)
```
http://localhost:5000/                    → Santé serveur
http://localhost:5000/api/master/schools  → Liste écoles (API)
```

---

## 👤 IDENTIFIANTS SUPER ADMIN

```
Email:    admin@edunexus.fr
Password: SecurePassword123!
```

---

## 🧪 FLUX RAPIDE DE TEST

### 1️⃣ Login Master
```
URL: http://localhost:5173/master/login
Email: admin@edunexus.fr
Password: SecurePassword123!
```

### 2️⃣ Créer une école
```
URL: http://localhost:5173/master/schools
Click: "+ Ajouter une école"
Remplir:
  - Nom: "Mon École"
  - Devise: "Excellence"
  - Type: "Francophone"
  - Email: "contact@monecole.sn"
```

### 3️⃣ Générer lien invitation
```
URL: http://localhost:5173/master/schools/<ID_COLE>
Remplir:
  - Nom admin: "Mamadou"
  - Email admin: "mamadou@monecole.sn"
Click: "Générer lien"
```

### 4️⃣ Activer école (Rôle: Admin école)
```
Copier le lien reçu par email
URL: http://localhost:5173/onboarding/invite/<TOKEN>
Remplir:
  - Email: mamadou@monecole.sn
  - Mot de passe: SecurePassword123!
Click: "Créer mon compte"
```

### 5️⃣ Vérifier audit trail
```
URL: http://localhost:5173/master/schools/<ID_COLE>
Section: "Historique des actions"
Vérifier: Tous les actions logged
```

### 6️⃣ Voir emails du platform
```
URL: http://localhost:5173/master/email-history
Filtrer par: Type="school_invite"
Vérifier: Badge "Filtres actifs: 1"
```

---

## 🛑 PROBLÈMES COURANTS

### Backend ne démarre pas
```powershell
# Tuer le port 5000
netstat -ano | Select-String "5000"
taskkill /PID <PID> /F

# Relancer
bun run dev
```

### CORS Error
```
Vérifier .env:
CLIENT_URL=http://localhost:5173
```

### Pas d'email reçu
```
Regarder les logs du backend
Console terminal 2 doit afficher les logs d'email
```

### Port 5173 déjà utilisé
```powershell
# Tuer le port 5173
netstat -ano | Select-String "5173"
taskkill /PID <PID> /F

# Relancer frontend
bun dev
```

---

## 📝 NOTES

- **Inngest:** Pas besoin de lancer séparément (c'est un client inclus dans le backend)
- **MongoDB:** Déjà configuré sur le Cloud (Atlas) via `.env`
- **SMTP:** Déjà configuré (emails vrais envoyés à Gmail)
- **JWT:** Automatiquement sauvegardé en cookie httpOnly

---

## 🔐 FLUX D'AUTHENTIFICATION

### Super Admin (Master DB)
```
Login: http://localhost:5173/master/login
Cookie: master_jwt
JWT Token: Contient email, role, id
```

### Admin École (École DB)
```
Login: http://localhost:5173/login
Cookie: jwt
JWT Token: Contient email, schoolId, id
```

---

## 📊 BASES DE DONNÉES

| DB | Contenu | URL |
|----|---------|-----|
| `edunexus_master` | Écoles, Admins platform, Invitations | MASTER_MONGO_URL |
| `edunexusdb` | Défaut (peut servir pour test) | MONGO_URL |
| `edunexus_<schoolname>` | Données de chaque école | Créée automatiquement |

---

## 🎓 ROLES

| Role | Accès | Créé via |
|------|-------|----------|
| `super_admin` | Master admin complet | `bun create-admin.ts` |
| `platform_admin` | Master admin limité | Créé par super_admin |
| `school_manager` | Manager une école | Créé par super_admin |
| `support` | Support technique | Créé par super_admin |
| Admin école | Dashboard école | Lien invitation |

---

## 🚀 C'EST PRÊT!

Tu peux maintenant:
1. ✅ Lancer backend + frontend
2. ✅ Tester l'authentification master
3. ✅ Créer des écoles
4. ✅ Inviter des admins
5. ✅ Activer des écoles
6. ✅ Vérifier les logs
7. ✅ Tester la suspension/réactivation

**Bon test! 🎉**
