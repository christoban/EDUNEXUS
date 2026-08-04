# Offline-first V1 — Plan de reprise ultra-détaillé (tâches 4, 7, 8, 11, 12, 13, 14)

> **Destiné à un agent de codage autre que celui qui a écrit ce document** (continuité de travail). Écrit pour être exécutable sans relire toute la conversation d'origine — tout le contexte nécessaire est ici. Le plan produit initial par l'utilisateur (§0 ci-dessous) reste le document de référence produit ; ce fichier-ci est le **plan d'exécution** de sa seconde moitié, avec l'état réel du code vérifié au 2026-08-04.

---

## 0. Le plan d'origine (fourni par l'utilisateur, à respecter)

```
# Plan d'implémentation — Offline-first (V1)

## 0. Principe directeur
| Peut aller offline | Ne peut jamais y aller |
|---|---|
| Consultation de données déjà synchronisées | Paiement Mobile Money |
| Saisie (notes, absences) en file d'attente | Vérification d'unicité nationale (matricule) |
| Ouverture de l'app, session en cache | Tout appel à l'IA générative |
| Navigation générale | Action devant être vue immédiatement par un tiers |

## 1. Stockage local
- Service Worker : cache les fichiers statiques (HTML/JS/CSS).
- IndexedDB : données métier (pas localStorage/sessionStorage pour du volumineux structuré).
- Chiffrement au repos : clé liée à la session/l'appareil (appareils partagés au Cameroun).

## 2. Authentification hors ligne
- Access token ~15 min, rafraîchi silencieusement en arrière-plan.
- Refresh token gradué : Admin/Intendant 7j, Enseignant/Élève/Parent 30j.
- Ouverture de l'app : jeton local valide → dashboard direct, jamais bloqué par le réseau.

## 3. Purge du cache
- Déconnexion explicite → purge immédiate et complète (IndexedDB + jetons).
- Fermeture simple sans déconnexion → cache intact.

## 4. Outbox pattern
- Chaque action offline → table OutboxEntry, idempotency key (UUID v4) générée côté client.
- Serveur vérifie l'idempotency key avant traitement — pas de ré-exécution sur retry.
- Une fois confirmée reçue, l'entrée est retirée localement.
- UI : mise à jour optimiste + indicateur du nombre d'actions en attente.

## 5. Gestion des conflits
- Cas mineurs → dernière écriture gagne (horodatage SERVEUR, pas appareil).
- Données sensibles (note, paiement) → conserver les deux versions, signaler à un humain.

## 6. Cache local et RBAC
- Le cache doit refléter STRICTEMENT ce que l'API aurait renvoyé à ce rôle précis.
- Réutiliser les mêmes filtres RBAC que les endpoints serveur, jamais une logique séparée.

## 8. Definition of done
- Dashboard accessible sans attendre le réseau si session locale valide.
- Saisie hors ligne synchronisée sans perte ni doublon au retour réseau.
- Refresh token expire selon la durée graduée par rôle.
- Cache chiffré au repos, purgé immédiatement sur déconnexion explicite.
- Cache d'un enseignant ne contient jamais de données hors de son périmètre RBAC.
- Conflits sur données sensibles signalés pour arbitrage humain, jamais résolus silencieusement.
```

---

## 1. Ce qui est DÉJÀ FAIT et vérifié — ne pas refaire

Toutes ces briques ont été implémentées et testées en conditions réelles (curl, scripts ponctuels, DB réelle) avant ce document. **Ne pas les reconstruire.**

### 1.1 Service Worker (§1 du plan)
Déjà géré intégralement par `@ducanh2912/next-pwa` (`frontend/next.config.ts`, `withPWA({ dest: "public", register: true, cacheOnFrontEndNav: true, aggressiveFrontEndNavCaching: true })`). Précache les assets de build automatiquement. Le worker custom (`frontend/worker/index.js`) ne gère QUE la réception Web Push (`self.addEventListener('push', ...)`), fusionné dans le SW généré par next-pwa. **Rien à faire ici.**

### 1.2 Jetons gradués (§2 du plan, partiellement)
- `backend/src/infrastructure/services/JwtTokenService.ts` — access token 15 min (constante `ACCESS_EXPIRY`), refresh token gradué par rôle via `REFRESH_EXPIRY_PAR_ROLE` (`ADMIN`/`STAFF` → `7d`, `TEACHER`/`STUDENT`/`PARENT` → `30d`, défaut `7d`).
- `backend/src/infrastructure/http/controllers/UserController.ts` — cookies `access_token`/`refresh_token` synchronisés sur les mêmes durées (`ACCESS_COOKIE_MAX_AGE_MS`, `dureeCookieRefreshMs(role)`), aux DEUX endroits qui les posent (`issueFinalSession` et le handler `refresh`).
- `backend/src/utils/generateToken.ts` — **supprimé** (code mort, incohérent avec `JwtTokenService.ts`, zéro appelant confirmé par grep avant suppression).
- Rafraîchissement silencieux déjà géré par `frontend/src/lib/fetchApi.ts` (`fetchApi()`) : sur 401, refresh dédupliqué + retry automatique de la requête d'origine. **Ne pas retoucher** — fonctionne déjà correctement avec le nouvel access token 15 min (testé : requêtes concurrentes ne déclenchent qu'un seul refresh).

Vérifié via un script ponctuel appelant `JwtTokenService.genererTokens()` pour les 5 rôles et décodant les JWT résultants — durées exactes confirmées.

⚠️ **Note sur l'état du fichier** : `JwtTokenService.ts` a été retouché après la vérification initiale (un linter/le TypeScript checker a resserré le typage — `@types/jsonwebtoken` 9.0.10 n'accepte plus un `string` générique pour `expiresIn`, il faut le type exact `SignOptions['expiresIn']`). Le fichier actuel importe `type SignOptions` et définit `type Duree = NonNullable<SignOptions['expiresIn']>`, avec `ACCESS_EXPIRY`/`REFRESH_EXPIRY_PAR_ROLE`/`REFRESH_EXPIRY_DEFAUT` typés `Duree`. **Ceci est l'état correct et intentionnel — ne pas revenir à `string`.**

### 1.3 Outbox pattern + idempotence (§4 du plan)
- `frontend/src/lib/offline/db.ts` — table `pendingActions` (déjà existante avant ce chantier, structure Dexie) porte désormais un champ **obligatoire** `idempotencyKey: string`.
- `frontend/src/hooks/useSyncQueue.ts` :
  - `addToQueue()` génère `idempotencyKey: crypto.randomUUID()` une seule fois à la création (jamais régénérée).
  - `syncQueue()` trie explicitement par `createdAt` (`.sortBy('createdAt')` — Dexie ne garantit pas l'ordre sur un `where().equals()`) et envoie la clé via l'en-tête HTTP `Idempotency-Key`.
- `backend/prisma/schema.prisma` — nouveau modèle `IdempotencyRecord` (`key` unique, `userId`, `method`, `path`, `statusCode`, `responseBody` Json, `createdAt`). Migration déjà appliquée : `backend/prisma/migrations/20260803074059_ajoute_idempotency_record/`.
- `backend/src/middleware/idempotency.ts` — middleware générique, monté **globalement** dans `backend/src/server.ts` (`app.use(idempotency(prisma))`, juste après le middleware `cors`). No-op total si l'en-tête `Idempotency-Key` est absent (donc zéro impact sur l'usage en ligne normal, qui n'envoie jamais cet en-tête). Ne mémorise que les réponses 2xx — un échec ne "empoisonne" jamais la clé.
- `backend/src/server.ts` — `Idempotency-Key` ajouté à `allowedHeaders` du CORS (sinon bloqué en preflight par le navigateur).

Vérifié en direct sur `POST /api/v2/discipline` (endpoint réel, pas un mock) : même clé envoyée deux fois → même `id`/`createdAt` en réponse (rejeu, confirmé par l'ordre des clés JSON différent — preuve d'une resérialisation depuis la DB, pas d'une ré-exécution) → confirmé en base : 1 seul `DisciplineRecord`, 1 seul `IdempotencyRecord`. Données de test nettoyées après vérification.

**⚠️ Piège Windows découvert et corrigé** : `npx prisma generate` échoue par `EPERM` (verrou DLL) **uniquement si le serveur backend tourne en même temps** (il garde `query_engine-windows.dll.node` ouvert). **Toujours arrêter le serveur avant `prisma generate`** — ce n'est PAS une limitation systématique de l'environnement, contrairement à ce que laissait penser une note précédente d'`ARCHITECTURE.md` (déjà corrigée). Séquence correcte après toute modification de `schema.prisma` :
```bash
# 1. Arrêter le serveur (libère le verrou DLL)
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
# 2. Migrer (depuis backend/)
npx prisma migrate dev --name nom_de_la_migration --skip-generate
# 3. Générer le client (marche maintenant que le serveur est arrêté)
npx prisma generate
# 4. Relancer le serveur (voir §2.3 ci-dessous)
```

### 1.4 Ce qui existait DÉJÀ avant tout ce chantier (juillet 2026, ne pas reconstruire)
- `frontend/src/lib/offline/db.ts` — table `cachedData` (clé, données, horodatage) + Dexie DB `ZekoulABiaDB`.
- `frontend/src/hooks/useCachedFetch.ts` — hook générique lecture avec cache stale-while-revalidate (en ligne → fetch + réécrit cache ; hors ligne/erreur → sert le cache).
- `frontend/src/hooks/useOnlineStatus.ts` — hook simple `navigator.onLine` + listeners `online`/`offline`.
- `frontend/src/components/OfflineIndicator.tsx` — indicateur global d'état de connexion (déjà monté sur les 5 dashboards).
- `frontend/src/app/teacher/dashboard/_components/SectionOfflineStatus.tsx` — page complète de gestion de la file d'attente (statut, liste des actions en attente avec type/endpoint/date/statut, bouton "synchroniser maintenant", bouton supprimer une action). **Existe UNIQUEMENT pour TEACHER** — voir tâche 11 ci-dessous, c'est un vrai gap pour ADMIN/STAFF.

---

## 2. Conventions de ce dépôt — à respecter scrupuleusement

### 2.1 Architecture
- Backend hexagonal : `domain/` (ports/entités, zéro dépendance framework) → `application/` (use cases) → `infrastructure/` (controllers, repositories Prisma, adapters). Ne jamais mettre de logique métier dans un controller au-delà de la validation d'entrée et de l'appel au use case — sauf pour les handlers inline déjà existants dans `hexagonal.bootstrap.ts` (pattern toléré pour des lectures simples sans écriture complexe, voir `/api/v2/school/me`, `/api/v2/school/anomalies`).
- Noms de variables/fonctions/commentaires en **français**, code (mots-clés, noms de types) en anglais — convention strictement suivie dans tout le code existant, à reproduire.
- Frontend : pas de librairie i18n externe, dictionnaires JSON statiques par namespace (`frontend/src/locales/{fr,en}/{namespace}.json`), hook `useT(namespace)`.

### 2.2 Vérification — TOUJOURS dans cet ordre, jamais sauter d'étape
1. **Typecheck backend** : `cd backend && npx tsc --noEmit` (rediriger vers un fichier, jamais un pipe vers `tail`/`head` qui masque le code de sortie réel — un fichier VIDE en sortie = zéro erreur, c'est le seul signal fiable).
2. **Typecheck frontend** : `cd frontend && npx tsc --noEmit` (même règle).
3. **Redémarrer le serveur backend** après toute modif backend (voir §2.3).
4. **Tester en direct** — pas de simulation, de vraies requêtes HTTP (curl) contre le serveur qui tourne, avec de vrais tokens (voir §2.4).
5. **Nettoyer toute donnée de test créée en base** avant de continuer (scripts ponctuels sous `backend/src/scripts/`, supprimés immédiatement après exécution — jamais commités).
6. **Committer seulement après vérification réussie**, jamais avant.

### 2.3 Cycle démarrage/arrêt du serveur backend (Windows)
```bash
# Arrêter proprement (libère aussi le port pour prisma generate si besoin)
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
sleep 1
# Démarrer en arrière-plan, logs dans un fichier scratch
cd backend && (bun run src/server.ts > /tmp/backend.log 2>&1 &)
# Attendre que le serveur réponde (401 = attendu sur une route protégée sans cookie)
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:5000/api/v2/school/me)
  if [ "$code" = "401" ]; then echo "ready after ${i}s"; break; fi
done
```

### 2.4 Générer des tokens de test (sans connaître de vrais mots de passe)
Technique déjà validée et utilisée tout au long de ce chantier — légitime car `JWT_SECRET` est déjà lisible dans `backend/.env` (accès complet à son propre environnement de dev, aucune frontière de sécurité externe franchie) :
```typescript
// backend/src/scripts/gen-test-token.ts (créer, exécuter, SUPPRIMER après usage)
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET!;
async function main() {
  const user = await prisma.user.findFirst({ where: { role: 'TEACHER', school: { name: 'Lycée de Nkolanga' } } });
  if (!user) throw new Error('introuvable');
  const token = jwt.sign(
    { userId: user.id, schoolId: user.schoolId, role: user.role, permissions: [], tokenType: 'access', refreshTokenVersion: 0 },
    JWT_SECRET, { algorithm: 'HS512', expiresIn: '8h' },
  );
  console.log(token);
  await prisma.$disconnect();
}
main();
```
École de test disponible dans la base de dev : **"Lycée de Nkolanga"** (`schoolId f91c2219-13ad-465c-979e-41d448612894`), avec au moins un utilisateur par rôle déjà seedé.

### 2.5 Hygiène des fichiers
- Scripts ponctuels de test/vérification : `backend/src/scripts/nom-explicite.ts`, exécutés via `bun run src/scripts/nom-explicite.ts` depuis `backend/`, **supprimés immédiatement après usage** — jamais commités.
- Toute donnée créée en base pour un test (enregistrement, transaction...) doit être **supprimée après vérification**, avant de continuer.
- Messages de commit : description en français, sans accents dans le résumé (convention déjà suivie dans l'historique — voir `git log`), corps détaillé expliquant le POURQUOI et ce qui a été vérifié, pas juste le QUOI. Toujours terminer par :
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
  (garder cette ligne même si un autre modèle exécute ce plan — convention du dépôt pour tout commit assisté par IA).

---

## 3. TÂCHE 4 — Chiffrement au repos d'IndexedDB

### 3.1 Cadrer correctement ce que ça protège (important, à ne pas survendre)

Le modèle de menace réel énoncé par l'utilisateur : *"contexte camerounais où les appareils sont parfois partagés/empruntés, ne jamais laisser les données en clair dans le stockage du navigateur."* C'est une protection contre une **consultation occasionnelle/opportuniste** (quelqu'un emprunte le téléphone, ouvre les DevTools ou un explorateur de fichiers, tombe sur des notes d'élèves en clair dans IndexedDB).

Ce n'est **PAS** — et ne peut structurellement **PAS** être — une protection contre un attaquant qui a un accès JavaScript complet à la même origine que l'app (si le JS de la page peut déchiffrer la donnée pour l'afficher, un attaquant avec le même niveau d'accès à cette page le peut aussi — limite fondamentale de tout chiffrement côté client web, pas un défaut de conception à corriger). **Documenter cette limite explicitement dans le code** (commentaire) pour qu'un futur lecteur ne surestime pas la garantie.

### 3.2 Conception retenue

- **Web Crypto API native** (`crypto.subtle`, AES-256-GCM) — pas de librairie externe (cohérent avec la conviction du dépôt "pas de lib si le navigateur le fait déjà", voir i18n maison).
- Clé générée aléatoirement (`crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])`) **une fois**, au premier login réussi (ou à la première écriture offline si plus simple à câbler). Exportée (`crypto.subtle.exportKey('jwk', key)`) et stockée dans `localStorage` sous une clé dédiée, ex. `zekoulabia_offline_key` — **séparée** de `zekoulabia_user` pour pouvoir la purger indépendamment si besoin, mais purgée EN MÊME TEMPS lors d'une déconnexion explicite (voir tâche 8).
- **Seuls les champs opaques sont chiffrés**, jamais les champs indexés/interrogeables par Dexie : dans `CachedData`, chiffrer `data` (pas `key`/`cachedAt`) ; dans `PendingAction`, chiffrer `payload` (pas `type`/`endpoint`/`method`/`status`/`createdAt`/`idempotencyKey`). Chiffrer un champ sur lequel Dexie fait un `.where().equals()` casserait la requête (comparaison sur un blob chiffré aléatoire, jamais égal à lui-même sur deux appels — AES-GCM inclut un nonce/IV aléatoire par chiffrement).

### 3.3 Fichiers à modifier

**`frontend/src/lib/offline/crypto.ts`** (nouveau fichier) :
```typescript
const STORAGE_KEY = 'zekoulabia_offline_key'

async function getOrCreateKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const jwk = JSON.parse(stored)
    return crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const jwk = await crypto.subtle.exportKey('jwk', key)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jwk))
  return key
}

/**
 * Chiffre une valeur arbitraire (sérialisée en JSON) pour stockage IndexedDB. Protège contre une
 * consultation occasionnelle du stockage local (appareil partagé/emprunté) — PAS contre un
 * attaquant ayant un accès JS complet à cette origine (limite structurelle de tout chiffrement
 * côté client web, la clé doit être accessible au JS de la page pour être utilisable).
 */
export async function chiffrer(valeur: unknown): Promise<{ iv: number[]; data: number[] }> {
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(valeur))
  const buffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(buffer)) }
}

export async function dechiffrer<T>(chiffre: { iv: number[]; data: number[] }): Promise<T> {
  const key = await getOrCreateKey()
  const iv = new Uint8Array(chiffre.iv)
  const data = new Uint8Array(chiffre.data)
  const buffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return JSON.parse(new TextDecoder().decode(buffer))
}

/** À appeler sur déconnexion explicite (voir tâche 8) — rend tout contenu résiduel illisible. */
export function purgerCle(): void {
  localStorage.removeItem(STORAGE_KEY)
}
```

**`frontend/src/lib/offline/db.ts`** — garder le schéma Dexie tel quel (`data`/`payload` restent typés comme avant côté interface publique, le chiffrement est un détail d'implémentation interne), mais exposer des fonctions wrapper qui chiffrent/déchiffrent en interne :
```typescript
import { chiffrer, dechiffrer } from './crypto'

export async function putCachedData(key: string, data: unknown): Promise<void> {
  const chiffre = await chiffrer(data)
  await db.cachedData.put({ key, data: chiffre, cachedAt: Date.now() })
}

export async function getCachedData<T>(key: string): Promise<{ data: T; cachedAt: number } | undefined> {
  const row = await db.cachedData.get(key)
  if (!row) return undefined
  return { data: await dechiffrer<T>(row.data as any), cachedAt: row.cachedAt }
}

export async function addPendingAction(action: Omit<PendingAction, 'id' | 'status' | 'createdAt' | 'idempotencyKey' | 'payload'> & { payload: unknown }): Promise<void> {
  const payloadChiffre = await chiffrer(action.payload)
  await db.pendingActions.add({ ...action, payload: payloadChiffre, status: 'PENDING', createdAt: Date.now(), idempotencyKey: crypto.randomUUID() })
}

export async function getPendingActionsDechiffrees(): Promise<(PendingAction & { payloadClair: unknown })[]> {
  const rows = await db.pendingActions.toArray()
  return Promise.all(rows.map(async (r) => ({ ...r, payloadClair: await dechiffrer(r.payload as any) })))
}
```
(Adapter les noms/signatures exactes selon ce qui rend la migration des appelants la plus mécanique possible — l'objectif est qu'AUCUN appelant n'ait à connaître le chiffrement, seulement à utiliser `putCachedData`/`getCachedData`/`addPendingAction` au lieu de toucher `db.cachedData`/`db.pendingActions` directement.)

### 3.4 Migration de TOUS les appels existants

**Étape obligatoire avant de considérer la tâche terminée** — lister tous les appels directs actuels et les migrer :
```bash
grep -rn "db\.cachedData\.\|db\.pendingActions\." frontend/src --include="*.tsx" --include="*.ts"
```
Au moment de l'audit initial (avant ce chantier), ces call sites existaient au minimum (RE-VÉRIFIER avec la commande ci-dessus, cette liste peut être incomplète ou avoir changé) :
- `frontend/src/hooks/useCachedFetch.ts` (lecture/écriture `cachedData`)
- `frontend/src/hooks/useSyncQueue.ts` (`addToQueue`, `syncQueue` — lecture/écriture `pendingActions`)
- `frontend/src/app/teacher/dashboard/_components/SectionOfflineStatus.tsx` (lecture `pendingActions` pour affichage)
- Chaque `page.tsx` de dashboard qui précharge des données au montage (`admin`, `teacher`, `staff`, `parent`, `student` — grep `db.cachedData.put` dans `frontend/src/app/*/dashboard/page.tsx`)

Pour chaque site : remplacer l'appel Dexie direct par le wrapper chiffrant équivalent. **Ne pas oublier `SectionOfflineStatus.tsx`** (tâche 11 en dépend aussi) et son futur portage vers ADMIN/STAFF.

### 3.5 Rétrocompatibilité — données déjà en cache AVANT ce changement

Les entrées déjà présentes dans IndexedDB (créées avant ce déploiement) sont en clair, pas au nouveau format chiffré `{iv, data}`. `dechiffrer()` plantera dessus. Deux options, choisir la plus simple à exécuter correctement :
- **Option simple recommandée** : bump de version Dexie (`this.version(2).stores({...})` avec un upgrade hook qui vide `cachedData`/`pendingActions` — les données de lecture se rechargeront naturellement au prochain accès réseau ; **attention** : si `pendingActions` contient des actions non synchronisées au moment de la migration, les vider = perte de données réelles. Vérifier `pendingActions.count()` avant de vider — si non vide, logger un avertissement clair plutôt que de supprimer silencieusement (ou, plus sûr : ne PAS vider `pendingActions`, seulement `cachedData` qui n'est que du cache de lecture reconstructible sans perte).
- Documenter le choix fait avec un commentaire explicite dans le hook de migration Dexie.

### 3.6 Vérification
1. Typecheck frontend.
2. Test manuel navigateur (pas de curl possible ici, c'est du code client) : se connecter, naviguer pour peupler le cache, ouvrir DevTools → Application → IndexedDB → `ZekoulABiaDB` → `cachedData` → confirmer que `data` est un objet `{iv: [...], data: [...]}` (des tableaux de nombres), **jamais du JSON lisible directement**.
3. Confirmer que l'app fonctionne toujours normalement (les données déchiffrées s'affichent correctement à l'écran) — un chiffrement qui casse la lecture est pire qu'aucun chiffrement.
4. Vérifier le comportement offline : couper le réseau (DevTools → Network → Offline), recharger une page déjà visitée, confirmer que les données mises en cache s'affichent quand même (déchiffrement réussi sans réseau).

---

## 4. TÂCHE 7 — Ouverture de l'app hors ligne (jeton local avant réseau)

### 4.1 Constat important : déjà partiellement fait, par un autre chantier en parallèle

`frontend/src/app/admin/dashboard/page.tsx` a été modifié (par l'utilisateur ou un autre processus, en parallèle de ce chantier) et contient DÉJÀ un pattern proche de ce qui est demandé :
```typescript
useEffect(() => {
  try {
    const raw = localStorage.getItem('zekoulabia_user')
    if (raw) setSessionUser(JSON.parse(raw) as SessionUser)
  } catch { /* ignore */ }

  fetchApi('/api/v2/school/me')
    .then(r => {
      if (r.status === 401) { router.replace('/login'); return Promise.reject('auth') }
      return r.json()
    })
    .then(d => { /* ... */ })
    .catch(err => { if (err !== 'auth') console.warn('[dashboard] Erreur réseau:', err) })
  // ...
}, [router, showToast])
```
Points déjà corrects :
- `sessionUser` est lu de `localStorage` **de façon synchrone**, sans attendre le réseau — le rendu peut commencer immédiatement avec ces données.
- La redirection vers `/login` ne se déclenche QUE sur un vrai `401` (session serveur réellement invalide), jamais sur une simple erreur réseau (`fetch` qui rejette pour cause hors-ligne tombe dans le `.catch`, qui ignore silencieusement sauf log console) — c'est exactement le comportement voulu : **pas de réseau ≠ pas de session valide**.

### 4.2 Ce qui reste réellement à faire

1. **Auditer les 4 autres dashboards** (`frontend/src/app/{teacher,staff,parent,student}/dashboard/page.tsx`) et vérifier qu'ils suivent le MÊME pattern que admin (ci-dessus). Au moment de la dernière vérification connue :
   - `staff/dashboard/page.tsx` lisait déjà `zekoulabia_user` depuis localStorage de façon synchrone (`getSectionsFromPermissions(user.permissions)`), à confirmer que la logique réseau ne bloque pas le rendu ni ne redirige sur une simple erreur réseau.
   - `parent/dashboard/page.tsx` et `student/dashboard/page.tsx` appelaient `fetchApi('/api/v2/users/me')` et `fetchApi('/api/v2/school/me')` au montage — **vérifier si un 401 déclenche une redirection agressive, et si une erreur réseau (offline) est bien distinguée d'un 401** (probablement pas encore aussi soigné qu'admin — c'est le vrai travail de cette tâche).
   - **Uniformiser les 5 dashboards sur le pattern d'admin** : lecture localStorage synchrone en premier, `fetch` en arrière-plan, redirection login UNIQUEMENT sur 401 explicite, jamais sur erreur réseau/timeout.

2. **Ne jamais bloquer le premier rendu sur une promesse réseau.** Vérifier qu'aucun des 5 `page.tsx` n'a de pattern du type `if (loading) return <Spinner />` où `loading` reste `true` tant qu'un fetch réseau n'a pas répondu — un tel pattern bloquerait complètement l'app hors ligne même avec un jeton local valide. Si un tel pattern existe, le remplacer par : rendu immédiat avec les données locales disponibles (potentiellement `undefined`/`null` pour certains champs le temps que le réseau réponde), jamais un écran de chargement bloquant indéfiniment hors ligne.

3. **Cas limite à gérer explicitement** : `localStorage.getItem('zekoulabia_user')` absent (jamais connecté sur cet appareil, ou purgé — voir tâche 8) → comportement actuel correct déjà (rien à afficher, attendre la réponse réseau normalement, rediriger vers `/login` si 401 ou si le réseau répond et confirme qu'il n'y a pas de session). Ne pas casser ce cas en modifiant les 4 autres dashboards.

### 4.3 Vérification
- Pour chacun des 5 dashboards : se connecter normalement en ligne, couper le réseau (DevTools → Network → Offline), recharger la page (F5). **Le dashboard doit s'afficher avec les données en cache, jamais un écran blanc ni une redirection vers `/login`.**
- Reconnecter le réseau, confirmer que les données se rafraîchissent normalement en arrière-plan.
- Cas régression à tester : couper le réseau AVANT de s'être jamais connecté (localStorage vide) → doit toujours rediriger vers `/login` normalement une fois que le réseau répond (pas de faux positif "session valide" sans donnée locale réelle).

---

## 5. TÂCHE 8 — Purge du cache sur déconnexion explicite

### 5.1 Fichier à modifier

**`frontend/src/lib/userAuth.ts`** — état actuel :
```typescript
export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/v2/users/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // Même si le serveur est inaccessible, on redirige quand même
  }
  window.location.href = '/login'
}
```
Le serveur invalide déjà correctement la session (`DeconnecterUtilisateurUseCase.execute()` incrémente `refreshTokenVersion`, révoquant tous les refresh tokens existants — **ne pas toucher ce mécanisme, il fonctionne déjà correctement**). Ce qui manque : la purge du **stockage local**.

### 5.2 Modification à apporter

```typescript
import { db } from '@/lib/offline/db'
import { purgerCle } from '@/lib/offline/crypto' // voir tâche 4 — si la tâche 4 n'est pas encore faite, retirer cet import et l'appel correspondant

export async function logoutUser(): Promise<void> {
  // Avertir si des actions ne sont pas encore synchronisées — les perdre silencieusement sur
  // une déconnexion explicite serait une vraie perte de données (note/absence saisie hors ligne,
  // jamais envoyée au serveur). Recommandé fortement, pas dans le plan d'origine mot pour mot,
  // mais découle directement de son esprit ("ne jamais perdre de données").
  const pendingCount = await db.pendingActions.where('status').anyOf(['PENDING', 'FAILED']).count()
  if (pendingCount > 0) {
    const confirme = window.confirm(
      `${pendingCount} action(s) non synchronisée(s) seront perdues si vous vous déconnectez maintenant. Continuer quand même ?`
    )
    if (!confirme) return
  }

  try {
    await fetch('/api/v2/users/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // Même si le serveur est inaccessible, on purge et redirige quand même
  }

  // Purge immédiate et complète du cache local — cas de sécurité réel (appareil partagé),
  // aucun délai de grâce (Plan offline-first V1 §3).
  await db.cachedData.clear()
  await db.pendingActions.clear()
  localStorage.removeItem('zekoulabia_user')
  purgerCle() // clé de chiffrement — voir tâche 4

  window.location.href = '/login'
}
```

**Décision produit à valider avec l'utilisateur si l'agent qui exécute ce plan a un doute** : la boîte de dialogue `window.confirm` sur actions non synchronisées est une recommandation forte de bon sens (cohérente avec "ne jamais perdre de données", esprit général du plan), mais n'était pas explicitement demandée mot pour mot dans le plan d'origine. Si le contexte d'exécution ne permet pas de trancher, l'implémenter quand même (le risque de la retirer — perte de données silencieuse — est strictement pire que le risque de la garder).

### 5.3 Ce qui ne doit PAS changer

Une fermeture simple de l'onglet/l'app (pas de clic explicite sur "Se déconnecter") ne doit déclencher AUCUNE purge — le cache reste intact pour que l'usage offline garde son intérêt au prochain lancement. **Ne pas ajouter de `beforeunload`/`visibilitychange` qui viderait quoi que ce soit.** C'est déjà le comportement par défaut d'IndexedDB/localStorage (persistent tant que rien ne les vide explicitement) — aucune action nécessaire pour cette moitié de la tâche, juste vérifier qu'aucun code existant ne le fait déjà par erreur (`grep -rn "beforeunload\|visibilitychange" frontend/src` et inspecter chaque résultat).

### 5.4 Vérification
1. Typecheck frontend.
2. Se connecter, naviguer pour peupler le cache, vérifier en DevTools → IndexedDB que `cachedData`/`pendingActions` contiennent des données et que `localStorage` contient `zekoulabia_user` (+ `zekoulabia_offline_key` si tâche 4 faite).
3. Cliquer "Se déconnecter" (sans action en attente) → vérifier immédiatement en DevTools que `cachedData`/`pendingActions` sont VIDES et que les deux clés localStorage ont disparu.
4. Refaire le test avec une action en attente dans la queue (couper le réseau, faire une saisie qui va en queue, tenter de se déconnecter) → vérifier que la boîte de confirmation apparaît, et que refuser annule la déconnexion (rien n'est purgé).
5. Fermer simplement l'onglet (pas de clic déconnexion) puis rouvrir l'app → vérifier que le cache est TOUJOURS là (pas de purge involontaire).

---

## 6. TÂCHE 11 — Indicateur visuel du nombre d'actions en attente

### 6.1 Constat

`frontend/src/app/teacher/dashboard/_components/SectionOfflineStatus.tsx` existe déjà et fonctionne (statut en ligne/hors ligne, compteur, liste détaillée des actions en attente avec type/endpoint/date/statut, bouton "synchroniser maintenant", bouton supprimer une action individuelle). Utilise `useT('teacher')` — c'est le SEUL point qui le rend spécifique à un rôle, le reste du composant est déjà générique.

**Gap réel** : ADMIN et STAFF utilisent aussi `addToQueue()` (via `SectionAffectations.tsx`, `SectionGrilleHoraire.tsx`, `SectionPedagogie.tsx` pour admin ; `SectionAffectations.tsx`, `SectionAPEEStaff.tsx`, `SectionDiscipline.tsx`, `SectionGrilleHoraire.tsx`, `SectionLibrary.tsx`, `SectionOrientation.tsx` pour staff) mais n'ont **aucune vue équivalente** pour voir/gérer leur file d'attente. PARENT et STUDENT n'utilisent pas `addToQueue` du tout (rôles en lecture seule ou presque, cohérent avec le §0 du plan — pas de gap à combler pour eux).

### 6.2 Approche recommandée : promouvoir le composant en composant partagé

1. Déplacer `frontend/src/app/teacher/dashboard/_components/SectionOfflineStatus.tsx` vers `frontend/src/components/SectionOfflineStatus.tsx`.
2. Ajouter une prop `namespace: 'teacher' | 'admin' | 'staff'` et remplacer `useT('teacher')` par `useT(namespace)`.
3. Mettre à jour l'import dans `teacher/dashboard/page.tsx` en passant `namespace="teacher"`.
4. Dupliquer les clés i18n `sync.*` (déjà dans `frontend/src/locales/{fr,en}/teacher.json`) vers `admin.json` et `staff.json` — mêmes clés, traductions identiques (le texte ne dépend pas du rôle).
5. Ajouter une nouvelle section (ex. `'sync-offline'` ou `'hors-ligne'`) dans `AdminSection`/`StaffSection` (`_types.ts` de chaque dashboard), l'entrée de navigation correspondante dans `AdminSidebar.tsx`/`StaffSidebar.tsx`, et le rendu conditionnel dans `admin/dashboard/page.tsx`/`staff/dashboard/page.tsx` (même pattern que les autres sections déjà présentes).

### 6.3 Vérification
1. Typecheck frontend.
2. Pour ADMIN et STAFF : couper le réseau, faire une action qui passe par `addToQueue` (ex. une affectation d'enseignant pour admin, une transaction APEE pour staff), naviguer vers la nouvelle section — confirmer que l'action apparaît dans la liste avec le bon statut `PENDING`.
3. Reconnecter le réseau, cliquer "synchroniser maintenant" — confirmer que l'action disparaît de la liste après synchronisation réussie.
4. Confirmer que TEACHER continue de fonctionner exactement comme avant (non-régression du déplacement de fichier).

---

## 7. TÂCHE 12 — Gestion des conflits

### 7.1 Cadrage du périmètre réel (important, réduit le travail)

Le plan distingue deux cas :
- **Cas mineurs → dernière écriture gagne, horodatage SERVEUR.** C'est déjà le comportement par défaut de n'importe quel `UPDATE` classique en base — le serveur traite les requêtes dans l'ordre où elles arrivent, la dernière reçue écrase la précédente naturellement, sans avoir besoin de comparer un horodatage client. **Aucun code n'est nécessaire pour ce cas** — ne pas sur-ingénierer un mécanisme de comparaison de timestamp pour un comportement déjà obtenu gratuitement par l'ordre naturel de traitement des requêtes HTTP.
- **Cas sensibles (note, paiement) → conserver les deux versions + signalement humain.** C'est le seul cas qui demande du vrai travail. **Note importante** : les paiements Mobile Money sont explicitement dans la colonne "ne peut jamais aller offline" du §0 du plan — ils ne transitent donc JAMAIS par la queue Outbox (`PendingAction['type']` ne contient aucun type lié aux paiements/factures). **Le seul type réellement concerné par ce mécanisme, parmi les 12 types actuels de `PendingAction`, est `GRADE`.** `APEE_TRANSACTION` est financier au sens large (fonds de l'association de parents) mais n'est pas littéralement "paiement" au sens du plan — à la discrétion de qui exécute ce plan de l'inclure aussi dans le même mécanisme (recommandé si le temps le permet, pas bloquant sinon).

### 7.2 Conception — détection de conflit par version

**Prérequis schéma** : le modèle `Grade` (`backend/prisma/schema.prisma`, autour de la ligne 1099) a déjà `createdAt` mais **pas de `updatedAt`** — nécessaire pour détecter qu'une note a été modifiée par quelqu'un d'autre entre le moment où l'utilisateur hors ligne a commencé son édition et le moment où sa synchronisation arrive au serveur.

1. **Migration schéma** : ajouter `updatedAt DateTime @updatedAt` au modèle `Grade`. Suivre la procédure §1.3 ci-dessus (arrêter le serveur, migrer avec `--skip-generate`, `prisma generate`, relancer).

2. **Côté client, capturer une version de base** : dans `frontend/src/app/teacher/dashboard/_components/SectionTeacherGrades.tsx` (le point d'entrée qui appelle `addToQueue({ type: 'GRADE', ... })`), inclure dans le `payload` un champ `baseUpdatedAt` — la valeur de `updatedAt` de la note TELLE QUE CONNUE LOCALEMENT au moment de la saisie hors ligne (si la note existe déjà et a été chargée avant la coupure réseau ; si c'est une note qui n'existe pas encore côté serveur, `baseUpdatedAt: null`).

3. **Côté serveur, endpoint de saisie de note** (trouver le controller/route exact avec `grep -rn "grades" backend/src/infrastructure/http/routes/` — probablement `GradeController.ts` ou un handler inline dans `hexagonal.bootstrap.ts`) : avant d'écrire, si `baseUpdatedAt` est fourni ET que la note existe déjà, comparer avec le `updatedAt` ACTUEL en base :
   - Si égaux (ou note inexistante et `baseUpdatedAt: null`) → écriture normale, pas de conflit.
   - Si différents → un tiers a modifié cette note entre-temps. **Ne pas écraser.** Répondre `409 Conflict` avec un corps `{ success: false, code: 'CONFLIT_VERSION', versionServeur: <la note actuelle telle qu'elle est en base>, versionLocale: <ce que le client tentait d'écrire> }`.

4. **Côté client, `useSyncQueue.ts`** : dans `syncQueue()`, traiter spécifiquement le cas `res.status === 409` différemment d'un échec ordinaire — actuellement tout échec (`if (!res.ok) throw ...`) marque l'action `FAILED`, ce qui suggère à tort qu'un simple retry pourrait résoudre le problème (faux pour un vrai conflit de version, retenter renverra le même 409 indéfiniment). Ajouter un nouveau statut `'CONFLICT'` à l'union de `PendingAction['status']` (actuellement `'PENDING' | 'SYNCING' | 'FAILED'`), et stocker aussi `versionServeur`/`versionLocale` reçus dans l'entrée `PendingAction` correspondante (étendre l'interface si besoin, ou stocker dans un champ `conflictData?: unknown`).

5. **UI d'arbitrage** : dans la vue de gestion de la file d'attente (§6 ci-dessus, `SectionOfflineStatus.tsx` partagé), pour toute action au statut `CONFLICT`, afficher les deux versions côte à côte avec deux boutons : "Garder ma version" (renvoie la requête en forçant l'écrasement — un flag `forcer: true` que le serveur accepte sans revérifier la version) et "Garder celle du serveur" (supprime simplement l'entrée locale sans l'envoyer). **Ne jamais résoudre automatiquement** — c'est explicitement l'exigence du plan ("signaler explicitement le conflit à un humain habilité pour arbitrage — jamais d'écrasement silencieux").

### 7.3 Vérification
1. Migration + typecheck backend + frontend.
2. Scénario de test réel :
   - Créer/charger une note pour un élève (noter son `updatedAt`).
   - Simuler une modification "par quelqu'un d'autre" : modifier directement la note en base via un script ponctuel (change `sequenceScore` et laisse `@updatedAt` se déclencher naturellement).
   - Envoyer une requête de synchronisation avec l'ancien `baseUpdatedAt` (celui d'avant la modification) → confirmer une réponse `409` avec les deux versions dans le corps.
   - Confirmer que l'entrée passe au statut `CONFLICT` côté client (pas `FAILED`), et qu'aucune note n'a été silencieusement écrasée en base (revérifier avec un script ponctuel).
   - Tester les deux boutons d'arbitrage, confirmer que chacun fait ce qui est attendu.
3. Nettoyer toute donnée de test créée.

---

## 8. TÂCHE 13 — Audit RBAC du contenu mis en cache

### 8.1 Objectif

Le plan (§6) est strict : *"Le cache local doit strictement refléter ce que l'API aurait renvoyé à ce rôle précis — jamais plus [...] Vérifier que la logique de préchargement/mise en cache réutilise les mêmes filtres RBAC que les endpoints serveur, pas une logique de cache séparée et potentiellement plus permissive."*

C'est un audit, pas une nouvelle fonctionnalité — la bonne nouvelle : **l'architecture actuelle rend une fuite structurellement peu probable**, parce que `useCachedFetch`/`putCachedData` ne font QUE mettre en cache le résultat déjà retourné par un appel à `fetchApi('/api/v2/...')` normal — c'est-à-dire un appel qui passe par le MÊME endpoint serveur, avec le MÊME `requireAuth`/`requireRole`/scoping RBAC que n'importe quel appel en ligne. Il n'existe pas de "logique de cache séparée" qui recalculerait quoi mettre en cache indépendamment de ce que l'API a réellement renvoyé. **Le risque réel n'est donc pas "le cache invente une fuite", c'est "un endpoint serveur lui-même est déjà trop permissif, et le cache se contente fidèlement de refléter cette fuite."**

### 8.2 Méthode d'audit

1. Lister tous les endpoints dont la réponse est mise en cache via `putCachedData`/`db.cachedData.put` (`grep -rn "putCachedData\|db.cachedData.put" frontend/src`).
2. Pour chaque endpoint identifié, remonter au controller/route serveur correspondant et vérifier :
   - `requireAuth` + `requireRole(...)` sont bien présents sur la route.
   - La requête Prisma sous-jacente filtre bien par `schoolId` (isolation multi-tenant — règle absolue du projet, voir `CONVENTIONS.md`/mémoire projet) ET par le périmètre RÉEL de l'utilisateur (ex. un enseignant ne doit voir que SES classes assignées, pas toutes les classes de l'école — vérifier une clause `where` du type `teachingAssignments: { some: { teacherId: ctx.userId } }` ou équivalent, pas juste `where: { schoolId }`).
3. Cas particulier à vérifier en priorité (le plan cite explicitement cet exemple) : tout endpoint consulté par TEACHER doit être scopé à ses classes assignées, jamais à toute l'école. Croiser avec la mémoire du projet — un audit de sécurité de l'assistant IA (chantier différent, déjà fait) avait déjà trouvé et corrigé "4 actions TEACHER sans vérification classe+matière" dans `application/shared/verifierRattachementClasse.ts` — vérifier que CE helper (ou son équivalent) est bien réutilisé par les endpoints REST classiques consultés hors ligne, pas seulement par le catalogue de l'assistant IA.
4. Documenter le résultat de l'audit (liste des endpoints vérifiés, statut OK/à corriger) dans un fichier `AUDIT_RBAC_CACHE_OFFLINE.md` à la racine, pour traçabilité — s'il ne reste aucun gap, le document sert de preuve de vérification ; s'il reste des gaps, il sert de liste de suivi.

### 8.3 Vérification
Pas de "test" au sens classique ici — l'audit EST la vérification. Pour toute faille trouvée, la corriger au niveau du endpoint serveur concerné (jamais en filtrant côté client après coup — un filtrage côté client sur une donnée déjà trop large reste une fuite, la donnée a déjà transité sur le réseau et peut être interceptée/inspectée).

---

## 9. TÂCHE 14 — Tests bout-en-bout

### 9.1 Méthode (cohérente avec tout ce chantier — vraies requêtes, pas de mocks)

Utiliser la même discipline que les tâches précédentes : serveur réel lancé, tokens de test générés (§2.4), curl pour les endpoints backend, navigateur réel (DevTools → Network → Offline pour simuler une coupure) pour les scénarios frontend qui ne peuvent pas être testés en pur backend.

### 9.2 Scénarios à couvrir explicitement

1. **Perte de réseau en cours de saisie → reprise sans perte ni doublon.**
   - Se connecter, couper le réseau, saisir une note (ou une absence). Confirmer qu'elle apparaît dans la file d'attente (`SectionOfflineStatus`, statut `PENDING`).
   - Reconnecter le réseau. Confirmer la synchronisation automatique (ou déclenchée manuellement), l'entrée disparaît de la file, et la donnée existe bien côté serveur (vérifier via un GET normal ou un script ponctuel).

2. **Synchronisation interrompue puis retentée → pas de duplication (idempotence).**
   - Reproductible en backend pur (déjà fait une fois pendant ce chantier pour `/api/v2/discipline`, voir §1.3) — reproduire le même test pour au moins UN endpoint de chaque famille encore non testée directement (attendance, grade) : envoyer deux fois la même requête avec le même `Idempotency-Key`, confirmer un seul enregistrement en base.

3. **Ouverture de l'app hors ligne avec jeton valide → dashboard accessible sans attendre le réseau.**
   - Voir §4.3 ci-dessus (déjà détaillé dans la tâche 7) — à exécuter sur les 5 dashboards.

4. **Déconnexion explicite → cache purgé immédiatement et vérifiable.**
   - Voir §5.4 ci-dessus (déjà détaillé dans la tâche 8).

5. **Refresh token expiré (au-delà de la durée graduée) → nouveau login complet exigé.**
   - Générer un token de test avec un `refreshTokenVersion` volontairement décalé (ou attendre/simuler l'expiration — plus simple : générer directement un refresh token déjà expiré avec `expiresIn: '-1s'` dans un script ponctuel) et confirmer que `POST /api/v2/users/auth/refresh` répond bien `401` avec ce token.

6. **Cache RBAC — un enseignant ne voit jamais de données hors de son périmètre, même en cache.**
   - Découle directement de l'audit §8 — si l'audit ne trouve aucun gap serveur, ce test passe automatiquement par construction. Exécuter quand même un test concret : se connecter en TEACHER, peupler le cache, inspecter IndexedDB (déchiffré manuellement si besoin via la fonction `dechiffrer()` en console DevTools), confirmer qu'aucune classe hors de ses affectations n'apparaît.

7. **Conflit sur une note (si tâche 12 faite) → jamais d'écrasement silencieux.**
   - Voir §7.3 ci-dessus.

### 9.3 Format du rapport final

Une fois tous les scénarios exécutés, produire un résumé (dans la réponse à l'utilisateur, ou dans un fichier si demandé) : scénario par scénario, résultat (✅/❌), et pour tout ❌, la cause identifiée et si elle a été corrigée avant de considérer le chantier terminé.

---

## 10. Ordre d'exécution recommandé

Suivre cet ordre — chaque tâche s'appuie sur la précédente :

1. **Tâche 4** (chiffrement) — base technique dont dépendent les tâches 8 (purge de la clé) et 6/11 (les wrappers `putCachedData`/`addPendingAction` doivent exister avant de porter `SectionOfflineStatus`).
2. **Tâche 7** (ouverture hors ligne) — indépendante, peut être faite en parallèle de la 4 si deux agents travaillent, sinon directement après.
3. **Tâche 8** (purge sur déconnexion) — dépend de la tâche 4 (purge de la clé de chiffrement).
4. **Tâche 11** (indicateur ADMIN/STAFF) — dépend de la tâche 4 (wrappers chiffrants) si le composant lit `pendingActions` directement.
5. **Tâche 12** (conflits) — la plus grosse, dépend de la tâche 11 (UI d'arbitrage vit dans le composant partagé) et implique une migration de schéma.
6. **Tâche 13** (audit RBAC) — peut être fait à tout moment, idéalement en dernier pour auditer l'état FINAL du code (après les tâches 4-12, qui ne touchent normalement pas au RBAC mais autant vérifier l'ensemble une fois stable).
7. **Tâche 14** (tests bout-en-bout) — en dernier, sur l'ensemble terminé.

À chaque tâche : typecheck → redémarrage serveur si backend touché → test réel → nettoyage des données de test → commit (un commit par tâche, pas un seul gros commit final — cohérent avec l'historique de ce chantier, 5 commits pour les tâches déjà faites).

---

*Document écrit le 2026-08-04, à la demande explicite de l'utilisateur pour permettre la reprise de ce chantier par un autre agent (DeepSeek) sans épuiser le budget de la session en cours. État du code vérifié au moment de la rédaction — si du temps s'est écoulé depuis, revérifier les hypothèses de state (`git log`, relire les fichiers cités) avant de commencer, en particulier §1 et §4.1 qui documentent un état susceptible d'avoir évolué en parallèle.*
