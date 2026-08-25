import type { PrismaClient } from '@prisma/client';
import { User } from '@domain/entities/User';
import type { UserRepository, AuthUserData } from '@domain/ports/repositories/UserRepository';
import type { StaffPermissionType, UserRole } from '@domain/types/enums';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const data = await this.prisma.user.findUnique({
      where: { id },
      include: { staffProfile: { include: { permissions: true } } },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByEmail(email: string, schoolId: string): Promise<User | null> {
    const data = await this.prisma.user.findFirst({
      where: { email, schoolId },
      include: { staffProfile: { include: { permissions: true } } },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByPhone(phone: string, schoolId: string): Promise<User | null> {
    const data = await this.prisma.user.findFirst({
      where: { phone, schoolId },
      include: { staffProfile: { include: { permissions: true } } },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByPhoneContient(phoneFragment: string, schoolId: string): Promise<User | null> {
    const data = await this.prisma.user.findFirst({
      where: { phone: { contains: phoneFragment }, schoolId },
      include: { staffProfile: { include: { permissions: true } } },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findBySchool(schoolId: string): Promise<User[]> {
    const data = await this.prisma.user.findMany({
      where: { schoolId },
      include: { staffProfile: { include: { permissions: true } } },
    });
    return data.map((item) => this.toDomain(item));
  }

  async findByRole(schoolId: string, role: UserRole): Promise<User[]> {
    const data = await this.prisma.user.findMany({
      where: { schoolId, role },
      include: { staffProfile: { include: { permissions: true } } },
    });
    return data.map((item) => this.toDomain(item));
  }

  async findByClass(schoolId: string, classId: string): Promise<User[]> {
    const data = await this.prisma.user.findMany({
      where: { schoolId, role: 'STUDENT', ...whereElevesParClasse(classId) },
      include: { staffProfile: { include: { permissions: true } } },
    });
    return data.map((item) => this.toDomain(item));
  }

  async existsByEmail(email: string, schoolId: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email, schoolId } });
    return count > 0;
  }

  async save(user: User): Promise<void> {
    const data = user.toObject();

    await this.prisma.user.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        role: data.role,
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
        isActive: data.isActive,
        refreshTokenVersion: data.refreshTokenVersion,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });

    if (data.role === 'STAFF' && data.staffPermissions && data.staffPermissions.length > 0) {
      const staffProfile = await this.prisma.staffProfile.create({
        data: {
          userId: data.id,
          schoolId: data.schoolId,
          title: 'STAFF',
          sectionId: data.staffSectionId,
        },
      });

      await this.prisma.staffPermission.createMany({
        data: data.staffPermissions.map((permission) => ({
          staffProfileId: staffProfile.id,
          permission,
        })),
      });
    }
  }

  async update(user: User): Promise<void> {
    const data = user.toObject();

    await this.prisma.user.update({
      where: { id: data.id },
      data: {
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
        isActive: data.isActive,
        refreshTokenVersion: data.refreshTokenVersion,
        lastLogin: data.lastLogin,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async findByIdWithRefreshVersion(
    id: string
  ): Promise<{ user: User; refreshTokenVersion: number } | null> {
    const data = await this.prisma.user.findUnique({
      where: { id },
      include: { staffProfile: { include: { permissions: true } } },
    });
    if (!data) return null;

    return {
      user: this.toDomain(data),
      refreshTokenVersion: data.refreshTokenVersion,
    };
  }

  async saveAvecProfil(user: User, profilData: {
    passwordHash: string;
    staffTitle?: string;
    specializations?: string[];
    subjectIds?: string[];
    classeId?: string;
    dateOfBirth?: Date;
    gender?: string;
    parentOfStudentIds?: string[];
  }): Promise<void> {
    const data = user.toObject();

    await this.prisma.user.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        role: data.role,
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
        isActive: data.isActive,
        refreshTokenVersion: data.refreshTokenVersion,
        passwordHash: profilData.passwordHash,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });

    if (data.role === 'STUDENT') {
      const studentProfile = await this.prisma.studentProfile.create({
        data: {
          userId: data.id,
          dateOfBirth: profilData.dateOfBirth ?? null,
          gender: profilData.gender ?? null,
        },
      });

      // Inscription year-scoped (la classe vit dans Enrollment, plus sur le profil)
      if (profilData.classeId) {
        const classe = await this.prisma.class.findUnique({
          where: { id: profilData.classeId },
          select: { schoolId: true, academicYearId: true },
        });
        if (classe) {
          await this.prisma.enrollment.create({
            data: {
              studentId: studentProfile.id,
              classId: profilData.classeId,
              academicYearId: classe.academicYearId,
              schoolId: classe.schoolId,
              enrolledById: data.id,
              status: 'ACTIVE',
            },
          });
        }
      }

      if (profilData.parentOfStudentIds?.length) {
        for (const parentId of profilData.parentOfStudentIds) {
          const parentProfile = await this.prisma.parentProfile.findFirst({
            where: { userId: parentId },
          });
          if (parentProfile) {
            await this.prisma.parentStudent.create({
              data: { parentProfileId: parentProfile.id, studentProfileId: studentProfile.id },
            });
          }
        }
      }
    }

    if (data.role === 'TEACHER') {
      const teacherProfile = await this.prisma.teacherProfile.create({
        data: { userId: data.id, specialization: profilData.specializations ?? [] },
      });

      if (profilData.subjectIds?.length) {
        await this.prisma.teacherSubject.createMany({
          data: profilData.subjectIds.map((subjectId) => ({
            teacherProfileId: teacherProfile.id,
            subjectId,
          })),
          skipDuplicates: true,
        });
      }
    }

    if (data.role === 'PARENT') {
      await this.prisma.parentProfile.create({ data: { userId: data.id } });
    }

    if (data.role === 'STAFF') {
      const staffProfile = await this.prisma.staffProfile.create({
        data: {
          schoolId: data.schoolId,
          userId: data.id,
          title: profilData.staffTitle ?? 'Staff',
          sectionId: data.staffSectionId ?? null,
        },
      });

      if (data.staffPermissions && data.staffPermissions.length > 0) {
        await this.prisma.staffPermission.createMany({
          data: data.staffPermissions.map((permission) => ({
            staffProfileId: staffProfile.id,
            permission,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  async authentifier(email: string, schoolId: string, plainPassword: string, role?: string): Promise<User | null> {
    const ROLES_CONNUS: UserRole[] = ['ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT'];
    // Un rôle hors énumération levait une PrismaClientValidationError (500) au lieu d'un échec
    // d'authentification normal — même traitement qu'un email/mot de passe incorrect, pour ne
    // jamais distinguer "rôle invalide" de "identifiants invalides" (pas d'info leakage).
    if (role !== undefined && !ROLES_CONNUS.includes(role as UserRole)) return null;
    const data = await this.prisma.user.findFirst({
      where: { email, schoolId, ...(role ? { role: role as UserRole } : {}) },
      include: { staffProfile: { include: { permissions: true } } },
    });
    if (!data || !data.passwordHash) return null;

    const bcrypt = await import('bcryptjs');
    const valide = await bcrypt.compare(plainPassword, data.passwordHash);
    if (!valide) return null;

    return this.toDomain(data);
  }

  async listerRolesAvecMotDePasse(email: string, schoolId: string, plainPassword: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { email, schoolId, isActive: true },
      select: { role: true, passwordHash: true },
    });
    const bcrypt = await import('bcryptjs');
    const resultats = await Promise.all(
      users.map(async u => {
        if (!u.passwordHash) return null;
        const ok = await bcrypt.compare(plainPassword, u.passwordHash);
        return ok ? u.role : null;
      })
    );
    return resultats.filter((r): r is NonNullable<typeof r> => r !== null) as string[];
  }

  async mettreAJourAvecProfil(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
    email?: string;
    isActive?: boolean;
    passwordHash?: string;
    subjectIds?: string[];
    classeId?: string;
    dateOfBirth?: Date;
    gender?: string;
  }): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.email && { email: data.email }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.passwordHash && { passwordHash: data.passwordHash }),
        updatedAt: new Date(),
      },
    });

    if (data.subjectIds !== undefined) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId },
      });
      if (teacherProfile) {
        await this.prisma.teacherSubject.deleteMany({
          where: { teacherProfileId: teacherProfile.id },
        });
        if (data.subjectIds.length > 0) {
          await this.prisma.teacherSubject.createMany({
            data: data.subjectIds.map(subjectId => ({
              teacherProfileId: teacherProfile.id,
              subjectId,
            })),
          });
        }
      }
    }

    if (data.classeId !== undefined || data.dateOfBirth !== undefined || data.gender !== undefined) {
      await this.prisma.studentProfile.update({
        where: { userId },
        data: {
          ...(data.classeId !== undefined && { classId: data.classeId }),
          ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth }),
          ...(data.gender !== undefined && { gender: data.gender }),
        },
      });
    }
  }

  /**
   * Nom historique ("avecCascade") conservé pour ne pas devoir renommer l'interface du port et
   * ses ~8 doublures InMemory de test — le comportement, lui, a changé du tout au tout (Couche 1,
   * PLAN_IMPLEMENTATION_BACKUP.md) : ceci ne supprime plus RIEN en cascade. `deletedAt` est
   * simplement posé sur la ligne User elle-même ; toutes ses données liées (notes, présences,
   * bulletins, liens parent-élève...) restent intactes et inchangées, invisibles seulement parce
   * que l'écran qui les affiche résout déjà l'élève/enseignant via `user.findUnique` (filtré par
   * softDeleteExtension.ts). Une restauration remet donc tout en état sans rien à reconstruire.
   *
   * Changement de comportement assumé par rapport à l'ancienne cascade : un parent dont c'était
   * le dernier enfant rattaché n'est plus supprimé automatiquement avec l'élève — cet effet de
   * bord n'a plus sa place dans un mécanisme pensé pour être réversible (le geste de l'admin
   * porte sur l'élève, pas sur le compte du parent).
   */
  async supprimerAvecCascade(userId: string, deletedById?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new Error('Utilisateur introuvable');
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), deletedById: deletedById ?? null },
    });
  }

  async restaurer(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId, deletedAt: { not: null } },
      data: { deletedAt: null, deletedById: null },
    });
  }

  async transfererEleve(params: {
    studentId: string;
    fromClasseId: string;
    toClasseId: string;
    demandeurId: string;
    schoolId: string;
  }): Promise<void> {
    const classeCible = await this.prisma.class.findUniqueOrThrow({
      where: { id: params.toClasseId },
      select: { schoolId: true, academicYearId: true },
    });
    const profilEleve = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { userId: params.studentId },
      select: { id: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: { studentId: profilEleve.id, status: 'ACTIVE' },
        data: { status: 'TRANSFERRED', exitedAt: new Date(), exitReason: 'TRANSFERT_INTERNE' },
      });
      await tx.enrollment.create({
        data: {
          studentId: profilEleve.id,
          classId: params.toClasseId,
          academicYearId: classeCible.academicYearId,
          schoolId: classeCible.schoolId,
          enrolledById: params.demandeurId,
          status: 'ACTIVE',
        },
      });
      await tx.studentPromotion.create({
        data: {
          id: crypto.randomUUID(),
          schoolId: params.schoolId,
          studentId: profilEleve.id,
          fromClassId: params.fromClasseId,
          toClassId: params.toClasseId,
          academicYearId: 'TRANSFER',
          promotedById: params.demandeurId,
          promotedAt: new Date(),
        },
      });
    });
  }

  async findEmailsParentsParEleve(studentId: string): Promise<string[]> {
    const relations = await this.prisma.parentStudent.findMany({
      where: { studentProfile: { userId: studentId } },
      include: { parentProfile: { include: { user: { select: { email: true } } } } },
    });
    return relations
      .map((r) => r.parentProfile.user.email)
      .filter((email): email is string => !!email);
  }

  async findAuthDataById(id: string): Promise<AuthUserData | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        isActive: true,
        loginEmailOtpHash: true,
        loginEmailOtpExpiresAt: true,
        loginEmailOtpAttempts: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaRecoveryCodeHashes: true,
      },
    });
  }

  async saveLoginEmailOtp(id: string, data: { hash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        loginEmailOtpHash: data.hash,
        loginEmailOtpExpiresAt: data.expiresAt,
        loginEmailOtpAttempts: 0,
        loginEmailOtpSentAt: new Date(),
      },
    });
  }

  async incrementLoginEmailOtpAttempts(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { loginEmailOtpAttempts: { increment: 1 } },
    });
  }

  async clearLoginEmailOtp(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        loginEmailOtpHash: null,
        loginEmailOtpExpiresAt: null,
        loginEmailOtpAttempts: 0,
        loginEmailOtpSentAt: null,
      },
    });
  }

  async updateMfaRecoveryCodeHashes(id: string, hashes: string[]): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { mfaRecoveryCodeHashes: hashes },
    });
  }

  private toDomain(data: any): User {
    const permissions: StaffPermissionType[] =
      data.staffProfile?.permissions?.map((p: { permission: StaffPermissionType }) => p.permission) ?? [];

    return User.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      role: data.role as UserRole,
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      firstName: data.firstName,
      lastName: data.lastName,
      avatarUrl: data.avatarUrl ?? undefined,
      isActive: data.isActive,
      refreshTokenVersion: data.refreshTokenVersion,
      lastLogin: data.lastLogin ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      staffPermissions: permissions,
      staffSectionId: data.staffProfile?.sectionId ?? undefined,
    });
  }
}