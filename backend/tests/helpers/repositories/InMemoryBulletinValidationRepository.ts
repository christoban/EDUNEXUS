/**
 * Test helper — InMemory implémentation de BulletinValidationRepository
 * Pour les tests unitaires des use cases de validation des bulletins.
 */
import type { BulletinValidationRepository, BulletinValidationSessionData } from '@domain/ports/repositories/BulletinValidationRepository';
import type { BulletinValidationStatus } from '@domain/types/enums';

export class InMemoryBulletinValidationRepository implements BulletinValidationRepository {
  private store = new Map<string, BulletinValidationSessionData>();

  async sessionExistante(classId: string, academicPeriodId: string): Promise<BulletinValidationSessionData | null> {
    for (const session of this.store.values()) {
      if (session.classId === classId && session.academicPeriodId === academicPeriodId) {
        return session;
      }
    }
    return null;
  }

  async creerSession(data: { schoolId: string; classId: string; academicPeriodId: string; submittedById: string }): Promise<BulletinValidationSessionData> {
    const session: BulletinValidationSessionData = {
      id: crypto.randomUUID(),
      schoolId: data.schoolId,
      classId: data.classId,
      academicPeriodId: data.academicPeriodId,
      status: 'SUBMITTED',
      submittedById: data.submittedById,
      submittedAt: new Date(),
      validatedById: null,
      validatedAt: null,
      publishedAt: null,
    };
    this.store.set(session.id, session);
    return session;
  }

  async obtenirSession(sessionId: string, schoolId: string): Promise<BulletinValidationSessionData | null> {
    const session = this.store.get(sessionId);
    if (!session || session.schoolId !== schoolId) return null;
    return session;
  }

  async validerSession(sessionId: string, validatedById: string): Promise<BulletinValidationSessionData> {
    const session = this.store.get(sessionId);
    if (!session) throw new Error('Session introuvable');
    session.status = 'VALIDATED';
    session.validatedById = validatedById;
    session.validatedAt = new Date();
    return session;
  }

  async publierSession(sessionId: string): Promise<BulletinValidationSessionData> {
    const session = this.store.get(sessionId);
    if (!session) throw new Error('Session introuvable');
    session.status = 'PUBLISHED';
    session.publishedAt = new Date();
    return session;
  }
}