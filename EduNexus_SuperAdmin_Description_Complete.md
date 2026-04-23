# EduNexus — Description Complète du Dashboard Super Admin
## Document de référence pour implémentation (HTML / React / TypeScript)

---

## 1. CONTEXTE GÉNÉRAL

EduNexus Education est une plateforme camerounaise de gestion multi-établissements scolaires (primaire, secondaire, maternelle, technique, bilingue). Le dashboard décrit ici est l'interface **exclusive** de l'administrateur principal (Ndzana Christophe). Il n'existe aucun autre accès à cette interface.

---

## 2. PALETTE DE COULEURS ET THÈME GLOBAL

Le thème est **100% dark** (foncé), aucune page n'est claire. Voici les couleurs exactes utilisées :

| Rôle | Valeur hex |
|---|---|
| Fond global (body/html) | `#080c18` |
| Fond topbar & cartes | `#0d1225` |
| Fond tableaux & sections | `#101828` |
| Fond cartes infos | `#131f35` |
| Bordures subtiles | `#1a2840` |
| Bordures moyennes | `#223050` |
| Texte principal (titres) | `#f1f5f9` |
| Texte secondaire | `#94a3b8` |
| Texte discret (labels) | `#4b6070` |
| Texte très discret | `#2d3f55` |
| Bleu principal (actions) | `#2563eb` |
| Bleu clair (liens) | `#60a5fa` |
| Vert (active/approuver) | `#16a34a` |
| Vert clair | `#4ade80` |
| Orange (warning/pending) | `#d97706` |
| Orange clair | `#fb923c` |
| Rouge (danger/rejeter) | `#dc2626` |
| Rouge clair | `#f87171` |

**Police principale :** `DM Sans` (Google Fonts), avec `DM Mono` pour les badges techniques. Poids utilisés : 400, 500, 600, 700, 800, 900.

---

## 3. STRUCTURE GÉNÉRALE DE LA PAGE

La page est composée de deux zones fixes :

### 3.1 Topbar (barre de navigation en haut)
- **Position :** `position: sticky; top: 0` — reste visible même en scrollant
- **Hauteur :** 56px
- **Fond :** `#0d1225` avec une bordure inférieure `1px solid #1a2840`
- **Padding horizontal :** 40px de chaque côté
- **Contenu à gauche :** Le logo texte `● EDUNE — SUPER ADMIN` en bleu clair (`#60a5fa`), lettres majuscules, espacement de lettres large. Le `●` est un petit rond bleu lumineux (`#2563eb`) avec un léger glow.
- **Contenu à droite :** Un bouton **"✉ Inviter une école"** en fond bleu plein (`#2563eb`), texte blanc, gras, padding `9px 22px`, border-radius `8px`. Ce bouton est toujours visible sur toutes les pages.

### 3.2 Zone de contenu
- **Largeur maximale :** `max-width: 1200px`, centré horizontalement avec `margin: 0 auto`
- **Padding intérieur :** `36px 40px` (haut/bas et gauche/droite)
- Le fond `#080c18` occupe 100% de l'écran en largeur, mais le contenu est centré dans ce conteneur de 1200px max.

---

## 4. PAGE 1 — HUB DE CONTRÔLE (page principale)

C'est la page d'accueil du super admin. Elle contient tout en un seul endroit.

### 4.1 En-tête de page
- **Titre :** "Hub de Contrôle" — `font-size: 24px`, `font-weight: 800`, couleur `#f1f5f9`
- **Sous-titre :** "Gestion centralisée des établissements camerounais" — `font-size: 13px`, couleur `#4b6070`
- Marge sous le sous-titre : `28px`

### 4.2 Les 4 cartes de statut (Stat Cards)

Affichées en **grille de 4 colonnes égales**, `gap: 14px`, sous le titre.

Chaque carte a :
- `border-radius: 12px`, `padding: 20px 22px`
- Une bordure de `2px solid` colorée selon le statut
- Un fond très sombre teinté de la couleur du statut
- Un effet `box-shadow` glowing quand la carte est **sélectionnée** (active)
- Elle est **cliquable** et filtre le tableau en dessous

| Carte | Label | Couleur label | Fond | Bordure normale | Bordure sélectionnée | Glow sélectionné |
|---|---|---|---|---|---|---|
| PENDING | "PENDING" | `#fb923c` | `#160f04` | `#92400e` | `#f97316` | `rgba(249,115,22,.15)` |
| REJECTED | "REJECTED" | `#f87171` | `#160404` | `#991b1b` | `#ef4444` | `rgba(239,68,68,.15)` |
| APPROVED | "APPROVED" | `#60a5fa` | `#04091a` | `#1e3a6e` | `#3b82f6` | `rgba(59,130,246,.15)` |
| ACTIVE | "ACTIVE" | `#4ade80` | `#041208` | `#166534` | `#22c55e` | `rgba(34,197,94,.15)` |

Contenu de chaque carte :
- **Label :** 9px, `font-weight: 800`, `letter-spacing: 2px`, `text-transform: uppercase`, couleur colorée
- **Chiffre :** 36px, `font-weight: 900`, couleur blanche `#fff`
- **Sous-texte :** 11px, couleur `#4b6070` (description courte)

Au démarrage, **ACTIVE est sélectionné par défaut**.

### 4.3 Barre de recherche

Juste sous les 4 cartes :
- **Fond :** blanc `#ffffff`
- **Border-radius :** `9px`, padding `11px 16px`
- Icône loupe à gauche (couleur `#9ca3af`)
- Input texte avec placeholder "Rechercher par école, email, administrateur..."
- Texte de l'input en `#111827`, placeholder en `#9ca3af`
- La recherche filtre les lignes du tableau en temps réel

### 4.4 Le tableau dynamique

Contenu dans un wrapper avec fond `#101828`, bordure `1px solid #1a2840`, `border-radius: 12px`.

**Barre du tableau (au-dessus des colonnes) :**
- À gauche : texte "Vue filtrée — Filtre : " suivi d'un **badge coloré** indiquant le filtre actif (ex: badge vert "ACTIVE", badge orange "PENDING", badge rouge "REJECTED", badge bleu "APPROVED"). Le badge a un fond plein coloré avec texte blanc.
- À droite : compteur de résultats en couleur très discrète

**En-têtes de colonnes** (6 colonnes) :
- Fond `#0d1225`, texte `10px`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 1px`, couleur `#4b6070`
- Colonnes : **Établissement** (28%) | **Type** (14%) | **Plan** (11%) | **Utilisateurs** (10%) | **Dernière connexion** (17%) | **Actions** (20%)

**Lignes du tableau :**
- Padding cellule : `13px 20px`
- Séparation entre lignes : `1px solid #0f1825`
- Hover : léger fond `rgba(255,255,255,.018)`
- **Nom de l'établissement :** texte blanc `#f1f5f9`, `font-weight: 700`, `font-size: 13px`
- **Type :** badge avec fond `#0f1e38`, texte bleu clair `#7dd3fc`, bordure `1px solid #1e3a6e`, police monospace DM Mono
- **Plan :**
  - Premium → fond `#052e16`, texte `#86efac`, bordure `#166534`
  - Standard → fond `#271900`, texte `#fcd34d`, bordure `#451a03`
  - Non éligible → fond `#1a0505`, texte `#fca5a5`, bordure `#7f1d1d`
- **Utilisateurs :** texte centré, couleur `#64748b`
- **Dernière connexion :** texte `12px`, couleur `#64748b`

**Pied de tableau :**
- Padding `10px 20px`, bordure supérieure, texte `11px`, couleur `#2d3f55`
- Texte : "Dernier accès : Master Admin, il y a 2 min"

---

## 5. COMPORTEMENT DES BOUTONS D'ACTION PAR STATUT

Les boutons dans la colonne **Actions** changent selon l'onglet actif. Tous les boutons sont `border: none`, `border-radius: 7px`, `padding: 8px 18px`, `font-size: 12px`, `font-weight: 700`, texte blanc, `font-family: inherit`.

### Onglet PENDING → 2 boutons côte à côte
- **Approuver** : fond `#16a34a` (vert franc), texte blanc → Cliquer approuve l'école, la fait passer en APPROVED
- **Rejeter** : fond `#dc2626` (rouge), texte blanc → Cliquer rejette l'école, la fait passer en REJECTED

### Onglet REJECTED → 1 bouton
- **Réexaminer** : fond `#d97706` (orange/amber), texte blanc → Permet de réouvrir une demande rejetée

### Onglet APPROVED → 1 bouton
- **Relancer** : fond `#2563eb` (bleu), texte blanc → Relance le processus d'activation vers l'école

### Onglet ACTIVE → 1 bouton
- **Gérer l'établissement →** : fond `#0d7a56` (vert foncé), texte blanc → **Navigue vers la Page 2 (fiche détaillée)**

Tous les boutons ont `transition: filter .15s` et `filter: brightness(1.12)` au hover.

---

## 6. PAGE 2 — FICHE DE GESTION D'UN ÉTABLISSEMENT

Cette page apparaît quand on clique sur **"Gérer l'établissement →"** depuis l'onglet ACTIVE. La page 1 disparaît, la page 2 prend sa place (pas de navigation par URL dans le prototype HTML, mais en React ce serait une route dédiée).

**Au démarrage de la page 2 :** la fenêtre scroll automatiquement vers le haut (`window.scrollTo(0,0)`).

### 6.1 Bouton de retour

- **Texte :** "← Retour au Hub de Contrôle"
- **Style :** texte bleu clair `#60a5fa`, fond transparent, pas de fond coloré, `font-size: 13px`, `font-weight: 700`
- **Hover :** texte `#93c5fd`
- En dessous : un breadcrumb discret "Hub de Contrôle › Gestion active › Fiche établissement" en `#4b6070`

### 6.2 Titre de la page

- **Format :** "Gestion : [Nom de l'école]" — dynamique selon l'école cliquée
- `font-size: 26px`, `font-weight: 800`, couleur `#f1f5f9`
- Sous-titre : "Fiche détaillée et gestion granulaire" en `#4b6070`

### 6.3 Header de l'école

Bloc avec fond `#101828`, bordure `1px solid #1a2840`, `border-radius: 12px`, `padding: 20px 24px`.

Contenu gauche (flex, gap 16px) :
- **Avatar carré** : 52×52px, `border-radius: 12px`, dégradé `linear-gradient(135deg, #1e3a6e, #2563eb)`, initiales de l'école en blanc (`#bfdbfe`), `font-size: 18px`, `font-weight: 900` — les initiales sont générées automatiquement depuis le nom
- **Nom de l'école** : `font-size: 18px`, `font-weight: 800`, blanc
- **Badge ACTIF** : à droite du nom, `font-size: 9px`, `font-weight: 800`, `letter-spacing: 1px`, fond `#052e16`, texte `#4ade80`, `border-radius: 20px`, `padding: 3px 10px`
- **Sous-domaine** : ligne en dessous du nom, `font-size: 12px`, couleur `#4b6070`

### 6.4 Grille d'informations (3 colonnes égales)

Trois cartes côte à côte, chacune avec fond `#101828`, bordure `1px solid #1a2840`, `border-radius: 12px`, `padding: 18px 20px`.

**Titre de chaque carte :** 9px, `font-weight: 800`, uppercase, `letter-spacing: 1.5px`, couleur `#4b6070`, avec une bordure inférieure `1px solid #1a2840` et `padding-bottom: 10px`.

**Lignes d'info :** `display: flex; justify-content: space-between`, label à gauche en `#4b6070` (12px), valeur à droite en `#94a3b8` (12px, `font-weight: 600`).

#### Carte 1 — "Général"
- Adresse (ex: Douala, Littoral)
- Téléphone
- Email contact
- Type d'école
- Plan

#### Carte 2 — "Configuration technique"
- Sous-domaine (ex: lycee-condorcet.edune.cm)
- Email configuré (noreply@edune.cm)
- Plan souscrit
- Fin de contrat
- Utilisateurs (nombre)

#### Carte 3 — "Journal d'audit" (Timeline)
Liste verticale d'événements chronologiques. Chaque item :
- Un **rond coloré** (8×8px, avec `box-shadow` glow subtil) à gauche
- Texte de l'événement en `#94a3b8`, `font-size: 12px`, `font-weight: 600`
- Date en dessous en `#4b6070`, `font-size: 11px`

| Événement | Couleur rond |
|---|---|
| Invitation envoyée | Bleu `#3b82f6` |
| Demande approuvée | Bleu `#3b82f6` |
| Compte admin créé | Vert `#22c55e` |
| Plan mis à jour | Orange `#f97316` |

### 6.5 Zone de danger

Bloc avec fond `#100808`, bordure `1px solid #7f1d1d` (rouge sombre), `border-radius: 12px`, `padding: 20px 24px`.

**Titre :** "⚠ ZONE DE DANGER — ACTIONS IRRÉVERSIBLES" en `#f87171` (rouge clair), 11px, `font-weight: 800`, uppercase, `letter-spacing: 1px`.

**Deux boutons côte à côte (flex, gap: 20px) :**

1. **"⏸ Suspendre l'accès temporairement"**
   - Fond `#d97706` (orange/amber), texte blanc, `padding: 10px 20px`, `border-radius: 8px`, `font-size: 13px`, `font-weight: 700`
   - Description sous le bouton : "Bloquer l'accès sans supprimer les données" en `#5a1e1e`
   - Action : bloque l'école temporairement, les données sont préservées

2. **"🗑 Supprimer l'établissement définitivement"**
   - Fond `#dc2626` (rouge), texte blanc, même style
   - Description : "Tapez 'SUPPRIMER' pour confirmer la suppression permanente" en `#5a1e1e`
   - Action : suppression irréversible, doit demander une confirmation textuelle

---

## 7. MODALE — INVITER UNE ÉCOLE

Déclenchée par le bouton **"✉ Inviter une école"** dans la topbar (disponible sur les deux pages).

### Overlay
- `position: fixed; inset: 0` (couvre tout l'écran)
- Fond `rgba(0,0,0,.82)` avec `backdrop-filter: blur(4px)`
- `z-index: 500`
- Clic en dehors de la modale → ferme la modale

### Fenêtre modale
- Fond `#0d1225`, bordure latérale/inférieure `1px solid #223050`, **bordure supérieure `3px solid #2563eb`** (accent bleu distinctif)
- `border-radius: 14px`, `padding: 30px`, `width: 420px`, `max-width: 95vw`
- `box-shadow: 0 24px 60px rgba(0,0,0,.6)`

**Titre :** "✉ Inviter un établissement" — 18px, `font-weight: 800`, blanc
**Sous-titre :** "Un lien d'inscription sera envoyé à l'administrateur de l'école." — 13px, `#4b6070`

**4 champs du formulaire :**

Chaque champ a un label en 10px, uppercase, `letter-spacing: .8px`, `#4b6070` au-dessus.
Les inputs et selects ont : fond `#080c18`, bordure `1px solid #223050`, `border-radius: 8px`, `padding: 10px 14px`, texte `#f1f5f9`, `font-size: 13px`. Au focus : bordure devient `#2563eb`.

1. **Email du responsable \*** — input type email, placeholder "admin@ecole.cm"
2. **Nom de l'établissement** — input type text, placeholder "Ex: Lycée Condorcet de Douala"
3. **Type d'établissement** — select avec options :
   - Secondaire francophone
   - Secondaire anglophone
   - Primaire francophone
   - Primaire anglophone
   - Maternelle
   - Technique / Professionnel
   - Bilingue
4. **Plan d'abonnement** — select avec options : Premium, Standard, Découverte (gratuit)

**2 boutons d'action (flex, gap: 10px) :**
- **Annuler** (flex: 1) : fond `#131f35`, bordure `1px solid #223050`, texte `#94a3b8`, `font-weight: 600` → ferme la modale
- **Envoyer l'invitation →** (flex: 2) : fond `#2563eb`, texte blanc, `font-weight: 800` → envoie l'invitation

---

## 8. POLITIQUE DE FONCTIONNEMENT — ONBOARDING DES ÉTABLISSEMENTS

### 8.1 Processus d'invitation (la seule porte d'entrée)

L'administrateur principal **ne crée jamais manuellement** un compte d'école. Le seul flux officiel est :

1. L'admin clique sur **"✉ Inviter une école"**
2. Il saisit uniquement l'**email du responsable** (champ obligatoire), + nom et type optionnels
3. Le système génère un **lien sécurisé unique** et l'envoie par email
4. L'établissement clique sur le lien → accède à un **formulaire d'inscription** (page publique, hors dashboard admin) où il saisit :
   - Nom de l'école (si non pré-rempli)
   - Type d'établissement
   - Mot de passe administrateur de l'école
5. Une fois le formulaire soumis → une **demande est créée** avec le statut **PENDING**
6. L'établissement apparaît dans l'onglet **PENDING** du Hub de Contrôle

### 8.2 Cycle de vie des statuts

```
[Invitation envoyée]
        ↓
    PENDING ──→ REJECTED (admin rejette)
        ↓              ↓
    APPROVED       (peut être réexaminé → retour PENDING)
        ↓
    [Email envoyé à l'école pour finalisation]
        ↓
    ACTIVE (école a finalisé son compte)
```

**PENDING** : L'école a soumis sa demande, l'admin doit décider.
- Actions disponibles : **Approuver** ou **Rejeter**

**REJECTED** : L'admin a refusé la demande.
- Action disponible : **Réexaminer** (peut réouvrir la demande)

**APPROVED** : L'admin a validé, un email est envoyé à l'école pour finaliser.
- Action disponible : **Relancer** (renvoyer l'email si l'école n'a pas finalisé)

**ACTIVE** : L'école a finalisé son compte, elle est opérationnelle.
- Action disponible : **Gérer l'établissement →** (accès à la fiche complète)
- Depuis la fiche : **Suspendre** ou **Supprimer**

### 8.3 Actions critiques

**Suspension** (`btn-suspend`) :
- Bloque l'accès à la plateforme de l'école
- Les données sont **préservées**
- Action réversible

**Suppression** (`btn-delete`) :
- **Irréversible**
- Nécessite une confirmation textuelle (taper "SUPPRIMER")
- Supprime définitivement l'établissement et ses données

### 8.4 Journal d'audit (traçabilité)

Chaque établissement possède un journal chronologique automatique :
- Invitation envoyée (date)
- Inscription effectuée (date)
- Demande approuvée (date)
- Compte admin créé (date)
- Activation (date)
- Toute modification de plan (date)

### 8.5 Données collectées sur chaque établissement

- Email du responsable
- Nom de l'établissement
- Type d'établissement
- Sous-domaine attribué (ex: `nom-ecole.edune.cm`)
- Plan d'abonnement (Premium, Standard, Découverte)
- Identifiants administrateur de l'école
- Historique de connexion (dernière connexion)
- Nombre d'utilisateurs actifs
- Date de fin de contrat

---

## 9. RÈGLES D'INTERFACE À RESPECTER IMPÉRATIVEMENT

1. **Aucun bouton "Connexion en tant qu'admin"** sur la fiche d'établissement — le super admin ne se connecte pas comme un admin d'école.
2. **Tous les boutons d'action doivent avoir un fond coloré plein** avec texte blanc — jamais transparent ni sombre sur sombre.
3. **Le bouton "Inviter une école"** est toujours visible en haut à droite, sur toutes les pages.
4. **La barre topbar est sticky** (reste visible au scroll).
5. **Le contenu est centré** avec max-width 1200px — le fond sombre occupe tout l'écran.
6. **Les badges de type** d'établissement utilisent la police monospace.
7. **Les badges de plan** ont 3 états visuellement distincts : Premium (vert), Standard (amber), Non éligible (rouge).
8. **Le tableau est dynamique** : filtré par onglet + rechercheble en temps réel.
9. **Navigation page 1 → page 2** : uniquement depuis l'onglet ACTIVE, bouton "Gérer l'établissement →".
10. **Navigation page 2 → page 1** : bouton retour en haut de la fiche.
11. **La modale** se ferme en cliquant l'overlay ou le bouton Annuler.
12. **Scrollbar personnalisée** : fine (6px), fond `#080c18`, thumb `#223050`.

---

## 10. DONNÉES D'EXEMPLE (pour le prototype)

### Onglet ACTIVE (12 écoles)
| Nom | Type | Plan | Utilisateurs | Dernière connexion |
|---|---|---|---|---|
| Lycée Condorcet | fr_secondary | Premium | 5 | 18 avr. 2026, 14:40 |
| Collège Pierre de Ronsard | fr_secondary | Premium | 5 | 20 avr. 2026, 14:40 |
| École Primaire du Lac | fr_primary | Premium | 13 | 18 avr. 2026, 14:40 |
| École Primaire de Ronsard | fr_primary | Premium | 3 | 18 avr. 2026, 14:40 |
| École Primaire du Arlour | fr_primary | Standard | 5 | 18 avr. 2026, 14:40 |
| Collège Marie Curie | fr_secondary | Premium | 8 | 17 avr. 2026, 09:12 |
| Institut Bilingue du Wouri | bilingual | Premium | 11 | 18 avr. 2026, 08:30 |
| École Maternelle Les Étoiles | maternelle | Standard | 2 | 16 avr. 2026, 15:00 |

### Onglet PENDING (3 écoles)
| Nom | Type | Plan |
|---|---|---|
| École Primaire du Soleil | fr_secondary | Premium |
| Collège Pierre de Ronsard (Nouvelle demande) | fr_secondary | Premium |
| Institut d'Éducation Nouvelle | fr_secondary | Non éligible |

### Onglet APPROVED (5 écoles)
| Nom | Type | Plan | Dernière connexion |
|---|---|---|---|
| École Primaire St. Paul | fr_secondary | Premium | 18 avr. 2026, 14:40 |
| Groupe Scolaire Élite | fr_secondary | Premium | Non disponible |
| École Primaire de Ronsard | fr_secondary | Premium | 18 avr. 2025, 14:40 |
| École Primaire du Corthuet | fr_secondary | Premium | Non disponible |
| Lycée Technique du Sud | technique | Standard | Non disponible |

### Onglet REJECTED (5 écoles)
| Nom | Type | Plan |
|---|---|---|
| École Élémentaire Voltaire | fr_secondary | Premium |
| Lycée Condorcet (Annexe) | fr_secondary | Premium |
| Institut Supérieur du Nord | fr_secondary | Premium |
| Collège Pierre de Ronsard (Refusé) | fr_secondary | Non éligible |
| École Maternelle Les Papillons | maternelle | Non éligible |

---

## 11. RÉSUMÉ VISUEL — CE QU'ON VOIT À L'ÉCRAN

### Page principale (Hub de Contrôle)
```
┌─────────────────────────────────────────────────────────────┐
│ ● EDUNE — SUPER ADMIN                    [✉ Inviter école]  │  ← Topbar sticky, fond #0d1225
├─────────────────────────────────────────────────────────────┤
│                    [max-width 1200px, centré]               │
│                                                             │
│  Hub de Contrôle                                            │
│  Gestion centralisée des établissements camerounais         │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ PENDING  │ │ REJECTED │ │ APPROVED │ │   ACTIVE ✓   │  │  ← 4 cartes cliquables
│  │ orange   │ │  rouge   │ │  bleu    │ │  vert glow   │  │
│  │    3     │ │    5     │ │    5     │ │     12       │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                             │
│  🔍 [Rechercher par école, email...                    ]    │  ← Fond blanc
│                                                             │
│  Vue filtrée — Filtre: [ACTIVE]              8 résultats    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ÉTABLISSEMENT  TYPE      PLAN   USERS  CONNEXION  ACTIONS│
│  │─────────────────────────────────────────────────────│   │
│  │ Lycée Condorcet [fr_sec] [Prem]  5   18 avr...  [Gérer→]│
│  │ Collège Pierre... [fr_sec] [Prem]  5   20 avr... [Gérer→]│
│  │ ...                                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│  Dernier accès : Master Admin, il y a 2 min                 │
└─────────────────────────────────────────────────────────────┘
```

### Page fiche établissement
```
┌─────────────────────────────────────────────────────────────┐
│ ● EDUNE — SUPER ADMIN                    [✉ Inviter école]  │
├─────────────────────────────────────────────────────────────┤
│                    [max-width 1200px, centré]               │
│                                                             │
│  ← Retour au Hub de Contrôle                               │
│  Hub de Contrôle › Gestion active › Fiche établissement     │
│                                                             │
│  Gestion : Lycée Condorcet                                  │
│  Fiche détaillée et gestion granulaire                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [LC] Lycée Condorcet  [ACTIF]                        │   │  ← Header école
│  │      lycee-condorcet.edune.cm                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │   GÉNÉRAL   │  │ CONFIG TECHNIQUE│  │ JOURNAL AUDIT │  │  ← 3 colonnes
│  │ Adresse ... │  │ Sous-domaine ..│  │ ● Invitation  │  │
│  │ Téléphone.. │  │ Email système.  │  │ ● Approuvée   │  │
│  │ Email ...   │  │ Fin de contrat  │  │ ● Compte créé │  │
│  │ Type ...    │  │ Utilisateurs: 5 │  │ ● Plan màj    │  │
│  └─────────────┘  └─────────────────┘  └───────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚠ ZONE DE DANGER — ACTIONS IRRÉVERSIBLES             │   │  ← Fond rouge très sombre
│  │ [⏸ Suspendre temporairement]  [🗑 Supprimer déf.]   │   │
│  │ Bloquer sans supprimer les données  Tapez SUPPRIMER  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Modale Inviter une école
```
┌─────────────────────────────────────────────────────────────┐
│                  [overlay sombre blur]                       │
│          ┌───────────────────────────────┐                  │
│          │▌✉ Inviter un établissement    │  ← Accent bleu haut
│          │ Un lien sera envoyé...        │
│          │                               │
│          │ EMAIL DU RESPONSABLE *        │
│          │ [admin@ecole.cm            ]  │
│          │                               │
│          │ NOM DE L'ÉTABLISSEMENT        │
│          │ [Ex: Lycée Condorcet...    ]  │
│          │                               │
│          │ TYPE D'ÉTABLISSEMENT          │
│          │ [Secondaire francophone    ▼] │
│          │                               │
│          │ PLAN D'ABONNEMENT             │
│          │ [Premium                   ▼] │
│          │                               │
│          │ [Annuler]  [Envoyer →       ] │
│          └───────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

---

*Document rédigé pour EduNexus Education — Plateforme de gestion multi-établissements scolaires camerounais.*
*Admin principal : Ndzana Christophe*
*Ce document suffit à reproduire fidèlement le dashboard super admin, sans accès au fichier HTML source.*
