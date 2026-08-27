/**
 * DOMAIN LAYER — Port Repository StaffAttendance (présence du personnel)
 */
export interface StaffAttendanceData {
  id: string;
  userId: string;
  schoolId: string;
  date: Date;
  statut: string;
  note: string | null;
  createdAt: Date;
}

export interface StaffAttendanceRepository {
  upsert(data: { userId: string; schoolId: string; date: Date; statut: string; note?: string }): Promise<StaffAttendanceData>;
  findBySchool(schoolId: string, filters?: { userId?: string; debut?: Date; fin?: Date }): Promise<StaffAttendanceData[]>;
}
