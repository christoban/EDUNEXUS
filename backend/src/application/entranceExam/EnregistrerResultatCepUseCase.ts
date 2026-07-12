import type { PrismaClient } from '@prisma/client';
import type { EnregistrerResultatCepCommande } from './types';
import bcrypt from 'bcryptjs';

export class EnregistrerResultatCepUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: EnregistrerResultatCepCommande): Promise<{ status: string; studentCreated: boolean; candidateName: string; parentPhone: string | null }> {
    const candidate = await (this.prisma as any).entranceExamCandidate.findUnique({
      where: { id: cmd.candidateId },
      include: { session: true },
    });
    if (!candidate) throw new Error('Candidat introuvable');
    if (candidate.session.schoolId !== cmd.schoolId) throw new Error('AccÃ¨s refusÃ©');
    if (candidate.admissionStatus !== 'ADMIS_PROVISOIRE') {
      throw new Error('Seuls les candidats ADMIS_PROVISOIRE peuvent recevoir un rÃ©sultat CEP');
    }

    const now = new Date();
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const parentPhone: string | null = candidate.parentPhone ?? null;

    if (cmd.cepResult === 'REUSSI') {
      // Confirmer l'admission
      await (this.prisma as any).entranceExamCandidate.update({
        where: { id: cmd.candidateId },
        data: {
          cepResult: 'REUSSI',
          cepResultDate: now,
          admissionStatus: 'CONFIRME',
        },
      });

      // CrÃ©er le compte Ã©lÃ¨ve
      const defaultPassword = 'ZEKOULABIA2024';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      // Trouver une classe de 6e dans l'Ã©cole
      const classes6e = await this.prisma.class.findMany({
        where: { schoolId: cmd.schoolId, level: { contains: '6' } },
        orderBy: { name: 'asc' },
      });

      const targetClass = classes6e[0];
      if (!targetClass) {
        // Pas de classe 6e disponible â€” on confirme quand mÃªme le candidat sans crÃ©er de compte
        return { status: 'CONFIRME', studentCreated: false, candidateName, parentPhone };
      }

      // Créer l'utilisateur — dateOfBirth n'existe PAS sur User, elle va sur StudentProfile
      // (bug précédent : le champ était posé ici, ce qui faisait planter Prisma à chaque
      // confirmation CEP réussie avec "Unknown arg dateOfBirth").
      const user = await (this.prisma as any).user.create({
        data: {
          schoolId: cmd.schoolId,
          role: 'STUDENT',
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          passwordHash,
          isActive: true,
        },
      });

      // Créer le profil élève
      const profile = await (this.prisma as any).studentProfile.create({
        data: {
          userId: user.id,
          classId: targetClass.id,
          studentStatus: 'ACTIVE',
          dateOfBirth: candidate.dateOfBirth ?? null,
        },
      });

      // Lier le candidat au profil
      await (this.prisma as any).entranceExamCandidate.update({
        where: { id: cmd.candidateId },
        data: { studentProfileId: profile.id },
      });

      return { status: 'CONFIRME', studentCreated: true, candidateName, parentPhone };
    } else {
      // Ã‰chec CEP â†’ annuler
      await (this.prisma as any).entranceExamCandidate.update({
        where: { id: cmd.candidateId },
        data: {
          cepResult: 'ECHOUE',
          cepResultDate: now,
          admissionStatus: 'ANNULE',
        },
      });
      return { status: 'ANNULE', studentCreated: false, candidateName, parentPhone };
    }
  }
}
