# PLAN — Notifications Push (Web Push)

> Format standard imposé par [AGENTS.md](AGENTS.md) §4. Lié à [ARCHITECTURE.md](ARCHITECTURE.md) · [MODULE_INDEX.md](MODULE_INDEX.md) · [CONVENTIONS.md](CONVENTIONS.md).
> Décision produit (juillet 2026) : stack validée — Web Push maintenant (Service Worker + VAPID), réutilisable tel quel par une future appli desktop Electron et une future appli mobile Capacitor. React Native et Tauri écartés pour un dev solo (voir discussion — coût de maintenance de bases de code séparées / nouveau langage).

---

## 1. Objectif

Permettre à tout utilisateur **ayant déjà un compte actif** (admin, staff, enseignant, parent, élève) de recevoir en push (navigateur, et plus tard desktop/mobile via le même mécanisme) les informations, rappels et signalements qui lui sont destinés depuis l'espace de son établissement — à la place de l'email, qui reste réservé aux personnes **sans compte encore créé** (onboarding). Le SMS n'est pas touché par ce chantier (mis de côté sur demande explicite).

---

## 2. Contexte (état réel du code)

Diagnostic fait sur le code réel avant de planifier — pas de supposition :

- **`NotificationPreference`** existe déjà dans `schema.prisma` (ligne ~1101) : `push`/`sms`/`email`/`aiAlerts` (booléens, défaut `true`) par utilisateur (`User.notificationPreference`). **Le champ `push` existe mais n'est consulté nulle part dans le code actuel** — c'est un interrupteur prêt à l'emploi, jamais branché.
- **`NotificationChannel`** (`backend/src/domain/types/enums.ts:70`) déclare déjà `'PUSH'` comme valeur possible. Le port `NotificationService` (`backend/src/domain/ports/services/NotificationService.ts`) l'accepte dans `EnvoiNotificationOptions.canal`.
- **Seule implémentation existante du port**, `SocketNotificationService` (`backend/src/infrastructure/services/SocketNotificationService.ts`) : gère réellement `IN_APP` (Socket.io), et pour tout autre canal (dont `'PUSH'`) fait un `console.log` et s'arrête — **PUSH est un canal fantôme, déclaré mais jamais implémenté**. Ce port n'est utilisé que par 3 use cases (`DemanderRattrapageUseCase`, `RejeterNoteUseCase`, `EnregistrerPresenceUseCase`) — ce n'est **pas** le mécanisme dominant de notification dans ce projet.
- **Le vrai mécanisme dominant** est `backend/src/infrastructure/services/SmsNotificationService.ts` : un module de fonctions libres, une par événement métier (`notifyAbsenceSms`, `notifyPaymentSms`, `notifyDisciplineSms`, `notifyBulletinSms`, `notifyOnboardingLinkSms`, etc.), chacune : résout la langue (`resolveLanguage`), vérifie un gate au niveau école (`SchoolNotificationSettings` — `smsAbsences`/`smsPayments`/`smsBulletins`), récupère le(s) contact(s), envoie via `services/smsService.ts` (wrapper Techsoft), journalise dans `SmsLog`. **C'est ce pattern qu'il faut reproduire pour push**, pas le port `NotificationService` sous-utilisé (principe CONVENTIONS.md §0 : « le code que tu écris doit se fondre dans le code existant »).
- **Email** (`backend/src/services/emailService.ts`) : envoi générique bas niveau (`EmailEventType`, Resend ou SMTP), appelé **ad hoc depuis 13 fichiers différents** (`FinanceController`, `CommunicationsController`, `UserController`, `MasterAdminHexController`, `PublicController`, `InviteOnboardingController`, `utils/onboardingNotifications.ts`, jobs Inngest, etc.) — pas de module centralisé équivalent à `SmsNotificationService.ts` côté email. La distinction « a un compte » vs « en onboarding » est déjà naturellement présente dans le code : les fonctions d'onboarding (`notifyOnboardingLinkSms`, etc.) prennent un contact brut (téléphone/email saisi), jamais un `userId` — alors que les événements post-compte prennent un `userId`/`studentUserId` réel.
- **PWA** : aucun `manifest.json`, aucun Service Worker dans `frontend/public/` aujourd'hui (confirmé lors de l'audit du plan produit la semaine dernière) — prérequis technique manquant, pas encore un simple ajout.

---

## 3. Impact sur l'architecture

- **Nouveau modèle Prisma** `PushSubscription` (device ↔ utilisateur, plusieurs par utilisateur — multi-appareil façon WhatsApp).
- **`NotificationPreference.push`** enfin lu et respecté avant tout envoi.
- **Nouveau module** `backend/src/infrastructure/services/PushNotificationService.ts`, calqué sur `SmsNotificationService.ts` (mêmes conventions : templates fr/en, gate, log, jamais de throw).
- **Nouvelle brique bas niveau** `backend/src/services/webPushService.ts` (wrapper `web-push`), miroir de `services/smsService.ts`.
- **Container/bootstrap** : nouveaux use cases d'abonnement/désabonnement à câbler (`infra/config/container.ts`, `infra/config/hexagonal.bootstrap.ts`) — changement de complexité **Élevée**.
- **Frontend** : nouveau Service Worker + manifest PWA (fondation absente à ce jour) + hook d'abonnement + composant de réglage.
- **Aucune régression attendue sur SMS/email existants** : ce chantier est additif (nouvelle brique, nouvelle table), il ne modifie pas les chemins SMS/email actuels dans sa Phase A (voir §5). La bascule email→push des événements existants est volontairement une **Phase B séparée**, hors périmètre immédiat (13 fichiers concernés, à traiter au cas par cas pour ne rien casser — voir §5, étape 8).

---

## 4. Fichiers concernés

**Backend — nouveaux fichiers**
- `backend/prisma/schema.prisma` (ajout modèle `PushSubscription`, pas de suppression)
- `backend/src/services/webPushService.ts`
- `backend/src/infrastructure/services/PushNotificationService.ts`
- `backend/src/application/pushNotification/SouscrirePushUseCase.ts`
- `backend/src/application/pushNotification/DesinscrirePushUseCase.ts`
- `backend/src/application/pushNotification/index.ts` (barrel)
- `backend/src/infrastructure/http/controllers/PushNotificationController.ts`
- `backend/src/infrastructure/http/routes/pushNotification.routes.ts`

**Backend — fichiers modifiés**
- `backend/src/infrastructure/config/container.ts` (câblage use cases)
- `backend/src/infrastructure/config/hexagonal.bootstrap.ts` (montage routes)
- `backend/src/server.ts` (health check clés VAPID au démarrage, dans le même esprit que le health check LibreOffice déjà en place)
- `backend/src/infrastructure/services/SocketNotificationService.ts` (branche enfin réellement `'PUSH'` au lieu du `console.log`, délègue à `PushNotificationService` — gain accessoire pour les 3 use cases qui utilisent déjà le port)
- `backend/package.json` / `backend/bun.lock` (+ `web-push`, `+ @types/web-push`)
- `backend/.env` (nouvelles clés `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)

**Frontend — nouveaux fichiers**
- `frontend/public/manifest.json`
- `frontend/public/sw.js`
- `frontend/src/lib/pushNotifications.ts` (permission, abonnement, appel API)
- `frontend/src/hooks/usePushNotifications.ts`
- `frontend/src/components/PushNotificationToggle.tsx` (réutilisable dans chaque dashboard de rôle)
- `frontend/src/locales/{fr,en}/common.json` (clés du toggle — parité stricte, §7 CONVENTIONS.md)

**Frontend — fichiers modifiés**
- `frontend/src/app/layout.tsx` (lien `manifest.json`, enregistrement du Service Worker)
- Un point d'intégration par dashboard de rôle (section paramètres/profil existante — à confirmer par exploration au moment de l'implémentation, pas deviné ici)

---

## 5. Étapes

| Étape | Description | Difficulté | IA recommandée |
|---|---|---|---|
| 1 | Modèle Prisma `PushSubscription` (`id, userId, endpoint, p256dh, auth, userAgent?, createdAt, lastSeenAt`, `@@index([userId])`, `onDelete: Cascade`) + migration | Moyenne | DeepSeek (schéma simple, patron déjà établi dans le fichier) |
| 2 | `backend/src/services/webPushService.ts` : génération/lecture des clés VAPID, `sendPush(subscription, payload)` avec gestion des réponses `410 Gone`/`404` (souscription expirée → à signaler pour suppression) | Élevée | Claude Code (nouvelle brique d'infra transverse, gestion d'erreurs sensible) |
| 3 | `backend/src/infrastructure/services/PushNotificationService.ts` : fonctions `notifyXxxPush(...)` miroir de `SmsNotificationService.ts` (templates fr/en, gate `NotificationPreference.push`, récupération des `PushSubscription` actives de l'utilisateur, appel `webPushService`, suppression auto des souscriptions expirées, log) | Élevée | Claude Code (doit respecter fidèlement un pattern existant multi-fonctions) |
| 4 | Use cases `SouscrirePushUseCase` / `DesinscrirePushUseCase` (upsert/delete `PushSubscription` par `userId`+`endpoint`) | Faible | DeepSeek |
| 5 | Controller + routes `POST /api/v2/push/subscribe`, `DELETE /api/v2/push/unsubscribe`, `GET /api/v2/push/vapid-public-key` + câblage container/bootstrap | Moyenne | DeepSeek (avec ce plan) |
| 6 | `frontend/public/manifest.json` (fondation PWA, absente à ce jour) | Faible | DeepSeek |
| 7 | `frontend/public/sw.js` : écouteurs `push` (affiche la notification) et `notificationclick` (focus/ouvre la bonne page) | Moyenne | DeepSeek (pattern standard, bien documenté) |
| 8 | `frontend/src/lib/pushNotifications.ts` + `usePushNotifications.ts` : demande de permission, `registration.pushManager.subscribe()` avec la clé VAPID publique, envoi au backend | Moyenne | DeepSeek |
| 9 | `frontend/src/components/PushNotificationToggle.tsx` + intégration dans les dashboards de rôle + clés i18n fr/en | Faible | DeepSeek |
| 10 | Câbler `'PUSH'` dans `SocketNotificationService.envoyer()`/`envoyerAuRole()` (délègue à `PushNotificationService`) | Faible | DeepSeek |
| 11 | Vérification `tsc` + smoke test bout-en-bout (abonnement fictif → envoi → réception simulée) | Moyenne | Claude Code (vérification finale, voir §9) |

**Phase A — statut : ✅ terminée et vérifiée (juillet 2026).** Étape 1 (DeepSeek) vérifiée conforme. Étapes 4-9 (DeepSeek) vérifiées, 3 bugs réels corrigés au passage (voir §12). Étapes 2-3 et 10-11 (Claude Code) implémentées et testées (`tsc` propre backend+frontend, smoke tests bout-en-bout réussis, nettoyés après usage). Détail complet en §12.

**Phase B — statut : ✅ terminée et vérifiée (juillet 2026).** 7 types d'événements migrés vers push-d'abord avec repli email automatique, détail complet et vérifications en **§13**.

---

## 6. Dépendances

- Paquet npm `web-push` (+ `@types/web-push`) — backend uniquement, aucun nouveau runtime.
- Clés VAPID à générer une fois (`web-push generate-vapid-keys`) et à stocker en variables d'environnement (`.env`, puis secrets Railway en production).
- Étape 3 dépend de l'étape 2 ; étape 5 dépend de 4 ; étape 8 dépend de 6+7 ; étape 9 dépend de 8 ; étape 10 dépend de 3.
- Aucune dépendance externe payante (voir clarification faite en discussion : une « souscription push » est un enregistrement technique gratuit, pas un abonnement facturé).

---

## 7. Risques

- **Permission navigateur refusée ou révoquée** : ne doit jamais bloquer un flux métier — chaque `notifyXxxPush` doit rester *fire-and-forget* comme son équivalent SMS (jamais de `throw`).
- **Souscriptions expirées/orphelines** (désinstallation navigateur, changement d'appareil) : nettoyage automatique sur réponse `410 Gone`/`404` de l'API push du navigateur (étape 2), sinon la table `PushSubscription` grossit avec des entrées mortes et les tentatives d'envoi échouent silencieusement sans jamais se corriger.
- **Confusion des deux gates existants** : `NotificationPreference` (par utilisateur) et `SchoolNotificationSettings` (par école, par catégorie d'événement) sont deux mécanismes différents et coexistants — bien réutiliser les deux, comme le fait déjà `SmsNotificationService.ts`, pas en inventer un troisième.
- **iOS Safari** : le push n'y fonctionne que si le site est installé en PWA sur l'écran d'accueil (iOS 16.4+) — comportement Apple non contournable, à documenter clairement dans le toggle UI (« Sur iPhone, ajoutez EduNexus à l'écran d'accueil pour activer les notifications »).
- **Phase B (migration)** : plus grand risque du chantier — 13 fichiers d'appel email existants, logique métier variée. Traiter un flux à la fois, jamais en lot, avec vérification de non-régression à chaque flux (voir AGENTS.md §2 « zéro régression »).

---

## 8. Critères de validation (Definition of Done — Phase A)

1. Un utilisateur ayant un compte actif peut activer les notifications push depuis son dashboard (toggle visible, fonctionnel, thème réactif — voir CONVENTIONS.md §6).
2. La souscription est stockée en base (`PushSubscription`), liée au bon `userId`.
3. Un envoi de test (script ou route de debug) déclenche une notification visible côté navigateur, y compris onglet fermé mais navigateur ouvert.
4. Désactiver le toggle `NotificationPreference.push` empêche bien l'envoi (vérifié côté backend, pas seulement côté UI).
5. Une souscription expirée est automatiquement supprimée après un envoi en échec (410/404), sans jamais faire échouer le flux appelant.
6. `tsc` propre (backend + frontend).
7. Parité i18n fr/en stricte sur toute chaîne UI ajoutée.
8. Aucune régression sur les flux SMS/email existants (Phase A n'y touche pas).

---

## 9. Plan de test

- `tsc --noEmit` backend et frontend (jamais `npx tsc`, voir AGENTS.md §3).
- Smoke test `_smoke_push.ts` dans `backend/` (créer une souscription factice en DB, appeler `notifyXxxPush` avec un `userId` de test, vérifier qu'aucune exception ne remonte même avec une souscription invalide) — supprimé après usage.
- Test manuel navigateur : activer le toggle, accepter la permission, déclencher un événement réel de test, vérifier la réception (onglet actif, onglet inactif, navigateur fermé si possible).
- Vérifier explicitement le comportement de repli quand `NotificationPreference.push = false` : aucun envoi, pas d'erreur.
- Vérifier la parité fr/en des nouvelles clés (mêmes clés dans les deux fichiers).

---

## 10. Retour arrière (Rollback)

Chantier entièrement additif en Phase A — rollback simple :
- Retirer le montage des routes push dans `hexagonal.bootstrap.ts` (1 ligne).
- Les appels à `PushNotificationService` étant nouveaux (Phase A ne touche aucun flux existant), aucun autre chemin du code n'en dépend — les supprimer n'affecte rien d'autre.
- La table `PushSubscription` peut rester en base sans effet de bord si le chantier est abandonné (juste des données non consultées).
- Pas de rollback nécessaire pour SMS/email : non modifiés en Phase A.
- Pour la Phase B (migration), chaque flux migré doit être rollback-able individuellement (garder l'appel email en repli explicite, pas en suppression sèche, tant que le flux push n'est pas confirmé fiable en production).

---

## 11. Décision de conception (fixée pendant l'implémentation)

Étape 3 ne contient volontairement **aucune** fonction `notifyXxxPush` par événement (contrairement à une lecture littérale de l'étape 3 telle que formulée initialement). La Phase B (§13) étant hors périmètre immédiat, aucune de ces fonctions n'aurait d'appelant réel — les construire par anticipation serait contraire à AGENTS.md §2. À la place, `PushNotificationService.ts` expose un seul primitif générique réutilisable, `notifierUtilisateurPush(...)`, équivalent de `dispatchSms()` dans `SmsNotificationService.ts` : c'est sur ce primitif que les futures fonctions par événement de la Phase B viendront se greffer, une par une.

---

## 12. Vérification Phase A (rapport)

**Étape 1 (DeepSeek) — conforme.** Modèle `PushSubscription` identique à la spec (`id, userId, endpoint, p256dh, auth, userAgent?, createdAt, lastSeenAt`, `@@index([userId])`, cascade), migration appliquée en base (`prisma migrate status` → à jour), relation inverse `User.pushSubscriptions` présente.

**Étapes 4-9 (DeepSeek) — 3 bugs réels trouvés et corrigés :**

1. **`PushNotificationController.ts`** (`subscribe`/`unsubscribe`) : utilisait `(req as any).user.id`, alors que le payload JWT (`AuthPayload`, `backend/src/middleware/auth.ts`) expose `userId`, pas `id`. Sans correction, chaque abonnement aurait été enregistré avec `userId: undefined` — cassé dès le premier appel réel. Corrigé en `req.user!.userId` (convention déjà utilisée dans les autres controllers, ex. `StatisticalCampaignController.ts`).
2. **`frontend/src/lib/pushNotifications.ts`** (`urlBase64ToUint8Array`) : erreur de typage TS (`Uint8Array<ArrayBufferLike>` non assignable à `BufferSource`, quirk de `lib.dom.d.ts` récent) — bloquait `tsc --noEmit`. Corrigé par annotation explicite `Uint8Array<ArrayBuffer>`.
3. **Couverture du toggle incomplète** : seuls les dashboards admin et parent avaient `PushNotificationToggle`. Enseignants et personnel n'avaient aucun moyen d'activer le push. Ajouté dans `frontend/src/components/SectionMonProfilRH.tsx` (composant déjà partagé teacher+staff) — couvre les deux rôles en un seul ajout. **Élève reste sans section réglages** (aucune n'existe dans son dashboard aujourd'hui, tous rôles confondus — lacune préexistante, hors périmètre de correction ici, à traiter si un jour un espace réglages élève est créé).

**Divers non bloquants relevés, non corrigés (hors périmètre) :**
- `frontend/public/icons/icon-192.png` et `icon-512.png` font exactement la même taille en octets (17589) — très probablement le même fichier dupliqué plutôt qu'une vraie version 512×512. N'empêche pas le fonctionnement du push (l'icône de notification utilise la petite taille), mais dégradera la qualité d'affichage si une invite d'installation PWA zoome sur la grande icône.
- Un fichier `_dream_query.py` et une entrée modifiée `.mimocode/.cron-lock` sont apparus à la racine du projet, non liés à EduNexus (script de requête sur une base SQLite locale d'un outil d'agent tiers, chemin absolu codé en dur). Ne fait pas partie du code applicatif — **à supprimer si tu confirmes que ce n'est pas voulu**, je ne l'ai pas fait unilatéralement.
- Le fichier `nul` (résidu de redirection Windows, voir AGENTS.md §3) a été supprimé.

**Étapes 2-3 et 10-11 (Claude Code)** : implémentées, `tsc --noEmit` propre (backend et frontend, zéro erreur), smoke tests bout-en-bout réels exécutés et supprimés après usage (souscription factice créée/mise à jour/supprimée en base, envoi via `webPushService` avec distinction 410/404 vs échec confirmée, envoi via le port `NotificationService.envoyer({canal:'PUSH'})` confirmé sans exception).

---

## 13. Plan détaillé — Phase B (migration email → push)

### 13.1 Objectif

Pour les utilisateurs ayant déjà un compte actif, remplacer l'email par le push comme canal principal (repli automatique sur l'email si aucune souscription push active ou si l'envoi échoue) — sans toucher aux flux où le destinataire n'a pas encore de compte (onboarding) ni aux flux de sécurité (OTP, réinitialisation de mot de passe).

### 13.2 Contexte (analyse du code réel)

- **Point de passage unique déjà existant** : `sendTransactionalEmail()` (`backend/src/services/emailService.ts:131`) est appelé depuis **14 fichiers**. C'est **le** point d'insertion pour la logique push-d'abord — pas la peine de modifier la décision dans chacun des 14 fichiers.
- **Découverte clé** : `SendEmailInput` (`emailService.ts:102`) déclarait déjà un champ `recipientUserId?: string | null` — présent dans le type depuis le début, mais rempli nulle part avant ce chantier. Même schéma que `NotificationPreference.push` et le canal `'PUSH'` en Phase A : l'anticipation existait, le branchement non.
- **`EmailEventType`** (`backend/src/types/email.ts`) définit 16 valeurs. Classification faite en lisant chaque site d'appel réel — **deux corrections faites en cours d'implémentation par rapport à la première passe d'analyse** :
  - `user_import` : la première analyse supposait "notification à l'admin qui a déclenché l'import". En lisant `ImporterUtilisateursUseCase.ts:369-437`, ce sont en fait les emails **"compte créé, voici votre mot de passe/lien d'activation"** envoyés aux utilisateurs **nouvellement importés qui n'ont pas encore de mot de passe défini** — un flux d'onboarding, pas un rapport à un compte existant. **Reclassé : reste email.**
  - `report_card_sent` : utilisé uniquement par `NodemailerEmailService.envoyerAvecPDF()`, dont j'ai vérifié qu'**aucun use case réel ne l'appelle** (0 caller en dehors des mocks de test). Code mort. **Non migré** (rien à migrer).
  - **Découverte supplémentaire, corrigée au passage** : le vrai flux d'envoi de bulletins aux parents (`EnvoyerBulletinsUseCase.ts`, celui réellement câblé/utilisé) appelait `emailService.envoyer()` **sans jamais préciser `eventType`**, tombant donc par défaut sur `'school_approved'` (le fallback codé en dur dans `NodemailerEmailService.ts:13`) — jamais reconnu comme "bulletin disponible". Corrigé : `eventType: 'report_card_available'` explicite + résolution de `recipientUserId` via `userRepository.findByEmail()` ajoutés à ce use case.

**Classification finale (7 types migrés vers push, 9 restent email) :**

| Type d'événement | Décision | Où (vérifié) |
|---|---|---|
| `report_card_available` | → Push | `inngest/functions.ts` (job planifié) **+ `EnvoyerBulletinsUseCase.ts`** (flux réel à la demande, corrigé au passage) |
| `payment_reminder` | → Push | `inngest/functions.ts` |
| `payment_receipt` | → Push | `FinanceController.ts` |
| `grade_reminder_48h` | → Push | `inngest/functions.ts` (censeur) |
| `grade_reminder_72h` | → Push | `inngest/functions.ts` (admin) |
| `absence_alert` | → Push | `inngest/functions.ts` (personnel `MANAGE_ATTENDANCE`) — vérifié aucun doublon avec le SMS `notifyAbsenceThresholdSms` (destinataires différents : personnel vs parent) |
| `discipline_notification` | → Push | `CommunicationsController.ts` (outil de diffusion admin, `Recipient.userId` ajouté aux deux branches de `resolveRecipients`) |
| `report_card_sent` | Reste email | Code mort (`envoyerAvecPDF`, 0 appelant réel) — non migré |
| `user_import` | Reste email | **Reclassé** — onboarding (compte pas encore actif) |
| `school_invite` / `user_invite` | Reste email | Onboarding — pas de compte encore |
| `master_login_otp` / `master_password_change_otp` / `password_reset` | Reste email | **Sécurité** — canal volontairement indépendant de l'appareil déjà connecté |
| `contact_request` / `demo_request` / `school_pending_notification` | Reste email | Pas un utilisateur EduNexus (marketing/interne) |
| `school_approved` | Reste email | Moment de transition onboarding→compte actif ; le compte ne peut pas encore avoir de souscription push à cet instant précis |

### 13.3 Impact sur l'architecture (tel qu'implémenté)

- `SendEmailInput.recipientUserId` renseigné aux 8 sites d'appel migrés (7 types, dont 2 sites pour `report_card_available`).
- `sendTransactionalEmail()` tente le push en tout premier (avant même le mode dev) si `recipientUserId` fourni et `eventType ∈ PUSH_MIGRATED_EVENT_TYPES` ; ne bascule sur l'email que si le push n'a livré à aucun appareil. L'email reste **toujours** le repli, jamais un canal concurrent.
- `PushNotificationService` gagne `notifierUtilisateurPushAvecResultat()` (retourne `{delivered: boolean}`), extraite d'un cœur partagé `envoyerEtRapporter()` — `notifierUtilisateurPush()` existant (void, utilisé par le port `NotificationService`) reste inchangé en façade, aucune rupture.
- `EnvoiEmailOptions` (port domaine `EmailService`) gagne `recipientUserId?: string`, propagé par `NodemailerEmailService` — nécessaire car `EnvoyerBulletinsUseCase` et consorts passent par ce port, pas directement par `sendTransactionalEmail`.
- Chaque site d'appel migré a eu `id: true` ajouté à sa sélection Prisma existante (n'existait pas systématiquement avant).

### 13.4 Fichiers concernés (modifiés)

- `backend/src/types/email.ts` — `PUSH_MIGRATED_EVENT_TYPES`
- `backend/src/services/emailService.ts` — branche de décision push-d'abord
- `backend/src/infrastructure/services/PushNotificationService.ts` — `notifierUtilisateurPushAvecResultat`
- `backend/src/domain/ports/services/EmailService.ts` — `recipientUserId` sur le port
- `backend/src/infrastructure/services/NodemailerEmailService.ts` — propagation
- `backend/src/application/reportCard/EnvoyerBulletinsUseCase.ts` — correction du mauvais étiquetage + résolution `recipientUserId`
- `backend/src/inngest/functions.ts` — 5 sites (`report_card_available`, `payment_reminder`, `grade_reminder_48h`, `grade_reminder_72h`, `absence_alert`)
- `backend/src/infrastructure/http/controllers/FinanceController.ts` — `payment_receipt`
- `backend/src/infrastructure/http/controllers/CommunicationsController.ts` — `discipline_notification` (interface `Recipient` + 2 branches de `resolveRecipients` + `dispatchEmailToOne`)

### 13.5 Étapes — statut final

| Étape | Description | Statut |
|---|---|---|
| B1 | `notifierUtilisateurPushAvecResultat()` | ✅ Fait |
| B2 | `PUSH_MIGRATED_EVENT_TYPES` + branche push-d'abord | ✅ Fait |
| B3 | Localisation précise des 3 types ambigus | ✅ Fait — 2 reclassifications (§13.2) |
| — | Correction du mauvais étiquetage `EnvoyerBulletinsUseCase` (découvert pendant B3/B4) | ✅ Fait |
| B4 | `report_card_available` | ✅ Fait (2 sites) |
| B5 | `payment_reminder` + `payment_receipt` | ✅ Fait |
| B6 | `grade_reminder_48h` + `grade_reminder_72h` | ✅ Fait |
| B7 | `absence_alert` | ✅ Fait — aucun doublon confirmé |
| B8 | `discipline_notification` | ✅ Fait |
| B9 | `user_import` | ✅ Confirmé reste email, aucun changement de code |
| B10 | Vérification `tsc` + smoke test | ✅ Fait — voir §13.9 |

### 13.6 Risques — statut final

- **Risque principal (point de passage unique)** : neutralisé par test explicite — `password_reset` envoyé avec `recipientUserId` fourni délibérément en test n'a jamais déclenché de tentative push (voir §13.9). Les 3 types de sécurité restent intouchés.
- **Doublon `absence_alert`** : levé, destinataires confirmés différents (§13.2).
- **`school_approved`/`user_import`/`report_card_sent`** : levé, classification corrigée après lecture du code réel.

### 13.7 Critères de validation — vérifiés

1. ✅ `tsc --noEmit` propre, backend et frontend, après toutes les migrations.
2. ✅ Événement migré sans souscription active → repli email fonctionnel (testé).
3. ✅ Événement migré avec souscription invalide (push échoue) → repli email fonctionnel (testé).
4. ✅ Type non migré (`password_reset`) avec `recipientUserId` fourni exprès → jamais intercepté par la branche push (testé explicitement, voir §13.9).
5. ✅ `PUSH_MIGRATED_EVENT_TYPES` ne contient ni `user_import` ni `report_card_sent` ni aucun des 3 types de sécurité (vérifié par assertion dans le smoke test).

### 13.8 Plan de test — exécuté

Smoke test `_smoke_phaseb.ts` (créé, exécuté, supprimé après usage — convention AGENTS.md) :
1. Contenu de `PUSH_MIGRATED_EVENT_TYPES` (7 valeurs attendues, confirmé).
2. Événement migré sans souscription → email de repli (mode dev, simulé) → confirmé.
3. Événement migré avec souscription invalide → push tenté, échoue proprement, repli email → confirmé.
4. Événement non migré (`password_reset`) avec `recipientUserId` fourni → jamais de tentative push, email direct → confirmé.
5. Assertions négatives (`password_reset`, `master_login_otp`, `user_import` absents de l'ensemble migré) → confirmées.

Non testé en conditions réelles (pas de souscription push valide disponible dans cet environnement de dev) : la livraison effective d'un push réel déclenchant le repli email désactivé — déjà prouvée séparément en Phase A (§12) avec une souscription factice mais structurellement valide.

### 13.9 Retour arrière (Rollback)

Par flux migré, individuellement : retirer l'entrée correspondante de `PUSH_MIGRATED_EVENT_TYPES` (1 ligne) fait revenir immédiatement au comportement email pur pour ce type d'événement précis, sans toucher au reste. Aucun flux migré n'a supprimé le chemin email existant (repli conservé en permanence) — le rollback est possible à tout moment, événement par événement, y compris en production.

---

## 14. Correctif connexe — cloche IN_APP (découvert et corrigé, juillet 2026)

En discutant de la Phase A/B, question posée : la cloche de notification dans les dashboards (IN_APP, Socket.io) était-elle réellement fonctionnelle ? Vérification du code réel — elle ne l'était pas :

- `socket/io.ts` : le handler `connection` était vide, aucun client ne rejoignait jamais la room `user:{userId}` — les émissions de `SocketNotificationService.envoyer()` partaient dans le vide.
- Aucune connexion Socket.io établie côté frontend, aucun composant cloche fonctionnel (seulement une icône décorative statique dans 6 fichiers).
- `marquerLue()` était un stub vide.
- Un modèle Prisma `Notification` existait déjà (jamais consulté par `SocketNotificationService`) — seul `hrSelfServiceJobs.ts` y écrivait directement, en contournant complètement le port `NotificationService`.
- **Bug trouvé pendant la correction** : le `NotificationType` du domaine (port `NotificationService`, ex. `ABSENCE_ALERT`) et l'enum Prisma `NotificationType` (`ACADEMIC`, `ATTENDANCE`...) sont deux vocabulaires distincts qui ne partagent que la valeur `SYSTEM` — une écriture directe aurait échoué silencieusement. Corrigé avec une table de correspondance explicite.

**Corrigé** : authentification + jointure de rooms côté `socket/io.ts` (cookie `access_token`, même vérification JWT que `middleware/auth.ts`) ; persistance dans `Notification` avant toute émission live (`SocketNotificationService.envoyer()`/`envoyerAuRole()`) ; `marquerLue()` réellement câblé ; nouveau `NotificationController` (`GET /api/v2/notifications`, `POST /:id/read`, `POST /read-all`) ; côté frontend, connexion Socket.io (`lib/notificationSocket.ts`), hook `useInAppNotifications`, composant partagé `NotificationBell.tsx` remplaçant l'icône décorative dans les 6 emplacements réels (AdminTopbar, StaffTopbar, TeacherTopbar, teacher/student/parent `page.tsx`).

Vérifié : `tsc` propre (backend + frontend), smoke test confirmant les 8 types de notification mappés correctement vers l'enum Prisma, persistance et `marquerLue` fonctionnels.

---

*Plan rédigé et exécuté juillet 2026 (Claude Sonnet 5) — Phase A, Phase B et le correctif cloche IN_APP (§14) tous terminés et vérifiés. Diagnostic fait sur le code réel à chaque étape, classification/comportement corrigés en cours d'implémentation quand la lecture du code contredisait l'hypothèse initiale.*
