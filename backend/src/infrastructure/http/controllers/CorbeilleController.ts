/**
 * INFRASTRUCTURE LAYER — Écran Corbeille (Couche 1, PLAN_IMPLEMENTATION_BACKUP.md §1.3).
 *
 * ADMIN uniquement pour l'instant : les 3 use cases de suppression (utilisateur/classe/matière)
 * exigent tous `demandeurRole === 'ADMIN'` aujourd'hui — la nuance "chaque rôle habilité voit
 * uniquement ce qu'il a lui-même supprimé" du plan ne s'applique pas encore puisqu'aucun autre
 * rôle ne peut supprimer quoi que ce soit. À revoir si cette capacité s'étend un jour à d'autres
 * rôles (Censeur, etc.) — l'admin resterait alors le seul à voir l'ensemble de l'établissement.
 */
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';

/**
 * Dispatch dynamique par nom de modèle (User/Class/Subject uniquement — les 3 seules valeurs
 * possibles de `modele` ci-dessous), sur le sous-ensemble de méthodes réellement utilisé ici.
 * Un `as any` masquerait une vraie faute de frappe sur le nom du modèle ; cette interface
 * ciblée garde au moins la forme des appels (where/data) type-checkée.
 */
interface DelegateCorbeille {
  findFirst(args: { where: { id: string; schoolId: string; deletedAt: { not: null } }; select: { schoolId: true } }): Promise<{ schoolId: string } | null>;
  update(args: { where: { id: string; deletedAt: { not: null } }; data: { deletedAt: null; deletedById: null } }): Promise<unknown>;
}

type TypeCorbeille = 'utilisateur' | 'classe' | 'matiere';

export class CorbeilleController {
  constructor(private readonly prisma: PrismaClient) {}

  // GET /api/v2/corbeille
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { type } = req.query as { type?: TypeCorbeille };

      const [utilisateurs, classes, matieres] = await Promise.all([
        (!type || type === 'utilisateur')
          ? this.prisma.user.findMany({
              where: { schoolId: user.schoolId, deletedAt: { not: null } },
              select: { id: true, role: true, firstName: true, lastName: true, email: true, deletedAt: true, deletedById: true },
              orderBy: { deletedAt: 'desc' },
            })
          : [],
        (!type || type === 'classe')
          ? this.prisma.class.findMany({
              where: { schoolId: user.schoolId, deletedAt: { not: null } },
              select: { id: true, name: true, level: true, deletedAt: true, deletedById: true },
              orderBy: { deletedAt: 'desc' },
            })
          : [],
        (!type || type === 'matiere')
          ? this.prisma.subject.findMany({
              where: { schoolId: user.schoolId, deletedAt: { not: null } },
              select: { id: true, name: true, code: true, deletedAt: true, deletedById: true },
              orderBy: { deletedAt: 'desc' },
            })
          : [],
      ]);

      const deletedByIds = [...new Set([...utilisateurs, ...classes, ...matieres].map((r: any) => r.deletedById).filter(Boolean))];
      const auteurs = deletedByIds.length > 0
        ? await this.prisma.user.findMany({ where: { id: { in: deletedByIds }, deletedAt: undefined }, select: { id: true, firstName: true, lastName: true } })
        : [];
      const nomAuteur = (id: string | null) => {
        if (!id) return null;
        const a = auteurs.find((x: any) => x.id === id);
        return a ? `${a.firstName} ${a.lastName}` : null;
      };

      const GRACE_DAYS = parseInt(process.env.PURGE_GRACE_PERIOD_DAYS || '30', 10);
      const purgeLe = (deletedAt: Date) => new Date(deletedAt.getTime() + GRACE_DAYS * 86400000);

      res.json({
        success: true,
        data: {
          utilisateurs: utilisateurs.map((u: any) => ({
            id: u.id, type: 'utilisateur', role: u.role, nom: `${u.firstName} ${u.lastName}`, email: u.email,
            deletedAt: u.deletedAt, deletedByNom: nomAuteur(u.deletedById), purgeLe: purgeLe(u.deletedAt),
          })),
          classes: classes.map((c: any) => ({
            id: c.id, type: 'classe', nom: c.name, niveau: c.level,
            deletedAt: c.deletedAt, deletedByNom: nomAuteur(c.deletedById), purgeLe: purgeLe(c.deletedAt),
          })),
          matieres: matieres.map((m: any) => ({
            id: m.id, type: 'matiere', nom: m.name, code: m.code,
            deletedAt: m.deletedAt, deletedByNom: nomAuteur(m.deletedById), purgeLe: purgeLe(m.deletedAt),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/corbeille/:type/:id/restore
  restaurer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { type, id } = req.params as { type: TypeCorbeille; id: string };

      let cible: { schoolId: string } | null = null;
      let modele: 'user' | 'class' | 'subject';
      if (type === 'utilisateur') { modele = 'user'; } else if (type === 'classe') { modele = 'class'; } else if (type === 'matiere') { modele = 'subject'; } else {
        res.status(400).json({ success: false, message: 'Type de corbeille inconnu' });
        return;
      }

      const delegate = this.prisma[modele] as unknown as DelegateCorbeille;
      cible = await delegate.findFirst({
        where: { id, schoolId: user.schoolId, deletedAt: { not: null } },
        select: { schoolId: true },
      });
      if (!cible) {
        res.status(404).json({ success: false, message: 'Élément introuvable dans la corbeille' });
        return;
      }

      await delegate.update({
        where: { id, deletedAt: { not: null } },
        data: { deletedAt: null, deletedById: null },
      });

      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: `restaurer_${type}`, targetType: modele, targetId: id,
        origin: 'UI_DIRECT', outcome: 'SUCCES',
      });

      res.json({ success: true, message: 'Élément restauré' });
    } catch (error) {
      next(error);
    }
  };
}
