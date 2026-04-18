# 🚀 GUIDE COMPLET: Démarrage & Test E2E du Système EDUNEXUS

> **Guide FRANCOPHONE en 3 parties:** Prérequis → Lancer les services → Tester le flux complet

---

## 📋 PARTIE 1: PRÉREQUIS

### 1.1 Logiciels à installer

```bash
# ✅ Bun (runtime JavaScript/TypeScript rapide)
# Windows: Ouvrir PowerShell (Admin) et exécuter:
powershell -c "irm https://bun.sh/install.ps1|iex"

# Vérifier installation:
bun --version
# Doit afficher: bun x.x.x

# ✅ Node.js (pour npm si besoin)
# Télécharger depuis: https://nodejs.org (LTS)
```

### 1.2 Vérifier la configuration existante

Fichier `backend/.env` doit contenir:
```env
PORT=5000
MODE_ENV=development
CLIENT_URL=http://localhost:5173
MASTER_MONGO_URL=mongodb+srv://christoban:HaDqDm4mfXbPJbjs@cluster0.w3slfv8.mongodb.net/edunexus_master?appName=Cluster0
MONGO_URL=mongodb+srv://christoban:HaDqDm4mfXbPJbjs@cluster0.w3slfv8.mongodb.net/edunexusdb?appName=Cluster0
JWT_SECRET="your_jwt_secret_key"
INNGEST_DEV=1
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=edunexus.noreply@gmail.com
SMTP_PASS=pwjothvnfvivpcbq
```

✅ **Votre fichier `.env` est déjà configuré!**

### 1.3 Variables d'environnement clés

| Variable | Valeur | Utilité |
|----------|--------|---------|
| `MASTER_MONGO_URL` | Atlas Cloud | Base de données centrale (écoles, admins platform) |
| `MONGO_URL` | Atlas Cloud | Base par défaut (données transactionnelles) |
| `CLIENT_URL` | `http://localhost:5173` | URL du frontend pour CORS |
| `PORT` | `5000` | Port backend (Express) |
| `INNGEST_DEV` | `1` | Mode développement (logs locaux) |

---

## 🎯 PARTIE 2: LANCER LES SERVICES (L'ORDRE EST IMPORTANT!)

### Étape 1️⃣: Installer les dépendances

```bash
# Terminal 1 - Racine du projet
cd "e:\My long journey towards becoming the best programmer ever by God's Grace\Personal matters\EDUNEXUS"

# Backend
cd backend
bun install
echo "✅ Backend dépendances installées"

# Frontend (depuis racine du projet)
cd ..\frontend
bun install
echo "✅ Frontend dépendances installées"
```

### Étape 2️⃣: Créer le Super Admin (une fois seulement)

```bash
# Terminal 2 - Dans le dossier /backend
cd backend

# Exécuter le script de création du super admin
bun create-admin.ts

# Output attendu:
# ✓ Connected to MASTER DB
# Creating super_admin...
# ✅ Super Admin created:
#    Email: admin@edunexus.fr
#    Password: SecurePassword123!
#    Role: super_admin
# ✓ Database connection closed
```

**✅ Identifiants Super Admin créés:**
- Email: `admin@edunexus.fr`
- Mot de passe: `SecurePassword123!`
- Rôle: `super_admin`

### Étape 3️⃣: Lancer le Backend (Terminal séparé)

```bash
# Terminal 2 - Dans /backend
cd backend

# Lancer avec nodemon (hot reload)
bun run dev

# OU lancer avec bun watch
bun --watch src/server.ts

# Output attendu:
# Server is running on port 5000
# ✓ Multi-tenant architecture enabled
# ✓ MASTER DB initialized
# (puis plein de logs avec morgan)
```

⏳ **Attendre la ligne:** `✓ Multi-tenant architecture enabled`

### Étape 4️⃣: Lancer le Frontend (Terminal séparé)

```bash
# Terminal 3 - Dans /frontend
cd frontend

# Lancer Vite dev server
bun dev

# Output attendu:
# VITE v5.x ready in xxx ms
#
# ➜  Local:   http://localhost:5173/
# ➜  press h to show help
```

### Étape 5️⃣: ℹ️ À propos d'Inngest

**Bonne nouvelle:** Inngest n'a **PAS** besoin d'un serveur séparé!

- C'est un **client** qui exécute les workflows en local (mode DEV)
- `INNGEST_DEV=1` dans `.env` active le mode développement
- Les fonctions Inngest (`generateTimeTable`, `generateExam`, etc.) s'exécutent directement dans le serveur Express

**Pas de commande supplémentaire à lancer!** 🎉

---

## ✅ PARTIE 3: VÉRIFIER QUE TOUT FONCTIONNE

### 3.1 Test de santé du système

Ouvrir le navigateur et copier-coller ces URLs:

| URL | Attendu | Signification |
|-----|---------|---------------|
| `http://localhost:5173` | Page d'accueil affichée | Frontend ok ✅ |
| `http://localhost:5000/` | `{"status": "OK", "message": "Server is healthy"}` | Backend ok ✅ |
| `http://localhost:5173/master/login` | Page login master (noire) | Frontend route ok ✅ |

### 3.2 Test de connexion Master Admin

1. **Aller à:** `http://localhost:5173/master/login`

2. **Saisir:**
   - Email: `admin@edunexus.fr`
   - Mot de passe: `SecurePassword123!`

3. **Cliquer:** "Se connecter"

4. **Résultat attendu:**
   - ✅ Redirection vers `/master/schools` (liste vide pour le moment)
   - ✅ Le token `master_jwt` sauvegardé en cookie

### 3.3 Vérifier la sauvegarde du token

Ouvrir DevTools (F12):
- Onglet **Application** (ou Storage)
- **Cookies** → **localhost:5173**
- Chercher cookie nommé `master_jwt`
- Doit contenir une longue chaîne JWT

---

## 🎬 PARTIE 4: FLUX E2E COMPLET (Pas à pas)

### Scénario: Créer une école → Inviter admin → Activer l'école → Tester suspension

### 🔵 PHASE 1: Super Admin crée une école

**Lieu:** `http://localhost:5173/master/login` (déjà connecté)

**Actions:**
1. Cliquer sur **"+ Ajouter une école"** (ou naviguer à `/master/schools`)
2. Remplir le formulaire:
   - **Nom:** "Lycée Ndiaye Dakar"
   - **Devise:** "Excellence et discipline"
   - **Type de système:** "Francophone"
   - **Structure:** "Simple"
   - **Email:** "contact@ndiayelycee.sn"
   - **Téléphone:** "+221771234567"

3. Cliquer **"Créer l'école"**

**Résultat attendu:**
- ✅ Toast: "École créée avec succès"
- ✅ École apparaît dans la liste `/master/schools`
- ✅ Un **UUID** ou **ID** généré (copier pour suite)

**Exemple d'ID:** `507f1f77bcf86cd799439011`

---

### 🟡 PHASE 2: Super Admin invite un admin d'école

**Lieu:** Detail page de l'école (click sur l'école créée)

**Actions:**
1. Aller à `/master/schools/<SCHOOL_ID>` (détail école)
2. Chercher section **"Lien d'invitation"**
3. Saisir dans le champ:
   - **Nom de l'admin:** "Mamadou Sall"
   - **Email de l'admin:** "mamadou@ndiayelycee.sn"

4. Cliquer **"Générer lien d'invitation"**

**Résultat attendu:**
- ✅ Toast: "Lien d'invitation généré"
- ✅ Un **token d'activation** généré (affiché en modal ou copié)
- ✅ Email envoyé à `mamadou@ndiayelycee.sn` avec le lien (vérifier spam!)

**Format du lien:**
```
http://localhost:5173/onboarding/invite/[TOKEN_LONG]
```

---

### 🟢 PHASE 3: Admin d'école accepte l'invitation (Rôle: Établissement)

**Lieu:** Email reçu ou copier-coller le lien

**Actions:**
1. Cliquer le lien invitation: `http://localhost:5173/onboarding/invite/<TOKEN>`
2. Formulaire d'activation s'affiche:
   - **Nom:** "Mamadou Sall" (pré-rempli)
   - **Email:** "mamadou@ndiayelycee.sn" (pré-rempli)
   - **Mot de passe:** "SecurePassword123!" (nouveau)
   - **Confirmer mot de passe:** "SecurePassword123!"

3. Cliquer **"Créer mon compte"**

**Résultat attendu:**
- ✅ Toast: "Compte créé avec succès"
- ✅ Redirection vers `/dashboard` de l'école
- ✅ Le cookie `jwt` (scolaire) sauvegardé

---

### 🔴 PHASE 4: Super Admin teste les opérations avancées

**Lieu:** Retourner à `/master/schools/<SCHOOL_ID>` (detail page)

#### Test 4.1: Voir l'historique des actions

Chercher section **"Historique des actions"**:
- Doit lister: "Créée l'école", "Généré lien d'invitation", "Admin activé le compte"
- Chaque ligne affiche: date, utilisateur, action

#### Test 4.2: Vérifier le statut d'envoi email

Chercher section **"Dernier lien d'invitation"**:
- **Statut:** "✅ Envoyé"
- **À:** "mamadou@ndiayelycee.sn"
- **Date:** Timestamp du dernier envoi
- Bouton **"Voir le log email complet"** → navigue à `/master/email-history` filtré

#### Test 4.3: Suspendre l'école (avec raison)

1. Chercher **"Suspendre cette école"**
2. Saisir raison: "Non paiement des frais de plateforme - Q2 2026"
3. Cliquer **"Suspendre"**

**Résultat attendu:**
- ✅ École passe `isActive = false`
- ✅ Toast: "École suspendue"
- ✅ La raison sauvegardée en audit trail

#### Test 4.4: Vérifier dans l'audit trail

Section **"Historique des actions"** doit afficher:
```
[Date] Super Admin | ACTION: "Suspendu l'école"
DÉTAILS: "Raison: Non paiement des frais..."
```

#### Test 4.5: Réactiver l'école

1. Chercher **"Réactiver cette école"**
2. Cliquer **"Réactiver"**

**Résultat attendu:**
- ✅ École passe `isActive = true`
- ✅ Nouveau log d'action créé

#### Test 4.6: Regenerer le lien (nouveau token)

1. Chercher **"Régénérer lien d'invitation"**
2. Cliquer

**Résultat attendu:**
- ✅ Ancien token invalidé
- ✅ Nouveau token généré
- ✅ Nouvel email envoyé à mamadou@ndiayelycee.sn
- ✅ Ancien lien `/onboarding/invite/<OLD_TOKEN>` ne fonctionne plus

#### Test 4.7: Renvoyer email (même token)

1. Chercher **"Renvoyer email d'invitation"**
2. Cliquer

**Résultat attendu:**
- ✅ Même token renvoyé
- ✅ Nouvel email avec le MÊME lien

---

### 🟣 PHASE 5: Consulter l'historique des emails du platform

**Lieu:** `http://localhost:5173/master/email-history`

**Vérifier:**
1. Section **"Filtres"** (4 champs):
   - 🔍 Search (cherche dans email/subject)
   - 📧 School ID (dropdown ou texte)
   - ✅ Status ("Envoyé" / "Échoué")
   - 📬 Type d'événement ("school_invite", etc.)

2. **Filtrer par:** Type="school_invite" + School="Lycée Ndiaye"

3. **Résultat attendu:**
   - ✅ Affiche 3 emails: Generate + Resend + Regenerate
   - ✅ Chacun avec: timestamp, status (✅), email, subject
   - ✅ Badge **"Filtres actifs: 3"** visible en haut
   - ✅ Bouton **"Effacer les filtres"** présent

4. **Cliquer "Effacer les filtres":**
   - ✅ Tous les filtres reset à vide
   - ✅ Page recharge avec tous les emails

---

## 🧪 PARTIE 5: TESTER LES ISOLATIONS & MULTI-TENANCY

### Test 5.1: Isolation des données d'écoles

**Terminal - Requête curl:**

```bash
# Login Admin Lycée Ndiaye
curl -X POST "http://localhost:5000/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mamadou@ndiayelycee.sn",
    "password": "SecurePassword123!"
  }' \
  -c cookies.txt

# Récupérer JWT de la réponse, puis:

# Voir les utilisateurs de CETTE école uniquement
curl -X GET "http://localhost:5000/api/users" \
  -b cookies.txt

# Résultat attendu:
# - Voir SEULEMENT Mamadou Sall
# - PAS d'autres écoles
```

### Test 5.2: Accès non autorisé (école != super admin)

L'admin de l'école ne peut **PAS** accéder aux routes master:

```bash
# Copier le JWT école
SCHOOL_JWT="eyJ..." 

# Essayer d'accéder à master schools (DOIT échouer)
curl -X GET "http://localhost:5000/api/master/schools" \
  -H "Authorization: Bearer $SCHOOL_JWT"

# Résultat attendu:
# 401 Unauthorized: "No token, not authorized"
```

---

## 🎓 PARTIE 6: FLUX ÉCOLE (Une fois école activée)

### 6.1: Login école

```
http://localhost:5173/login
```

1. Cliquer sur **"Sélectionner établissement"** (si plusieurs écoles existent)
2. Choisir **"Lycée Ndiaye Dakar"**
3. Email: `mamadou@ndiayelycee.sn`
4. Mot de passe: `SecurePassword123!`
5. **Se connecter**

**Résultat attendu:**
- ✅ Redirection `/dashboard`
- ✅ Voir stats école (nombre élèves, etc.)
- ✅ Menus école (Classes, Exams, Timetables, etc.)

### 6.2: Tester fonctionnalités école

- **Classes:** Créer une classe (6ème A, par exemple)
- **Sujets:** Ajouter matières (Mathématiques, Français)
- **Emploi du temps:** Générer timetable
- **Exams:** Créer un examen

---

## 📊 PARTIE 7: COMMANDES UTILES POUR DÉPANNAGE

### Vérifier que MongoDB fonctionne

```bash
# (Depuis n'importe quel terminal)
# Atlas Dashboard: https://cloud.mongodb.com
# Vérifier connexion:
curl -s http://localhost:5000 | jq .
```

### Voir les logs backend

```bash
# Terminal 2 (où tourne le backend)
# Les logs sont affichés en temps réel
# Chercher: "✓ MASTER DB initialized"
```

### Logs du frontend

```bash
# Terminal 3 (où tourne Vite)
# Chercher: "VITE v5.x ready"
```

### Réinitialiser un cookie de session

```bash
# Dans DevTools (F12):
# Application → Cookies → Supprimer "jwt" ou "master_jwt"
# Puis F5 (refresh)
```

### Créer une nouvelle école via cURL (avancé)

```bash
# 1. Récupérer JWT super admin
MASTER_JWT=$(curl -s -X POST "http://localhost:5000/api/master/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@edunexus.fr","password":"SecurePassword123!"}' \
  | jq -r '.token')

# 2. Créer école
curl -X POST "http://localhost:5000/api/master/schools" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MASTER_JWT" \
  -d '{
    "schoolName": "Collège Saint-Louis",
    "systemType": "Francophone",
    "structure": "simple",
    "dbName": "edunexus_college",
    "dbConnectionString": "mongodb+srv://..."
  }'
```

---

## ✨ RÉSUMÉ: LES 3 SERVICES À LANCER

| Service | Commande | Terminal | Port | URL |
|---------|----------|----------|------|-----|
| **Backend** | `cd backend && bun run dev` | 2 | 5000 | http://localhost:5000 |
| **Frontend** | `cd frontend && bun dev` | 3 | 5173 | http://localhost:5173 |
| **Inngest** | *(Inclus dans Backend)* | - | - | - |

---

## 🎯 CHECKLIST FINAL

- [ ] `bun install` dans `/backend`
- [ ] `bun install` dans `/frontend`
- [ ] `bun create-admin.ts` dans `/backend`
- [ ] Backend lancé (`http://localhost:5000` répond ✅)
- [ ] Frontend lancé (`http://localhost:5173` s'affiche ✅)
- [ ] Login master ok: `admin@edunexus.fr` / `SecurePassword123!`
- [ ] Créer école test
- [ ] Générer lien invitation
- [ ] Activer admin école via lien
- [ ] Voir audit trail
- [ ] Tester suspension/réactivation
- [ ] Voir email history
- [ ] Tester isolation données

---

## 📞 En cas de problème

| Problème | Solution |
|----------|----------|
| "Cannot find bun" | Relancer PowerShell après installation |
| "Port 5000 déjà utilisé" | `netstat -ano \| find "5000"` puis tuer processus |
| "CORS error" | Vérifier `CLIENT_URL` dans `.env` = `http://localhost:5173` |
| "MongoDB connection failed" | Vérifier VPN/Firewall, IP Whitelist dans Atlas |
| "Token invalide" | Supprimer cookies (DevTools) et relancer login |

---

**🚀 Bon test!** Laisse moi un message si tu rencontres des problèmes!
