import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type {
  TimetableRepository,
  CreneauConflitInfo,
} from '@domain/ports/repositories/TimetableRepository';

export class InMemoryTimetableRepository implements TimetableRepository {
  private edts = new Map<string, EmploiDuTemps>();
  private creneaux = new Map<string, CreneauHoraire>();

  private enseignantsInfos = new Map<string, { nom: string; estAP: boolean }>();
  private sallesInfos = new Map<string, { nom: string }>();
  private sousGroupesValides = new Set<string>(); // "subGroupId:classId"

  ajouterEDT(edt: EmploiDuTemps): void { this.edts.set(edt.id, edt); }
  ajouterCreneau(c: CreneauHoraire): void { this.creneaux.set(c.id, c); }
  definirEnseignant(id: string, nom: string, estAP: boolean): void {
    this.enseignantsInfos.set(id, { nom, estAP });
  }
  definirSalle(id: string, nom: string): void {
    this.sallesInfos.set(id, { nom });
  }
  ajouterSousGroupeValide(subGroupId: string, classId: string): void {
    this.sousGroupesValides.add(`${subGroupId}:${classId}`);
  }

  async findById(id: string): Promise<EmploiDuTemps | null> {
    return this.edts.get(id) ?? null;
  }

  async findByClasse(classId: string, academicYearId: string): Promise<EmploiDuTemps | null> {
    return (
      [...this.edts.values()].find(
        e => e.classId === classId && e.academicYearId === academicYearId
      ) ?? null
    );
  }

  async save(edt: EmploiDuTemps): Promise<void> { this.edts.set(edt.id, edt); }
  async update(edt: EmploiDuTemps): Promise<void> { this.edts.set(edt.id, edt); }

  async countCreneaux(timetableId: string): Promise<number> {
    return [...this.creneaux.values()].filter(c => c.timetableId === timetableId).length;
  }

  async findCreneauById(id: string): Promise<CreneauHoraire | null> {
    return this.creneaux.get(id) ?? null;
  }

  async findCreneauxByTimetable(timetableId: string): Promise<CreneauHoraire[]> {
    return [...this.creneaux.values()].filter(c => c.timetableId === timetableId);
  }

  async saveCreneaux(c: CreneauHoraire): Promise<void> { this.creneaux.set(c.id, c); }
  async updateCreneau(c: CreneauHoraire): Promise<void> { this.creneaux.set(c.id, c); }
  async deleteCreneau(id: string, _timetableId: string): Promise<void> {
    this.creneaux.delete(id);
  }

  async findCreneauxEnseignantParJour(
    teacherId: string,
    dayOfWeek: number,
    _schoolId: string,
    excludeId?: string
  ): Promise<CreneauConflitInfo[]> {
    return [...this.creneaux.values()]
      .filter(
        c =>
          c.teacherId === teacherId &&
          c.dayOfWeek === dayOfWeek &&
          c.kind === 'CLASS' &&
          c.id !== excludeId
      )
      .map(c => ({
        id: c.id,
        startTime: c.startTime,
        endTime: c.endTime,
        classeNom: 'Classe Test',
      }));
  }

  async calculerVolumeHoraireHebdo(
    teacherId: string,
    _schoolId: string,
    excludeId?: string
  ): Promise<number> {
    const slots = [...this.creneaux.values()].filter(
      c => c.teacherId === teacherId && c.kind === 'CLASS' && c.id !== excludeId
    );
    const totalMinutes = slots.reduce((sum, c) => sum + c.calculerDureeMinutes(), 0);
    return totalMinutes / 60;
  }

  async getInfosEnseignant(id: string): Promise<{ nom: string; estAP: boolean } | null> {
    return this.enseignantsInfos.get(id) ?? null;
  }

  async getInfosSalle(id: string): Promise<{ nom: string } | null> {
    return this.sallesInfos.get(id) ?? null;
  }

  async findCreneauxSalleParJour(
    roomId: string,
    dayOfWeek: number,
    _schoolId: string,
    excludeId?: string
  ): Promise<CreneauConflitInfo[]> {
    return [...this.creneaux.values()]
      .filter(
        c =>
          c.roomId === roomId &&
          c.dayOfWeek === dayOfWeek &&
          c.kind === 'CLASS' &&
          c.id !== excludeId
      )
      .map(c => ({
        id: c.id,
        startTime: c.startTime,
        endTime: c.endTime,
        classeNom: 'Classe Test',
      }));
  }

  async sousGroupeAppartientAClasse(subGroupId: string, classId: string): Promise<boolean> {
    return this.sousGroupesValides.has(`${subGroupId}:${classId}`);
  }
}
