import type { PrismaClient } from '@prisma/client';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { CreneauALoter } from '@domain/ports/repositories/TimetableRepository';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { joursActifsVersIndex } from '@domain/types/joursSemaine';
import { calculerSqelette } from '@infrastructure/http/controllers/TimetableGridConfigController';

export interface GenererSqueletteCommande {
  schoolId: string;
  classId: string;
}

export interface GenererSqueletteResultat {
  timetableId: string;
  creneauxCrees: number;
}

/**
 * Crée la grille horaire VIDE d'une classe (un créneau par jour actif × période de cours, sans
 * matière ni enseignant) — l'admin la remplit ensuite manuellement, ou la laisse au solveur.
 *
 * Extrait d'un handler inline qui écrivait via `prisma.timetable.create({ slots: { create: … } })`
 * en contournant l'entité, et numérotait les jours en 1-6 alors que le domaine valide 0-5.
 * Passe désormais par CreneauHoraire.create() (via creerCreneauxEnLot), donc le format est
 * validé et la numérotation est la seule du domaine.
 *
 * `verifierConflits: false` : des créneaux sans enseignant ni salle n'ont aucun conflit possible
 * — les vérifications seraient des no-ops coûteuses (une requête par créneau, ~40-48 créneaux).
 */
export class GenererSqueletteEmploiDuTempsUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(commande: GenererSqueletteCommande): Promise<GenererSqueletteResultat> {
    const gridConfig = await this.prisma.timetableGridConfig.findUnique({
      where: { schoolId: commande.schoolId },
    });
    if (!gridConfig) {
      throw new Error("Veuillez d'abord configurer la grille horaire.");
    }

    const classe = await this.prisma.class.findFirst({
      where: { id: commande.classId, schoolId: commande.schoolId },
      select: { id: true },
    });
    if (!classe) throw new Error('Classe introuvable.');

    const annee = await this.prisma.academicYear.findFirst({
      where: { schoolId: commande.schoolId, isCurrent: true },
      select: { id: true },
    });
    if (!annee) {
      throw new Error("Aucune année scolaire courante. Configurez une année scolaire d'abord.");
    }

    const existant = await this.timetableRepository.findByClasse(commande.classId, annee.id);
    if (existant) {
      throw new Error('Un emploi du temps existe déjà pour cette classe et cette année scolaire.');
    }

    const emploiDuTemps = EmploiDuTemps.create({
      schoolId: commande.schoolId,
      classId: commande.classId,
      academicYearId: annee.id,
      generatedByAI: false,
    });
    await this.timetableRepository.save(emploiDuTemps);

    const periodesCours = calculerSqelette(gridConfig).filter(p => p.type === 'COURS');
    const jours = joursActifsVersIndex(gridConfig.joursActifs);

    const creneaux: CreneauALoter[] = jours.flatMap(dayOfWeek =>
      periodesCours.map(p => ({ dayOfWeek, startTime: p.debut, endTime: p.fin })),
    );

    const { creneauxCrees } = await this.timetableRepository.creerCreneauxEnLot(
      emploiDuTemps.id, commande.schoolId, creneaux, { verifierConflits: false },
    );

    return { timetableId: emploiDuTemps.id, creneauxCrees };
  }
}
