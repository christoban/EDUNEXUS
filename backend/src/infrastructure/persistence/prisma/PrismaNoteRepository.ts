import type { PrismaClient } from '@prisma/client';
import { Note } from '@domain/entities/Note';
import type { NoteRepository, NoteNonValideeInfo } from '@domain/ports/repositories/NoteRepository';
import type { GradeValidationStatus } from '@domain/types/enums';

export class PrismaNoteRepository implements NoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Note | null> {
    const data = await this.prisma.grade.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByEleve(studentId: string, academicYearId: string): Promise<Note[]> {
    const data = await this.prisma.grade.findMany({
      where: { studentId, academicYearId },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByClasse(classId: string, sequenceId: string): Promise<Note[]> {
    const data = await this.prisma.grade.findMany({
      where: { classId, sequenceId },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByEnseignant(teacherId: string, sequenceId: string): Promise<Note[]> {
    const data = await this.prisma.grade.findMany({
      where: { recordedById: teacherId, sequenceId },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByEleveEtMatiere(
    studentId: string,
    subjectId: string,
    sequenceId: string
  ): Promise<Note | null> {
    const data = await this.prisma.grade.findUnique({
      where: { studentId_subjectId_sequenceId: { studentId, subjectId, sequenceId } },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByStatut(
    classId: string,
    sequenceId: string,
    statut: GradeValidationStatus
  ): Promise<Note[]> {
    const data = await this.prisma.grade.findMany({
      where: { classId, sequenceId, validationStatus: statut },
    });
    return data.map(d => this.toDomain(d));
  }

  async findNotesNonValideesParClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<NoteNonValideeInfo[]> {
    const sequences = await this.prisma.academicSequence.findMany({
      where: { academicPeriodId },
      select: { id: true },
    });
    const sequenceIds = sequences.map(s => s.id);

    const notes = await this.prisma.grade.findMany({
      where: {
        classId,
        sequenceId: { in: sequenceIds },
        validationStatus: { in: ['DRAFT', 'SUBMITTED'] },
      },
      include: {
        subject: { select: { name: true } },
        recordedBy: { select: { firstName: true, lastName: true } },
      },
    });

    return notes.map(n => ({
      matiereNom: n.subject.name,
      enseignantNom: n.recordedBy
        ? `${n.recordedBy.firstName} ${n.recordedBy.lastName}`
        : 'Enseignant inconnu',
      statut: n.validationStatus as GradeValidationStatus,
    }));
  }

  async toutesNotesValideesParClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<boolean> {
    const nonValidees = await this.findNotesNonValideesParClasse(classId, academicPeriodId);
    return nonValidees.length === 0;
  }

  async save(note: Note): Promise<void> {
    const data = note.toObject();
    await this.prisma.grade.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        studentId: data.studentId,
        subjectId: data.subjectId,
        classId: data.classId,
        academicYearId: data.academicYearId,
        sequenceId: data.sequenceId,
        recordedById: data.recordedById,
        sequenceScore: data.sequenceScore,
        classTestScore: data.classTestScore,
        terminalExamScore: data.terminalExamScore,
        theoreticalScore: data.theoreticalScore,
        practicalScore: data.practicalScore,
        professionalAttitude: data.professionalAttitude,
        oralScore: data.oralScore,
        selfDevelopmentScore: data.selfDevelopmentScore,
        coefficient: data.coefficient,
        maxValue: data.maxValue,
        sequenceAverage: data.sequenceAverage,
        validationStatus: data.validationStatus,
        isOfflineSync: data.isOfflineSync,
        createdAt: data.createdAt,
      },
    });
  }

  async update(note: Note): Promise<void> {
    const data = note.toObject();
    await this.prisma.grade.update({
      where: { id: data.id },
      data: {
        sequenceScore: data.sequenceScore,
        classTestScore: data.classTestScore,
        terminalExamScore: data.terminalExamScore,
        theoreticalScore: data.theoreticalScore,
        practicalScore: data.practicalScore,
        professionalAttitude: data.professionalAttitude,
        oralScore: data.oralScore,
        selfDevelopmentScore: data.selfDevelopmentScore,
        sequenceAverage: data.sequenceAverage,
        validationStatus: data.validationStatus,
        validatedById: data.validatedById ?? null,
        validatedAt: data.validatedAt ?? null,
        rejectionReason: data.rejectionReason ?? null,
        isOfflineSync: data.isOfflineSync,
        syncedAt: data.syncedAt ?? null,
      },
    });
  }

  async updateStatut(
    noteId: string,
    statut: GradeValidationStatus,
    validateurId?: string,
    motif?: string
  ): Promise<void> {
    await this.prisma.grade.update({
      where: { id: noteId },
      data: {
        validationStatus: statut,
        validatedById: validateurId ?? null,
        validatedAt: validateurId ? new Date() : null,
        rejectionReason: motif ?? null,
      },
    });
  }

  async findNotesEnAttenteDepuis(heures: number): Promise<Note[]> {
    const depuis = new Date(Date.now() - heures * 60 * 60 * 1000);
    const data = await this.prisma.grade.findMany({
      where: {
        validationStatus: 'SUBMITTED',
        createdAt: { lte: depuis },
      },
    });
    return data.map(d => this.toDomain(d));
  }

  private toDomain(data: any): Note {
    return Note.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      studentId: data.studentId,
      subjectId: data.subjectId,
      classId: data.classId,
      academicYearId: data.academicYearId,
      sequenceId: data.sequenceId,
      recordedById: data.recordedById ?? undefined,
      sequenceScore: data.sequenceScore ?? undefined,
      classTestScore: data.classTestScore ?? undefined,
      terminalExamScore: data.terminalExamScore ?? undefined,
      theoreticalScore: data.theoreticalScore ?? undefined,
      practicalScore: data.practicalScore ?? undefined,
      professionalAttitude: data.professionalAttitude ?? undefined,
      oralScore: data.oralScore ?? undefined,
      selfDevelopmentScore: data.selfDevelopmentScore ?? undefined,
      coefficient: data.coefficient,
      maxValue: data.maxValue,
      sequenceAverage: data.sequenceAverage ?? undefined,
      validationStatus: data.validationStatus as GradeValidationStatus,
      validatedById: data.validatedById ?? undefined,
      validatedAt: data.validatedAt ?? undefined,
      rejectionReason: data.rejectionReason ?? undefined,
      isOfflineSync: data.isOfflineSync,
      syncedAt: data.syncedAt ?? undefined,
      createdAt: data.createdAt,
    });
  }
}
