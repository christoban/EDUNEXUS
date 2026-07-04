import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import { VolumeHoraireAPError } from '@domain/errors/VolumeHoraireAPError';
import type { SlotKind } from '@domain/types/enums';

export interface AjouterCreneauCommande {
  timetableId: string;
  schoolId: string;
  subjectId?: string;
  teacherId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  kind?: SlotKind;
  subGroupId?: string;
  isLV2Slot?: boolean;
  isElectiveSlot?: boolean;
}

export interface AjouterCreneauResultat {
  creneauId: string;
}

const LIMITE_AP_HEURES = 14;

export class AjouterCreneauUseCase {
  constructor(private readonly timetableRepository: TimetableRepository) {}

  async execute(commande: AjouterCreneauCommande): Promise<AjouterCreneauResultat> {
    // 1. Vérifier l'EDT
    const emploiDuTemps = await this.timetableRepository.findById(commande.timetableId);
    if (!emploiDuTemps) throw new Error(`EDT introuvable : ${commande.timetableId}`);
    if (emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : EDT hors de votre établissement');
    }
    if (emploiDuTemps.estPublie()) {
      throw new Error("Impossible d'ajouter un créneau à un EDT déjà publié");
    }

    // 2. Vérifier appartenance sous-groupe à la classe
    if (commande.subGroupId) {
      const appartient = await this.timetableRepository.sousGroupeAppartientAClasse(
        commande.subGroupId,
        emploiDuTemps.classId
      );
      if (!appartient) {
        throw new Error("Ce sous-groupe n'appartient pas à la classe de cet EDT");
      }
    }

    // 3. Récupérer infos enseignant si fourni
    let teacherNom: string | undefined;
    let estAP = false;

    if (commande.teacherId && commande.kind !== 'BREAK') {
      const infos = await this.timetableRepository.getInfosEnseignant(commande.teacherId);
      if (!infos) throw new Error(`Enseignant introuvable : ${commande.teacherId}`);
      teacherNom = infos.nom;
      estAP = infos.estAP;
    }

    // 4. Créer l'entité créneau (validation des formats dans l'entité)
    const creneau = CreneauHoraire.create({
      timetableId: commande.timetableId,
      subjectId: commande.subjectId,
      teacherId: commande.teacherId,
      teacherNom,
      dayOfWeek: commande.dayOfWeek,
      startTime: commande.startTime,
      endTime: commande.endTime,
      room: commande.room,
      kind: commande.kind,
      subGroupId: commande.subGroupId,
      isLV2Slot: commande.isLV2Slot,
      isElectiveSlot: commande.isElectiveSlot,
    });

    // 5. Détection de conflit enseignant (filtre schoolId — correction bug legacy)
    if (commande.teacherId && commande.kind === 'CLASS') {
      const creneauxExistants = await this.timetableRepository.findCreneauxEnseignantParJour(
        commande.teacherId,
        commande.dayOfWeek,
        commande.schoolId
      );
      creneau.verifierConflitEnseignant(creneauxExistants);
    }

    // 6. Vérification volume horaire AP (Loi 7)
    if (commande.teacherId && estAP && commande.kind === 'CLASS') {
      const heuresActuelles = await this.timetableRepository.calculerVolumeHoraireHebdo(
        commande.teacherId,
        commande.schoolId
      );
      const nouvellesHeures = creneau.calculerDureeMinutes() / 60;

      if (heuresActuelles + nouvellesHeures > LIMITE_AP_HEURES) {
        throw new VolumeHoraireAPError(teacherNom ?? commande.teacherId, heuresActuelles);
      }
    }

    await this.timetableRepository.saveCreneaux(creneau);
    return { creneauId: creneau.id };
  }
}
