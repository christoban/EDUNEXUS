import type { PrismaClient } from '@prisma/client';
import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { StaffPermissionType, UserRole } from '@domain/types/enums';

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
        data: { userId: data.id, classId: profilData.classeId ?? null },
      });

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
    const data = await this.prisma.user.findFirst({
      where: { email, schoolId, ...(role ? { role: role as any } : {}) },
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

    if (data.classeId !== undefined) {
      await this.prisma.studentProfile.update({
        where: { userId },
        data: { classId: data.classeId },
      });
    }
  }

  async supprimerAvecCascade(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!user) throw new Error('Utilisateur introuvable');

      let parentProfileIds: string[] = [];

      if (user.role === 'STUDENT') {
        const studentProfile = await tx.studentProfile.findUnique({
          where: { userId },
          select: {
            parents: { select: { parentProfileId: true } },
          },
        });
        parentProfileIds = studentProfile?.parents.map(p => p.parentProfileId) ?? [];
      }

      await tx.attendance.deleteMany({ where: { studentId: userId } });
      await tx.grade.deleteMany({ where: { studentId: userId } });
      await tx.reportCard.deleteMany({ where: { studentId: userId } });
      await tx.parentStudent.deleteMany({
        where: {
          OR: [
            { studentProfile: { userId } },
            { parentProfile: { userId } },
          ],
        },
      });
      await tx.teacherSubject.deleteMany({
        where: { teacherProfile: { userId } },
      });
      await tx.staffPermission.deleteMany({
        where: { staffProfile: { userId } },
      });
      await tx.user.delete({ where: { id: userId } });

      for (const parentProfileId of parentProfileIds) {
        const remaining = await tx.parentStudent.count({
          where: { parentProfileId },
        });
        if (remaining === 0) {
          const parentProfile = await tx.parentProfile.findUnique({
            where: { id: parentProfileId },
            select: { userId: true },
          });
          if (parentProfile) {
            await tx.parentProfile.delete({ where: { id: parentProfileId } });
            await tx.user.delete({ where: { id: parentProfile.userId } });
          }
        }
      }
    });
  }

  async transfererEleve(params: {
    studentId: string;
    fromClasseId: string;
    toClasseId: string;
    demandeurId: string;
    schoolId: string;
  }): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.studentProfile.update({
        where: { userId: params.studentId },
        data: { classId: params.toClasseId },
      }),
      this.prisma.studentPromotion.create({
        data: {
          id: crypto.randomUUID(),
          schoolId: params.schoolId,
          studentId: params.studentId,
          fromClassId: params.fromClasseId,
          toClassId: params.toClasseId,
          academicYearId: 'TRANSFER',
          promotedById: params.demandeurId,
          promotedAt: new Date(),
        },
      }),
    ]);
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