import type { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import type {
  EleveOnboardingRepository,
  OnboardingSettings,
  OnboardingRecord,
  OnboardingProfileMatch,
  ValiderOnboardingInput,
  ValiderOnboardingCompteResultat,
} from '@domain/ports/repositories/EleveOnboardingRepository';
import type { OnboardingRecipient, OnboardingSource } from '@domain/types/enums';

const RESET_TOKEN_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

function genererIdentifiants() {
  const resetToken = randomBytes(32).toString('hex');
  const resetTokenHash = createHash('sha256').update(resetToken).digest('hex');
  return { resetToken, resetTokenHash, resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_VALIDITY_MS) };
}

export class PrismaEleveOnboardingRepository implements EleveOnboardingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSettings(schoolId: string): Promise<OnboardingSettings | null> {
    return this.prisma.schoolOnboardingSettings.findUnique({ where: { schoolId } });
  }

  async findOnboardingById(id: string, schoolId: string): Promise<OnboardingRecord | null> {
    return this.prisma.studentOnboarding.findFirst({ where: { id, schoolId } });
  }

  async findOnboardingByToken(token: string): Promise<OnboardingRecord | null> {
    return this.prisma.studentOnboarding.findUnique({ where: { token } });
  }

  async findClassOnboardingInfo(classId: string): Promise<{ level: string; templateCode: string | null } | null> {
    const classe = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { level: true, school: { select: { templateCode: true } } },
    });
    if (!classe?.school) return null;
    return { level: classe.level, templateCode: classe.school.templateCode };
  }

  async findProfilesParDateNaissance(schoolId: string, dateOfBirth: Date): Promise<OnboardingProfileMatch[]> {
    const profiles = await this.prisma.studentProfile.findMany({
      where: { user: { schoolId }, dateOfBirth },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    return profiles.map((p) => ({
      id: p.id,
      lastName: p.user.lastName ?? '',
      firstName: p.user.firstName ?? '',
    }));
  }

  async findGroupTransferRequestByOnboarding(onboardingId: string): Promise<{ sourceUserId: string } | null> {
    const demande = await this.prisma.groupTransferRequest.findFirst({ where: { onboardingId } });
    return demande ? { sourceUserId: demande.sourceUserId } : null;
  }

  async createSquelette(data: {
    schoolId: string; nomProvisoire: string; classId: string | null;
    contactEmail: string | null; contactTelephone: string | null;
    parentContactEmail: string | null; parentContactTelephone: string | null;
    recipientType: OnboardingRecipient; sourceType: OnboardingSource; examCandidateId: string | null;
    eleveADispositif: boolean | null; eleveDispositifOS: string | null;
    parentADispositif: boolean | null; parentDispositifOS: string | null;
    token: string; tokenExpiresAt: Date;
  }): Promise<OnboardingRecord> {
    return this.prisma.studentOnboarding.create({
      data: {
        schoolId: data.schoolId,
        nomProvisoire: data.nomProvisoire,
        classId: data.classId,
        contactEmail: data.contactEmail,
        contactTelephone: data.contactTelephone,
        parentContactEmail: data.parentContactEmail,
        parentContactTelephone: data.parentContactTelephone,
        recipientType: data.recipientType,
        sourceType: data.sourceType,
        examCandidateId: data.examCandidateId,
        eleveADispositif: data.eleveADispositif,
        eleveDispositifOS: data.eleveDispositifOS,
        parentADispositif: data.parentADispositif,
        parentDispositifOS: data.parentDispositifOS,
        token: data.token,
        tokenExpiresAt: data.tokenExpiresAt,
        status: 'LINK_SENT',
      },
    });
  }

  async marquerOnboardingExpire(id: string): Promise<void> {
    await this.prisma.studentOnboarding.update({ where: { id }, data: { status: 'EXPIRED' } });
  }

  async soumettreFormulaire(id: string, data: {
    submittedData: Record<string, unknown>; submittedAt: Date; tokenUsedAt: Date;
    matchScore: number | null; matchedStudentId: string | null;
    eleveADispositif?: boolean; parentADispositif?: boolean;
  }): Promise<void> {
    await this.prisma.studentOnboarding.update({
      where: { id },
      data: {
        submittedData: data.submittedData as Prisma.InputJsonValue,
        submittedAt: data.submittedAt,
        tokenUsedAt: data.tokenUsedAt,
        status: 'PENDING_VALIDATION',
        matchScore: data.matchScore,
        matchedStudentId: data.matchedStudentId,
        ...(data.eleveADispositif !== undefined && { eleveADispositif: data.eleveADispositif }),
        ...(data.parentADispositif !== undefined && { parentADispositif: data.parentADispositif }),
      },
    });
  }

  async rejeterOnboarding(id: string, data: { rejectionReason: string; rejectedById: string; rejectedAt: Date }): Promise<void> {
    await this.prisma.studentOnboarding.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: data.rejectionReason,
        validatedById: data.rejectedById,
        validatedAt: data.rejectedAt,
      },
    });
  }

  async reactiverStudentProfilesTransferes(sourceUserId: string): Promise<void> {
    await this.prisma.studentProfile.updateMany({
      where: { userId: sourceUserId, studentStatus: 'TRANSFERRED' },
      data: { studentStatus: 'ACTIVE' },
    });
  }

  async validerOnboarding(input: ValiderOnboardingInput): Promise<{ studentProfileId: string; comptesCrees: ValiderOnboardingCompteResultat[] }> {
    const { studentProfile, comptesCrees } = await this.prisma.$transaction(async (tx) => {
      const studentUser = await tx.user.create({
        data: {
          schoolId: input.schoolId,
          role: 'STUDENT',
          firstName: input.prenom,
          lastName: input.nom,
          email: input.eleveContactEmail,
          phone: input.eleveContactTelephone,
          passwordHash: input.studentPasswordHash,
          resetPasswordToken: input.studentResetTokenHash,
          resetPasswordTokenExpiry: input.studentResetTokenExpiry,
          accessMode: input.eleveAccessMode,
          isActive: true,
        },
      });

      const studentProfile = await tx.studentProfile.create({
        data: {
          userId: studentUser.id,
          studentStatus: 'ACTIVE',
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
        },
      });

      const classeCible = await tx.class.findUniqueOrThrow({
        where: { id: input.classId },
        select: { schoolId: true, academicYearId: true },
      });
      await tx.enrollment.create({
        data: {
          studentId: studentProfile.id,
          classId: input.classId,
          academicYearId: classeCible.academicYearId,
          schoolId: classeCible.schoolId,
          enrolledById: input.validatedById,
          status: 'ACTIVE',
        },
      });

      const comptesCrees: ValiderOnboardingCompteResultat[] = [{
        role: 'STUDENT',
        userId: studentUser.id,
        resetToken: input.studentResetToken,
        contactEmail: input.eleveContactEmail,
        contactTelephone: input.eleveContactTelephone,
        compteExistant: false,
        accessMode: input.eleveAccessMode,
      }];

      if (input.parentRecoitContact) {
        const contactFilters = [
          input.parentContactEmail ? { email: input.parentContactEmail } : null,
          input.parentContactTelephone ? { phone: input.parentContactTelephone } : null,
        ].filter(Boolean) as Record<string, string>[];

        const existingParentUser = contactFilters.length > 0
          ? await tx.user.findFirst({ where: { schoolId: input.schoolId, role: 'PARENT', OR: contactFilters } })
          : null;

        let parentProfileId: string;
        let parentUserId: string;
        let parentReset: ReturnType<typeof genererIdentifiants> | null;
        let compteExistant: boolean;

        if (existingParentUser) {
          const existingProfile = await tx.parentProfile.findUnique({ where: { userId: existingParentUser.id } });
          parentProfileId = existingProfile!.id;
          parentUserId = existingParentUser.id;
          parentReset = null;
          compteExistant = true;
        } else {
          parentReset = input.parentAccessMode === 'FULL_ACCESS' ? genererIdentifiants() : null;
          const parentPassword = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
          const parentUser = await tx.user.create({
            data: {
              schoolId: input.schoolId,
              role: 'PARENT',
              firstName: 'Parent de',
              lastName: input.nom,
              email: input.parentContactEmail,
              phone: input.parentContactTelephone,
              passwordHash: parentPassword,
              resetPasswordToken: parentReset?.resetTokenHash ?? null,
              resetPasswordTokenExpiry: parentReset?.resetTokenExpiry ?? null,
              accessMode: input.parentAccessMode,
              isActive: true,
            },
          });
          const parentProfile = await tx.parentProfile.create({ data: { userId: parentUser.id } });
          parentProfileId = parentProfile.id;
          parentUserId = parentUser.id;
          compteExistant = false;
        }

        await tx.parentStudent.create({
          data: { parentProfileId, studentProfileId: studentProfile.id },
        });

        comptesCrees.push({
          role: 'PARENT',
          userId: parentUserId,
          resetToken: parentReset?.resetToken ?? null,
          contactEmail: input.parentContactEmail,
          contactTelephone: input.parentContactTelephone,
          compteExistant,
          accessMode: input.parentAccessMode,
        });
      }

      await tx.studentOnboarding.update({
        where: { id: input.onboardingId },
        data: {
          status: 'ACTIVATED',
          validatedById: input.validatedById,
          validatedAt: new Date(),
          createdStudentId: studentProfile.id,
          classId: input.classId,
        },
      });

      if (input.examCandidateId) {
        await tx.entranceExamCandidate.update({
          where: { id: input.examCandidateId },
          data: { studentProfileId: studentProfile.id },
        });
      }

      return { studentProfile, comptesCrees };
    });

    return { studentProfileId: studentProfile.id, comptesCrees };
  }
}
