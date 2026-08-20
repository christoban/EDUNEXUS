import type { PrismaClient } from '@prisma/client';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';
import type { ClassRoomAssignmentRepository } from '@domain/ports/repositories/ClassRoomAssignmentRepository';
import type {
  SchedulingSolverPort,
  PropositionEmploiDuTemps,
  ExigenceSeance,
  CaseGrille,
  IndisponibiliteEnseignant,
} from '@domain/ports/services/SchedulingSolverPort';
import { calculerSqelette } from '@infrastructure/http/controllers/TimetableGridConfigController';
import { joursActifsVersIndex } from '@domain/types/joursSemaine';
import type { SubjectType } from '@domain/types/enums';

export interface ProposerEmploiDuTempsCommande {
  timetableId: string;
  schoolId: string;
}

export class ProposerEmploiDuTempsUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly roomRepository: RoomRepository,
    private readonly classRoomAssignmentRepository: ClassRoomAssignmentRepository,
    private readonly solver: SchedulingSolverPort,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(commande: ProposerEmploiDuTempsCommande): Promise<PropositionEmploiDuTemps> {
    const emploiDuTemps = await this.timetableRepository.findById(commande.timetableId);
    if (!emploiDuTemps) throw new Error(`EDT introuvable : ${commande.timetableId}`);
    if (emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : EDT hors de votre établissement');
    }
    if (emploiDuTemps.estPublie()) {
      throw new Error("Impossible de proposer un emploi du temps pour un EDT déjà publié");
    }

    const exigences = await this.chargerExigences(emploiDuTemps.classId, commande.schoolId);
    if (exigences.length === 0) {
      throw new Error(
        "Aucune affectation pédagogique (matière + enseignant) pour cette classe — affectez les enseignants aux matières avant de proposer un emploi du temps.",
      );
    }

    const grille = await this.chargerGrille(commande.schoolId);
    if (grille.length === 0) {
      throw new Error(
        "Aucune grille horaire configurée pour cet établissement — configurez-la avant de proposer un emploi du temps.",
      );
    }

    const salles = (await this.roomRepository.findBySchool(commande.schoolId))
      .filter(salle => salle.estDisponible())
      .map(salle => ({ roomId: salle.id, type: salle.type, capacity: salle.capacity }));
    if (salles.length === 0) {
      throw new Error("Aucune salle active dans cet établissement — créez au moins une salle.");
    }

    const assignation = await this.classRoomAssignmentRepository.findByClasseAndAnnee(
      emploiDuTemps.classId, emploiDuTemps.academicYearId,
    );

    const occupationExistante = await this.timetableRepository.findOccupationEcole(
      commande.schoolId, emploiDuTemps.academicYearId, commande.timetableId,
    );

    const indisponibilitesEnseignants = await this.chargerIndisponibilitesEnseignants(commande.schoolId);

    return this.solver.proposer({
      classId: emploiDuTemps.classId,
      salleHabituelleId: assignation?.roomId,
      exigences,
      grille,
      sallesDisponibles: salles,
      occupationExistante,
      indisponibilitesEnseignants,
    });
  }

  /** Plages actives où un enseignant est indisponible — contrainte DURE du solveur (V2.4). */
  private async chargerIndisponibilitesEnseignants(schoolId: string): Promise<IndisponibiliteEnseignant[]> {
    const items = await this.prisma.teacherUnavailability.findMany({
      where: { schoolId, active: true },
      select: { teacherId: true, dayOfWeek: true, startTime: true, endTime: true },
    });
    return items.map(i => ({
      teacherId: i.teacherId,
      dayOfWeek: i.dayOfWeek,
      startTime: i.startTime,
      endTime: i.endTime,
    }));
  }

  /**
   * Une exigence = une affectation pédagogique (TeachingAssignment) de cette classe.
   *
   * EXCLUSIONS explicites — ces matières ne sont PAS des séances classe-entière et relèvent de
   * GenererSeancesGroupeUseCase (fan-out par StudentGroupSet), pas du solveur :
   *   - matière rattachée à un StudentGroup (ex. "Allemand" comme valeur du GroupSet "LV2") :
   *     rien dans le schéma n'empêche un TeachingAssignment classe-entière sur une telle matière
   *     (@@unique([classId, subjectId]) l'autorise), donc l'exclusion doit être EXPLICITE et non
   *     déduite d'une absence de données ;
   *   - matière restreinte à un Group précis (Subject.restrictedToGroupId, ex. English Literature
   *     réservée au programme bilingue) : seule une partie de la classe y assiste.
   */
  private async chargerExigences(classId: string, schoolId: string): Promise<ExigenceSeance[]> {
    const affectations = await this.prisma.teachingAssignment.findMany({
      where: {
        classId,
        schoolId,
        subject: {
          restrictedToGroupId: null,
          studentGroups: { none: {} },
        },
      },
      select: {
        teacherId: true,
        subjectId: true,
        subject: { select: { subjectType: true } },
      },
    });

    return affectations.map(a => ({
      subjectId: a.subjectId,
      subjectType: a.subject.subjectType as SubjectType,
      teacherId: a.teacherId,
      durationMinutes: 0, // durée portée par la case de grille (créneaux de durée uniforme)
    }));
  }

  /** Grille = jours actifs × périodes de COURS (les pauses ne sont jamais des cases plaçables). */
  private async chargerGrille(schoolId: string): Promise<CaseGrille[]> {
    const config = await this.prisma.timetableGridConfig.findUnique({ where: { schoolId } });
    if (!config) return [];

    const periodesCours = calculerSqelette(config).filter(p => p.type === 'COURS');
    const jours = joursActifsVersIndex(config.joursActifs);

    return jours.flatMap(dayOfWeek =>
      periodesCours.map(p => ({ dayOfWeek, startTime: p.debut, endTime: p.fin })),
    );
  }
}
