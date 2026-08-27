/**
 * DOMAIN LAYER — Port Repository Department
 */
export interface DepartmentProps {
  id: string;
  schoolId: string;
  name: string;
  color: string;
  headId: string | null;
  subjects?: { id: string; name: string }[];
}

export interface DepartmentRepository {
  findById(id: string): Promise<DepartmentProps | null>;
  findByIdAndSchool(id: string, schoolId: string): Promise<DepartmentProps | null>;
}
