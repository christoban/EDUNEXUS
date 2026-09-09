import type { PrismaClient } from '@prisma/client';
import type {
  AnonymatCodeRecord,
  AnonymatListRow,
  AnonymatRepository,
  AnonymatTeamMemberRecord,
  CreateAnonymatCodeInput,
  CreateAnonymatTeamMemberInput,
  StudentGroupForAnonymat,
} from '@domain/ports/repositories/AnonymatRepository';
import type { AnonymatTeamMemberStatus } from '@domain/types/enums';

export class PrismaAnonymatRepository implements AnonymatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCodesBySession(sessionId: string): Promise<AnonymatCodeRecord[]> {
    const codes = await this.prisma.anonymatCode.findMany({
      where: { assessmentSessionId: sessionId },
      orderBy: { code: 'asc' },
    });
    return codes.map((code) => ({ ...code }));
  }

  async replaceCodesForSession(sessionId: string, codes: CreateAnonymatCodeInput[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.anonymatCode.deleteMany({ where: { assessmentSessionId: sessionId } });
      if (codes.length === 0) return;
      await tx.anonymatCode.createMany({
        data: codes.map((code) => ({
          schoolId: code.schoolId,
          assessmentSessionId: code.assessmentSessionId,
          studentProfileId: code.studentProfileId,
          classId: code.classId,
          code: code.code,
          generatedByUserId: code.generatedByUserId,
        })),
      });
    });
  }

  async findStudentsForSessionGroupedByClass(params: {
    schoolId: string;
    classIds: string[];
  }): Promise<StudentGroupForAnonymat[]> {
    const result: StudentGroupForAnonymat[] = [];
    for (const classId of params.classIds) {
      const classe = await this.prisma.class.findFirst({
        where: { id: classId, schoolId: params.schoolId },
        select: { id: true, name: true },
      });
      if (!classe) continue;

      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          classId,
          schoolId: params.schoolId,
          status: 'ACTIVE',
          academicYear: { isCurrent: true },
        },
        select: {
          studentId: true,
          student: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: [
          { student: { user: { lastName: 'asc' } } },
          { student: { user: { firstName: 'asc' } } },
        ],
      });

      result.push({
        classId: classe.id,
        className: classe.name,
        students: enrollments.map((enrollment) => ({
          studentProfileId: enrollment.studentId,
          lastName: enrollment.student.user.lastName ?? '',
          firstName: enrollment.student.user.firstName ?? '',
        })),
      });
    }
    return result;
  }

  async createTeamMembers(members: CreateAnonymatTeamMemberInput[]): Promise<AnonymatTeamMemberRecord[]> {
    const created: AnonymatTeamMemberRecord[] = [];
    for (const member of members) {
      const record = await this.prisma.anonymatTeamMember.create({ data: member });
      created.push({ ...record, status: record.status as AnonymatTeamMemberStatus });
    }
    return created;
  }

  async findTeamMemberByTokenHash(tokenHash: string): Promise<AnonymatTeamMemberRecord | null> {
    const member = await this.prisma.anonymatTeamMember.findUnique({ where: { magicTokenHash: tokenHash } });
    return member ? { ...member, status: member.status as AnonymatTeamMemberStatus } : null;
  }

  async updateTeamMemberStatus(
    id: string,
    status: Extract<AnonymatTeamMemberStatus, 'IN_PROGRESS' | 'DONE'>,
    doneAt?: Date,
  ): Promise<void> {
    await this.prisma.anonymatTeamMember.update({
      where: { id },
      data: { status, doneAt: status === 'DONE' ? (doneAt ?? new Date()) : null },
    });
  }

  async countTeamMembersNotDone(sessionId: string): Promise<number> {
    return this.prisma.anonymatTeamMember.count({
      where: { assessmentSessionId: sessionId, status: { not: 'DONE' } },
    });
  }

  async getOrderedListForMember(memberId: string): Promise<AnonymatListRow[]> {
    const member = await this.prisma.anonymatTeamMember.findUniqueOrThrow({ where: { id: memberId } });
    const classes = await this.prisma.class.findMany({
      where: { id: { in: member.assignedClassIds } },
      select: { id: true, name: true },
    });
    const classNameById = new Map(classes.map((classe) => [classe.id, classe.name]));
    const codes = await this.prisma.anonymatCode.findMany({
      where: {
        assessmentSessionId: member.assessmentSessionId,
        classId: { in: member.assignedClassIds },
      },
      include: {
        studentProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    const byClass = new Map<string, typeof codes>();
    for (const code of codes) {
      const list = byClass.get(code.classId) ?? [];
      list.push(code);
      byClass.set(code.classId, list);
    }

    const shouldSlice = member.assignedClassIds.length === 1
      && member.classSliceStart != null
      && member.classSliceEnd != null;
    const rows: AnonymatListRow[] = [];
    for (const classId of member.assignedClassIds) {
      let list = (byClass.get(classId) ?? []).sort((left, right) => {
        const lastNameOrder = (left.studentProfile.user.lastName ?? '').localeCompare(right.studentProfile.user.lastName ?? '');
        return lastNameOrder !== 0
          ? lastNameOrder
          : (left.studentProfile.user.firstName ?? '').localeCompare(right.studentProfile.user.firstName ?? '');
      });
      if (shouldSlice) list = list.slice(member.classSliceStart! - 1, member.classSliceEnd!);
      list.forEach((code, index) => rows.push({
        code: code.code,
        studentLastName: code.studentProfile.user.lastName ?? '',
        studentFirstName: code.studentProfile.user.firstName ?? '',
        classId: code.classId,
        className: classNameById.get(code.classId) ?? '',
        orderInClass: index + 1,
      }));
    }
    return rows;
  }
}