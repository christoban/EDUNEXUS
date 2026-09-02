/**
 * APPLICATION LAYER — Use Case : Enregistrer les présences d'une classe
 * Enregistre la présence de tous les élèves d'une classe en une opération.
 * Déclenche les alertes si le seuil d'absences est dépassé.
 */
import { Presence } from '@domain/entities/Presence';
import type { PresenceRepository } from '@domain/ports/repositories/PresenceRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';
import type { MetricCachePort } from '@domain/ports/cache/MetricCachePort';
import type { AttendanceStatus, AttendancePeriod } from '@domain/types/enums';

export interface PresenceEleve {
  studentId: string;
  statut: AttendanceStatus;
}

export interface EnregistrerPresenceCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  subjectId?: string;
  teacherId: string;
  recordedById: string;
  date: Date;
  period: AttendancePeriod;
  presences: PresenceEleve[];
  isOfflineSync?: boolean;
}

export interface EnregistrerPresenceResultat {
  enregistrees: number;
  absents: string[];   // studentIds
  retards: string[];   // studentIds
}

export class EnregistrerPresenceUseCase {
  constructor(
    private readonly presenceRepository: PresenceRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly rattachementRepository: RattachementEnseignantRepository,
    private readonly metricCache?: MetricCachePort,
  ) {}

  async execute(commande: EnregistrerPresenceCommande): Promise<EnregistrerPresenceResultat> {
    // 1. Vérifier que l'enseignant existe
    const enseignant = await this.userRepository.findById(commande.teacherId);
    if (!enseignant || !enseignant.isActive) {
      throw new Error('Enseignant introuvable ou inactif');
    }

    // 1bis. Vérifier que l'enseignant est réellement rattaché à cette classe — soit comme
    // professeur principal (habilité à prendre les présences quelle que soit la matière), soit
    // via une assignation classe+matière (TeachingAssignment) pour la matière précisée. Sans ce
    // contrôle, n'importe quel enseignant de l'école pouvait marquer présent/absent/en retard
    // n'importe quel élève d'une classe qu'il n'enseigne pas.
    if (!enseignant.estAdmin()) {
      const rattache = await this.rattachementRepository.estRattacheALaClasse(
        commande.teacherId, commande.classId, commande.subjectId,
        { autoriserProfesseurPrincipal: true },
      );
      if (!rattache) {
        throw new Error(
          `L'enseignant "${enseignant.nomComplet}" n'est pas rattaché à cette classe`
        );
      }
    }

    // 2. Vérifier qu'une présence n'existe pas déjà pour ce créneau
    //    (ignoré pour la synchronisation hors-ligne — la resynchronisation
    //     d'un même créneau est intentionnelle et doit écraser l'existant)
    if (!commande.isOfflineSync) {
      const dejaEnregistree = await this.presenceRepository.existeDeja(
        commande.presences[0]?.studentId ?? '',
        commande.date,
        commande.period
      );
      if (dejaEnregistree) {
        throw new Error(
          `Les présences du ${commande.date.toLocaleDateString('fr-FR')} ` +
          `(${commande.period}) ont déjà été enregistrées pour cette classe`
        );
      }
    }

    // 3. Créer les entités Presence
    const presencesACreer: Presence[] = commande.presences.map(p =>
      Presence.create({
        schoolId: commande.schoolId,
        studentId: p.studentId,
        classId: commande.classId,
        academicPeriodId: commande.academicPeriodId,
        subjectId: commande.subjectId,
        teacherId: commande.teacherId,
        recordedById: commande.recordedById,
        date: commande.date,
        status: p.statut,
        period: commande.period,
        isOfflineSync: commande.isOfflineSync ?? false,
      })
    );

    // 4. Sauvegarder en bloc
    await this.presenceRepository.saveMany(presencesACreer);

    // 4bis. Invalidation MetricCache v1 (pilote) — taux_presence
    if (this.metricCache) {
      await this.metricCache.invalidate('taux_presence', { schoolId: commande.schoolId, classId: commande.classId });
    }

    // 5. Identifier absents et retardataires
    const absents = commande.presences
      .filter(p => p.statut === 'ABSENT')
      .map(p => p.studentId);

    const retards = commande.presences
      .filter(p => p.statut === 'LATE')
      .map(p => p.studentId);

    // 6. Notifier les parents des absents (si pas hors ligne)
    if (!commande.isOfflineSync) {
      for (const studentId of absents) {
        await this.notificationService.envoyer({
          schoolId: commande.schoolId,
          userId: studentId,
          type: 'ABSENCE_ALERT',
          titre: 'Absence enregistrée',
          corps: `Votre enfant a été marqué absent le ${commande.date.toLocaleDateString('fr-FR')}`,
          canal: 'SMS',
          urgency: 'HIGH',
        });
      }
    }

    return {
      enregistrees: presencesACreer.length,
      absents,
      retards,
    };
  }
}
