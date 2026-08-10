export interface DesinscrirePushCommande {
  userId: string;
  endpoint: string;
}

export class DesinscrirePushUseCase {
  constructor(private readonly prisma: any) {}

  async execute(commande: DesinscrirePushCommande): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId: commande.userId, endpoint: commande.endpoint },
    });
  }
}
