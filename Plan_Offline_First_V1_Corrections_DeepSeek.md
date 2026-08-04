# Offline-first V1 — Corrections obligatoires (ordres d'exécution précis)

> **Toi (agent exécutant) n'as pas à décider quoi que ce soit dans ce document — tout est déjà tranché.** Chaque correction ci-dessous contient le code exact à écrire. Ton travail : appliquer chaque correction dans l'ordre indiqué, vérifier avec les commandes fournies, corriger si un test échoue, committer, passer à la suivante. Si un extrait de code ne correspond pas exactement à ce que tu trouves dans le fichier réel (noms de variables légèrement différents, etc.), adapte-toi au fichier réel tout en gardant EXACTEMENT la même logique — ne change jamais l'intention.

Ce document fait suite à `Plan_Offline_First_V1_Suite_DeepSeek.md` (déjà exécuté) et à une revue de code qui a trouvé 9 problèmes réels dans ce qui a été livré, classés par gravité ci-dessous. **Ne pas sauter la correction A** — c'est la plus grave, elle rend la fonctionnalité centrale du chantier (saisir une note hors ligne) complètement non-fonctionnelle malgré un typecheck qui passe.

---

## Rappel des règles de vérification (déjà énoncées dans le plan précédent, toujours valables)

1. Typecheck avec le binaire local, **jamais `npx tsc`** : `cd backend && ./node_modules/.bin/tsc --noEmit` (idem `frontend/`). `npx tsc` peut retourner un faux résultat (placeholder npm) sans lancer le vrai compilateur — c'est vraisemblablement ce qui s'est produit lors de la livraison précédente : "0 erreurs" avait été rapporté alors que 3 erreurs réelles existaient.
2. Rediriger vers un fichier, jamais un pipe vers `tail`/`head`. Fichier vide = zéro erreur. **Toujours lire le fichier de sortie avant d'affirmer "0 erreurs" — ne jamais l'affirmer sur la base d'un timeout ou d'une commande qui n'a pas visiblement terminé.**
3. `prisma generate` échoue si le serveur backend tourne en même temps (verrou DLL Windows) — l'arrêter avant.
4. Toute donnée de test créée en base doit être supprimée après vérification.
5. Un commit par correction, jamais un seul commit fourre-tout.

---

## CORRECTION A (BLOQUANT, priorité 1) — La saisie de note hors ligne ne sauvegarde jamais réellement les valeurs

### Le problème exact

Fichier : `frontend/src/app/teacher/dashboard/_components/SectionTeacherGrades.tsx`.

- `saveDraft()`, branche hors ligne (autour de la ligne 190) : appelle **seulement** `putCachedData(draftKey, ...)`. `putCachedData` écrit dans `cachedData` — la table de **cache de lecture, disposable, jamais synchronisée avec le serveur**. Aucun appel à `addToQueue` n'est fait. **Les valeurs de notes saisies hors ligne ne rejoignent donc jamais la file d'attente réelle (`pendingActions`) et ne seront jamais envoyées au serveur.**
- Pire : `cachedData` est explicitement vidée par `db.cachedData.clear()` sur toute déconnexion explicite (`logoutUser()`, tâche 8) et par le hook de migration Dexie. Un enseignant qui saisit des notes hors ligne, puis se déconnecte (ou dont le cache est purgé pour n'importe quelle raison), **perd silencieusement toutes ses notes saisies, sans aucun avertissement.**
- `submitGrades()`, branche hors ligne (autour de la ligne 226) : met bien en queue une action réelle (`addToQueue({ type: 'GRADE', endpoint: '/api/v2/grades/submit', ... })`) — MAIS le payload envoyé ne contient que `{ studentId, baseUpdatedAt }`, **jamais la valeur de la note** (`value`/`observation`).
- Et côté serveur, `GradeController.soumettreEnMasse` (`/api/v2/grades/submit`) ne fait **qu'un `updateMany` qui bascule `validationStatus` sur des lignes `Grade` déjà existantes** — il n'écrit AUCUNE valeur de note. Les valeurs sont écrites par un endpoint différent, `/api/v2/grades/draft`, jamais appelé dans le flux hors ligne.

**Conséquence bout en bout** : un enseignant hors ligne qui saisit des notes puis les soumet croit (toast de confirmation à l'appui) que tout est en file d'attente. En réalité, au retour du réseau, la seule action rejouée (`/api/v2/grades/submit`) ne trouvera aucune ligne `DRAFT`/`REJECTED` correspondante en base (puisqu'elle n'a jamais été créée), échouera avec un 404 ("Aucune note à soumettre... trouvée"), et **aucune note n'aura jamais atteint le serveur.** C'est le scénario exact que toute la tâche 4 du plan d'origine (§0, tableau) était censée rendre fiable — actuellement, c'est le contraire qui se produit.

### Le correctif exact

**1. `frontend/src/lib/offline/db.ts`** — ajouter un nouveau type à l'union `PendingAction['type']` :
```typescript
type: 'ATTENDANCE' | 'GRADE' | 'GRADE_DRAFT_SAVE' | 'CAHIER_DE_TEXTE_CREATE' | 'APPRECIATION_PP' | 'DISCIPLINE_SANCTION' | 'DISCIPLINE_SANCTION_LIFT' | 'APEE_TRANSACTION' | 'LIBRARY_BOOK_CREATE' | 'LIBRARY_BOOK_UPDATE' | 'TEACHER_ASSIGNMENT' | 'TIMETABLE_GRID_CONFIG' | 'PEDAGOGY_PROGRAM' | 'ORIENTATION_RECORD'
```
(ajout de `'GRADE_DRAFT_SAVE'` juste après `'GRADE'`, rien d'autre ne change dans ce fichier pour cette correction).

**2. `frontend/src/app/teacher/dashboard/_components/SectionTeacherGrades.tsx`** — `saveDraft()`, remplacer la branche hors ligne :
```typescript
// AVANT
if (!isOnline) {
  await putCachedData(draftKey, { notes, observations })
  onToast(t('grades_section.toast_draft_saved_local'), 'info')
  return
}
```
```typescript
// APRÈS
if (!isOnline) {
  await putCachedData(draftKey, { notes, observations }) // affichage optimiste immédiat, inchangé
  // Correctif critique : sans cette ligne, les valeurs saisies hors ligne n'étaient JAMAIS mises
  // en file d'attente réelle — seulement mises en cache de lecture (disposable, effacé à la
  // déconnexion). Voir CORRECTION A du document de revue.
  await addToQueue({
    type: 'GRADE_DRAFT_SAVE',
    endpoint: '/api/v2/grades/draft',
    method: 'POST',
    payload: { classId: selectedClass, subjectId: selectedSubject, sequenceId: selectedSequence, grades: gradesPayload },
  })
  onToast(t('grades_section.toast_draft_saved_local'), 'info')
  return
}
```

**3. Même fichier** — `submitGrades()`, remplacer la branche hors ligne :
```typescript
// AVANT
if (!isOnline) {
  const baseUpdatedAtMap: Record<string, string | null> = {}
  for (const g of gradesPayload) {
    const cached = await getCachedData<any[]>(`teacher:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`)
    const existing = cached?.data?.find((gg: any) => gg.studentId === g.studentId)
    baseUpdatedAtMap[g.studentId] = existing?.updatedAt ?? null
  }
  await addToQueue({
    type: 'GRADE',
    endpoint: '/api/v2/grades/submit',
    method: 'POST',
    payload: {
      classId: selectedClass,
      subjectId: selectedSubject,
      sequenceId: selectedSequence,
      grades: gradesPayload.map(g => ({ studentId: g.studentId, baseUpdatedAt: baseUpdatedAtMap[g.studentId] })),
    },
  })
  await deleteCachedData(draftKey)
  onToast(t('grades_section.toast_submit_queued'), 'warning')
  return
}
```
```typescript
// APRÈS
if (!isOnline) {
  const baseUpdatedAtMap: Record<string, string | null> = {}
  for (const g of gradesPayload) {
    const cached = await getCachedData<any[]>(`teacher:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`)
    const existing = cached?.data?.find((gg: any) => gg.studentId === g.studentId)
    baseUpdatedAtMap[g.studentId] = existing?.updatedAt ?? null
  }
  // 1. Met en file d'attente la SAUVEGARDE RÉELLE des valeurs (voir CORRECTION A) — sans cette
  // étape, l'action de soumission ci-dessous ne trouverait aucune ligne à soumettre au retour
  // réseau. L'ordre createdAt garanti par syncQueue() assure que cette action est rejouée AVANT
  // la soumission ci-dessous.
  await addToQueue({
    type: 'GRADE_DRAFT_SAVE',
    endpoint: '/api/v2/grades/draft',
    method: 'POST',
    payload: { classId: selectedClass, subjectId: selectedSubject, sequenceId: selectedSequence, grades: gradesPayload },
  })
  // 2. Met en file d'attente la soumission — le payload inclut désormais `value`/`observation`
  // en plus de `baseUpdatedAt`, UNIQUEMENT pour permettre l'affichage des deux versions en cas
  // de conflit (CORRECTION C ci-dessous) — l'écriture réelle de la valeur se fait par l'action
  // ci-dessus, pas par celle-ci.
  await addToQueue({
    type: 'GRADE',
    endpoint: '/api/v2/grades/submit',
    method: 'POST',
    payload: {
      classId: selectedClass,
      subjectId: selectedSubject,
      sequenceId: selectedSequence,
      grades: gradesPayload.map(g => ({
        studentId: g.studentId,
        baseUpdatedAt: baseUpdatedAtMap[g.studentId],
        value: g.value,
        observation: g.observation,
      })),
    },
  })
  await deleteCachedData(draftKey)
  onToast(t('grades_section.toast_submit_queued'), 'warning')
  return
}
```

### Vérification obligatoire (scénario réel, pas seulement typecheck)

1. Typecheck frontend (`./node_modules/.bin/tsc --noEmit`), doit être vide.
2. Générer un token de test TEACHER (voir méthode §2.4 du plan précédent).
3. Démarrer le backend.
4. Dans le navigateur (ou via les DevTools d'une page servie par le frontend en dev), se connecter en TEACHER, couper le réseau, saisir une note pour un élève, cliquer "Enregistrer brouillon" puis "Soumettre". Confirmer dans IndexedDB → `pendingActions` : **deux** entrées apparaissent, une `GRADE_DRAFT_SAVE` et une `GRADE`, dans cet ordre de `createdAt`.
5. Reconnecter le réseau, laisser la synchronisation automatique s'exécuter (ou déclencher "synchroniser maintenant").
6. Vérifier via un script ponctuel backend (`backend/src/scripts/verifie-grade.ts`, supprimé après usage) que la note existe bien en base avec la bonne valeur et `validationStatus: 'SUBMITTED'`.
7. Nettoyer toute donnée de test créée.

---

## CORRECTION B (BLOQUANT, priorité 2) — Migration Prisma jamais appliquée, le backend ne compile pas

`Grade.updatedAt` a été ajouté à `schema.prisma` sans migration ni régénération du client. Vérifié directement en base (`information_schema.columns`) : la colonne **n'existe pas**. Vérifié au typecheck réel : 3 erreurs dans `GradeController.ts` référençant un champ qui n'existe pas dans le client généré.

### Correctif exact

Depuis `backend/`, dans cet ordre strict :
```bash
# 1. Arrêter le serveur backend s'il tourne (libère le verrou DLL Windows)
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
sleep 1
# 2. Créer et appliquer la migration
npx prisma migrate dev --name ajoute_grade_updated_at --skip-generate
# 3. Régénérer le client (fonctionne maintenant que le serveur est arrêté)
npx prisma generate
```

### Vérification obligatoire

1. Confirmer qu'un nouveau dossier `backend/prisma/migrations/<timestamp>_ajoute_grade_updated_at/` existe avec un `migration.sql` contenant `ADD COLUMN "updatedAt"`.
2. Relancer le script de vérification directe de colonne (voir méthode utilisée dans la revue — requête `information_schema.columns` sur `Grade`/`updatedAt`) — doit maintenant retourner une ligne, pas un tableau vide.
3. Typecheck backend (`./node_modules/.bin/tsc --noEmit`) — **doit être un fichier VIDE**. Si les 3 erreurs de `GradeController.ts` persistent après ces étapes, ne pas continuer — diagnostiquer avant de passer à la suite (cause probable : le serveur tournait encore pendant `prisma generate`, ou une erreur de syntaxe dans la migration).
4. Redémarrer le serveur, confirmer qu'il démarre sans erreur.

---

## CORRECTION C (BLOQUANT, priorité 3) — Les boutons de résolution de conflit ne font pas ce qu'ils affichent

### Le problème exact

Fichier : `frontend/src/components/SectionOfflineStatus.tsx`, fonction `handleResolveConflict(action, keepLocal)`. **Le code est identique que `keepLocal` soit `true` ou `false`** — dans les deux cas, `deletePendingAction(action.id!)` est appelé et rien d'autre. Cliquer "Garder ma version" ne renvoie jamais la note au serveur — elle est supprimée localement, silencieusement perdue. C'est exactement ce que le plan interdisait ("jamais d'écrasement silencieux") — en pire, puisque le bouton affirme le contraire de ce qu'il fait.

De plus, `conflictData` (stocké par `useSyncQueue.ts` à la réception d'un 409) ne contient que des **horodatages** (`versionServeur`/`versionLocale` = des dates ISO), jamais les valeurs de note elles-mêmes — impossible pour un humain d'arbitrer intelligemment ("le serveur dit 14, tu as 16 ?") avec seulement des dates.

### Correctif exact — 4 fichiers à modifier

**1. `backend/src/infrastructure/http/controllers/GradeController.ts`**, méthode `soumettreEnMasse` — accepter un flag de forçage, et enrichir les conflits avec les valeurs réelles :

```typescript
// Ligne actuelle : const { classId, subjectId, sequenceId, grades: gradesWithVersion } = req.body;
// Remplacer par :
const { classId, subjectId, sequenceId, grades: gradesWithVersion, forcerEcrasement } = req.body;
```

Puis remplacer tout le bloc `if (Array.isArray(gradesWithVersion) && gradesWithVersion.length > 0) { ... }` par :
```typescript
// Si gradesWithVersion est fourni (sync offline avec détection de conflit V1 §12),
// vérifier les conflits de version avant de soumettre — SAUF si forcerEcrasement est vrai
// (l'utilisateur a explicitement choisi "Garder ma version" après un conflit déjà affiché).
if (Array.isArray(gradesWithVersion) && gradesWithVersion.length > 0 && !forcerEcrasement) {
  const conflicts: {
    studentId: string;
    versionServeur: { updatedAt: string; sequenceScore: number | null };
    versionLocale: { updatedAt: string | null; value: number | null; observation: string | null };
  }[] = [];

  const existingGrades = await prisma.grade.findMany({
    where: {
      schoolId: user.schoolId,
      classId,
      subjectId,
      sequenceId,
      validationStatus: { in: ['DRAFT', 'REJECTED'] },
      recordedById: user.userId,
    },
    select: { id: true, studentId: true, updatedAt: true, sequenceScore: true },
  });

  const existingByStudent = new Map(existingGrades.map(g => [g.studentId, g]));

  for (const gwv of gradesWithVersion) {
    if (!gwv.studentId) continue;
    const existing = existingByStudent.get(gwv.studentId);
    const baseUpdatedAt = gwv.baseUpdatedAt ? new Date(gwv.baseUpdatedAt).getTime() : null;

    if (existing && baseUpdatedAt !== null && existing.updatedAt.getTime() !== baseUpdatedAt) {
      conflicts.push({
        studentId: gwv.studentId,
        versionServeur: { updatedAt: existing.updatedAt.toISOString(), sequenceScore: existing.sequenceScore },
        versionLocale: { updatedAt: gwv.baseUpdatedAt, value: gwv.value ?? null, observation: gwv.observation ?? null },
      });
    }
  }

  if (conflicts.length > 0) {
    res.status(409).json({
      success: false,
      code: 'CONFLIT_VERSION',
      message: 'Conflit de version détecté — une tierce personne a modifié ces notes',
      conflicts,
    });
    return;
  }
}
```
(Le seul changement fonctionnel vs l'existant : `&& !forcerEcrasement` sur la condition d'entrée du bloc, et `sequenceScore`/`value`/`observation` ajoutés aux deux côtés du conflit pour affichage réel.)

**2. `frontend/src/lib/offline/db.ts`** — élargir la forme de `conflictData` sur `PendingAction` pour matcher ce que le serveur renvoie maintenant, et ajouter un wrapper chiffrant dédié (voir aussi CORRECTION F, qui dépend de ce même changement — faire les deux en même temps) :
```typescript
/** Données de conflit (si status === 'CONFLICT') — un conflit par élève concerné. */
conflictData?: {
  studentId: string;
  versionServeur: { updatedAt: string; sequenceScore: number | null };
  versionLocale: { updatedAt: string | null; value: number | null; observation: string | null };
}[]
```
(remplace la forme actuelle `{ versionServeur: unknown; versionLocale: unknown }` par un tableau de conflits par élève, cohérent avec ce que `conflicts` contient déjà côté serveur).

Ajouter aussi dans ce fichier, à côté des autres fonctions exportées (`updatePendingActionStatus` etc.) :
```typescript
/** Enregistre les données de conflit d'une action — passe par le même wrapper que le reste (voir CORRECTION F). */
export async function setConflictData(id: number, conflictData: PendingAction['conflictData']): Promise<void> {
  await db.pendingActions.update(id, { conflictData })
}
```

**3. `frontend/src/hooks/useSyncQueue.ts`** — remplacer le bloc de traitement du 409 :
```typescript
// AVANT
if (res.status === 409) {
  const conflictData = await res.json().catch(() => null)
  await updatePendingActionStatus(action.id!, 'CONFLICT')
  if (conflictData?.conflicts) {
    await db.pendingActions.update(action.id!, { conflictData: { versionServeur: conflictData.conflicts, versionLocale: action.payload } })
  }
  continue
}
```
```typescript
// APRÈS
if (res.status === 409) {
  const body = await res.json().catch(() => null)
  await updatePendingActionStatus(action.id!, 'CONFLICT')
  if (body?.conflicts) {
    // setConflictData (pas db.pendingActions.update direct) — voir CORRECTION F, ce champ doit
    // passer par le wrapper chiffrant comme le reste des données sensibles.
    await setConflictData(action.id!, body.conflicts)
  }
  continue
}
```
Adapter l'import en haut du fichier : ajouter `setConflictData` à l'import depuis `@/lib/offline/db` (à côté de `addPendingAction, getPendingActions, countPendingActions, deletePendingAction, updatePendingActionStatus`).

**4. `frontend/src/components/SectionOfflineStatus.tsx`** — remplacer entièrement `handleResolveConflict` et afficher les deux versions :
```typescript
const handleResolveConflict = async (action: PendingAction, keepLocal: boolean) => {
  if (!action.conflictData) return

  if (keepLocal) {
    // "Garder ma version" doit RÉELLEMENT renvoyer la note au serveur, en forçant l'écrasement
    // — avant ce correctif, ce bouton supprimait juste l'action sans jamais rien envoyer.
    try {
      const res = await fetchApi(action.endpoint, {
        method: action.method,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ ...(action.payload as object), forcerEcrasement: true }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await deletePendingAction(action.id!)
      setActions(prev => prev.filter(a => a.id !== action.id))
      onToast(t('sync.conflict_kept_local'), 'success')
    } catch {
      onToast(t('sync.conflict_resolve_error'), 'error')
    }
    return
  }

  // "Garder version serveur" : on abandonne la version locale, correct de simplement supprimer.
  await deletePendingAction(action.id!)
  setActions(prev => prev.filter(a => a.id !== action.id))
  onToast(t('sync.conflict_kept_server'), 'info')
}
```
Et, dans le rendu de la ligne `CONFLICT` (bloc `action.status === 'CONFLICT' ? (...)`), ajouter l'affichage des deux versions AVANT les deux boutons — insérer ce bloc juste avant `<div style={{ display: 'flex', gap: 6 }}>` :
```tsx
{action.conflictData && action.conflictData.length > 0 && (
  <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6 }}>
    {action.conflictData.map(c => (
      <div key={c.studentId}>
        {t('sync.conflict_server_value')}: <strong>{c.versionServeur.sequenceScore ?? '—'}</strong>
        {' · '}
        {t('sync.conflict_local_value')}: <strong>{c.versionLocale.value ?? '—'}</strong>
      </div>
    ))}
  </div>
)}
```
(Ce bloc doit être un frère du `<div style={{ display: 'flex', gap: 6 }}>` existant, tous deux à l'intérieur du même `<td>`, pas imbriqués l'un dans l'autre.)

**5. Locales** — ajouter dans `frontend/src/locales/{fr,en}/{teacher,admin,staff}.json`, à côté des clés `sync.conflict_*` déjà présentes :
```json
"conflict_resolve_error": "Erreur lors de l'envoi — réessayez",
"conflict_server_value": "Note serveur",
"conflict_local_value": "Ta note"
```
(équivalent anglais : `"Error while sending — try again"`, `"Server grade"`, `"Your grade"`).

### Vérification obligatoire

1. Typecheck backend ET frontend, les deux doivent être vides.
2. Reproduire un vrai conflit : sauvegarder une note en base pour un élève (script ponctuel), noter son `updatedAt`. Se connecter en TEACHER, couper le réseau, saisir une note DIFFÉRENTE pour ce même élève, soumettre (met en queue via CORRECTION A). Pendant que c'est encore hors ligne, modifier directement la note en base via un script ponctuel (change `sequenceScore`, laisse `@updatedAt` se déclencher). Reconnecter le réseau, laisser la synchro tourner.
3. Confirmer que l'action passe au statut `CONFLICT` et que les DEUX valeurs (serveur et locale) s'affichent dans `SectionOfflineStatus`.
4. Cliquer "Garder ma version" — confirmer par une requête serveur (script ponctuel ou GET direct) que la note en base a bien été écrasée par la valeur locale, ET que l'action a disparu de la file d'attente.
5. Répéter le scénario, cette fois cliquer "Garder version serveur" — confirmer que la note en base n'a PAS changé, et que l'action a disparu de la file.
6. Nettoyer toute donnée de test créée.

---

## CORRECTION D (HAUTE) — STAFF n'a jamais reçu le correctif d'ouverture hors ligne (tâche 7)

Sur les 5 dashboards, seuls admin (déjà fait avant ce chantier), teacher, parent et student ont le pattern "lecture localStorage synchrone + fetch en arrière-plan + redirection UNIQUEMENT sur 401 réel, jamais sur erreur réseau". `frontend/src/app/staff/dashboard/page.tsx` n'a reçu aucune modification de ce type (vérifié par diff — seul l'ajout de la section `sync-offline` de la tâche 11 y figure).

### Correctif exact

Dans `frontend/src/app/staff/dashboard/page.tsx`, reproduire EXACTEMENT le pattern déjà appliqué à `frontend/src/app/parent/dashboard/page.tsx` (lire ce fichier pour le modèle exact avant de modifier staff — les deux composants ont une structure très proche : lecture `localStorage.getItem('zekoulabia_user')` dans un `useEffect` séparé et synchrone dès le montage, PUIS un second `useEffect` avec `fetchApi('/api/v2/school/me', ...)` qui redirige via `useRouter().replace('/login')` **uniquement si `r.status === 401`**, jamais dans le `.catch` d'une erreur réseau).

Étapes concrètes :
1. Ajouter `import { useRouter } from 'next/navigation'` et `const router = useRouter()` dans le corps du composant.
2. Le `useEffect` existant qui lit `zekoulabia_user` (déjà présent, ne pas le dupliquer) reste tel quel — il fait déjà la lecture synchrone attendue.
3. Modifier le `useEffect` qui appelle `fetchApi('/api/v2/school/me', ...)` pour distinguer 401 (redirection) d'une erreur réseau (ignorée), suivant exactement le modèle de `parent/dashboard/page.tsx`.

### Vérification obligatoire

1. Typecheck frontend.
2. Se connecter en STAFF, couper le réseau, recharger la page (F5) — le dashboard doit s'afficher avec les données en cache, jamais un écran blanc ni une redirection vers `/login`.
3. Réseau coupé AVANT toute connexion (localStorage vide) — doit toujours rediriger normalement vers `/login` une fois que le réseau répond.

---

## CORRECTION E (MOYENNE) — Fichier mort laissé après la promotion du composant partagé

`frontend/src/app/teacher/dashboard/_components/SectionOfflineStatus.tsx` existe toujours et a même été modifié, alors que plus rien ne l'importe (`teacher/dashboard/page.tsx` importe désormais `@/components/SectionOfflineStatus`).

### Correctif exact
```bash
rm "frontend/src/app/teacher/dashboard/_components/SectionOfflineStatus.tsx"
```
Confirmer avant suppression, par grep, qu'aucun autre fichier ne l'importe :
```bash
grep -rln "teacher/dashboard/_components/SectionOfflineStatus" frontend/src
```
(doit ne rien retourner).

### Vérification
Typecheck frontend après suppression — doit rester vide (confirme qu'aucune référence résiduelle ne cassait sur ce fichier).

---

## CORRECTION F (MOYENNE) — `conflictData` stocké en clair, contournant le chiffrement

Déjà traité dans le CORRECTION C ci-dessus (le remplacement de `db.pendingActions.update(action.id!, { conflictData: ... })` par `setConflictData(action.id!, ...)` dans `useSyncQueue.ts`, et l'ajout de `setConflictData` dans `db.ts`). **Vérifier un point important non couvert par le chiffrement automatique** : `conflictData` contient des valeurs de notes (`sequenceScore`, `value`) — décider si ce champ doit lui-même être chiffré comme `payload`, ou s'il est acceptable de le laisser en clair parce qu'il est nécessaire à l'affichage direct dans `SectionOfflineStatus.tsx` sans déchiffrement asynchrone supplémentaire.

**Décision à appliquer** (pour rester cohérent avec l'esprit de la tâche 4 — toute donnée métier opaque doit être chiffrée) : chiffrer `conflictData` comme `payload`. Modifier `setConflictData` dans `db.ts` :
```typescript
import { chiffrer, dechiffrer } from './crypto'

export async function setConflictData(id: number, conflictData: unknown): Promise<void> {
  const chiffre = await chiffrer(conflictData)
  await db.pendingActions.update(id, { conflictData: chiffre as any })
}
```
Et dans `getPendingActions()` (même fichier), déchiffrer aussi `conflictData` s'il est présent, en plus de `payload` :
```typescript
export async function getPendingActions(): Promise<PendingAction[]> {
  const rows = await db.pendingActions.toArray()
  return Promise.all(rows.map(async (r) => ({
    ...r,
    payload: await dechiffrer(r.payload),
    conflictData: r.conflictData ? await dechiffrer(r.conflictData as any) : undefined,
  })))
}
```

### Vérification
1. Typecheck frontend.
2. Reproduire un conflit (voir CORRECTION C, étape 2 de vérification). Ouvrir DevTools → IndexedDB → `pendingActions` → confirmer que le champ `conflictData` de l'entrée en conflit est de la forme `{ iv: [...], data: [...] }`, jamais un objet lisible directement.
3. Confirmer que `SectionOfflineStatus.tsx` affiche quand même correctement les deux versions (le déchiffrement doit être transparent pour l'affichage).

---

## CORRECTION G (MOYENNE) — `logoutUser()` ne prévient pas sur un conflit non résolu

Fichier : `frontend/src/lib/userAuth.ts`. Le check actuel :
```typescript
const pendingCount = await db.pendingActions.where('status').anyOf(['PENDING', 'FAILED']).count()
```
Une action au statut `CONFLICT` (ajouté depuis) n'est PAS couverte — elle est perdue silencieusement à la déconnexion, sans avertissement, alors qu'elle représente une décision utilisateur non encore prise (perte de données réelle, exactement ce que la tâche 12 devait éviter).

### Correctif exact
```typescript
const pendingCount = await db.pendingActions.where('status').anyOf(['PENDING', 'FAILED', 'CONFLICT']).count()
```
(seul changement : `'CONFLICT'` ajouté à la liste).

### Vérification
Reproduire un conflit (CORRECTION C), NE PAS le résoudre, cliquer "Se déconnecter" — confirmer que la boîte de confirmation apparaît en mentionnant l'action en attente, et qu'annuler la déconnexion préserve bien l'action `CONFLICT` dans la file.

---

## CORRECTION H (BASSE, mais obligatoire) — Audit RBAC à refaire avec de vraies preuves

`AUDIT_RBAC_CACHE_OFFLINE.md` actuel est une description plausible, jamais vérifiée contre le code serveur réel — aucune ligne ne cite un contrôleur, une route, ou une clause `where` Prisma précise. Une affirmation de sécurité y est même incorrecte : le document présente "deviner la clé de cache" comme une protection contre la lecture inter-utilisateurs, alors qu'un script/DevTools sur la même origine peut lister le contenu complet d'IndexedDB sans rien deviner — la vraie protection est la purge au logout (déjà correctement listée ailleurs dans le même document, mais la justification donnée en §3 est fausse et doit être corrigée).

### Correctif exact — méthode à suivre pour CHAQUE ligne du tableau §1 (`cachedData`) de l'audit existant

Pour chaque clé de cache listée (`teacher:classes`, `teacher:grades:{...}`, `parent:children:{uid}`, etc.) :
1. Trouver l'appel `fetchApi('/api/v2/...')` dont la réponse est mise dans cette clé de cache (`grep -rn "putCachedData\|db.cachedData.put" frontend/src` pour les localiser toutes).
2. Trouver le endpoint serveur correspondant exact (fichier + méthode).
3. Ouvrir ce fichier, citer la clause `where` Prisma réelle qui scope la requête (copier-coller l'extrait exact dans le document, avec numéro de ligne).
4. Confirmer explicitement : la clause filtre-t-elle par `schoolId` (isolation multi-tenant) ET par le périmètre RÉEL de l'utilisateur (classe assignée pour un enseignant, enfants liés pour un parent, etc.) — pas seulement par `schoolId` seul, qui laisserait voir toute l'école.
5. Si un endpoint ne fait PAS cette double vérification, le signaler comme un vrai gap (pas une supposition) et le corriger au niveau du endpoint serveur, jamais par un filtrage côté client après coup (voir §8.3 du plan précédent : un filtrage client sur une donnée déjà trop large reste une fuite, la donnée a déjà transité sur le réseau).

Remplacer aussi le tableau §3 ("Isolation inter-utilisateurs") : corriger la ligne "Lecture cachedData d'un autre utilisateur" — la protection réelle est que **chaque utilisateur n'a accès en JS qu'à SA PROPRE session authentifiée** (les clés de cache sont scopées par construction à l'utilisateur/l'établissement connu du navigateur à un instant donné, pas parce qu'elles seraient "difficiles à deviner"), et que la purge au logout élimine tout résidu pour l'utilisateur SUIVANT sur le même appareil — reformuler sans invoquer une notion de "clé secrète à deviner" qui ne correspond pas au vrai modèle de menace (déjà correctement documenté dans `crypto.ts`, réutiliser la même formulation honnête ici).

### Vérification
Le document corrigé doit contenir, pour chaque ligne du tableau §1, une citation de code réelle (fichier + ligne + extrait de clause `where`) — pas seulement une colonne "Permission(s) requise(s)" déclarative sans preuve à l'appui.

---

## Ordre d'exécution final

1. **CORRECTION B** en premier (rien d'autre ne peut être vérifié tant que le backend ne compile pas).
2. **CORRECTION A** (la plus grave fonctionnellement).
3. **CORRECTION C** (dépend du typecheck propre de B, et complète A).
4. **CORRECTION F** (petit ajout dans la foulée de C, mêmes fichiers).
5. **CORRECTION G** (rapide, un seul mot ajouté).
6. **CORRECTION D** (indépendante, peut être faite à tout moment).
7. **CORRECTION E** (rapide, indépendante).
8. **CORRECTION H** (peut être faite en dernier, ne bloque rien d'autre).

Un commit par correction. Après la dernière, relancer l'intégralité des scénarios de vérification listés dans `Plan_Offline_First_V1_Suite_DeepSeek.md` §9.2 (tests bout-en-bout) — plusieurs d'entre eux étaient impossibles à valider correctement tant que CORRECTION A et B n'étaient pas faites.

---

*Document écrit le 2026-08-04, à la suite d'une revue de code qui a vérifié chaque affirmation du résumé de livraison précédent contre le code réel et l'état réel de la base de données — pas contre les affirmations elles-mêmes. Toutes les commandes de vérification ci-dessus doivent produire une preuve concrète (fichier de sortie, requête base de données, capture d'état IndexedDB), jamais une affirmation non vérifiée.*
