Voici le fonctionnement complet, consolidé après tout ce qu'on a discuté.

## Statuts d'un établissement

`ACTIF` → `SUSPENDU` → `ARCHIVÉ` (jamais de suppression physique s'il y a de vraies données) ou `SUSPENDU` → `ACTIF` (réactivation)

Séparément : un établissement **brouillon** (jamais utilisé en vrai) peut être supprimé directement.

## Cas 1 — Établissement avec de vraies données (≥1 élève avec bulletin publié OU ≥1 paiement enregistré)

1. **Suspension** (`SuspendreEtablissementUseCase`) : super admin déclenche, motif obligatoire (impayé, litige, fermeture, doublon...), statut → `SUSPENDU`, accès coupé pour tout le monde dans l'établissement, **données intactes**. Notification immédiate (push+SMS) à l'admin/proviseur de l'établissement. Log dans la vue sécurité-plateforme.

2. **Suspension sans limite de durée par défaut** — rien ne se passe automatiquement tant que le super admin n'engage pas explicitement le compte à rebours d'archivage (une suspension "punitive" ou "en attente de paiement" peut rester indéfiniment sans jamais aller vers l'archivage).

3. **Si le super admin engage le compte à rebours d'archivage** (action distincte, volontaire) :
   - Notification hebdomadaire à l'admin/proviseur pendant 90 jours ("votre établissement sera archivé le [date] si aucune action")
   - Le proviseur peut à tout moment stopper le compte à rebours en réglant ce qui posait problème (le super admin réactive ou annule l'archivage programmé)

4. **Après 90 jours sans réaction** → `ArchiverEtablissementUseCase` : statut → `ARCHIVÉ`, aucune donnée supprimée, sort des listes actives/stats/facturation du super admin, éventuellement déplacé vers un stockage froid plus tard (jamais effacé). Log sécurité-plateforme.

5. **Réactivation** possible à tout moment depuis `SUSPENDU` ou `ARCHIVÉ` (`ReactiverEtablissementUseCase`), même rigueur : motif, notification, log.

## Cas 2 — Établissement brouillon (0 élève réel, 0 bulletin, 0 paiement)

`SupprimerEtablissementBrouillonUseCase` : hard delete réel, mais bloqué automatiquement (409) dès que `hasProductionData` détecte la moindre vraie donnée. Re-authentification MFA + mot de passe obligatoire, même pour un brouillon.

## Garde-fous transverses (déjà présents ailleurs dans ZekoulABia, réutilisés ici)

- Toute action de ce use case réservée au rôle Super Admin plateforme le plus élevé (toi), jamais un Admin d'établissement même sur son propre établissement
- Log dans la vue sécurité-plateforme (jamais la vue établissement, qui pourrait ne plus exister)
- Pattern propose/apply cohérent avec le reste (clôture d'année, emploi du temps) — pas d'action irréversible silencieuse

Je mets à jour ta mémoire projet avec cette décision pour qu'elle soit là la prochaine fois qu'on en reparle.C'est enregistré. Dis-moi quand tu veux qu'on code `SuspendreEtablissementUseCase` (le plus utilisé au quotidien), ou si tu préfères commencer par `SupprimerEtablissementBrouillonUseCase` (plus simple, sert à nettoyer tes tests actuels).







il va falloir faire qu'il y'ait deux différents enseignants au primaire également







il faudra:
1. Simplifier la validation des notes

Ton intuition est juste, et elle est cohérente avec un principe que tu as déjà posé ailleurs : ne pas construire de la validation hiérarchique là où elle n'ajoute rien. Le censeur/proviseur validant chaque note individuelle n'a effectivement aucune valeur pédagogique — il ne peut pas juger si un 12/20 en maths est correct. Ce qu'il doit vérifier, c'est la complétude et la cohérence à l'échelle de la classe, pas la justesse d'une note isolée.

Proposition : séparer clairement deux niveaux de statut qui existent aujourd'hui fusionnés dans un seul workflow.

Niveau Note (par matière, par enseignant) — statuts minimalistes :

EN_SAISIE — l'enseignant remplit/modifie librement
VERROUILLÉE — l'enseignant confirme avoir terminé pour cette évaluation (verrouillage auto-géré par l'enseignant, pas de validation externe)

Niveau Bulletin (par classe, agrégat) — c'est ici que le pattern DRAFT→SUBMITTED→VALIDATED→PUBLISHED que tu as déjà retenu pour les frais garde tout son sens, mais appliqué au bulletin complet de la classe, pas à chaque note :

DRAFT — les notes de la classe sont en cours de saisie par les différents enseignants
SUBMITTED — le titulaire de classe (voir point 2) a vérifié la complétude et soumis
VALIDATED — le censeur (ou directeur en primaire) a fait sa vérification de cohérence globale
PUBLISHED — diffusion automatique à tous les parents/élèves concernés

Ça évite exactement ce que ton enseignant pointait : personne ne "valide" une note en tant que telle, mais quelqu'un vérifie que le paquet est complet et cohérent avant diffusion.

2. Rôle de l'enseignant titulaire (professeur principal ↔ primaire)

Point important que ton encadrant soulève : le rôle existant dans ton backlog ("Professeur principal") doit en réalité être pensé comme un rôle transversal aux deux cycles, avec la même fonction structurelle mais un contexte différent :

Secondaire : Professeur principal — n'enseigne généralement qu'une ou deux matières à sa classe, coordonne les autres enseignants matière
Primaire : Instituteur titulaire — enseigne lui-même la majorité des matières, sauf les matières spécialisées (anglais, informatique) assurées par un enseignant itinérant sur plusieurs classes

Dans les deux cas, c'est la même fonction vis-à-vis du bulletin : point de convergence entre tous les enseignants de la classe (lui inclus) et l'échelon supérieur.

Voici le workflow détaillé que je propose, qui correspond à ce que ton encadrant a décrit :

Chaque enseignant de la classe (titulaire compris, pour ses propres matières) remplit ses notes + son appréciation par élève (le terme technique classique est bien "appréciation")
Une fois toutes les fiches remplies, le titulaire :
Vérifie la complétude (aucune matière manquante, aucun élève oublié)
Rédige son appréciation générale/de conduite (spécifique au titulaire, pas une matière — reflète la synthèse du conseil de classe une fois celui-ci tenu)
Peut publier une pré-version consultable par les élèves pour signalement d'erreur avant transmission officielle (bonne idée à garder — ça réduit les corrections après coup)
Soumet (SUBMITTED) au censeur (secondaire) ou au directeur (primaire)
Le censeur/directeur fait sa vérification de cohérence globale (VALIDATED) — pas une re-vérification note par note, mais un contrôle de forme et de cohérence d'ensemble
Le censeur/directeur publie (PUBLISHED) → diffusion automatique à tous les destinataires concernés (parents, élèves), sans envoi manuel un par un









ok il va falloir faire et implémenter les audit de tout ce qui se passe au niveau de l'établissement pour l'admin et les staff en fonction de leur niveau pour l'eleve des audit en ce qui lui concernedans ses fonctions, meme chose pour chaque role et maintenant l'admin a l'audit complet pour tout son etablissement et pour le super admin c'ets l'audit de toute la plateforme