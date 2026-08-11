import type { PrismaClient } from '@prisma/client';
import type { AppliquerTransfertPebsCommande } from './types';
import { notifierEvenementAcademique } from '../../utils/academicEventNotifier';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import { synchroniserAppartenanceProgramme } from '@application/studentGroup/syncGroupMembership';

interface NotifieCandidat { studentUserId: string; studentName: string }

export class AppliquerTransfertPebsUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly groupSetRepository: StudentGroupSetRepository,
    private readonly groupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
  ) {}

  async execute(cmd: AppliquerTransfertPebsCommande): Promise<{
    transferred: number; confirmed: boolean; selectionnes: NotifieCandidat[]; nonSelectionnes: NotifieCandidat[];
  }> {
    const session = await this.prisma.pebsExamSession.findUnique({
      where: { id: cmd.sessionId },
    });
    if (!session) throw new Error('Session PEBS introuvable');
    if (session.schoolId !== cmd.schoolId) throw new Error('Accès refusé');
    if (session.status === 'APPLIED') throw new Error('Le transfert a déjà été appliqué');

    // Récupérer tous les candidats traités (sélectionnés + non sélectionnés) avec leur nom
    const allCandidates: any[] = await this.prisma.pebsExamCandidate.findMany({
      where: { sessionId: cmd.sessionId, selectionResult: { in: ['SELECTIONNE', 'NON_SELECTIONNE'] } },
      include: { studentProfile: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
    });
    const selected = allCandidates.filter(c => c.selectionResult === 'SELECTIONNE');
    const nonSelected = allCandidates.filter(c => c.selectionResult === 'NON_SELECTIONNE');

    if (selected.length === 0) {
      throw new Error('Aucun candidat sélectionné à transférer');
    }

    // Si pas confirmé, retourner le résumé sans appliquer
    if (!cmd.confirmed) {
      return { transferred: 0, confirmed: false, selectionnes: [], nonSelectionnes: [] };
    }

    const school = await this.prisma.school.findUnique({ where: { id: cmd.schoolId }, select: { subsystem: true } });
    const pebsFiliere = school?.subsystem === 'ANGLOPHONE' ? 'EN_PEBS' : 'FR_PEBS';

    // Appliquer les transferts
    const syncRepos = { prisma: this.prisma, groupSetRepository: this.groupSetRepository, groupRepository: this.groupRepository, membershipRepository: this.membershipRepository };
    let transferred = 0;
    const selectionnes: NotifieCandidat[] = [];
    for (const c of selected) {
      try {
        await this.prisma.studentProfile.update({
          where: { id: c.studentProfileId },
          data: { classId: session.targetClassId, pebsFiliere },
        });
        await synchroniserAppartenanceProgramme(syncRepos, {
          schoolId: cmd.schoolId, studentProfileId: c.studentProfileId, pebsFiliere,
        });
        transferred++;
        if (c.studentProfile?.user) {
          selectionnes.push({ studentUserId: c.studentProfile.user.id, studentName: `${c.studentProfile.user.firstName} ${c.studentProfile.user.lastName}` });
        }
      } catch {
        // Erreur sur un transfert — continuer
      }
    }

    const nonSelectionnes: NotifieCandidat[] = nonSelected
      .filter(c => c.studentProfile?.user)
      .map(c => ({ studentUserId: c.studentProfile.user.id, studentName: `${c.studentProfile.user.firstName} ${c.studentProfile.user.lastName}` }));

    // Marquer la session comme appliquée
    await this.prisma.pebsExamSession.update({
      where: { id: cmd.sessionId },
      data: { status: 'APPLIED' },
    });
    void notifierEvenementAcademique(
      this.prisma, cmd.schoolId, ['ADMIN', 'STAFF'],
      'Sélection PEBS clôturée',
      'Le transfert a été appliqué — la session est clôturée et le menu Sélection PEBS n\'est plus mis en avant.',
    ).catch((err) => console.error('[PebsExam] notification clôture:', err?.message));

    return { transferred, confirmed: true, selectionnes, nonSelectionnes };
  }
}
