/**
 * APPLICATION LAYER — Liste des demandes de transfert du groupe (toutes, tous statuts),
 * vue du Fondateur de Groupe.
 */
import type { PrismaClient } from '@prisma/client';

export class ListerDemandesTransfertGroupeUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(groupId: string) {
    const demandes = await this.prisma.groupTransferRequest.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    });

    const schoolIds = Array.from(new Set(demandes.flatMap((d) => [d.sourceSchoolId, d.targetSchoolId])));
    const userIds = demandes.map((d) => d.sourceUserId);

    const [schools, users] = await Promise.all([
      this.prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true } }),
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const schoolNameById = new Map(schools.map((s) => [s.id, s.name]));
    const userNameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    return demandes.map((d) => ({
      ...d,
      sourceSchoolName: schoolNameById.get(d.sourceSchoolId) ?? '—',
      targetSchoolName: schoolNameById.get(d.targetSchoolId) ?? '—',
      sourceUserName: userNameById.get(d.sourceUserId) ?? '—',
    }));
  }
}
