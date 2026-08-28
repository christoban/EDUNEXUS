/**
 * DOMAIN LAYER — Port Repository SchoolConfig
 * Configuration des seuils et paramètres par école.
 */
export interface SchoolConfigRepository {
  findBySchool(schoolId: string): Promise<any | null>;
  findBySchoolId(schoolId: string): Promise<any | null>;
}