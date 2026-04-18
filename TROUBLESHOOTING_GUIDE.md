# 🔧 TROUBLESHOOTING & DEBUGGING GUIDE

> **Problèmes courants et solutions rapides**

---

## 🚨 PROBLÈMES AU DÉMARRAGE

### Problème 1: "Command not found: bun"

**Symptôme:**
```
'bun' n'est pas reconnu comme commande interne...
```

**Cause:** Bun pas installé ou PATH pas mis à jour

**Solution:**
```powershell
# 1. Réinstaller Bun
irm https://bun.sh/install.ps1 | iex

# 2. Fermer et réouvrir PowerShell (pour recharger PATH)

# 3. Vérifier
bun --version
# Doit afficher: bun x.x.x
```

---

### Problème 2: "Port 5000 already in use"

**Symptôme:**
```
Error: listen EADDRINUSE :::5000
```

**Cause:** Un autre processus utilise déjà le port 5000

**Solution:**
```powershell
# 1. Trouver le processus sur port 5000
netstat -ano | findstr "5000"

# Résultat ex:
# TCP    0.0.0.0:5000     0.0.0.0:0         LISTENING       12345

# 2. Tuer le processus
taskkill /PID 12345 /F

# 3. Relancer backend
bun run dev
```

**Alternative:** Changer le port
```powershell
# Dans backend/.env
PORT=5001

# Relancer backend
bun run dev

# Mettre à jour frontend pour utiliser 5001
# Dans frontend/.env ou frontend/src/lib/api.ts
VITE_API_BASE_URL=http://localhost:5001/api
```

---

### Problème 3: "Port 5173 already in use"

**Symptôme:**
```
Port 5173 is in use, trying 5174...
```

**Solution:**
```powershell
# 1. Trouver le processus
netstat -ano | findstr "5173"

# 2. Tuer
taskkill /PID <PID> /F

# 3. Relancer
bun dev
```

---

### Problème 4: "CORS error" lors appel API

**Symptôme (Console F12):**
```
Access to XMLHttpRequest at 'http://localhost:5000/api/...'
from origin 'http://localhost:5173' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present...
```

**Cause:** `CLIENT_URL` dans `.env` ne correspond pas à l'URL frontend

**Solution:**
```powershell
# 1. Ouvrir backend/.env

# 2. Vérifier ligne:
CLIENT_URL=http://localhost:5173

# 3. Si port frontend différent, adapter:
CLIENT_URL=http://localhost:5174  # (si vite utilise 5174)

# 4. Redémarrer backend
bun run dev

# 5. Rafraîchir navigateur (F5) et retry
```

---

## 🌐 PROBLÈMES DE CONNECTIVITÉ

### Problème 5: "MongoDB connection failed"

**Symptôme (Backend logs):**
```
Error: getaddrinfo ENOTFOUND cluster0.w3slfv8.mongodb.net
```

**Cause:** 
- VPN not connected
- Network issue
- IP Whitelist problem
- Connection string wrong

**Solution:**

**5.1: Vérifier Internet**
```powershell
# Test connectivité
ping google.com
# Doit répondre
```

**5.2: Vérifier IP Whitelisted dans MongoDB Atlas**
```
1. Aller à: https://cloud.mongodb.com/
2. Projet → Network Access
3. Chercher votre IP (0.0.0.0/0 = all IPs)
4. Si pas visible, ajouter

Pour dev: Peut mettre 0.0.0.0/0 (pas sécurisé, dev seulement!)
```

**5.3: Tester connection string directement**
```powershell
# Installer mongosh (MongoDB Shell)
# Télécharger depuis: https://www.mongodb.com/try/download/shell

# Tester connexion
mongosh "mongodb+srv://christoban:HaDqDm4mfXbPJbjs@cluster0.w3slfv8.mongodb.net/edunexus_master?appName=Cluster0"

# Si réussit:
> db.version()
# Doit retourner version MongoDB
```

**5.4: Vérifier `.env` variables**
```powershell
# Dans backend/.env, vérifier:
MASTER_MONGO_URL=mongodb+srv://christoban:...
MONGO_URL=mongodb+srv://christoban:...

# Pas d'espaces extras!
# Pas de guillemets autour (sauf si variables spécialisées)
```

**5.5: Si toujours erreur, test curl**
```powershell
# Depuis Terminal avec MongoDB shell
# Essayer ping simple
mongosh --eval "db.version()" --uri "mongodb+srv://christoban:HaDqDm4mfXbPJbjs@cluster0.w3slfv8.mongodb.net/edunexus_master"
```

---

### Problème 6: "SSL/TLS certificate issue"

**Symptôme:**
```
Error: certificate verify failed
```

**Cause:** Certificate hostname mismatch (rare)

**Solution:**
```powershell
# 1. Vérifier connection string contient bon cluster
# Doit être: cluster0.w3slfv8.mongodb.net

# 2. Si sur réseau corporate avec proxy, peut nécessiter:
MONGO_URL="mongodb+srv://...?tls=true&tlsCAFile=/path/to/ca.pem"

# 3. Pour dev, peut désactiver (NOT FOR PRODUCTION):
MONGO_URL="mongodb+srv://...?tls=false"
```

---

## 👤 PROBLÈMES D'AUTHENTIFICATION

### Problème 7: "Invalid credentials" au login master

**Symptôme:**
```json
{ "message": "Invalid credentials" }
```

**Cause:** Email ou password incorrect

**Solution:**

**7.1: Vérifier credentials**
```
Email: admin@edunexus.fr (exact!)
Password: SecurePassword123! (case-sensitive!)
```

**7.2: Vérifier super admin existe dans DB**
```powershell
# Relancer creation (supprime ancien et crée nouveau)
bun create-admin.ts

# Output doit être:
# ✅ Super Admin created:
#    Email: admin@edunexus.fr
#    Password: SecurePassword123!
```

**7.3: Vérifier hash password OK**
```powershell
# Si erreur lors create:
# Vérifier bcryptjs version dans package.json
# Doit avoir: "@types/bcryptjs": "^3.0.0", "bcryptjs": "^3.0.3"

# Si absent:
bun add bcryptjs @types/bcryptjs

# Relancer create
bun create-admin.ts
```

---

### Problème 8: "No token, not authorized" même après login

**Symptôme:**
```json
{ "message": "No token, not authorized" }
```

**Cause:** Cookie pas sauvegardé

**Solution:**

**8.1: Vérifier cookies activés**
```
F12 → Settings (gear icon)
Chercher: "Disable cache (while DevTools open)"
Décocher (laisse cookies)
```

**8.2: Vérifier cookie sauvegardé**
```
F12 → Application → Cookies → localhost:5173
Chercher: "master_jwt" ou "jwt"
Doit exister avec valeur longue
```

**8.3: Si cookie pas là après login:**
```powershell
# Vérifier backend logs (Terminal 2)
# Chercher: "Master login successful" ou erreur

# Vérifier backend envoie cookie:
# Dans backend/src/controllers/masterAdmin.ts
# Doit avoir: res.cookie("master_jwt", token, {...})
```

**8.4: Si cookies pas persistent:**
```
Cause probable: HTTPS issue (dev localhost = HTTP, OK)

Si sur HTTPS production:
→ Vérifier secure: true dans cookie config
→ Vérifier sameSite: "strict" OU "lax"
```

---

### Problème 9: "Token invalid or expired" après login

**Symptôme:**
```json
{ "message": "Not authorized" }
ou page redirect vers login
```

**Cause:** JWT expiré (30 jours) OU invalide

**Solution:**

**9.1: Supprimer et relancer login**
```
F12 → Application → Cookies
Supprimer: "jwt" et "master_jwt"
Refresh (F5)
Redirect vers /login
Login à nouveau
```

**9.2: Vérifier JWT_SECRET dans .env**
```
Backend .env:
JWT_SECRET="your_jwt_secret_key"

Si changé après création token:
→ Vieux tokens deviennent invalides
→ Nécessite relancer login
```

**9.3: Vérifier heure serveur**
```powershell
# JWT a un timestamp d'expiration
# Si heure système décalée, peut causer problème

# Vérifier heure Windows
date /t
time /t

# Vérifier heure serveur est ok:
curl -I https://www.google.com
# Voir Date header
```

---

## 📧 PROBLÈMES EMAIL

### Problème 10: "Email not received"

**Symptôme:**
```
Invitation générée, mais email pas reçu dans boîte
```

**Cause:** 
- SMTP config incorrecte
- Email en SPAM
- Firewall bloque port 587

**Solution:**

**10.1: Vérifier SMTP config dans .env**
```powershell
# backend/.env doit avoir:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=edunexus.noreply@gmail.com
SMTP_PASS=pwjothvnfvivpcbq
SMTP_FROM=edunexus.noreply@gmail.com
SMTP_FROM_NAME=EDUNEXUS Education
```

**10.2: Vérifier logs email dans backend**
```powershell
# Terminal 2 (où tourne backend)
# Lors de génération invitation, chercher logs:

# Si réussi:
# Email sent to mamadou@ndiayelycee.sn

# Si erreur:
# Error sending email: ...
```

**10.3: Vérifier email en SPAM**
```
Gmail → Spam
Chercher "EDUNEXUS" OU "mamadou"
Si trouvé → Marquer "Not Spam"
```

**10.4: Vérifier Gmail App Password**
```
Si compte Gmail a 2FA, besoin "App Password":

1. Aller à: https://myaccount.google.com/apppasswords
2. Chercher: edunexus.noreply@gmail.com
3. Générer nouveau token (si pas existe)
4. Copier dans SMTP_PASS du .env
```

**10.5: Tester SMTP directement**
```powershell
# Créer script test-email.ts
# (Voir section SCRIPTS ci-bas)

bun test-email.ts
```

---

### Problème 11: "530 5.7.0 Must issue a STARTTLS command"

**Symptôme (Backend logs):**
```
Error: 530 5.7.0 Must issue a STARTTLS command first
```

**Cause:** SMTP config manque TLS

**Solution:**
```typescript
// Dans backend/src/services/emailService.ts ou config email:

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,  // ← IMPORTANT: false pour port 587 (TLS)
  // Si port 465: secure: true (SSL)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
```

---

## 🗄️ PROBLÈMES BASE DE DONNÉES

### Problème 12: "School not found" lors création invitation

**Symptôme:**
```json
{ "message": "School not found" }
```

**Cause:** School ID invalide OU école pas créée

**Solution:**

**12.1: Vérifier School ID**
```
URL doit avoir format valide:
http://localhost:5173/master/schools/507f1f77bcf86cd799439011

Pas:
http://localhost:5173/master/schools/invalid-id
```

**12.2: Vérifier école existe dans MASTER DB**
```powershell
# Utiliser MongoDB Compass ou mongosh:
mongosh "connection_string"

# Dans shell:
use edunexus_master
db.schools.find({})

# Doit lister écoles créées
```

**12.3: Vérifier collections créées**
```
MASTER DB doit avoir collections:
- schools
- schoolinvites
- activitieslog
- emaillogs
- masterusers

Si manquantes:
→ Créer manuellement (MongoDB crée auto en premier insert)
```

---

### Problème 13: "Duplicate key error" sur SchoolInvite

**Symptôme (Backend logs):**
```
E11000 duplicate key error collection: edunexus_master.schoolinvites...
```

**Cause:** Token uniqueness violation (rare)

**Solution:**
```powershell
# 1. Supprimer invites invalides
mongosh "connection_string"
use edunexus_master
db.schoolinvites.deleteMany({ status: "expired" })

# 2. Relancer invitation
```

---

### Problème 14: "School already exists"

**Symptôme:**
```json
{ "message": "School already exists" }
```

**Cause:** Duplicate check ou unique constraint

**Solution:**
```powershell
# Chercher écoles doublons dans DB
mongosh "connection_string"
use edunexus_master
db.schools.find({ schoolName: "Lycée Ndiaye" })

# Si 2+ retournés:
# Supprimer le doublon
db.schools.deleteOne({ _id: ObjectId("...") })

# Relancer création
```

---

## 🎨 PROBLÈMES FRONTEND

### Problème 15: "Blank page" au lancement

**Symptôme:**
```
http://localhost:5173/ → page blanche
Console F12: erreurs diverses
```

**Cause:** Build erreur OU dependency issue

**Solution:**

**15.1: Vérifier erreurs console**
```
F12 → Console tab
Chercher messages rouges
Screenshot ou copier erreur exacte
```

**15.2: Réinstaller dependencies**
```powershell
cd frontend
rm -r node_modules
bun install
bun dev
```

**15.3: Vider cache Vite**
```powershell
cd frontend
rm -r .vite
bun dev
```

**15.4: Vérifier TypeScript errors**
```powershell
cd frontend
bun x tsc --noEmit

# Doit retourner: no errors
# Si erreurs, corriger
```

---

### Problème 16: "Component not rendering"

**Symptôme:**
```
Page loadée mais composant pas visible
```

**Solution:**

**16.1: Vérifier console F12**
```
F12 → Console
Chercher erreurs React
```

**16.2: Vérifier CSS imported**
```
F12 → Elements
Chercher classe (ex: className="flex")
Si couleur rouge ou strikethrough:
→ CSS pas appliqué
→ Vérifier import tailwind
```

**16.3: Vérifier useState hooks**
```typescript
// Chercher dans composant:
const [state, setState] = useState(...)

// Si non-initialized, peut causer issues
```

---

### Problème 17: "404 on route"

**Symptôme:**
```
http://localhost:5173/master/schools → 404
```

**Cause:** Route pas enregistrée OU chemin typo

**Solution:**

**17.1: Vérifier router.tsx**
```typescript
// frontend/src/pages/routes/router.tsx
// Chercher ligne:
{ path: "master/schools", element: <MasterSchoolsPage /> }

// Doit être présent
```

**17.2: Vérifier component existe**
```
Fichier doit exister:
frontend/src/pages/master/MasterSchools.tsx

Si pas existe: Créer
```

**17.3: Vérifier path exact**
```
Si route: "master/schools"
URL: http://localhost:5173/master/schools ✅

PAS:
http://localhost:5173/master/school (pas de s)
http://localhost:5173/masterSchools (camelCase)
```

---

## 🔍 PROBLÈMES DE PERFORMANCE

### Problème 18: "Page very slow to load"

**Symptôme:**
```
Clic → 5-10 secondes avant réaction
```

**Cause:** API slow OU Network slow

**Solution:**

**18.1: Vérifier Network tab (F12)**
```
F12 → Network
Faire action (clic, navigation)
Voir quel endpoint est lent

Si requête > 3s:
→ Backend slow
→ Database slow
→ Network issue
```

**18.2: Vérifier Backend logs**
```
Terminal 2 (backend)
Chercher logs pour requête lente:

Exemple:
POST /api/master/schools:... 2543ms

Si >> 1 seconde:
→ Vérifier MongoDB latency
→ Vérifier logs DB
```

**18.3: Vérifier Internet latency**
```powershell
ping cluster0.w3slfv8.mongodb.net
# Doit être < 100ms (local network)

Si >> 500ms:
→ Network issue
→ Peut être normal si far from server
```

---

### Problème 19: "Memory leak" ou "App crashes"

**Symptôme:**
```
Après 30 min: Frontend freezes
OU Backend process dies
```

**Cause:** Memory leak en code

**Solution:**

**19.1: Vérifier Backend memory (Terminal 2)**
```
Chercher si logs arrêtent soudain
→ Peut être crash

Relancer:
bun run dev
```

**19.2: Vérifier useEffect cleanup**
```typescript
// frontend/src/pages/MasterEmailHistory.tsx
// Tout useEffect doit avoir cleanup:

useEffect(() => {
  // Logic
  return () => {
    // Cleanup: abort requests, clear timeouts, etc.
  };
}, [dependencies]);
```

**19.3: Vérifier event listeners removed**
```typescript
// Must remove listeners:
useEffect(() => {
  window.addEventListener("resize", handler);
  return () => window.removeEventListener("resize", handler);
}, []);
```

---

## 🔒 PROBLÈMES DE SÉCURITÉ

### Problème 20: "CSRF error" OU "Invalid token"

**Symptôme:**
```json
{ "message": "Invalid CSRF token" }
```

**Cause:** Token CSRF malformed OU expired

**Note:** EDUNEXUS utilise httpOnly cookies (good!)

**Solution:**
```powershell
# Supprimer cookies et relancer login
# (Voir Problème 9)
```

---

### Problème 21: "Access denied to protected route"

**Symptôme:**
```json
{ "message": "Not authorized" }
```

**Cause:** Permissions insuffisantes OU JWT expiré

**Solution:**

**21.1: Vérifier role utilisateur**
```
Si endpoint nécessite: super_admin
Mais user est: admin

→ 403 Forbidden est correct
→ Utiliser bon user
```

**21.2: Relancer login avec bon role**
```
Super admin: admin@edunexus.fr
Admin école: mamadou@ndiayelycee.sn
```

---

## 📋 SCRIPT DE TEST RAPIDE

### Test-Email.ts (Test SMTP)

```typescript
// backend/test-email.ts
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendTest = async () => {
  try {
    const info = await transporter.sendMail({
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM}>`,
      to: "testrecipient@gmail.com",  // Change this
      subject: "Test Email from EDUNEXUS",
      html: "<h1>Test email works!</h1>",
    });

    console.log("✅ Email sent:", info.messageId);
  } catch (error) {
    console.error("❌ Email error:", error);
  }
};

sendTest();
```

**Lancer:**
```powershell
bun test-email.ts
```

---

## 🆘 DERNIER RECOURS: RESET COMPLET

Si rien marche:

```powershell
# 1. Tuer tous les processus
taskkill /IM node.exe /F
taskkill /IM bun.exe /F

# 2. Supprimer node_modules
cd backend && rm -r node_modules
cd ../frontend && rm -r node_modules

# 3. Réinstaller
cd backend && bun install
cd ../frontend && bun install

# 4. Vider DB (⚠️ Data loss!)
# Aller à MongoDB Atlas et supprimer écoles test

# 5. Relancer création admin
cd backend
bun create-admin.ts

# 6. Relancer services
Terminal 2: bun run dev (backend)
Terminal 3: bun dev (frontend)
```

---

## 📞 DEBUGGING ADVANCED

### Activer Verbose Logging

**Backend:**
```typescript
// Dans backend/src/server.ts, changez:
if (process.env.STAGE === "development") {
  app.use(morgan("dev"));  // ← Change "dev" to "combined"
}
// Combined = plus de détails
```

**MongoDB:**
```typescript
// Dans backend/src/config/db.ts:
mongoose.set("debug", true);  // ← Affiche toutes requêtes
```

**Frontend:**
```typescript
// Dans frontend/src/lib/api.ts:
console.log("API Request:", {
  method: config.method,
  url: config.url,
  data: config.data,
});
```

---

## 📊 HEALTH CHECK DASHBOARD

Créer un endpoint santé complet:

```typescript
// backend/src/routes/health.ts
app.get("/health", async (req, res) => {
  const health = {
    uptime: process.uptime(),
    mongodb: "checking...",
    redis: "checking...",
    timestamp: new Date(),
  };

  try {
    const dbCheck = await mongoose.connection.db?.admin().ping();
    health.mongodb = dbCheck ? "ok" : "down";
  } catch (e) {
    health.mongodb = "down";
  }

  res.json(health);
});
```

**Test:**
```
http://localhost:5000/health
```

---

**Still stuck? Check logs files or contact support with:**
1. Erreur exacte (copier-coller)
2. Logs pertinents (backend + frontend)
3. Steps for reproduction
4. OS + node version
