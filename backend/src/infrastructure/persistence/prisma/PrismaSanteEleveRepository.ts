import type { PrismaClient } from '@prisma/client';
import type {
  SanteEleveRepository,
  DonneesSanteEleve,
} from '@domain/ports/repositories/SanteEleveRepository';

export class PrismaSanteEleveRepository implements SanteEleveRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getDonneesSante(
    studentId: string,
    schoolId: string,
    academicYearId: string
  ): Promise<DonneesSanteEleve | null> {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { schoolId: true },
    });
    if (!student || student.schoolId !== schoolId) return null;

    // 1. Moyenne générale pondérée (notes VALIDATED/LOCKED)
    const notes = await this.prisma.grade.findMany({
      where: {
        studentId,
        academicYearId,
        validationStatus: { in: ['VALIDATED', 'LOCKED'] },
      },
      select: { sequenceAverage: true, coefficient: true },
    });

    let moyenneGenerale = 0;
    if (notes.length > 0) {
      const sommePonderee = notes.reduce(
        (s, n) => s + (n.sequenceAverage ?? 0) * n.coefficient,
        0
      );
      const sommeCoefficients = notes.reduce((s, n) => s + n.coefficient, 0);
      moyenneGenerale = sommeCoefficients > 0 ? sommePonderee / sommeCoefficients : 0;
    }

    // 2. Assiduité (30 derniers jours)
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - 30);
    const presences = await this.prisma.attendance.findMany({
      where: { studentId, schoolId, date: { gte: dateDebut } },
      select: { status: true },
    });
    const joursPresent = presences.filter(p => p.status === 'PRESENT').length;
    const joursTotaux = presences.length;

    // 3. Tendance (3 dernières périodes de l'année)
    const periodes = await this.prisma.academicPeriod.findMany({
      where: { academicYear: { schoolId, id: academicYearId } },
      orderBy: { orderIndex: 'asc' },
      take: 3,
      select: { id: true },
    });

    const moyennesPrecedentes: number[] = [];
    for (const periode of periodes) {
      const sequences = await this.prisma.academicSequence.findMany({
        where: { academicPeriodId: periode.id },
        select: { id: true },
      });
      const seqIds = sequences.map(s => s.id);
      if (seqIds.length === 0) continue;

      const notesPeriode = await this.prisma.grade.findMany({
        where: {
          studentId,
          sequenceId: { in: seqIds },
          validationStatus: { in: ['VALIDATED', 'LOCKED'] },
        },
        select: { sequenceAverage: true, coefficient: true },
      });
      if (notesPeriode.length > 0) {
        const sp = notesPeriode.reduce(
          (s, n) => s + (n.sequenceAverage ?? 0) * n.coefficient,
          0
        );
        const sc = notesPeriode.reduce((s, n) => s + n.coefficient, 0);
        moyennesPrecedentes.push(sc > 0 ? sp / sc : 0);
      }
    }

    // 4. Comportement — sanctions dans l'établissement
    const nombreSanctions = await this.prisma.disciplineRecord.count({
      where: { studentId, schoolId },
    });

    // 5. Paiements
    const factures = await this.prisma.invoice.findMany({
      where: { studentId, schoolId },
      select: { amount: true, status: true },
    });
    const fraisTotaux = factures.reduce((s, f) => s + f.amount, 0);
    const fraisRegles = factures
      .filter(f => f.status === 'PAID')
      .reduce((s, f) => s + f.amount, 0);

    return {
      studentId,
      moyenneGenerale,
      joursPresent,
      joursTotaux,
      moyennesPrecedentes,
      nombreSanctions,
      nombrePeriodes: periodes.length,
      fraisRegles,
      fraisTotaux,
    };
  }

  async sauvegarderScore(studentId: string, score: number): Promise<void> {
    await this.prisma.studentProfile.update({
      where: { userId: studentId },
      data: { healthScore: score },
    });
  }
}
