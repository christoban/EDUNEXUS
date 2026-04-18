# ✅ CHECKLIST TEST E2E INTERACTIF

> **Guide pas à pas avec checkboxes pour valider chaque étape**

---

## 📋 PART 1: SETUP INITIAL (One-Time)

### 1.1 Installer Bun
```
[ ] Bun installé (commande: bun --version)
[ ] Version affichée: x.x.x
```

### 1.2 Vérifier .env
```
[ ] Fichier backend/.env existe
[ ] Contient: MASTER_MONGO_URL (MongoDB Atlas)
[ ] Contient: MONGO_URL (MongoDB Atlas)
[ ] Contient: CLIENT_URL=http://localhost:5173
[ ] Contient: JWT_SECRET (valeur quelconque)
[ ] Contient: INNGEST_DEV=1
[ ] Contient: SMTP_HOST, SMTP_PORT, SMTP_USER
```

### 1.3 Installer dépendances
```
[ ] cd backend && bun install
    ✓ Affiche: "added X packages, Y packages removed..."
    
[ ] cd ../frontend && bun install
    ✓ Affiche: "added X packages, Y packages removed..."
```

### 1.4 Créer Super Admin
```
[ ] cd backend && bun create-admin.ts
    ✓ Output: "✅ Super Admin created"
    ✓ Email: admin@edunexus.fr
    ✓ Password: SecurePassword123!
    ✓ Output: "✓ Database connection closed"
```

---

## 🎯 PART 2: LANCER LES SERVICES (Order Matters!)

### 2.1 Terminal 2: Lancer Backend
```
[ ] cd backend
[ ] bun run dev (ou: bun --watch src/server.ts)
    
    ✓ Attendre: "Server is running on port 5000"
    ✓ Attendre: "✓ Multi-tenant architecture enabled"
    ✓ Attendre: "✓ MASTER DB initialized"
    ✓ Logs HTTP affichés (morgan logs)
    
    Si ERREUR:
    [ ] Vérifier port 5000 pas utilisé (netstat -ano | find "5000")
    [ ] Vérifier .env variables
    [ ] Vérifier connexion MongoDB (VPN/Firewall)
```

### 2.2 Terminal 3: Lancer Frontend
```
[ ] cd frontend
[ ] bun dev
    
    ✓ Attendre: "VITE v5.x ready in XXXms"
    ✓ Attendre: "➜  Local:   http://localhost:5173/"
    ✓ Logs affichés
    
    Si ERREUR:
    [ ] Vérifier port 5173 pas utilisé (netstat -ano | find "5173")
    [ ] Effacer cache Vite: rm -r .vite/ && bun dev
```

### 2.3 Vérifier Santé
```
[ ] Ouvrir http://localhost:5000/ dans navigateur
    ✓ Retourne JSON: {"status": "OK", "message": "Server is healthy"}
    
[ ] Ouvrir http://localhost:5173/ dans navigateur
    ✓ Page d'accueil EDUNEXUS affichée
    ✓ Pas d'erreurs console (F12)
```

---

## 👤 PART 3: AUTHENTIFICATION MASTER

### 3.1 Accéder à Master Login
```
[ ] URL: http://localhost:5173/master/login
    ✓ Page affichée (background noir, formulaire blanc)
    ✓ 2 champs: Email + Password
```

### 3.2 Se Connecter Super Admin
```
[ ] Email: admin@edunexus.fr (copier-coller)
[ ] Password: SecurePassword123! (copier-coller)
[ ] Cliquer "Se connecter"
    ✓ Toast: "Connexion réussie" (vert)
    ✓ Redirection automatique
    
    Si ERREUR:
    [ ] Vérifier credentials exactement
    [ ] Ouvrir DevTools (F12) → Console
    [ ] Chercher erreur (401, 403, 500)
    [ ] Vérifier Backend logs (Terminal 2)
```

### 3.3 Vérifier JWT Sauvegardé
```
[ ] F12 → Application → Cookies → localhost:5173
    ✓ Cookie "master_jwt" existe
    ✓ Valeur: longue chaîne (JWT token)
    ✓ HttpOnly: checked
    ✓ Secure: unchecked (local dev)
```

### 3.4 Vérifier Page Master
```
[ ] URL actuelle: http://localhost:5173/master/schools
    ✓ Page "Liste des écoles" affichée
    ✓ Tableau vide (aucune école créée)
    ✓ Bouton "+ Ajouter une école" visible
```

---

## 🏫 PART 4: CRÉER UNE ÉCOLE

### 4.1 Naviguer au formulaire
```
[ ] Cliquer "+ Ajouter une école"
    ✓ Modal ou page de création s'ouvre
    ✓ Formulaire avec champs visibles
```

### 4.2 Remplir le formulaire
```
Champ: Nom de l'école
[ ] Saisir: "Lycée Ndiaye Dakar"

Champ: Devise/Motto
[ ] Saisir: "Excellence et discipline"

Champ: Type de système
[ ] Sélectionner: "Francophone" (ou "Bilingual")

Champ: Structure
[ ] Sélectionner: "Simple"

Champ: Email
[ ] Saisir: "contact@lycee.sn"

Champ: Téléphone
[ ] Saisir: "+221771234567"

Champs optionnels:
[ ] Année fondation: 2000 (optionnel)
[ ] Localisation: "Dakar, Senegal" (optionnel)
```

### 4.3 Soumettre
```
[ ] Cliquer "Créer l'école"
    ✓ Toast: "École créée avec succès" (vert)
    ✓ Redirection vers detail page OR liste
    
    Si ERREUR:
    [ ] Vérifier tous champs requis remplis
    [ ] Vérifier Backend logs (Terminal 2)
    [ ] Chercher erreur 400/500
```

### 4.4 Récupérer School ID
```
[ ] URL de detail: http://localhost:5173/master/schools/<SCHOOL_ID>
    [ ] Copier le SCHOOL_ID (UUID long)
    [ ] Sauvegarder dans un document texte pour suite
    
    Format ID: 507f1f77bcf86cd799439011 (ou GUID)
```

### 4.5 Vérifier dans liste
```
[ ] Naviguer vers http://localhost:5173/master/schools
    ✓ "Lycée Ndiaye Dakar" apparaît dans tableau
    ✓ Status: "pending" OU "active" (selon config)
    ✓ Email: "contact@lycee.sn" visible
```

---

## 💌 PART 5: GÉNÉRER LIEN INVITATION

### 5.1 Ouvrir Detail École
```
[ ] Cliquer sur "Lycée Ndiaye Dakar" dans liste
    ✓ Page detail affichée
    ✓ URL: http://localhost:5173/master/schools/<SCHOOL_ID>
    ✓ Info école affichée: nom, devise, email, etc.
```

### 5.2 Chercher section Invitation
```
[ ] Scroller vers bas page
    ✓ Chercher section: "Lien d'invitation" OU "Invitation Admin"
    ✓ 2 champs visible:
       - "Nom de l'admin": input text
       - "Email de l'admin": input email
    ✓ Bouton: "Générer lien" OU "Créer invitation"
```

### 5.3 Remplir Info Admin
```
Champ: Nom de l'admin
[ ] Saisir: "Mamadou Sall"

Champ: Email de l'admin
[ ] Saisir: "mamadou@ndiayelycee.sn"
```

### 5.4 Générer Lien
```
[ ] Cliquer "Générer lien"
    ✓ Toast: "Lien d'invitation généré" (vert)
    ✓ Token affiché en modal OU copié automatiquement
    ✓ Format: lien complet "http://localhost:5173/onboarding/invite/<TOKEN>"
    
    [ ] Copier le TOKEN complet (ou lien entier)
    [ ] Sauvegarder pour étape suivante
```

### 5.5 Vérifier Email Envoyé
```
[ ] Ouvrir Gmail (en mode incognito ou nouveau navigateur)
    ✓ Inbox "edunexus.noreply@gmail.com"
    ✓ Email reçu dans "mamadou@ndiayelycee.sn" (ou spam)
    ✓ Sujet: "Invitation EDUNEXUS - Lycée Ndiaye Dakar"
    ✓ Body contient: lien d'activation
    
    Si NO EMAIL:
    [ ] Vérifier .env SMTP config
    [ ] Regarder Backend logs pour erreur SMTP
    [ ] Copier le lien manuellement (de la modal générée)
```

### 5.6 Vérifier Historique Actions
```
[ ] Toujours sur page detail école
    [ ] Chercher section: "Historique des actions" OU "Activity Log"
    ✓ Affiche: "Généré lien d'invitation"
    ✓ Utilisateur: "Super Admin" (ou admin@edunexus.fr)
    ✓ Timestamp: présent
```

---

## 🟢 PART 6: ACTIVER ÉCOLE (Rôle: Admin École)

### 6.1 Accéder au Lien Invitation
```
[ ] URL: http://localhost:5173/onboarding/invite/<TOKEN>
    
    (Copier le TOKEN de l'étape 5.4)
    
    ✓ Page "Activation Compte" affichée
    ✓ Formulaire visible avec champs pré-remplis
```

### 6.2 Vérifier Info Pré-Remplie
```
[ ] Champ "Nom": "Mamadou Sall" (pré-rempli)
    ✓ Correctement rempli
    
[ ] Champ "Email": "mamadou@ndiayelycee.sn" (pré-rempli)
    ✓ Correctement rempli
```

### 6.3 Remplir Mot de Passe
```
[ ] Champ "Mot de passe": Saisir "SecurePassword123!"

[ ] Champ "Confirmer mot de passe": Saisir "SecurePassword123!"
    ✓ Les 2 correspondent

[ ] (Optionnel) Vérifier indicateur force mot de passe
```

### 6.4 Créer Compte
```
[ ] Cliquer "Créer mon compte"
    ✓ Toast: "Compte créé avec succès" (vert)
    ✓ Redirection automatique vers /dashboard (école)
    
    Si ERREUR:
    [ ] Vérifier token valide (pas expiré, pas déjà utilisé)
    [ ] Vérifier mots de passe correspondent
    [ ] Regarder Backend logs
```

### 6.5 Vérifier Dashboard École
```
[ ] Page /dashboard affichée
    ✓ Titre: "Tableau de bord" OU "Dashboard"
    ✓ Info école affichée: "Lycée Ndiaye Dakar"
    ✓ Menu école visible: Classes, Exams, Timetables, etc.
    ✓ Bienvenue message avec prénom (Mamadou)
```

### 6.6 Vérifier JWT École
```
[ ] F12 → Application → Cookies → localhost:5173
    ✓ Cookie "jwt" existe (école JWT, pas master_jwt!)
    ✓ Valeur: longue chaîne JWT
    ✓ HttpOnly: checked
```

### 6.7 Vérifier Historique Actions (Master)
```
NOUVEAU TERMINAL:
[ ] Ouvrir nouvelle window navigateur (incognito)
    [ ] Aller à http://localhost:5173/master/login
    [ ] Login avec admin@edunexus.fr / SecurePassword123!
    [ ] Naviguer vers detail école
    [ ] Vérifier section "Historique des actions"
    
    ✓ Affiche: "Admin activé le compte"
    ✓ Utilisateur: "Mamadou Sall"
    ✓ Timestamp: récent
```

---

## 📊 PART 7: OPÉRATIONS AVANCÉES SUPER ADMIN

### 7.1 Accéder Detail École (Master Session)
```
(Vous êtes toujours dans session master)

[ ] URL: http://localhost:5173/master/schools/<SCHOOL_ID>
    ✓ Page detail école affichée
```

### 7.2 OPÉRATION: Suspendre École

#### 7.2a Trouver Section Suspension
```
[ ] Scroller page pour chercher: "Suspendre cette école" OU "Suspension"
    ✓ Section trouvée
    ✓ Textarea pour "Raison de suspension"
    ✓ Bouton "Suspendre"
```

#### 7.2b Saisir Raison
```
[ ] Textarea - Saisir raison:
    "Non paiement des frais de plateforme - Trimestre 2, 2026"
```

#### 7.2c Suspendre
```
[ ] Cliquer "Suspendre"
    ✓ Toast: "École suspendue" (vert)
    ✓ Page rafraîchit
    
    [ ] Vérifier:
        ✓ Status école passe à "inactive" (UI)
        ✓ Raison affichée en historique
        ✓ Bouton devient "Réactiver"
```

#### 7.2d Vérifier Audit Trail
```
[ ] Section "Historique des actions"
    ✓ Affiche: "Suspendu l'école"
    ✓ Détails: "Raison: Non paiement des frais..."
    ✓ User: "Admin@edunexus.fr"
```

### 7.3 OPÉRATION: Vérifier Statut Email

#### 7.3a Trouver Section Email
```
[ ] Scroller vers section: "Dernier lien d'invitation" OU "Invite Status"
    ✓ Info affichée:
       - Email: mamadou@ndiayelycee.sn
       - Status: ✅ Envoyé (ou ❌ Échoué)
       - Timestamp: Date d'envoi
```

#### 7.3b Cliquer "Voir Log Complet"
```
[ ] Bouton: "Voir le log email complet" OU "Email History"
    ✓ Redirection vers: /master/email-history?eventType=school_invite&schoolId=<ID>&search=mamadou
    ✓ Filtrés automatiquement
```

### 7.4 OPÉRATION: Réactiver École

#### 7.4a Trouver Bouton Réactiver
```
(Retourner à detail école si pas là)

[ ] Scroller vers section suspension
    ✓ Bouton: "Réactiver cette école"
```

#### 7.4b Réactiver
```
[ ] Cliquer "Réactiver"
    ✓ Toast: "École réactivée" (vert)
    ✓ Status école passe à "active"
    ✓ Nouveau log d'action créé
```

### 7.5 OPÉRATION: Régénérer Lien (Nouveau Token)

#### 7.5a Trouver Bouton
```
[ ] Section "Lien d'invitation"
    ✓ Bouton: "Régénérer lien" OU "Generate New Invite"
```

#### 7.5b Régénérer
```
[ ] Cliquer "Régénérer lien"
    ✓ Toast: "Nouveau lien généré" (vert)
    ✓ Modal: Nouveau token affiché
    ✓ Email: Nouvel email envoyé à mamadou@...
    
    [ ] Copier nouveau lien pour test
```

#### 7.5c Vérifier Ancien Lien Invalide
```
NOUVEAU TERMINAL:
[ ] Copier ancien lien from étape 5.4
[ ] Essayer d'ouvrir: http://localhost:5173/onboarding/invite/<OLD_TOKEN>
    ✓ Error affiché: "Token invalid or expired"
```

### 7.6 OPÉRATION: Renvoyer Email (Même Token)

#### 7.6a Trouver Bouton
```
[ ] Section "Lien d'invitation"
    ✓ Bouton: "Renvoyer email" OU "Resend Invite"
```

#### 7.6b Renvoyer
```
[ ] Cliquer "Renvoyer email"
    ✓ Toast: "Email renvoyé" (vert)
    ✓ Email reçu (check Gmail)
    ✓ Lien dans email = MÊME token (réutilisable)
```

#### 7.6c Tester Lien Reenvoyé
```
NOUVEAU TERMINAL (si vous avez pas utilisé nouveau token):
[ ] Ouvrir nouveau lien reçu par email
    ✓ Page activation charge
    ✓ Pas d'erreur "token invalid"
    ✓ Form pré-rempli affichée
```

---

## 🟣 PART 8: CONSULTER HISTORIQUE EMAILS (Master)

### 8.1 Naviguer à Email History
```
[ ] URL: http://localhost:5173/master/email-history
    ✓ Page affichée
    ✓ Titre: "Historique des emails"
```

### 8.2 Vérifier Filtres
```
[ ] Section "Filtres" avec 4 champs:
    ✓ 1. Search box (email/subject)
    ✓ 2. School ID dropdown
    ✓ 3. Status dropdown (Sent/Failed)
    ✓ 4. Event Type dropdown (school_invite, etc.)
```

### 8.3 Filtrer par Type d'Événement
```
[ ] Cliquer dropdown "Event Type"
[ ] Sélectionner: "school_invite"
    ✓ Table se met à jour automatiquement
    ✓ Affiche que les school_invite emails
    ✓ URL change: ?eventType=school_invite
```

### 8.4 Filtrer par École
```
[ ] Cliquer dropdown "School ID"
[ ] Chercher/Sélectionner: "Lycée Ndiaye Dakar"
    ✓ Table filtre davantage
    ✓ Affiche que les emails de cette école
    ✓ URL change: ?eventType=school_invite&schoolId=<ID>
```

### 8.5 Vérifier Badge Filtres Actifs
```
[ ] Chercher badge: "Filtres actifs: X"
    ✓ Affichée en haut
    ✓ Nombre = 2 (Type + School)
    ✓ Couleur: Ambre/orange
```

### 8.6 Ajouter Filtre Status
```
[ ] Cliquer dropdown "Status"
[ ] Sélectionner: "Sent"
    ✓ Table filtre
    ✓ Affiche que emails "envoyés"
    ✓ Badge "Filtres actifs: 3"
```

### 8.7 Vérifier Table Emails
```
[ ] Affichage:
    ✓ Colonne "Email": mamadou@ndiayelycee.sn
    ✓ Colonne "Sujet": "Invitation EDUNEXUS - ..."
    ✓ Colonne "Status": ✅ Envoyé
    ✓ Colonne "Type": school_invite
    ✓ Colonne "Date": Timestamp (ex: "2026-04-17 10:30")
    
[ ] Lignes attendues: 3
    1. Generate
    2. Resend
    3. Regenerate
```

### 8.8 Ajouter Filtre Search
```
[ ] Cliquer Search box
[ ] Saisir: "mamadou"
    ✓ Table filtre sur "mamadou" (dans email/subject)
    ✓ Badge "Filtres actifs: 4"
```

### 8.9 Bouton Effacer Filtres
```
[ ] Chercher bouton: "Effacer les filtres"
    ✓ Visible en haut
    ✓ Cliquer
    
    ✓ Tous les filtres reset à vide
    ✓ Table affiche TOUS les emails
    ✓ Badge "Filtres actifs: X" disparaît (ou devient "0")
    ✓ URL reset: /master/email-history (sans query params)
```

### 8.10 Pagination
```
[ ] Chercher: Prev/Next buttons, page counter
[ ] Si plus de 10 emails:
    ✓ "Page 1 of 2" (ou plus)
    ✓ Bouton "Next" cliquable
    [ ] Cliquer "Next"
        ✓ Page 2 affichée
        ✓ URL change: ?page=2
```

---

## 🔐 PART 9: TESTER ISOLATIONS & SÉCURITÉ

### 9.1 Isoler Admin École (Pas d'Accès Master)

#### 9.1a Nouveau Navigateur (Session École)
```
NOUVEAU NAVIGATEUR:
[ ] Aller à http://localhost:5173/login
[ ] Chercher "Sélectionner établissement"
    ✓ Ou dropdown "Lycée Ndiaye Dakar" visible
[ ] Email: mamadou@ndiayelycee.sn
[ ] Password: SecurePassword123!
[ ] Cliquer "Se connecter"
    ✓ Dashboard école affichée
```

#### 9.1b Essayer d'Accéder Master Routes
```
[ ] URL directe: http://localhost:5173/master/schools
    ✓ Redirect vers /login
    ✓ OU affiche "Not authorized"
    
    Attendu: Rejet (pas d'accès master)
```

#### 9.1c Vérifier JWT Différent
```
[ ] F12 → Application → Cookies
    ✓ Cookie: "jwt" (école, pas master_jwt)
    ✓ Différent du JWT master
```

### 9.2 Isoler Données Autres Écoles

#### 9.2a Créer 2ème École (Master Session)
```
(Retourner à session master: browser principal)

[ ] Naviguer: http://localhost:5173/master/schools
[ ] Cliquer "+ Ajouter une école"
[ ] Remplir:
    Nom: "Collège Saint-Louis"
    Type: "Anglophone"
    Email: "contact@stlouis.sn"
    
[ ] Créer école
    ✓ Nouvelle école apparaît en liste
    [ ] Copier nouvel SCHOOL_ID_2
```

#### 9.2b Créer Admin Collège
```
[ ] Cliquer "Collège Saint-Louis"
[ ] Générer lien pour: "John Smith" / john@stlouis.sn
[ ] Accepter invitation (dans NOUVELLE session incognito)
[ ] Activer compte
    ✓ John connecté au dashboard Collège
```

#### 9.2c Vérifier Admin École 1 NE voit PAS École 2
```
(Session école 1: Mamadou dans "Lycée Ndiaye")

[ ] Essayer URL école 2 directement:
    http://localhost:5173/master/schools/<SCHOOL_ID_2>
    ✓ Redirect vers /login OU "Not authorized"
    
[ ] Essayer endpoint API directement (Terminal):
    curl http://localhost:5000/api/users -b cookies.txt
    ✓ Retourne SEULEMENT users de Lycée Ndiaye
    ✓ Pas de users de Collège
```

### 9.3 Vérifier Token Expiré

#### 9.3a Supprimer Cookie
```
[ ] F12 → Application → Cookies
[ ] Delete: "jwt"
[ ] Actualiser page (F5)
    ✓ Redirect vers /login
    ✓ Dashboard disparaît
```

#### 9.3b Relancer Login
```
[ ] Faire login à nouveau avec mêmes credentials
    ✓ Nouveau JWT généré
    ✓ Nouveau cookie créé
    ✓ Accès rétabli
```

---

## 🎓 PART 10: FONCTIONNALITÉS ÉCOLE (Bonus)

### 10.1 Créer une Classe
```
(Dans session école: Mamadou)

[ ] Menu: "Classes" OU "Créer classe"
[ ] Cliquer: "+ Ajouter classe"
[ ] Remplir:
    Nom: "6ème A"
    Niveau: "6ème"
    Section: "A"
[ ] Créer
    ✓ Classe apparaît en liste
```

### 10.2 Ajouter des Sujets
```
[ ] Menu: "Sujets" OU "Matières"
[ ] Cliquer: "+ Ajouter sujet"
[ ] Remplir:
    Nom: "Mathématiques"
    Code: "MATH"
    Prof: (sélectionner)
[ ] Ajouter
    ✓ Sujet visible en liste
```

### 10.3 Générer Emploi du Temps
```
[ ] Menu: "Emploi du temps" OU "Timetable"
[ ] Cliquer: "Générer emploi du temps"
    ✓ Sélectionner classe, matières, profs
    ✓ Inngest job démarre (Backend logs affichent)
[ ] Attendre: "Emploi du temps généré"
    ✓ Timetable visible avec slots horaires
```

---

## ✨ RÉSUMÉ FINAL

### ✅ VALIDATIONS ESSENTIELLES

Cocher si TOUS les points suivants passent:

```
[ ] Backend tourne sans erreurs
[ ] Frontend tourne sans erreurs
[ ] Super admin login: OK
[ ] Créer école: OK
[ ] Générer lien invitation: OK
[ ] Email reçu: OK
[ ] Activer école via lien: OK
[ ] Dashboard école accessible: OK
[ ] Suspendre école (avec raison): OK
[ ] Réactiver école: OK
[ ] Voir historique actions: OK
[ ] Voir statut email: OK
[ ] Régénérer lien: OK
[ ] Ancien lien invalide: OK
[ ] Renvoyer email: OK
[ ] Email history filtrée: OK
[ ] Admin école ≠ voit autre école: OK
[ ] Token isolé école ≠ master: OK
```

---

## 🎯 RÉSULTAT FINAL

Si TOUTES les cases ✅, alors:

✅ **Architecture multi-tenant FONCTIONNE**
✅ **Authentification FONCTIONNE** (Master + École isolées)
✅ **Gestion d'invitations FONCTIONNE** (Regenerate vs Resend)
✅ **Audit trail FONCTIONNE** (Toutes actions logged)
✅ **Email transactionnel FONCTIONNE** (Reçu et tracé)
✅ **Isolations de données FONCTIONNE** (Sécurisé)

---

## 🚀 PRÊT POUR PRODUCTION

Quand cette checklist est ✅ 100%, le système est **READY FOR**:
- Pilot schools deployment
- Multi-school testing
- User acceptance testing (UAT)
- Load testing
- Security audit
- Production launch

---

**Date de test: ______________**
**Tester: ______________**
**Notes: ______________**
