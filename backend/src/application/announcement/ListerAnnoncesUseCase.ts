import type { PrismaClient, UserRole } from '@prisma/client';

export interface ListerAnnoncesCommande {
  schoolId: string;
  role: string;
}

export class ListerAnnoncesUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: ListerAnnoncesCommande) {
    const role = cmd.role.toUpperCase() as UserRole;
    const now = new Date();

    const conditionExpiration = {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    };

    const where: Record<string, unknown> = {
      schoolId: cmd.schoolId,
      AND: role === 'ADMIN'
        ? [conditionExpiration]
        : [
            conditionExpiration,
            {
              OR: [
                { targetRoles: { has: role } },
                { targetRoles: { isEmpty: true } },
              ],
            },
          ],
    };

    return (this.prisma as any).announcement.findMany({
      where,
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
  }
}