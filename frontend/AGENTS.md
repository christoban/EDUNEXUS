<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Structure frontend — convention features/

- `app/` : uniquement routing, layouts, pages, composition de routes. Les composants scoped à un seul segment de route restent colocalisés dans `_components/` de ce segment (pattern Next.js idiomatique, déjà en place).
- `features/<nom>/` : composants réutilisés par **plusieurs routes/dashboards** (ex. messagerie, suivi-eleves, rh, communication). Un composant partagé par ≥2 routes distinctes va ici, pas dans `components/`.
- `components/` : **réservé au réellement générique** (ui/, sécurité du compte, notifications, offline, thème). Ne jamais y placer un composant spécifique à une feature métier.
- Règle : si un composant ne sert qu'à une seule route → `_components/` colocalisé ; s'il sert à 2+ routes → `features/<nom>/` ; s'il est transverse/générique → `components/`.
