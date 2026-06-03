import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import { VolumeHoraireAPError } from '@domain/errors/VolumeHoraireAPError';
import type { SlotKind } from '@domain/types/enums';

export interface ModifierCreneauCommande {
  creneauId: string;
  timetableId: string;
  schoolId: string;
  subjectId?: string;
  teacherId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  room?: string;
  kind?: SlotKind;
  subGroupId?: string;
}

const LIMITE_AP_HEURES = 14;

export class ModifierCreneauUseCase {
  constructor(private readonly timetableRepository: TimetableRepository) {}

  async execute(commande: ModifierCreneauCommande): Promise<void> {
    // 1. Charger le créneau existant
    const creneauExistant = await this.timetableRepository.findCreneauById(commande.creneauId);
    if (!creneauExistant) throw new Error(`Créneau introuvable : ${commande.creneauId}`);

    // 2. Vérifier l'EDT
    const emploiDuTemps = await this.timetableRepository.findById(commande.timetableId);
    if (!emploiDuTemps || emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé');
    }

    // 3. Construire le créneau modifié par patch partiel
    const ancienProps = creneauExistant.toObject();
    const creneauModifie = CreneauHoraire.reconstituer({
      ...ancienProps,
      ...(commande.subjectId !== undefined && { subjectId: commande.subjectId }),
      ...(commande.teacherId !== undefined && { teacherId: commande.teacherId }),
      ...(commande.dayOfWeek !== undefined && { dayOfWeek: commande.dayOfWeek }),
      ...(commande.startTime !== undefined && { startTime: commande.startTime }),
      ...(commande.endTime !== undefined && { endTime: commande.endTime }),
      ...(commande.room !== undefined && { room: commande.room }),
      ...(commande.kind !== undefined && { kind: commande.kind }),
      ...(commande.subGroupId !== undefined && { subGroupId: commande.subGroupId }),
    });

    const teacherId = creneauModifie.teacherId;
    const kind = creneauModifie.kind;

    // 4. Vérifier conflit (avec excludeId pour exclure le créneau actuel)
    if (teacherId && kind === 'CLASS') {
      const creneauxEnseignant = await this.timetableRepository.findCreneauxEnseignantParJour(
        teacherId,
        creneauModifie.dayOfWeek,
        commande.schoolId,
        commande.creneauId
      );
      creneauModifie.verifierConflitEnseignant(creneauxEnseignant, commande.creneauId);
    }

    // 5. Vérification volume AP (correction : maintenant aussi vérifié au updateSlot)
    if (teacherId && kind === 'CLASS') {
      const infos = await this.timetableRepository.getInfosEnseignant(teacherId);
      if (infos?.estAP) {
        const heuresActuelles = await this.timetableRepository.calculerVolumeHoraireHebdo(
          teacherId,
          commande.schoolId,
          commande.creneauId
        );
        const nouvellesHeures = creneauModifie.calculerDureeMinutes() / 60;

        if (heuresActuelles + nouvellesHeures > LIMITE_AP_HEURES) {
          throw new VolumeHoraireAPError(infos.nom, heuresActuelles);
        }
      }
    }

    await this.timetableRepository.updateCreneau(creneauModifie);
  }
}
