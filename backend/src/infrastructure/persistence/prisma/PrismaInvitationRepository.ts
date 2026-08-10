import type { PrismaClient, PlanType } from '@prisma/client';
import type {
  InvitationRepository,
  InvitationProps,
} from '@domain/ports/repositories/InvitationRepository';

export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByToken(token: string): Promise<InvitationProps | null> {
    const data = await this.prisma.schoolInvite.findUnique({ where: { token } });
    if (!data) return null;
    return this.toProps(data);
  }

  async findBySchoolId(schoolId: string): Promise<InvitationProps[]> {
    const data = await this.prisma.schoolInvite.findMany({ where: { schoolId } });
    return data.map(d => this.toProps(d));
  }

  async findPendingByEmail(email: string): Promise<InvitationProps | null> {
    const data = await this.prisma.schoolInvite.findFirst({
      where: { email, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!data) return null;
    return this.toProps(data);
  }

  async save(invitation: InvitationProps): Promise<void> {
    await this.prisma.schoolInvite.create({
      data: {
        id: invitation.id,
        email: invitation.email,
        schoolName: invitation.schoolName,
        token: invitation.token,
        schoolId: invitation.schoolId,
        invitedByMasterId: invitation.invitedByMasterId,
        plan: invitation.plan as PlanType,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        notes: invitation.notes,
        createdAt: invitation.createdAt,
      },
    });
  }

  async update(invitation: InvitationProps): Promise<void> {
    await this.prisma.schoolInvite.update({
      where: { id: invitation.id },
      data: {
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    });
  }

  async expireToutes(schoolId: string): Promise<void> {
    await this.prisma.schoolInvite.updateMany({
      where: { schoolId, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
  }

  async marquerUtilisee(token: string): Promise<void> {
    await this.prisma.schoolInvite.update({
      where: { token },
      data: { status: 'USED' },
    });
  }

  private toProps(data: any): InvitationProps {
    return {
      id: data.id,
      email: data.email,
      schoolName: data.schoolName,
      token: data.token,
      schoolId: data.schoolId ?? undefined,
      invitedByMasterId: data.invitedByMasterId ?? undefined,
      plan: data.plan,
      status: data.status,
      expiresAt: data.expiresAt,
      notes: data.notes ?? undefined,
      createdAt: data.createdAt,
    };
  }
}
