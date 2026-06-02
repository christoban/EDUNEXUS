/**
 * DOMAIN LAYER — Port Repository School (Établissement)
 */
import type { School } from '@domain/entities/School';
import type { SchoolStatus } from '@domain/types/enums';

export interface SchoolRepository {
  // Lecture
  findById(id: string): Promise<School | null>;
  findBySubdomain(subdomain: string): Promise<School | null>;
  findAll(): Promise<School[]>;
  findByStatus(status: SchoolStatus): Promise<School[]>;
  existsBySubdomain(subdomain: string): Promise<boolean>;

  // Écriture
  save(school: School): Promise<void>;
  update(school: School): Promise<void>;
  delete(id: string): Promise<void>;

  // Statistiques pour le MasterAdmin
  countByStatus(status: SchoolStatus): Promise<number>;
  countEleves(schoolId: string): Promise<number>;
}
