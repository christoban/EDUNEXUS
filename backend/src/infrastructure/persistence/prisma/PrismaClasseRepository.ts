import type { PrismaClient } from '@prisma/client';
import { Classe } from '@domain/entities/Classe';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export class PrismaClasseRepository implements ClasseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Classe | null> {
    const data = await this.prisma.class.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findBySchool(schoolId: string): Promise<Classe[]> {
    const data = await this.prisma.class.findMany({ where: { schoolId } });
    return data.map(d => this.toDomain(d));
  }

  async findBySection(sectionId: string): Promise<Classe[]> {
    const data = await this.prisma.class.findMany({ where: { sectionId } });
    return data.map(d => this.toDomain(d));
  }

  async findByLevel(schoolId: string, level: string): Promise<Classe[]> {
    const data = await this.prisma.class.findMany({ where: { schoolId, level } });
    return data.map(d => this.toDomain(d));
  }

  async countEleves(classeId: string): Promise<number> {
    return this.prisma.studentProfile.count({
      where: { classId: classeId },
    });
  }

  async save(classe: Classe): Promise<void> {
    const data = classe.toObject();
    await this.prisma.class.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        name: data.name,
        level: data.level,
        serie: data.serie,
        filiere: data.filiere,
        sectionId: data.sectionId,
        capacity: data.capacity,
        professorPrincipalId: data.professorPrincipalId,
        createdAt: data.createdAt,
      },
    });
  }

  async update(classe: Classe): Promise<void> {
    const data = classe.toObject();
    await this.prisma.class.update({
      where: { id: data.id },
      data: {
        name: data.name,
        level: data.level,
        serie: data.serie,
        filiere: data.filiere,
        sectionId: data.sectionId,
        capacity: data.capacity,
        professorPrincipalId: data.professorPrincipalId ?? null,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.class.delete({ where: { id } });
  }

  async existsByName(schoolId: string, name: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.class.findFirst({
      where: {
        schoolId,
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return existing !== null;
  }

  async findClasseDeProfPrincipal(teacherUserId: string): Promise<Classe | null> {
    const data = await this.prisma.class.findFirst({
      where: { professorPrincipalId: teacherUserId },
    });
    return data ? this.toDomain(data) : null;
  }

  /**
   * Nom historique conservé ("avecCascade"), comportement changé (Couche 1,
   * PLAN_IMPLEMENTATION_BACKUP.md) : pose deletedAt sur la classe elle-même, ne supprime plus
   * rien — élèves rattachés, notes, présences, emploi du temps, conseils de classe restent
   * intacts. Une restauration remet tout en état sans rien à reconstruire. Limite connue et
   * acceptée : une classe supprimée reste visible via un `include: { class: true }` depuis un
   * autre modèle (le filtre automatique de softDeleteExtension.ts ne s'applique qu'aux lectures
   * directes sur `class`, pas aux relations imbriquées) — sans conséquence pratique tant que
   * l'écran qui liste les classes elles-mêmes (l'usage principal concerné) est bien filtré.
   */
  async supprimerAvecCascade(classeId: string, deletedById?: string): Promise<void> {
    const classe = await this.prisma.class.findUnique({ where: { id: classeId }, select: { id: true } });
    if (!classe) return;
    await this.prisma.class.update({
      where: { id: classeId },
      data: { deletedAt: new Date(), deletedById: deletedById ?? null },
    });
  }

  async restaurer(classeId: string): Promise<void> {
    await this.prisma.class.update({
      where: { id: classeId, deletedAt: { not: null } },
      data: { deletedAt: null, deletedById: null },
    });
  }

  private toDomain(data: any): Classe {
    return Classe.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      name: data.name,
      level: data.level ?? undefined,
      serie: data.serie ?? undefined,
      filiere: data.filiere ?? undefined,
      sectionId: data.sectionId ?? undefined,
      capacity: data.capacity,
      professorPrincipalId: data.professorPrincipalId ?? undefined,
      createdAt: data.createdAt,
    });
  }
}
