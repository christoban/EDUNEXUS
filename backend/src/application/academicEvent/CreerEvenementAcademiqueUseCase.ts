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
import { activerRessourceLieeSiApplicable } from './activerRessourceLiee';

export interface CreerEvenementCommande {
  schoolId: string;
  createdById: string;
  type: string;
  category: 'FIXED_DATE' | 'MANUAL_TRIGGER' | 'SLIDING_WINDOW';
  title: string;
  description?: string;
  targetRoles: string[];
  level?: string;
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
    if (cmd.type === 'CHOIX_LV2' && !cmd.level) {
      throw new Error('Un événement de type CHOIX_LV2 requiert un niveau (level).');
    }

    // FIXED_DATE et SLIDING_WINDOW s'ouvrent tous deux automatiquement à leur openDate — seul
    // MANUAL_TRIGGER n'a jamais d'ouverture automatique (voir DeclencherEvenementUseCase).
    const status = cmd.category !== 'MANUAL_TRIGGER' && cmd.openDate && cmd.openDate <= new Date() ? 'ACTIVE' : 'UPCOMING';

    // Ouvre la ressource réelle AVANT de persister l'événement — si ça échoue (ex. fenêtre déjà
    // ouverte pour ce niveau), aucun AcademicEvent orphelin n'est créé : jamais un événement
    // "actif" sans que la fonctionnalité qu'il représente ne le soit vraiment.
    let linkedResourceId: string | null = null;
    if (status === 'ACTIVE') {
      linkedResourceId = await activerRessourceLieeSiApplicable(this.prisma, {
        id: '', schoolId: cmd.schoolId, type: cmd.type,
        level: cmd.level ?? null, openDate: cmd.openDate ?? null, closeDate: cmd.closeDate ?? null,
      });
    }

    const evenement = await this.prisma.academicEvent.create({
      data: {
        schoolId: cmd.schoolId,
        createdById: cmd.createdById,
        type: cmd.type,
        category: cmd.category,
        title: cmd.title,
        description: cmd.description ?? null,
        targetRoles: cmd.targetRoles,
        level: cmd.level ?? null,
        openDate: cmd.category === 'MANUAL_TRIGGER' ? null : cmd.openDate,
        closeDate: cmd.closeDate ?? null,
        status,
        linkedResourceId,
      },
    });
    return { id: evenement.id };
  }
}
