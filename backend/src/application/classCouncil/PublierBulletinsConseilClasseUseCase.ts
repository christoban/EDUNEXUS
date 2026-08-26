import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';

export interface PublierBulletinsCommande {
  sessionId: string;
  schoolId: string;
}

export class PublierBulletinsConseilClasseUseCase {
  constructor(
    private readonly repo: ClassCouncilRepository,
    private readonly smsNotification: SmsNotificationPort,
  ) {}

  async execute(commande: PublierBulletinsCommande) {
    const session = await this.repo.obtenirSession(commande.sessionId, commande.schoolId);
    if (!session) throw new Error('Session introuvable');
    if (session.status !== 'LOCKED') {
      throw new Error('Le conseil doit être verrouillé avant de publier les bulletins');
    }

    const bulletins = await this.repo.publierBulletins(
      commande.sessionId,
      session.classId,
      commande.schoolId,
      session.academicPeriodId,
    );

    const periodName = session.academicPeriod?.name ?? 'cette période';

    Promise.all(
      bulletins.map(b =>
        this.smsNotification.notifyBulletinSms({
          schoolId: commande.schoolId,
          studentId: b.studentId,
          studentName: `${b.student.firstName} ${b.student.lastName}`,
          periodName,
        })
      )
    ).catch(() => {});

    return {
      count: bulletins.length,
      message: `${bulletins.length} bulletin${bulletins.length !== 1 ? 's' : ''} publié${bulletins.length !== 1 ? 's' : ''}`,
      bulletins,
      periodName,
    };
  }
}
