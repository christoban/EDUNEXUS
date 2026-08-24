export interface StudentBulletinOptions {
  studentId: string;
  lv2SubjectId: string | null;
  alevelSubjectIds: string[];
}

export interface StudentProfileRepository {
  findBulletinOptionsByStudentIds(
    studentIds: string[],
  ): Promise<StudentBulletinOptions[]>;
}