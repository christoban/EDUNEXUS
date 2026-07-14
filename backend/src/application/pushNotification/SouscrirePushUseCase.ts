export interface SouscrirePushCommande {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export class SouscrirePushUseCase {
  constructor(private readonly prisma: any) {}

  async execute(commande: SouscrirePushCommande): Promise<{ id: string }> {
    const existing = await (this.prisma as any).pushSubscription.findFirst({
      where: { userId: commande.userId, endpoint: commande.endpoint },
    });

    if (existing) {
      const updated = await (this.prisma as any).pushSubscription.update({
        where: { id: existing.id },
        data: {
          p256dh: commande.p256dh,
          auth: commande.auth,
          userAgent: commande.userAgent ?? existing.userAgent,
          lastSeenAt: new Date(),
        },
      });
      return { id: updated.id };
    }

    const created = await (this.prisma as any).pushSubscription.create({
      data: {
        userId: commande.userId,
        endpoint: commande.endpoint,
        p256dh: commande.p256dh,
        auth: commande.auth,
        userAgent: commande.userAgent,
      },
    });
    return { id: created.id };
  }
}
