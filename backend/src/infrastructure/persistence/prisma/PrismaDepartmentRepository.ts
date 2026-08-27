import type { PrismaClient } from '@prisma/client';
import type { DepartmentRepository, DepartmentProps } from '@domain/ports/repositories/DepartmentRepository';

export class PrismaDepartmentRepository implements DepartmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<DepartmentProps | null> {
    return this.prisma.department.findUnique({ where: { id }, include: { subjects: { select: { id: true, name: true } } } });
  }

  async findByIdAndSchool(id: string, schoolId: string): Promise<DepartmentProps | null> {
    return this.prisma.department.findFirst({ where: { id, schoolId }, include: { subjects: { select: { id: true, name: true } } } });
  }
}
