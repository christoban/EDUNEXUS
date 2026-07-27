/**
 * APPLICATION LAYER — Le Fondateur de Groupe initie une demande de transfert (élève ou
 * enseignant) entre deux écoles de SON groupe. Ne déplace aucune donnée — crée seulement la
 * demande, en attente de validation par l'Admin de l'école cible (Section 5 du plan).
 */
import type { PrismaClient } from '@prisma/client';

export interface CreerDemandeTransfertGroupeCommande {
  groupId: string;
  requestedByOwnerId: string;
  type: 'STUDENT' | 'STAFF';
  sourceSchoolId: string;
  targetSchoolId: string;
  sourceUserId: string;
}

export class CreerDemandeTransfertGroupeUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: CreerDemandeTransfertGroupeCommande) {
    if (cmd.sourceSchoolId === cmd.targetSchoolId) {
      throw new Error('École source et école cible doivent être différentes');
    }

    const schoolsInGroup = await this.prisma.school.findMany({
      where: { groupId: cmd.groupId },
      select: { id: true },
    });
    const idsInGroup = new Set(schoolsInGroup.map((s) => s.id));
    if (!idsInGroup.has(cmd.sourceSchoolId) || !idsInGroup.has(cmd.targetSchoolId)) {
      throw new Error("L'école source et l'école cible doivent toutes deux appartenir à votre groupe");
    }

    const sourceUser = await this.prisma.user.findUnique({
      where: { id: cmd.sourceUserId },
      select: { id: true, schoolId: true, role: true, firstName: true, lastName: true },
    });
    if (!sourceUser || sourceUser.schoolId !== cmd.sourceSchoolId) {
      throw new Error("Cette personne n'appartient pas à l'école source indiquée");
    }
    const roleAttendu = cmd.type === 'STUDENT' ? 'STUDENT' : 'TEACHER';
    if (sourceUser.role !== roleAttendu) {
      throw new Error(`Le type de transfert (${cmd.type}) ne correspond pas au rôle de cette personne (${sourceUser.role})`);
    }

    const demande = await this.prisma.groupTransferRequest.create({
      data: {
        groupId: cmd.groupId,
        type: cmd.type,
        sourceSchoolId: cmd.sourceSchoolId,
        targetSchoolId: cmd.targetSchoolId,
        sourceUserId: cmd.sourceUserId,
        requestedByOwnerId: cmd.requestedByOwnerId,
      },
    });

    return { ...demande, sourceUserName: `${sourceUser.firstName} ${sourceUser.lastName}` };
  }
}
