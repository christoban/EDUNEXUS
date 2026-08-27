import type { HealthJobsRepository } from '@domain/ports/repositories/HealthJobsRepository';
import type { IAService } from '@domain/ports/services/IAService';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService.ts';
import { notifierParentsPushDabord } from '@infrastructure/services/notification/PushFirstNotifier.ts';

async function notifierPersonnelDirect(userId: string, schoolId: string, titre: string, corps: string) {
  const socketService = new SocketNotificationService();
  await socketService
    .envoyer({ schoolId, userId, type: "STUDENT_RISK_ALERT", titre, corps, canal: "IN_APP" })
    .catch((err: any) => console.error("[HealthAlert] IN_APP personnel:", err?.message));
  const { notifierUtilisateurPush } = await import('@infrastructure/services/notification/PushNotificationService.ts');
  await notifierUtilisateurPush({ userId, title: titre, body: corps }).catch(() => {});
}

export class GererAlertesSanteUseCase {
  constructor(
    private readonly healthJobsRepository: HealthJobsRepository,
    private readonly iaService: IAService,
  ) {}

  private async genererEtPersisterConseil(params: {
    schoolId: string;
    studentId: string;
    subjectId?: string | null;
    nomEleve: string;
    contexte: string;
    recipientRole: "STUDENT" | "PARENT" | "TEACHER";
    contextType: "HEALTH_CRITICAL" | "HEALTH_WARNING" | "HEALTH_POSITIVE" | "SUBJECT_DROP";
    destinataire: "ELEVE" | "PARENT" | "ENSEIGNANT";
  }): Promise<string | null> {
    try {
      const content = await this.iaService.genererConseilPersonnalise({
        nomEleve: params.nomEleve,
        contexte: params.contexte,
        destinataire: params.destinataire,
      });
      await this.healthJobsRepository.createRecommendation({
        schoolId: params.schoolId,
        studentId: params.studentId,
        subjectId: params.subjectId ?? null,
        recipientRole: params.recipientRole,
        contextType: params.contextType,
        content,
      });
      return content;
    } catch (err: any) {
      console.error("[Conseil IA]", err?.message);
      return null;
    }
  }

  private async suggererOrientationSiRisquePersistant(
    studentId: string, schoolId: string, nomComplet: string, className: string | null,
  ): Promise<void> {
    try {
      const seuilDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const occurrences = await this.healthJobsRepository.countCriticalRecommendations(studentId, schoolId, seuilDate);
      if (occurrences < 2) return;
      const anneeCourante = await this.healthJobsRepository.findCurrentAcademicYear(schoolId);
      if (!anneeCourante) return;
      const ficheExistante = await this.healthJobsRepository.findFicheOrientation(studentId, anneeCourante.id);
      if (ficheExistante) return;
      const conseillers = await this.healthJobsRepository.findStaffByPermission(schoolId, "MANAGE_ORIENTATION");
      for (const c of conseillers) {
        await notifierPersonnelDirect(c.userId, schoolId, "Suivi Orientation suggéré",
          `${nomComplet} (${className ?? "N/A"}) est en risque critique de façon répétée (${occurrences} alerte(s) récente(s)). Une fiche d'orientation pourrait être ouverte.`);
      }
    } catch (err: any) {
      console.error("[Orientation] suggestion:", err?.message);
    }
  }

  async handleCritical(params: { studentId: string; schoolId: string; healthScore: number }): Promise<{ notified: boolean }> {
    const { studentId, schoolId, healthScore } = params;
    const ctx = await this.healthJobsRepository.findStudentContext(studentId, schoolId);
    const { nomComplet, className, professorPrincipalId } = ctx;
    const contexte = `Indice de santé scolaire au niveau critique (${healthScore}/100), dans la classe ${className ?? "N/A"}. Une période difficile qui nécessite un accompagnement rapproché.`;

    const conseilParent = await this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "PARENT", contextType: "HEALTH_CRITICAL", destinataire: "PARENT",
    });
    await notifierParentsPushDabord({
      schoolId, studentId, type: "STUDENT_RISK_ALERT",
      titre: "Alerte — suivi urgent recommandé",
      corps: conseilParent ?? `${nomComplet} (${className ?? "sa classe"}) traverse une période difficile (indice de santé scolaire : ${healthScore}/100). Un échange avec l'établissement est recommandé.`,
    }).catch((err: any) => console.error("[HealthAlert] parent critique:", err?.message));

    void this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "STUDENT", contextType: "HEALTH_CRITICAL", destinataire: "ELEVE",
    });

    if (professorPrincipalId) {
      void this.genererEtPersisterConseil({
        schoolId, studentId, nomEleve: nomComplet, contexte,
        recipientRole: "TEACHER", contextType: "HEALTH_CRITICAL", destinataire: "ENSEIGNANT",
      });
    }

    const censeurs = await this.healthJobsRepository.findStaffByPermission(schoolId, "VALIDATE_GRADES");
    for (const c of censeurs) {
      await notifierPersonnelDirect(c.userId, schoolId, "Élève en risque critique", `${nomComplet} (${className ?? "N/A"}) — indice de santé scolaire : ${healthScore}/100.`);
    }

    void this.suggererOrientationSiRisquePersistant(studentId, schoolId, nomComplet, className);
    return { notified: true };
  }

  async handleWarning(params: { studentId: string; schoolId: string; healthScore: number }): Promise<{ notified: boolean }> {
    const { studentId, schoolId, healthScore } = params;
    const ctx = await this.healthJobsRepository.findStudentContext(studentId, schoolId);
    const { nomComplet, className, professorPrincipalId } = ctx;
    const contexte = `Indice de santé scolaire à surveiller (${healthScore}/100), dans la classe ${className ?? "N/A"}. Des signes méritent une attention particulière avant que la situation ne se dégrade.`;

    const conseilParent = await this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "PARENT", contextType: "HEALTH_WARNING", destinataire: "PARENT",
    });
    await notifierParentsPushDabord({
      schoolId, studentId, type: "STUDENT_RISK_ALERT",
      titre: "Vigilance recommandée",
      corps: conseilParent ?? `${nomComplet} (${className ?? "sa classe"}) montre des signes à surveiller (indice de santé scolaire : ${healthScore}/100).`,
    }).catch((err: any) => console.error("[HealthAlert] parent avertissement:", err?.message));

    void this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "STUDENT", contextType: "HEALTH_WARNING", destinataire: "ELEVE",
    });

    if (professorPrincipalId) {
      void this.genererEtPersisterConseil({
        schoolId, studentId, nomEleve: nomComplet, contexte,
        recipientRole: "TEACHER", contextType: "HEALTH_WARNING", destinataire: "ENSEIGNANT",
      });
    }

    return { notified: true };
  }

  async handlePositive(params: { studentId: string; schoolId: string; healthScore: number }): Promise<{ notified: boolean }> {
    const { studentId, schoolId, healthScore } = params;
    const ctx = await this.healthJobsRepository.findStudentContext(studentId, schoolId);
    const { nomComplet, className } = ctx;
    const contexte = `Nette amélioration récente de l'indice de santé scolaire (désormais ${healthScore}/100), dans la classe ${className ?? "N/A"}. Un progrès à valoriser et à encourager.`;

    const conseilParent = await this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "PARENT", contextType: "HEALTH_POSITIVE", destinataire: "PARENT",
    });
    await notifierParentsPushDabord({
      schoolId, studentId, type: "STUDENT_RISK_ALERT",
      titre: "Belle progression 🎉",
      corps: conseilParent ?? `${nomComplet} (${className ?? "sa classe"}) montre une nette amélioration récente (indice de santé scolaire : ${healthScore}/100). Continuez à l'encourager !`,
    }).catch((err: any) => console.error("[HealthAlert] parent positif:", err?.message));

    void this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "STUDENT", contextType: "HEALTH_POSITIVE", destinataire: "ELEVE",
    });

    return { notified: true };
  }
}
