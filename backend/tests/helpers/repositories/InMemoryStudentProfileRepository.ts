import type {
  StudentBulletinOptions,
  StudentProfileRepository,
} from '@domain/ports/repositories/StudentProfileRepository';

export class InMemoryStudentProfileRepository
  implements StudentProfileRepository
{
  private store = new Map<string, StudentBulletinOptions>();

  set(profile: StudentBulletinOptions): void {
    this.store.set(profile.studentId, profile);
  }

  async findBulletinOptionsByStudentIds(
    studentIds: string[],
  ): Promise<StudentBulletinOptions[]> {
    return studentIds
      .map((studentId) => this.store.get(studentId))
      .filter(
        (profile): profile is StudentBulletinOptions =>
          profile !== undefined,
      );
  }
}