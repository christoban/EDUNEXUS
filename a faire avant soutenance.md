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


ok il va 