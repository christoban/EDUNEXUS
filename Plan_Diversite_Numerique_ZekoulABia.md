# PLAN D'IMPLÉMENTATION
## Diversité numérique camerounaise — Réseau, Téléphonie, Maternelle/Primaire
### Faire fonctionner EduNexus pour TOUTE famille, quel que soit son accès au numérique

> **Date :** juillet 2026
> **Statut :** ✅ IMPLÉMENTÉ (Axe 2 + Axe 3 + cas 6e/CEP) — voir Section 7 pour le détail par point. Axe 1 (réseau) confirmé inchangé, aucune retouche nécessaire.
> **Statut initial :** chantier de fond — conditionne l'adoption réelle du produit sur le terrain camerounais (zones rurales, familles sans smartphone), pas une fonctionnalité de confort
> **Principe fondateur :** la plateforme doit connaître et gérer TOUS les élèves d'un établissement — chaque élève a un dossier complet (notes, présences, bulletins) que l'enseignant/staff/admin peut toujours remplir, **indépendamment** du fait que l'élève ou son parent ait un smartphone, un compte, ou même un accès Internet. L'accès numérique conditionne uniquement QUI peut se connecter et COMMENT on le contacte — jamais SI son dossier existe.

---

## SOMMAIRE

- Section 0 — Principes directeurs
- Section 1 — État des lieux (ce qui existe déjà, vérifié dans le code)
- Section 2 — Axe 1 : diversité du réseau (déjà largement couvert, périmètre de vérification)
- Section 3 — Axe 2 : diversité des téléphones (le cœur de ce chantier)
- Section 4 — Axe 3 : maternelle/primaire (cas particulier de l'axe 2)
- Section 5 — Le cas spécifique de l'entrée en 6e (concours)
- Section 6 — Décisions actées et décisions ouvertes
- Section 7 — Definition of Done
- Section 8 — Risques et points de vigilance

---

# SECTION 0 — PRINCIPES DIRECTEURS

1. **Le dossier de l'élève existe toujours, l'accès numérique est une couche au-dessus.** `StudentProfile` + `User` sont créés systématiquement à la validation d'un onboarding, quelle que soit la situation numérique de la famille — c'est déjà l'invariant du code actuel (`ValiderOnboardingUseCase`), à préserver explicitement à chaque évolution de ce chantier, jamais à casser par erreur.
2. **La question de capacité numérique se pose UNIQUEMENT là où quelqu'un peut y répondre.** Ne jamais supposer qu'un formulaire en ligne peut capter "je n'ai pas d'accès en ligne" — c'est une contradiction. Cette question se pose soit par le staff en présentiel, soit par la famille elle-même si elle a un minimum d'accès (même un cybercafé, un accès ponctuel).
3. **Le SMS est un filet de sécurité, jamais le canal principal pour qui a un compte fonctionnel.** Quelqu'un avec un compte actif et des notifications push/in-app opérationnelles ne doit pas être noyé de SMS redondants — le mécanisme de repli existant (push d'abord, SMS si injoignable) reste la référence.
4. **Réutiliser l'existant plutôt que reconstruire.** Le module `eleveOnboarding` (squelette → formulaire → validation humaine) couvre déjà l'essentiel de la mécanique nécessaire — ce chantier l'étend, ne le remplace pas.
5. **Aucune décision automatique irréversible sans regard humain.** La détermination du destinataire (élève/parent/SMS-seul) reste toujours modifiable par le staff au moment de la validation, jamais figée définitivement dès la première saisie.

---

# SECTION 1 — ÉTAT DES LIEUX (vérifié dans le code, juillet 2026)

## 1.1 Ce qui existe déjà et fonctionne

- **Module `eleveOnboarding`** (`backend/src/application/eleveOnboarding/`) : `CreerSqueletteOnboardingUseCase` → `SoumettreFormulaireOnboardingUseCase` → `ValiderOnboardingUseCase` (+ `RejeterOnboardingUseCase`). Modèle `StudentOnboarding` avec `recipientType: ELEVE | PARENT | LES_DEUX`, `sourceType: IMPORT_MASSE | AUTOSERVICE | CONCOURS`, `submittedData: Json?` (sac libre déjà utilisé pour les données du formulaire).
- **`determinerRecipientType()`** (`rules.ts`) : force déjà `PARENT` pour `sourceType=CONCOURS` (un admis en 6e est mineur). C'est le seul cas actuellement forcé — sinon `recipientTypeExplicite ?? defaultRecipient ?? 'ELEVE'`.
- **`SchoolOnboardingSettings.ageThresholdForParent`** (défaut 15 ans) : **existe en base mais n'est lu par aucun code** — réglage mort, à activer dans ce chantier.
- **Entrée en 6e** : `AjouterCandidatsConcoursUseCase` prend déjà une **liste en masse** (Excel/scan Vision), avec un champ `originSchool` — conforme à la réalité terrain confirmée par l'utilisateur (le primaire transmet la liste, pas un dossier individuel par parent). Rien à changer sur ce point précis.
- **`EnregistrerResultatCepUseCase`** : dès le résultat CEP "REUSSI", crée **automatiquement** (sans contact humain à cet instant) le squelette d'onboarding (`recipientType=PARENT` forcé, `sourceType=CONCOURS`), via `candidate.parentPhone` capté à l'import de la liste.
- **Notification push-puis-SMS** (`notifierParentsPushDabord`, voir `PushFirstNotifier.ts`) : déjà en place pour le cas *transitoire* (compte existant, mais push pas encore activé/accessible) — pousse d'abord, SMS si aucun device n'a pu être atteint. Ne couvre PAS le cas *permanent* (famille sans aucun smartphone).
- **Mode hors-ligne (PWA)** : infrastructure `useSyncQueue`/`useCachedFetch` déjà étendue à l'écrasante majorité des écrans d'écriture/lecture identifiés par un audit dédié en juillet 2026 (voir `EduNexus_Carte_Complete_V2.md`, MODULE 15). Ce qui reste "en ligne uniquement" est une liste connue et déjà justifiée écran par écran (paiement, emprunt, convocation conseil, examens).

## 1.2 Ce qui manque — 4 trous concrets identifiés

1. **Aucune question de capacité numérique nulle part** dans le formulaire d'onboarding (`SoumettreFormulaireOnboardingCommande`) ni dans la création du squelette côté staff.
2. **`ageThresholdForParent` mort** — aucune règle ne force `PARENT` pour un enfant de maternelle/primaire (contrairement à CONCOURS, qui lui est bien forcé).
3. **Aucun "mode SMS seul"** — dès qu'un email/téléphone existe, le système crée systématiquement un compte avec mot de passe + lien d'activation, même quand la personne n'a structurellement aucun moyen de l'utiliser (pas de smartphone, pas d'accès web).
4. **Gating générique `requireRole('ADMIN','STAFF')`** sur tout le module `eleveOnboarding` — aucune permission fine, n'importe quel membre du staff peut créer/valider un dossier aujourd'hui.

---

# SECTION 2 — AXE 1 : DIVERSITÉ DU RÉSEAU

**Statut : déjà largement couvert, ce chantier ne le retouche pas en profondeur.** Le mécanisme de synchronisation différée (`useSyncQueue`, IndexedDB/Dexie) répond déjà à la question initiale de l'utilisateur ("on ne peut pas rester éternellement hors réseau ?") : NON, il n'y a pas de limite de durée — les actions faites hors-ligne restent en file d'attente locale indéfiniment jusqu'au retour du réseau, où elles sont rejouées automatiquement.

**Seule action de ce chantier sur cet axe** : produire, en Section 7 (DoD), une vérification explicite que la liste des écrans "en ligne obligatoire" (Catégorie C de l'audit MODULE 15) est toujours strictement limitée à des cas où le hors-ligne serait dangereux ou impossible par nature (paiement, IA, coordination temps réel) — pas à réviser en profondeur ici, juste à confirmer qu'elle n'a pas dérivé.

---

# SECTION 3 — AXE 2 : DIVERSITÉ DES TÉLÉPHONES (cœur du chantier)

## 3.1 La matrice réelle à gérer

Croisement (élève a un smartphone Android/iPhone ou non) × (parent a un smartphone Android/iPhone ou non) × (l'un ou l'autre a au moins un téléphone SMS-capable ou non) :

| Élève | Parent | Résultat |
|---|---|---|
| Smartphone | — | Compte ÉLÈVE (± compte PARENT en plus si souhaité → `LES_DEUX`) |
| Pas de smartphone | Smartphone | Compte PARENT seul, notifications push/in-app vers le parent |
| Pas de smartphone | Pas de smartphone, mais un téléphone SMS existe (élève ou parent) | Compte créé (pour le dossier/les données), mais **`accessMode = SMS_ONLY`** — pas de lien d'activation envoyé, notifications par SMS uniquement |
| Aucun téléphone nulle part | — | Dossier complet créé quand même (Principe 1) ; aucun canal de contact distant — retrait en personne, bulletins papier |

## 3.2 Où et quand capter cette information

**Ne jamais dans le formulaire self-service comme unique point de capture** — contradiction logique déjà identifiée (Section 0, Principe 2). Deux points de capture selon `sourceType` :

- **`AUTOSERVICE`** (nouvel arrivant, transfert en cours d'année qui vient payer son inscription en personne) : le staff a la famille en face de lui **au moment même** de `CreerSqueletteOnboardingUseCase`. C'est le point de capture naturel et immédiat — ajouter les champs de capacité numérique directement à cette commande.
- **`CONCOURS`** (admis en 6e après CEP) : le squelette est créé **automatiquement, sans contact humain** (voir 1.1). La capture doit donc se faire plus tard, au moment où la famille finalise réellement l'inscription — soit elle-même via le formulaire self-service si elle a un minimum d'accès, soit le staff qui remplit ce même formulaire à sa place quand la famille vient en personne (même écran, mains différentes). Dans les deux cas : champs ajoutés à `donneesComplementaires` (déjà un sac JSON libre, aucun changement de schéma requis pour cette partie).
- **`ValiderOnboardingUseCase` reste l'arbitre final** : lit les champs disponibles (ceux du squelette si `AUTOSERVICE`, ceux de `submittedData` sinon) et détermine `recipientType` + `accessMode` définitifs — le staff qui valide peut toujours corriger à la main si l'info captée plus tôt s'avère fausse ou incomplète.

## 3.3 Changements techniques proposés

**Schéma — deux évolutions** :

1. Mode d'accès du compte :
```prisma
enum UserAccessMode {
  FULL_ACCESS   // défaut — compte utilisable normalement (login, dashboard)
  SMS_ONLY      // dossier + contact existent, mais aucun lien d'activation n'est jamais envoyé
}

model User {
  // ... champs existants
  accessMode UserAccessMode @default(FULL_ACCESS)
}
```

2. **Contact élève et contact parent séparés sur `StudentOnboarding`** (décision actée, voir Section 6) — aujourd'hui un seul couple `contactEmail`/`contactTelephone` partagé, alors que le parcours de création directe (`InscrireUtilisateurUseCase`, section Utilisateurs/copilot) gère déjà deux contacts pleinement indépendants. Le module self-service doit s'aligner, exactement pour le cas que ce chantier adresse (élève et parent avec des situations numériques différentes) :
```prisma
model StudentOnboarding {
  // ... champs existants (contactEmail/contactTelephone existants conservés pour compat
  // ascendante — utilisés quand recipientType=ELEVE ou PARENT seul, un seul contact suffit)
  parentContactEmail     String?
  parentContactTelephone String?
  // contactEmail/contactTelephone existants deviennent implicitement "contact élève"
  // quand recipientType=LES_DEUX et que les deux champs parent* sont renseignés
}
```
`ValiderOnboardingUseCase` (cas `LES_DEUX`) utilise alors `contactEmail`/`contactTelephone` pour le compte ÉLÈVE et `parentContactEmail`/`parentContactTelephone` pour le compte PARENT, au lieu de réutiliser la même paire pour les deux comme aujourd'hui — repli sur le comportement actuel (même contact des deux côtés) si les champs `parent*` ne sont pas renseignés, pour ne rien casser sur les dossiers déjà en cours.

**`CreerSqueletteOnboardingCommande`** — nouveaux champs optionnels : `eleveADispositif?: boolean`, `eleveDispositifOS?: 'ANDROID'|'IOS'|'AUTRE'`, `parentADispositif?: boolean`, `parentDispositifOS?: 'ANDROID'|'IOS'|'AUTRE'` (utilisés pour `AUTOSERVICE`, transmis à `ValiderOnboardingUseCase` via le squelette).

**Formulaire self-service** (`SoumettreFormulaireOnboardingCommande.donneesComplementaires`) — mêmes clés, aucun changement de schéma (déjà un `Json?`).

**Export PDF du formulaire** (nouveau, remplace l'idée initiale de "formulaire papier" séparé) — un bouton "Exporter en PDF" sur l'écran de suivi du squelette, qui génère (réutilise `PdfKitBulletinService`/l'infra PDF déjà en place) le MÊME formulaire que la version en ligne, imprimable. Le staff le remet en main propre à la famille sans accès numérique ; les réponses manuscrites sont ensuite retapées par le staff dans le même `SoumettreFormulaireOnboardingUseCase` — aucun canal de saisie parallèle à maintenir, une seule source de vérité pour le contenu du formulaire.

**`determinerRecipientType()`** — étendu pour recevoir ces réponses et en déduire le `recipientType`, selon la matrice 3.1, avec les mêmes garde-fous que la règle CONCOURS actuelle (jamais d'override si une règle structurelle s'applique — ici, la présence/absence de smartphone prime sur `defaultRecipient`).

**`ValiderOnboardingUseCase`** — quand aucun `eleveADispositif`/`parentADispositif` n'est vrai mais qu'un téléphone existe : crée le(s) compte(s) normalement (Principe 1 — le dossier existe toujours) mais avec `accessMode: 'SMS_ONLY'` ; saute la génération du `resetToken`/lien d'activation (inutile, personne ne peut l'ouvrir) ; le téléphone reste exploitable tel quel par tout le système SMS existant (`ParentStudent → ParentProfile → User.phone`, aucun changement nécessaire côté `SmsNotificationService`).

## 3.4 Rôle staff habilité — décision actée

**Permission fine dédiée, confirmée par l'utilisateur** ("ça me dérange" que n'importe quel staff puisse créer/valider un dossier aujourd'hui). Ajout de `MANAGE_ENROLLMENT` au type `StaffPermissionType`, vérifiée dans `EleveOnboardingController` — même pattern que le fix RBAC de Discipline/APEE/Bibliothèque de juillet 2026 (vérification en dur dans le contrôleur, pas seulement `requireRole('ADMIN','STAFF')` générique). Attribuée par défaut au titre Intendant/Bursar dans `StaffPermissionRules.ts` (celui qui encaisse déjà l'inscription dans le scénario de référence), configurable ensuite comme les autres permissions.

---

# SECTION 4 — AXE 3 : MATERNELLE/PRIMAIRE (cas particulier de l'axe 2)

Confirmé par l'utilisateur : aucun débat à avoir, aucun élève de maternelle/primaire n'a de compte, que l'enfant ait un téléphone ou non — tout passe par le parent. Ça simplifie la matrice de l'axe 2 à un seul choix : le parent a un smartphone, ou seulement un téléphone SMS (ou aucun).

**Détection technique** : `Section.cycle` (`SectionCycle = "maternelle" | "primaire" | "secondaire" | "technique"`, déjà utilisé par `coreDomainDefaults.ts` pour la résolution du sous-système) est le signal fiable déjà présent dans le schéma — une `Class` référence toujours une `Section`.

**Changement dans `determinerRecipientType()`** : si `Class.section.cycle` ∈ {`maternelle`, `primaire`} → `recipientType = PARENT` **forcé**, exactement la même mécanique que la règle CONCOURS existante (aucun override possible, ni par `recipientTypeExplicite` ni par `defaultRecipient`). Le compte élève technique continue d'être créé (Principe 1, FK requises partout — notes, présences, bulletins), simplement sans email/téléphone propre ni lien d'activation, comportement déjà existant pour `recipientType=PARENT`.

**`ageThresholdForParent` (Section 1.2, point 2)** : conservé comme filet de sécurité secondaire pour les cas ambigus (ex. établissement multi-niveaux où le cycle de la classe n'est pas encore renseigné), mais la détection par `Section.cycle` est la règle primaire — plus fiable qu'un seuil d'âge déclaratif.

---

# SECTION 5 — LE CAS SPÉCIFIQUE DE L'ENTRÉE EN 6E

Déjà détaillé en 1.1 et 3.2. Résumé de ce qui change concrètement pour ce flux précis :

1. **Rien à changer sur l'import des listes** (`AjouterCandidatsConcoursUseCase`) — déjà conforme à la réalité terrain (listes transmises par le primaire, pas de dossier individuel).
2. **`EnregistrerResultatCepUseCase` continue de créer le squelette automatiquement** — mais désormais, le squelette créé pour un enfant admis en 6e est de toute façon voué à `recipientType=PARENT` par DEUX règles qui se recoupent (CONCOURS **et** souvent encore primaire/6e tout juste commencée) — pas de conflit, la même conclusion.
3. **Aucun contact réel n'existe entre la réception des listes et la validation finale** (confirmé par l'utilisateur) — la capture de la capacité numérique se fait donc uniquement **quand la famille se présente physiquement**, que ce soit juste après les résultats ou seulement à la rentrée. **Pas de date limite imposée par le système** — bloquer un dossier faute de délai contredirait le Principe 1.
4. **Deux chemins possibles à ce moment-là, selon l'accès de la famille** :
   - Un smartphone existe quelque part dans le foyer → on ne demande que l'email à la personne concernée, le reste du formulaire se remplit à distance via le lien envoyé.
   - Aucun accès → le staff imprime le formulaire (export PDF, voir 3.3), le remet à la famille (ou le remplit avec elle sur place), puis retape les réponses dans le même `SoumettreFormulaireOnboardingUseCase`. Même formulaire, même contenu, juste un support papier intermédiaire — pas de mécanisme séparé à construire.

---

# SECTION 6 — DÉCISIONS ACTÉES ET DÉCISIONS OUVERTES

## 6.1 Actées par l'utilisateur (juillet 2026)
- Toute information sur l'élève doit être renseignée systématiquement, quel que soit son accès numérique (Principe 1) — confirmé, déjà l'invariant du code actuel.
- Maternelle/primaire : jamais de compte élève, toujours le parent (Section 4) — confirmé.
- Pas de nouveau sous-rôle STAFF dédié aux inscriptions, mais **une permission fine `MANAGE_ENROLLMENT` est nécessaire** — confirmé : le statu quo (n'importe quel staff peut créer/valider un dossier) n'est pas acceptable. Rattachée par défaut au titre Intendant (Section 3.4).
- **Cas extrême "aucun téléphone nulle part dans le foyer"** — le dossier existe quand même (Principe 1) ; la contrainte actuelle de `CreerSqueletteOnboardingUseCase` (« un email ou un numéro de téléphone de contact est requis ») est **assouplie** pour ce cas précis — confirmé, "on assouplit".
- **Deux contacts distincts (élève et parent) plutôt qu'un seul partagé** — confirmé : `InscrireUtilisateurUseCase` (création directe, section Utilisateurs/copilot) le fait déjà correctement ; le module self-service (`StudentOnboarding`) doit s'aligner (Section 3.3, champs `parentContactEmail`/`parentContactTelephone`).
- **CEP / entrée en 6e** — capture uniquement à la présentation physique de la famille, sans délai imposé ; formulaire papier remplacé par un export PDF du même formulaire en ligne (Section 5).
- Ce plan formalisé avant implémentation — confirmé.

## 6.2 Ouvertes
Aucune à ce stade — les trois points en suspens ont tous été tranchés. Reste à vérifier en implémentant : le comportement de repli quand `parentContactEmail`/`parentContactTelephone` ne sont pas renseignés sur un dossier `LES_DEUX` (Section 3.3 — reprend le comportement actuel par défaut, à confirmer que ça reste correct en pratique).

---

# SECTION 7 — DEFINITION OF DONE

1. ✅ Un enfant de maternelle/primaire est onboardé → aucun compte élève utilisable n'est créé, le parent reçoit systématiquement le lien, quel que soit ce qui est saisi ailleurs. `determinerRecipientType()` force `PARENT` dès que `Class.section.cycle ∈ {maternelle, primaire}`, non-overridable (même mécanique que CONCOURS).
2. ✅ Une famille secondaire sans aucun smartphone (mais avec un numéro) est onboardée en personne → le dossier élève est complet, le compte existe en `accessMode=SMS_ONLY`, aucun email/SMS d'activation n'est envoyé, une notification SMS informative (`notifyOnboardingActivatedSmsOnly`) atteint bien le numéro enregistré.
3. ✅ Un enseignant peut saisir une note pour un élève dont la famille n'a aucun compte actif — inchangé, `StudentProfile` est toujours créé indépendamment de `recipientType`/`accessMode`.
4. ✅ Un candidat admis en 6e (post-CEP) suit le parcours décrit en Section 5 sans blocage — `EnregistrerResultatCepUseCase` passe désormais `aucunContactDisponible: !parentPhone` (le dossier se crée même sans aucun téléphone) ; la capacité numérique est captée soit au squelette (si contact connu), soit sur le formulaire public au moment de la soumission (nouveaux champs `eleveADispositif`/`parentADispositif`), avant la validation qui détermine `accessMode`.
5. ✅ Aucune régression sur le flux `AUTOSERVICE`/`ELEVE` existant — recette par les tests unitaires `rules.test.ts` (20/20 passent) + repli explicite sur l'ancien comportement partagé quand `parentContactEmail`/`parentContactTelephone` sont absents.
6. ✅ Un dossier `LES_DEUX` avec un email élève et un email parent distincts crée bien deux comptes joignables chacun à sa propre adresse — `ValiderOnboardingUseCase` utilise `contactEmail`/`contactTelephone` pour le compte ÉLÈVE et `parentContactEmail`/`parentContactTelephone` pour le compte PARENT dès que ces derniers sont renseignés (validation anti-collision à la création du squelette).
7. ✅ Un membre du staff sans la permission `MANAGE_ENROLLMENT` ne peut plus créer ni valider de dossier d'onboarding (403 explicite, `EleveOnboardingController.checkEnrollmentPermission`) ; Intendant/Économe/Bursar l'ont par défaut dans `StaffPermissionRules.ts`.
8. ✅ Le formulaire d'onboarding est exportable en PDF (`GET /api/v2/eleve-onboarding/:id/pdf`, `generateOnboardingFormPdf`), imprimable, avec les mêmes champs que la version en ligne + l'URL du lien en clair.
9. ✅ `tsc --noEmit` propre (backend + frontend), migration `20260721084723_add_digital_diversity_onboarding` créée et appliquée, `bun test` : 229/247 passent (les 18 échecs sont des tests d'intégration Prisma pré-existants nécessitant une base de test non provisionnée dans cet environnement — aucun rapport avec ce chantier).

---

# SECTION 8 — RISQUES ET POINTS DE VIGILANCE

1. **Ne jamais faire de la capacité numérique une barrière à l'inscription.** Le dossier doit toujours pouvoir être créé, même dans le pire des cas (aucun téléphone) — voir décision ouverte 6.2.2.
2. **Ne pas complexifier `StudentOnboarding` au-delà du besoin réel** — un seul couple de contact reste suffisant pour cette version (décision 6.2.3), ne pas anticiper un besoin de contacts multiples non demandé.
3. **`accessMode=SMS_ONLY` ne doit jamais bloquer silencieusement une fonctionnalité** — un compte SMS-only doit rester un `User` normal pour tout le reste du système (notes, présences, bulletins) ; seul le mécanisme d'activation/connexion change.
4. **Confusion possible entre `recipientType` (qui reçoit le lien de configuration) et `accessMode` (comment on notifie ensuite)** — ce sont deux dimensions orthogonales, bien les documenter séparément dans le code pour éviter qu'un futur chantier les confonde.

---

*Document de pilotage — implémentation terminée (juillet 2026). Fichiers touchés : `schema.prisma` (+migration), `eleveOnboarding/{types,rules,CreerSqueletteOnboardingUseCase,SoumettreFormulaireOnboardingUseCase,ValiderOnboardingUseCase}.ts`, `EleveOnboardingController.ts` + routes, `StaffPermissionRules.ts`, `enums.ts`, `SmsNotificationService.ts`, `onboardingNotifications.ts`, `onboardingDocuments.ts` (nouveau), `eleveOnboardingJobs.ts`, `EnregistrerResultatCepUseCase.ts`, `SectionEleveOnboarding.tsx`, `eleve-onboarding/[token]/page.tsx`, locales fr/en (`admin.json`, `onboarding.json`). Pas de gating client-side ajouté côté staff dashboard : ce module n'a pour l'instant d'écran que côté admin (`SectionEleveOnboarding.tsx`), aucune UI staff dédiée n'existe encore pour ce module — le 403 serveur protège déjà l'API quel que soit l'appelant.*
