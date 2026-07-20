/**
 * APPLICATION LAYER — Créer un événement académique.
 * Validation spécifique par catégorie :
 *  - FIXED_DATE : openDate ET closeDate obligatoires (dates connues à l'avance).
 *  - MANUAL_TRIGGER : aucune date à la création — l'admin déclenchera lui-même
 *    (DeclencherEvenementUseCase) le jour où le fait externe se produit.
 *  - SLIDING_WINDOW : openDate obligatoire (fenêtre par défaut), closeDate optionnelle
 *    (ajustable ensuite via AjusterFenetreEvenementUseCase).
 */
import type { PrismaClient } from '@prisma/client';

export interface CreerEvenementCommande {
  schoolId: string;
  createdById: string;
  type: string;
  category: 'FIXED_DATE' | 'MANUAL_TRIGGER' | 'SLIDING_WINDOW';
  title: string;
  description?: string;
  targetRoles: string[];
  openDate?: Date;
  closeDate?: Date;
}

export class CreerEvenementAcademiqueUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: CreerEvenementCommande): Promise<{ id: string }> {
    if (cmd.category === 'FIXED_DATE' && (!cmd.openDate || !cmd.closeDate)) {
      throw new Error('Un événement à date fixe requiert une date d\'ouverture et une date de clôture.');
    }
    if (cmd.category === 'SLIDING_WINDOW' && !cmd.openDate) {
      throw new Error('Un événement à fenêtre glissante requiert une date d\'ouverture par défaut.');
    }
    if (cmd.targetRoles.length === 0) {
      throw new Error('Au moins un rôle cible est requis.');
    }

    // FIXED_DATE et SLIDING_WINDOW s'ouvrent tous deux automatiquement à leur openDate — seul
    // MANUAL_TRIGGER n'a jamais d'ouverture automatique (voir DeclencherEvenementUseCase).
    const status = cmd.category !== 'MANUAL_TRIGGER' && cmd.openDate && cmd.openDate <= new Date() ? 'ACTIVE' : 'UPCOMING';

    const evenement = await (this.prisma as any).academicEvent.create({
      data: {
        schoolId: cmd.schoolId,
        createdById: cmd.createdById,
        type: cmd.type,
        category: cmd.category,
        title: cmd.title,
        description: cmd.description ?? null,
        targetRoles: cmd.targetRoles,
        openDate: cmd.category === 'MANUAL_TRIGGER' ? null : cmd.openDate,
        closeDate: cmd.closeDate ?? null,
        status,
      },
    });
    return { id: evenement.id };
  }
}
