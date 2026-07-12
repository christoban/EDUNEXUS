import type { PrismaClient } from '@prisma/client';
import type { SuivreFenetreCommande } from './types';

interface EleveSuivi {
  studentProfileId: string;
  userId: string;
  firstName: string;
  lastName: string;
  className: string;
  hasSubmitted: boolean;
  submissionMethod?: string;
  chosenSubjectName?: string;
}

export class SuivreFenetreChoixLV2UseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: SuivreFenetreCommande): Promise<{
    window: { id: string; level: string; status: string; openDate: Date; closeDate: Date };
    total: number;
    submitted: number;
    pending: number;
    students: EleveSuivi[];
  }> {
    const window = await (this.prisma as any).lv2ChoiceWindow.findUnique({
      where: { id: cmd.windowId },
    });
    if (!window) throw new Error('Fenêtre de choix introuvable');
    if (window.schoolId !== cmd.schoolId) throw new Error('Accès refusé');

    // Récupérer tous les élèves du niveau concerné
    const classes = await this.prisma.class.findMany({
      where: { schoolId: cmd.schoolId, level: window.level },
      select: { id: true, name: true },
    });
    const classIds = classes.map(c => c.id);
    const classByName = new Map(classes.map(c => [c.id, c.name]));

    const profiles = await (this.prisma as any).studentProfile.findMany({
      where: { classId: { in: classIds }, studentStatus: 'ACTIVE' },
      select: {
        id: true,
        userId: true,
        classId: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    // Récupérer les soumissions existantes
    const submissions: any[] = await (this.prisma as any).lv2ChoiceSubmission.findMany({
      where: { windowId: cmd.windowId },
      include: { chosenSubject: { select: { name: true } } },
    });
    const subByStudent = new Map(submissions.map((s: any) => [s.studentProfileId, s]));

    const students: EleveSuivi[] = profiles.map((p: any) => {
      const sub = subByStudent.get(p.id);
      return {
        studentProfileId: p.id,
        userId: p.userId,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        className: classByName.get(p.classId) ?? '',
        hasSubmitted: !!sub,
        submissionMethod: sub?.submissionMethod,
        chosenSubjectName: sub?.chosenSubject?.name,
      };
    });

    const submitted = students.filter(s => s.hasSubmitted).length;

    return {
      window: { id: window.id, level: window.level, status: window.status, openDate: window.openDate, closeDate: window.closeDate },
      total: students.length,
      submitted,
      pending: students.length - submitted,
      students,
    };
  }
}
