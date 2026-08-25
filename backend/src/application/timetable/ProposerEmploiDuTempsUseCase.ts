import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';
import type { ClassRoomAssignmentRepository } from '@domain/ports/repositories/ClassRoomAssignmentRepository';
import type { TeacherUnavailabilityRepository } from '@domain/ports/repositories/TeacherUnavailabilityRepository';
import type {
  SchedulingSolverPort,
  PropositionEmploiDuTemps,
  ExigenceSeance,
  CaseGrille,
  IndisponibiliteEnseignant,
  ContraintesDoucesOptions,
  CreneauOccupe,
  SalleDisponible,
} from '@domain/ports/services/SchedulingSolverPort';
import { calculerSqelette } from '@infrastructure/http/controllers/TimetableGridConfigController';
import { joursActifsVersIndex } from '@domain/types/joursSemaine';
import type { SubjectType } from '@domain/types/enums';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';

export interface ProposerEmploiDuTempsCommande {
  timetableId: string;
  schoolId: string;
  /** Contraintes douces V2.5 (optionnelles) — transmises telles quelles au solveur. */
  contraintes?: ContraintesDoucesOptions;
}

/** Contexte complet nécessaire au solveur — extrait pour être réutilisé par le what-if. */
export interface ContexteEmploiDuTemps {
  classId: string;
  academicYearId: string;
  salleHabituelleId?: string;
  exigences: ExigenceSeance[];
  grille: CaseGrille[];
  sallesDisponibles: SalleDisponible[];
  occupationExistante: CreneauOccupe[];
  indisponibilitesEnseignants: IndisponibiliteEnseignant[];
}

export class ProposerEmploiDuTempsUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly roomRepository: RoomRepository,
    private readonly classRoomAssignmentRepository: ClassRoomAssignmentRepository,
    private readonly teacherUnavailabilityRepository: TeacherUnavailabilityRepository,
    private readonly solver: SchedulingSolverPort,
  ) {}

  async execute(commande: ProposerEmploiDuTempsCommande): Promise<PropositionEmploiDuTemps> {
    const contexte = await this.chargerContexte(commande);
    return this.solver.proposer({
      classId: contexte.classId,
      salleHabituelleId: contexte.salleHabituelleId,
      exigences: contexte.exigences,
      grille: contexte.grille,
      sallesDisponibles: contexte.sallesDisponibles,
      occupationExistante: contexte.occupationExistante,
      indisponibilitesEnseignants: contexte.indisponibilitesEnseignants,
      contraintes: commande.contraintes,
    });
  }

  /** Charge et valide tout le contexte du solveur, sans résoudre — réutilisé par le what-if. */
  async chargerContexte(commande: { timetableId: string; schoolId: string }): Promise<ContexteEmploiDuTemps> {
    const emploiDuTemps = await this.timetableRepository.findById(commande.timetableId);
    if (!emploiDuTemps) throw new Error(`EDT introuvable : ${commande.timetableId}`);
    if (emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : EDT hors de votre établissement');
    }
    if (emploiDuTemps.estPublie()) {
      throw new Error("Impossible de proposer un emploi du temps pour un EDT déjà publié");
    }

    const grille = await this.chargerGrille(commande.schoolId);
    if (grille.length === 0) {
      throw new Error(
        "Aucune grille horaire configurée pour cet établissement — configurez-la avant de proposer un emploi du temps.",
      );
    }
    // Durée de référence d'une case : PGCD des durées de TOUTES les cases (la grille est
    // aujourd'hui homogène par construction — dureePeriode unique — mais le PGCD reste juste
    // si elle devient hétérogène, au lieu de silently se tromper sur la 1ʳᵉ case).
    const durees = grille.map(g =>
      CreneauHoraire.heureEnMinutes(g.endTime) - CreneauHoraire.heureEnMinutes(g.startTime),
    );
    if (durees.some(d => d <= 0)) {
      throw new Error(
        "La grille horaire contient une case de durée invalide (≤ 0 minute) — vérifiez la configuration des créneaux.",
      );
    }
    const dureeCase = durees.reduce(pgcd);

    const exigences = await this.chargerExigences(emploiDuTemps.classId, commande.schoolId, dureeCase);
    if (exigences.length === 0) {
      throw new Error(
        "Aucune affectation pédagogique (matière + enseignant) pour cette classe — affectez les enseignants aux matières avant de proposer un emploi du temps.",
      );
    }
    // Fail Fast : le volume hebdomadaire demandé doit tenir dans la grille, sinon le solveur
    // échouerait de toute façon avec un INFAISABLE moins explicite.
    if (exigences.length > grille.length) {
      throw new Error(
        `Le volume hebdomadaire des matières (${exigences.length} séances) dépasse la capacité de la grille (${grille.length} cases) — réduisez des heures par semaine ou ajoutez des créneaux.`,
      );
    }

    const salles = (await this.roomRepository.findBySchool(commande.schoolId))
      .filter(salle => salle.estDisponible())
      .map(salle => ({ roomId: salle.id, type: salle.type, capacity: salle.capacity, roomName: salle.name }));
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

    return {
      classId: emploiDuTemps.classId,
      academicYearId: emploiDuTemps.academicYearId,
      salleHabituelleId: assignation?.roomId,
      exigences,
      grille,
      sallesDisponibles: salles,
      occupationExistante,
      indisponibilitesEnseignants,
    };
  }

  /** Plages actives où un enseignant est indisponible — contrainte DURE du solveur (V2.4). */
  private async chargerIndisponibilitesEnseignants(schoolId: string): Promise<IndisponibiliteEnseignant[]> {
    const indisponibilites = await this.teacherUnavailabilityRepository.findBySchool(schoolId);
    return indisponibilites.map(i => ({
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
  private async chargerExigences(classId: string, schoolId: string, dureeCase: number): Promise<ExigenceSeance[]> {
    // Récupération des affectations avec les informations de la matière
    const affectations = await this.timetableRepository.findAffectationsSolver(classId, schoolId);

    // Regroupement par matière (subjectId) pour gérer hoursPerWeek
    const groupedBySubject = new Map<string, {
      subjectId: string;
      subjectType: SubjectType;
      teacherIds: string[];
      subjectName: string;
      hoursPerWeek: number;
      blocDureeCases: number | null;
    }>();

    for (const a of affectations) {
      const key = a.subjectId;
      const existing = groupedBySubject.get(key);
      if (existing) {
        existing.teacherIds.push(a.teacherId);
      } else {
        groupedBySubject.set(key, {
          subjectId: a.subjectId,
          subjectType: a.subjectType as SubjectType,
          teacherIds: [a.teacherId],
          subjectName: a.name || `Matière ${a.subjectId}`,
          hoursPerWeek: a.hoursPerWeek ?? 2,
          blocDureeCases: a.blocDureeCases ?? null,
        });
      }
    }

    // Noms des enseignants — UNE seule requête groupée (pas de N+1).
    const teacherIds = [...new Set(affectations.map(a => a.teacherId))];
    const enseignants = await this.timetableRepository.findNomsEnseignants(teacherIds);
    const nomParEnseignant = new Map(enseignants.map(u => [u.id, u.nomComplet]));

    const exigences: ExigenceSeance[] = [];

    // Pour chaque matière, générer le nombre de séances basé sur hoursPerWeek
    for (const [, groupe] of groupedBySubject) {
      let nbSeances = Math.max(1, Math.round(groupe.hoursPerWeek * 60 / dureeCase));

      // Blocs de 2 h : le nombre de séances doit être PAIR (une séance = un demi-bloc). Si impair,
      // arrondir au pair inférieur — jamais casser un bloc, et jamais laisser une séance orpheline.
      if (groupe.blocDureeCases === 2 && nbSeances % 2 !== 0) {
        nbSeances -= 1;
      }
      // Défensif : une matière à bloc avec 1 h/semaine garde au moins 1 séance (libre, non bloquée).
      if (nbSeances < 1) nbSeances = 1;

      // Création d'identifiants uniques pour chaque séance de cette matière
      for (let i = 0; i < nbSeances; i++) {
        const seanceId = `${groupe.subjectId}#${groupe.teacherIds[0]}#${i}`;
        exigences.push({
          subjectId: groupe.subjectId,
          subjectType: groupe.subjectType,
          teacherId: groupe.teacherIds[0],
          durationMinutes: dureeCase,
          // Champs étendus V2.5
          subjectName: groupe.subjectName,
          teacherName: nomParEnseignant.get(groupe.teacherIds[0]),
          seanceId: seanceId,
          blocDureeCases: groupe.blocDureeCases,
        });
      }
    }

    return exigences;
  }

  /** Grille = jours actifs × périodes de COURS (les pauses ne sont jamais des cases plaçables). */
  private async chargerGrille(schoolId: string): Promise<CaseGrille[]> {
    const config = await this.timetableRepository.getGridConfig(schoolId);
    if (!config) return [];

    const periodesCours = calculerSqelette(config).filter(p => p.type === 'COURS');
    const jours = joursActifsVersIndex(config.joursActifs);

    return jours.flatMap(dayOfWeek =>
      periodesCours.map(p => ({ dayOfWeek, startTime: p.debut, endTime: p.fin })),
    );
  }
}

/** PGCD d'Euclide — helper simple, pas de lib (le plan exige le PGCD des durées de cases). */
function pgcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}
