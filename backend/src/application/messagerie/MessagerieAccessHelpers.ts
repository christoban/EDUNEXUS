import type { PrismaClient } from '@prisma/client';
import { getClassIdActuelEleve, whereProfilesParClasse } from '@application/shared/studentEnrollment';

/**
 * Vérifie qu'un utilisateur a le droit de lire/écrire dans une conversation donnée. Centralisé
 * ici car EnvoyerMessageUseCase, ListerMessagesUseCase et MarquerMessagesLusUseCase ont
 * exactement les mêmes règles d'appartenance à appliquer.
 *
 * - PRIVATE : appartenance explicite via ConversationParticipant.
 * - CLASS_CHANNEL : enseignants de la classe (TeachingAssignment ou professeur principal) +
 *   élèves de la classe. Convention retenue (le document d'origine ne tranche pas explicitement
 *   entre les deux découpages possibles) : CLASS_CHANNEL = enseignants + élèves, PARENT_CHANNEL =
 *   enseignants + parents — jamais les deux familles (élèves/parents) dans le même canal.
 * - PARENT_CHANNEL : enseignants de la classe + parents ayant un enfant dans la classe.
 * - ADMIN/STAFF : accès à tous les canaux de leur école (supervision), jamais aux conversations
 *   PRIVATE dont ils ne sont pas participants.
 */
export async function verifierAppartenanceConversation(
  prisma: PrismaClient,
  params: { conversationId: string; schoolId: string; userId: string; role: string },
): Promise<{ id: string; type: string; classId: string | null; schoolId: string }> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, schoolId: params.schoolId },
    select: { id: true, type: true, classId: true, schoolId: true },
  });

  if (!conversation) {
    throw new Error('Conversation introuvable.');
  }

  const role = params.role.toUpperCase();

  if (conversation.type === 'PRIVATE') {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: conversation.id, userId: params.userId } },
    });
    if (!participant) throw new Error("Vous ne faites pas partie de cette conversation.");
    return conversation;
  }

  if (role === 'ADMIN' || role === 'STAFF') return conversation;

  if (!conversation.classId) throw new Error('Conversation invalide (canal sans classe).');

  if (conversation.type === 'CLASS_CHANNEL') {
    if (role === 'TEACHER' && (await estEnseignantDeLaClasse(prisma, params.userId, conversation.classId))) return conversation;
    if (role === 'STUDENT' && (await estEleveDeLaClasse(prisma, params.userId, conversation.classId))) return conversation;
    throw new Error("Vous n'avez pas accès à ce canal de classe.");
  }

  if (conversation.type === 'PARENT_CHANNEL') {
    if (role === 'TEACHER' && (await estEnseignantDeLaClasse(prisma, params.userId, conversation.classId))) return conversation;
    if (role === 'PARENT' && (await estParentDUnEleveDeLaClasse(prisma, params.userId, conversation.classId))) return conversation;
    throw new Error("Vous n'avez pas accès à ce canal parents.");
  }

  throw new Error('Type de conversation non pris en charge.');
}

export async function estEnseignantDeLaClasse(prisma: PrismaClient, userId: string, classId: string): Promise<boolean> {
  const teacherProfile = await prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!teacherProfile) return false;

  const [assignment, classeCommePp] = await Promise.all([
    prisma.teachingAssignment.findFirst({ where: { classId, teacherId: userId }, select: { id: true } }),
    prisma.class.findFirst({ where: { id: classId, professorPrincipalId: userId }, select: { id: true } }),
  ]);

  return Boolean(assignment || classeCommePp);
}

export async function estEleveDeLaClasse(prisma: PrismaClient, userId: string, classId: string): Promise<boolean> {
  const classIdActuel = await getClassIdActuelEleve(prisma, userId);
  return classIdActuel === classId;
}

export async function estParentDUnEleveDeLaClasse(prisma: PrismaClient, userId: string, classId: string): Promise<boolean> {
  const count = await prisma.parentStudent.count({
    where: {
      parentProfile: { userId },
      studentProfile: whereProfilesParClasse(classId),
    },
  });
  return count > 0;
}

/**
 * Résout les classIds pertinents pour un appelant donné, pour lister ses canaux. Un même
 * appelant peut avoir plusieurs classes (enseignant de plusieurs classes, parent de plusieurs
 * enfants dans des classes différentes).
 */
export async function classIdsPertinents(prisma: PrismaClient, userId: string, role: string): Promise<string[]> {
  const upperRole = role.toUpperCase();

  if (upperRole === 'TEACHER') {
    const [assignments, classesPp] = await Promise.all([
      prisma.teachingAssignment.findMany({ where: { teacherId: userId }, select: { classId: true } }),
      prisma.class.findMany({ where: { professorPrincipalId: userId }, select: { id: true } }),
    ]);
    return Array.from(new Set([
      ...assignments.map((a: any) => a.classId),
      ...classesPp.map((c: any) => c.id),
    ]));
  }

  if (upperRole === 'STUDENT') {
    const classId = await getClassIdActuelEleve(prisma, userId);
    return classId ? [classId] : [];
  }

  if (upperRole === 'PARENT') {
    const children = await prisma.parentStudent.findMany({
      where: { parentProfile: { userId } },
      select: {
        studentProfile: {
          select: {
            enrollmentsYearScoped: {
              where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
              select: { classId: true },
              take: 1,
            },
          },
        },
      },
    });
    return Array.from(new Set(
      children
        .map((c: any) => c.studentProfile?.enrollmentsYearScoped?.[0]?.classId)
        .filter((id: string | null | undefined): id is string => !!id),
    ));
  }

  return [];
}

/**
 * Restreint qui un PARENT/STUDENT peut contacter en messagerie privée : enseignants et
 * professeur(s) principal(aux) de leur(s) propre(s) classe(s), plus tout le personnel
 * administratif de l'école — jamais un autre parent ou un autre élève (règle explicite du plan
 * de conception : évite le contact non sollicité entre familles ou entre élèves).
 * Retourne `null` pour TEACHER/STAFF/ADMIN : aucune restriction, ils peuvent contacter n'importe
 * qui de leur école.
 */
export async function destinatairesAutorises(
  prisma: PrismaClient,
  schoolId: string,
  appelantId: string,
  appelantRole: string,
): Promise<Set<string> | null> {
  const role = appelantRole.toUpperCase();
  if (role !== 'PARENT' && role !== 'STUDENT') return null;

  const classIds = await classIdsPertinents(prisma, appelantId, role);

  const [assignments, classesPp, staffEtAdmin] = await Promise.all([
    classIds.length
      ? prisma.teachingAssignment.findMany({ where: { classId: { in: classIds } }, select: { teacherId: true } })
      : Promise.resolve([]),
    classIds.length
      ? prisma.class.findMany({ where: { id: { in: classIds }, professorPrincipalId: { not: null } }, select: { professorPrincipalId: true } })
      : Promise.resolve([]),
    prisma.user.findMany({ where: { schoolId, role: { in: ['STAFF', 'ADMIN'] }, isActive: true }, select: { id: true } }),
  ]);

  return new Set<string>([
    ...assignments.map((a: any) => a.teacherId),
    ...classesPp.map((c: any) => c.professorPrincipalId as string),
    ...staffEtAdmin.map((u: any) => u.id),
  ]);
}
