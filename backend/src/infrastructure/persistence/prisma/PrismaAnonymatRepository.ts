async findStudentsForSessionGroupedByClass(params: {
  schoolId: string;
  assessmentSessionId: string;
  classIds: string[];
}) {
  const result = [];
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
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: [
        { student: { user: { lastName: 'asc' } } },
        { student: { user: { firstName: 'asc' } } },
      ],
    });

    result.push({
      classId: classe.id,
      className: classe.name,
      students: enrollments.map((e) => ({
        studentProfileId: e.studentId,
        lastName: e.student.user.lastName ?? '',
        firstName: e.student.user.firstName ?? '',
      })),
    });
  }
  return result;
}

async getOrderedListForMember(memberId: string): Promise<AnonymatListRow[]> {
  const member = await this.prisma.anonymatTeamMember.findUniqueOrThrow({
    where: { id: memberId },
  });

  const codes = await this.prisma.anonymatCode.findMany({
    where: {
      assessmentSessionId: member.assessmentSessionId,
      classId: { in: member.assignedClassIds },
    },
    include: {
      studentProfile: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      // si relation class existe :
      // class: { select: { name: true } }
    },
  });

  // Grouper par classId
  const byClass = new Map<string, typeof codes>();
  for (const c of codes) {
    const list = byClass.get(c.classId) ?? [];
    list.push(c);
    byClass.set(c.classId, list);
  }

  const rows: AnonymatListRow[] = [];
  // Respecter l'ordre de assignedClassIds (pas un ordre arbitraire de Map)
  for (const classId of member.assignedClassIds) {
    let list = byClass.get(classId) ?? [];
    list = list.sort((a, b) => {
      const ln = (a.studentProfile.user.lastName ?? '').localeCompare(b.studentProfile.user.lastName ?? '');
      if (ln !== 0) return ln;
      return (a.studentProfile.user.firstName ?? '').localeCompare(b.studentProfile.user.firstName ?? '');
    });

    if (member.classSliceStart != null && member.classSliceEnd != null) {
      list = list.slice(member.classSliceStart - 1, member.classSliceEnd);
    }

    list.forEach((c, idx) => {
      rows.push({
        code: c.code,
        studentLastName: c.studentProfile.user.lastName ?? '',
        studentFirstName: c.studentProfile.user.firstName ?? '',
        classId: c.classId,
        className: '', // remplir via include class.name si dispo
        orderInClass: idx + 1,
      });
    });
  }
  return rows;
}