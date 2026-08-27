/**
 * APPLICATION LAYER — Use Case : Détecter une chute de moyenne par matière
 * Extrait de backend/src/infrastructure/inngest/functions/reportCards.ts
 *
 * Logique métier : compare la moyenne de la séquence courante vs précédente,
 * seuil configurable par école (SchoolConfig.subjectDropThreshold, défaut 3).
 * Si chute >= seuil → notification enseignant + conseil IA persisté.
 */
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { IAService } from '@domain/ports/services/IAService';
import { prisma } from '../../config/prisma.ts';

export interface DetecterChuteCommande {
  studentId: string;
  subjectId: string;
  schoolId: string;
  sequenceId: string;
}

export interface DetecterChuteResultat {
  studentId: string;
  subjectId: string;
  teacherId: string | null;
  nomComplet: string;
  className: string | null;
  matiere: string;
  avant: number;
  apres: number;
  corpsIndividuel: string;
}

export interface BatchChuteCommande {
  schoolId: string;
  grades: Array<{ studentId: string; subjectId: string; sequenceId: string }>;
}

export async function trouverSequencePrecedente(sequenceId: string, schoolId: string) {
  const courante = await prisma.academicSequence.findUnique({
    where: { id: sequenceId },
    select: { orderIndex: true, academicPeriod: { select: { orderIndex: true, academicYearId: true } } },
  });
  if (!courante) return null;

  const toutes = await prisma.academicSequence.findMany({
    where: { schoolId, academicPeriod: { academicYearId: courante.academicPeriod.academicYearId } },
    select: { id: true, orderIndex: true, academicPeriod: { select: { orderIndex: true } } },
  });
  const triees = toutes.sort((a, b) =>
    a.academicPeriod.orderIndex - b.academicPeriod.orderIndex || a.orderIndex - b.orderIndex
  );
  const idx = triees.findIndex((s) => s.id === sequenceId);
  return idx > 0 ? triees[idx - 1]! : null;
}

async function resolveStudentContext(studentId: string, schoolId: string) {
  const profile = await prisma.studentProfile.findFirst({
    where: { userId: studentId, user: { schoolId } },
    select: {
      user: { select: { firstName: true, lastName: true } },
      enrollmentsYearScoped: {
        where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
        take: 1,
        select: { classId: true, class: { select: { name: true, professorPrincipalId: true } } },
      },
    },
  });
  return {
    nomComplet: profile ? `${profile.user.firstName} ${profile.user.lastName}` : 'Élève',
    classId: profile?.enrollmentsYearScoped[0]?.classId ?? null,
    className: profile?.enrollmentsYearScoped[0]?.class?.name ?? null,
    professorPrincipalId: profile?.enrollmentsYearScoped[0]?.class?.professorPrincipalId ?? null,
  };
}

async function genererEtPersisterConseil(
  iaService: IAService | undefined,
  params: {
    schoolId: string;
    studentId: string;
    subjectId?: string | null;
    nomEleve: string;
    contexte: string;
    recipientRole: 'STUDENT' | 'PARENT' | 'TEACHER';
    contextType: 'HEALTH_CRITICAL' | 'HEALTH_WARNING' | 'HEALTH_POSITIVE' | 'SUBJECT_DROP';
    destinataire: 'ELEVE' | 'PARENT' | 'ENSEIGNANT';
  }
): Promise<string | null> {
  if (!iaService) return null;
  try {
    const content = await iaService.genererConseilPersonnalise({
      nomEleve: params.nomEleve,
      contexte: params.contexte,
      destinataire: params.destinataire,
    });
    await prisma.studentRecommendation.create({
      data: {
        schoolId: params.schoolId,
        studentId: params.studentId,
        subjectId: params.subjectId ?? null,
        recipientRole: params.recipientRole,
        contextType: params.contextType,
        content,
      },
    });
    return content;
  } catch (err: any) {
    console.error('[Conseil IA]', err?.message);
    return null;
  }
}

export class DetecterChuteMoyenneUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly notificationService: NotificationService,
    private readonly iaService?: IAService,
  ) {}

  private async detecterChutePourNote(data: DetecterChuteCommande): Promise<DetecterChuteResultat | null> {
    // Use repository for grade queries (hexagonal) — post-filter by schoolId + validation status
    const noteActuelle = await this.noteRepository.findByEleveEtMatiere(data.studentId, data.subjectId, data.sequenceId);
    if (!noteActuelle || noteActuelle.schoolId !== data.schoolId) return null;
    if (noteActuelle.validationStatus !== 'VALIDATED' && noteActuelle.validationStatus !== 'LOCKED') return null;
    if (noteActuelle.sequenceAverage == null) return null;

    const precedente = await trouverSequencePrecedente(data.sequenceId, data.schoolId);
    if (!precedente) return null;

    const noteAvant = await this.noteRepository.findByEleveEtMatiere(data.studentId, data.subjectId, precedente.id);
    if (!noteAvant || noteAvant.schoolId !== data.schoolId) return null;
    if (noteAvant.validationStatus !== 'VALIDATED' && noteAvant.validationStatus !== 'LOCKED') return null;
    if (noteAvant.sequenceAverage == null) return null;

    const config = await prisma.schoolConfig
      .findFirst({ where: { schoolId: data.schoolId }, select: { subjectDropThreshold: true, aiAlertsEnabled: true } })
      .catch(() => null);
    if (config?.aiAlertsEnabled === false) return null;
    const seuil = config?.subjectDropThreshold ?? 3;

    const chute = noteAvant.sequenceAverage - noteActuelle.sequenceAverage;
    if (chute < seuil) return null;

    const [contexte, subject] = await Promise.all([
      resolveStudentContext(data.studentId, data.schoolId),
      prisma.subject.findUnique({ where: { id: data.subjectId }, select: { name: true } }),
    ]);
    const matiere = subject?.name ?? 'une matière';
    const corpsGenerique = `${contexte.nomComplet} (${contexte.className ?? 'N/A'}) a chuté de ${chute.toFixed(1)} points en ${matiere} (${noteAvant.sequenceAverage.toFixed(1)} → ${noteActuelle.sequenceAverage.toFixed(1)}/20) entre les deux dernières séquences.`;
    const conseilEnseignant = await genererEtPersisterConseil(this.iaService, {
      schoolId: data.schoolId,
      studentId: data.studentId,
      subjectId: data.subjectId,
      nomEleve: contexte.nomComplet,
      contexte: corpsGenerique,
      recipientRole: 'TEACHER',
      contextType: 'SUBJECT_DROP',
      destinataire: 'ENSEIGNANT',
    });

    let teacherId: string | null = null;
    if (contexte.classId) {
      const assignment = await prisma.teachingAssignment
        .findUnique({
          where: { classId_subjectId: { classId: contexte.classId, subjectId: data.subjectId } },
          select: { teacherId: true },
        })
        .catch(() => null);
      teacherId = assignment?.teacherId ?? null;
    }

    return {
      studentId: data.studentId,
      subjectId: data.subjectId,
      teacherId,
      nomComplet: contexte.nomComplet,
      className: contexte.className,
      matiere,
      avant: noteAvant.sequenceAverage,
      apres: noteActuelle.sequenceAverage,
      corpsIndividuel: conseilEnseignant ?? corpsGenerique,
    };
  }

  async execute(commande: DetecterChuteCommande): Promise<DetecterChuteResultat | null> {
    const resultat = await this.detecterChutePourNote(commande);
    if (!resultat) return null;
    if (resultat.teacherId) {
      await this.notificationService
        .envoyer({
          schoolId: commande.schoolId,
          userId: resultat.teacherId,
          type: 'STUDENT_RISK_ALERT',
          titre: `Chute en ${resultat.matiere}`,
          corps: resultat.corpsIndividuel,
          canal: 'IN_APP',
        })
        .catch((err) => console.error('[DetecterChute] notification:', (err as any)?.message));
      // Best-effort push also (SocketNotificationService handles PUSH as IN_APP+push)
      const push = async () => {
        try {
          const { notifierUtilisateurPush } = await import('../../infrastructure/services/notification/PushNotificationService.ts');
          await notifierUtilisateurPush({ userId: resultat.teacherId!, title: `Chute en ${resultat.matiere}`, body: resultat.corpsIndividuel }).catch(() => {});
        } catch {}
      };
      void push();
    }
    return resultat;
  }

  async executeBatch(commande: BatchChuteCommande): Promise<{ enseignantsNotifies: number; parEnseignant: Map<string, string[]> }> {
    const parEnseignant = new Map<string, string[]>();
    for (const g of commande.grades) {
      const resultat = await this.detecterChutePourNote({
        studentId: g.studentId,
        subjectId: g.subjectId,
        schoolId: commande.schoolId,
        sequenceId: g.sequenceId,
      }).catch(() => null);
      if (!resultat || !resultat.teacherId) continue;
      const lignes = parEnseignant.get(resultat.teacherId) ?? [];
      lignes.push(`${resultat.nomComplet} (${resultat.className ?? 'N/A'}) — ${resultat.matiere} : ${resultat.avant.toFixed(1)} → ${resultat.apres.toFixed(1)}/20`);
      parEnseignant.set(resultat.teacherId, lignes);
    }

    for (const [teacherId, lignes] of parEnseignant) {
      const corps =
        lignes.length === 1 ? lignes[0]! : `${lignes.length} élèves en chute lors de cette validation :\n${lignes.join('\n')}`;
      await this.notificationService
        .envoyer({
          schoolId: commande.schoolId,
          userId: teacherId,
          type: 'STUDENT_RISK_ALERT',
          titre: 'Chutes détectées lors de votre validation',
          corps,
          canal: 'IN_APP',
        })
        .catch((err) => console.error('[DetecterChute batch] notification:', (err as any)?.message));
      try {
        const { notifierUtilisateurPush } = await import('../../infrastructure/services/notification/PushNotificationService.ts');
        await notifierUtilisateurPush({ userId: teacherId, title: 'Chutes détectées lors de votre validation', body: corps }).catch(() => {});
      } catch {}
    }

    return { enseignantsNotifies: parEnseignant.size, parEnseignant };
  }
}
