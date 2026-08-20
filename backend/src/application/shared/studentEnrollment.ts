// src/application/shared/studentEnrollment.ts

import { PrismaClient } from '@prisma/client';

/**
 * Helper centralisé pour interroger et modifier les inscriptions (Enrollment).
 *
 * Remplace les accès directs à l'ancien StudentProfile.classId (supprimé)
 * par des requêtes via la table Enrollment (year-scoped, historique complet).
 *
 * Règle absolue : la classe d'un élève se lit UNIQUEMENT via
 * Enrollment où status='ACTIVE' et academicYear.isCurrent=true.
 */

// ─── Types ───

export interface ClasseActuelleInfo {
  classId: string;
  className: string;
  level: string | null;
  serie: string | null;
  filiere: string | null;
  sectionId: string | null;
  sectionCode: string | null;
  professorPrincipalId: string | null;
}

export interface InscrireEleveParams {
  studentId: string;        // StudentProfile.id
  classId: string;
  academicYearId: string;
  schoolId: string;
  enrolledById: string;    // User.id
  status?: 'ACTIVE' | 'REPEATING';
}

export interface ChangerClasseParams {
  studentId: string;        // StudentProfile.id
  newClassId: string;
  academicYearId: string;
  schoolId: string;
  enrolledById: string;    // User.id
  exitReason?: string;     // 'PROMOTION' | 'TRANSFERT' | 'PEBS' | ...
}

// ─── Pattern A : Lister les élèves d'une classe ───

/**
 * Retourne les IDs de StudentProfile des élèves actifs dans une classe.
 */
export async function getStudentProfileIdsParClasse(
  prisma: PrismaClient,
  classId: string,
): Promise<string[]> {
  const rows = await prisma.enrollment.findMany({
    where: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
    select: { studentId: true },
  });
  return rows.map((r) => r.studentId);
}

/**
 * Retourne les IDs de User des élèves actifs dans une classe.
 * (notifications, messagerie, ciblage d'annonces)
 */
export async function getEleveUserIdsParClasse(
  prisma: PrismaClient,
  classId: string,
): Promise<string[]> {
  const rows = await prisma.enrollment.findMany({
    where: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
    select: { student: { select: { userId: true } } },
  });
  return rows.map((r) => r.student.userId);
}

/**
 * Compte le nombre d'élèves actifs dans une classe.
 */
export async function countElevesParClasse(
  prisma: PrismaClient,
  classId: string,
): Promise<number> {
  return prisma.enrollment.count({
    where: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
  });
}

// ─── Pattern B : Lire la classe actuelle d'un élève ───

/**
 * Retourne les infos de la classe actuelle d'un élève (depuis userId).
 * Retourne null si l'élève n'a pas d'inscription active.
 */
export async function getClasseActuelleEleve(
  prisma: PrismaClient,
  userId: string,
): Promise<ClasseActuelleInfo | null> {
  const row = await prisma.enrollment.findFirst({
    where: { student: { userId }, status: 'ACTIVE', academicYear: { isCurrent: true } },
    select: {
      class: {
        select: {
          id: true,
          name: true,
          level: true,
          serie: true,
          filiere: true,
          sectionId: true,
          section: { select: { code: true } },
          professorPrincipalId: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    classId: row.class.id,
    className: row.class.name,
    level: row.class.level,
    serie: row.class.serie,
    filiere: row.class.filiere,
    sectionId: row.class.sectionId,
    sectionCode: row.class.section?.code ?? null,
    professorPrincipalId: row.class.professorPrincipalId,
  };
}

/**
 * Variante : depuis un StudentProfile.id (quand on a déjà le profil).
 */
export async function getClasseActuelleParStudentId(
  prisma: PrismaClient,
  studentId: string,
): Promise<ClasseActuelleInfo | null> {
  const row = await prisma.enrollment.findFirst({
    where: { studentId, status: 'ACTIVE', academicYear: { isCurrent: true } },
    select: {
      class: {
        select: {
          id: true,
          name: true,
          level: true,
          serie: true,
          filiere: true,
          sectionId: true,
          section: { select: { code: true } },
          professorPrincipalId: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    classId: row.class.id,
    className: row.class.name,
    level: row.class.level,
    serie: row.class.serie,
    filiere: row.class.filiere,
    sectionId: row.class.sectionId,
    sectionCode: row.class.section?.code ?? null,
    professorPrincipalId: row.class.professorPrincipalId,
  };
}

/**
 * Version légère : retourne uniquement le classId (depuis userId).
 */
export async function getClassIdActuelEleve(
  prisma: PrismaClient,
  userId: string,
): Promise<string | null> {
  const row = await prisma.enrollment.findFirst({
    where: { student: { userId }, status: 'ACTIVE', academicYear: { isCurrent: true } },
    select: { classId: true },
  });
  return row?.classId ?? null;
}

/**
 * Retourne une Map<userId, classId> pour plusieurs élèves à la fois.
 * (utile pour les parents qui ont plusieurs enfants)
 */
export async function getClassIdsActuelsParUserIds(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.enrollment.findMany({
    where: {
      student: { userId: { in: userIds } },
      status: 'ACTIVE',
      academicYear: { isCurrent: true },
    },
    select: { classId: true, student: { select: { userId: true } } },
  });
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.student.userId, r.classId);
  return map;
}

// ─── Pattern C : Changer la classe d'un élève ───

/**
 * Change la classe d'un élève (promotion, transfert, PEBS).
 *
 * 1. Clôture l'Enrollment actif (status → TRANSFERRED, exitedAt)
 * 2. Crée un nouveau Enrollment
 * Transaction atomique.
 */
export async function changerClasseEleve(
  prisma: PrismaClient,
  params: ChangerClasseParams,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.enrollment.updateMany({
      where: { studentId: params.studentId, status: 'ACTIVE' },
      data: { status: 'TRANSFERRED', exitedAt: new Date(), exitReason: params.exitReason ?? 'CHANGEMENT_CLASSE' },
    });
    await tx.enrollment.create({
      data: {
        studentId: params.studentId,
        classId: params.newClassId,
        academicYearId: params.academicYearId,
        schoolId: params.schoolId,
        enrolledById: params.enrolledById,
        status: 'ACTIVE',
      },
    });
  });
}

/**
 * Variante masse : change la classe de plusieurs élèves (PEBS, promotion groupée).
 */
export async function changerClasseElevesEnMasse(
  prisma: PrismaClient,
  params: {
    studentIds: string[];
    newClassId: string;
    academicYearId: string;
    schoolId: string;
    enrolledById: string;
    exitReason?: string;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.enrollment.updateMany({
      where: { studentId: { in: params.studentIds }, status: 'ACTIVE' },
      data: { status: 'TRANSFERRED', exitedAt: new Date(), exitReason: params.exitReason ?? 'CHANGEMENT_CLASSE_MASSE' },
    });
    await tx.enrollment.createMany({
      data: params.studentIds.map((studentId) => ({
        studentId,
        classId: params.newClassId,
        academicYearId: params.academicYearId,
        schoolId: params.schoolId,
        enrolledById: params.enrolledById,
        status: 'ACTIVE' as const,
      })),
    });
  });
}

// ─── Pattern D : Inscrire un élève (création initiale) ───

/**
 * Crée une inscription Enrollment pour un élève.
 * Ne clôture PAS une inscription existante — utiliser changerClasseEleve pour ça.
 */
export async function inscrireEleve(
  prisma: PrismaClient,
  params: InscrireEleveParams,
): Promise<void> {
  await prisma.enrollment.create({
    data: {
      studentId: params.studentId,
      classId: params.classId,
      academicYearId: params.academicYearId,
      schoolId: params.schoolId,
      enrolledById: params.enrolledById,
      status: params.status ?? 'ACTIVE',
    },
  });
}

/**
 * Variante masse : inscrit plusieurs élèves (import Excel).
 */
export async function inscrireElevesEnMasse(
  prisma: PrismaClient,
  inscriptions: InscrireEleveParams[],
): Promise<void> {
  if (inscriptions.length === 0) return;
  await prisma.enrollment.createMany({
    data: inscriptions.map((p) => ({
      studentId: p.studentId,
      classId: p.classId,
      academicYearId: p.academicYearId,
      schoolId: p.schoolId,
      enrolledById: p.enrolledById,
      status: p.status ?? 'ACTIVE',
    })),
  });
}

// ─── Utilitaire : Prisma where-clause réutilisable ───

/**
 * Fragment de where Prisma pour filtrer les User qui sont élèves
 * dans une classe donnée. À étaler dans un findMany sur User.
 *
 * @example
 * const students = await prisma.user.findMany({
 *   where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
 * });
 */
export function whereElevesParClasse(classId: string) {
  return {
    studentProfile: {
      enrollmentsYearScoped: {
        some: {
          classId,
          status: 'ACTIVE' as const,
          academicYear: { isCurrent: true },
        },
      },
    },
  } as const;
}

/**
 * Fragment de where Prisma pour filtrer directement les StudentProfile
 * qui sont actifs dans une classe.
 *
 * @example
 * const profiles = await prisma.studentProfile.findMany({
 *   where: { ...whereProfilesParClasse(classId), studentStatus: 'ACTIVE' },
 *   select: { userId: true, pebsFiliere: true },
 * });
 */
export function whereProfilesParClasse(classId: string) {
  return {
    enrollmentsYearScoped: {
      some: {
        classId,
        status: 'ACTIVE' as const,
        academicYear: { isCurrent: true },
      },
    },
  } as const;
}

/**
 * Fragment de where Prisma pour filtrer directement les StudentProfile
 * qui sont actifs dans une liste de classes.
 */
export function whereProfilesParClasses(classIds: string[]) {
  return {
    enrollmentsYearScoped: {
      some: {
        classId: { in: classIds },
        status: 'ACTIVE' as const,
        academicYear: { isCurrent: true },
      },
    },
  } as const;
}

// ─── Pattern D : Création combinée pour tests et scripts ───

/**
 * Crée un StudentProfile + un Enrollment actif en une seule opération.
 * Pour les tests d'intégration et les scripts de génération de données.
 * Remplace `studentProfile.create({ data: { userId, classId } })`.
 */
export async function creerEleveAvecClasse(
  prisma: PrismaClient,
  params: {
    userId: string;
    classId: string;
    enrolledById: string;
    extraProfileData?: { matricule?: string; matriculeVerifieAt?: Date; gender?: string; dateOfBirth?: Date; pebsFiliere?: string };
  },
) {
  const cls = await prisma.class.findUniqueOrThrow({
    where: { id: params.classId },
    select: { schoolId: true, academicYearId: true },
  });
  const profile = await prisma.studentProfile.create({
    data: { userId: params.userId, ...params.extraProfileData },
  });
  await prisma.enrollment.create({
    data: {
      studentId: profile.id,
      classId: params.classId,
      academicYearId: cls.academicYearId,
      schoolId: cls.schoolId,
      enrolledById: params.enrolledById,
      status: 'ACTIVE',
    },
  });
  return profile;
}
