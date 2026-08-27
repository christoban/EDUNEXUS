import type { CahierDeTexteRepository, CahierDeTexteProps } from '@domain/ports/repositories/CahierDeTexteRepository';
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';

export interface GenererRapportInput {
  schoolId: string;
  userId: string;
  role: string;
  teacherId?: string;
  departmentId?: string;
  classId?: string;
  academicYearId?: string;
}

export interface RapportMatiere {
  subject: CahierDeTexteProps['subject'];
  seances: number;
  chapitresAbordees: number;
}

export interface RapportClasse {
  class: CahierDeTexteProps['class'];
  subjects: RapportMatiere[];
}

export interface RapportEnseignant {
  teacher: CahierDeTexteProps['teacher'];
  totalSeances: number;
  classes: RapportClasse[];
}

export interface RappportResultat {
  rapport: RapportEnseignant[];
  total: number;
}

export class GenererRapportPedagogieUseCase {
  constructor(
    private readonly cahierDeTexteRepository: CahierDeTexteRepository,
    private readonly departmentRepository: DepartmentRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
  ) {}

  async execute(input: GenererRapportInput): Promise<RappportResultat> {
    const anneeId = input.academicYearId ?? (await this.anneeRepository.findCourante(input.schoolId))?.id;

    let subjectIds: string[] | undefined;
    if (input.departmentId) {
      const dept = await this.departmentRepository.findById(input.departmentId);
      subjectIds = dept && dept.schoolId === input.schoolId ? dept.subjects?.map(s => s.id) ?? [] : [];
    }

    const enseignantId = input.teacherId ?? (input.role === 'TEACHER' ? input.userId : undefined);

    const entries = await this.cahierDeTexteRepository.findForRapport(input.schoolId, {
      academicYearId: anneeId,
      teacherId: enseignantId,
      classId: input.classId,
      subjectIds,
    });

    const groupes: Record<string, any> = {};
    for (const e of entries) {
      const teacherKey = e.teacherId;
      if (!groupes[teacherKey]) {
        groupes[teacherKey] = { teacher: e.teacher, totalSeances: 0, classes: {} as Record<string, any> };
      }
      groupes[teacherKey].totalSeances++;
      const classeKey = e.classId;
      if (!groupes[teacherKey].classes[classeKey]) {
        groupes[teacherKey].classes[classeKey] = { class: e.class, subjects: {} as Record<string, any> };
      }
      const subjectKey = e.subjectId;
      if (!groupes[teacherKey].classes[classeKey].subjects[subjectKey]) {
        groupes[teacherKey].classes[classeKey].subjects[subjectKey] = {
          subject: e.subject,
          seances: 0,
          chapitresAbordees: new Set<string>(),
        };
      }
      groupes[teacherKey].classes[classeKey].subjects[subjectKey].seances++;
      if (e.chapitreId) groupes[teacherKey].classes[classeKey].subjects[subjectKey].chapitresAbordees.add(e.chapitreId);
    }

    const rapport = Object.values(groupes).map((g: any) => ({
      teacher: g.teacher,
      totalSeances: g.totalSeances,
      classes: Object.values(g.classes).map((c: any) => ({
        class: c.class,
        subjects: Object.values(c.subjects).map((s: any) => ({
          subject: s.subject,
          seances: s.seances,
          chapitresAbordees: s.chapitresAbordees.size,
        })),
      })),
    }));

    return { rapport, total: entries.length };
  }
}
