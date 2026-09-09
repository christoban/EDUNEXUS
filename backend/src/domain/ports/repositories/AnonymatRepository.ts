import type { AnonymatTeamMemberStatus } from '@domain/types/enums';

export type AnonymatCodeRecord = {
  id: string;
  schoolId: string;
  assessmentSessionId: string;
  studentProfileId: string;
  classId: string;
  code: string;
  generatedAt: Date;
  generatedByUserId: string;
};

export type AnonymatTeamMemberRecord = {
  id: string;
  schoolId: string;
  assessmentSessionId: string;
  userId: string | null;
  email: string | null;
  magicTokenHash: string;
  magicTokenExpiresAt: Date;
  assignedClassIds: string[];
  classSliceStart: number | null;
  classSliceEnd: number | null;
  status: AnonymatTeamMemberStatus;
  doneAt: Date | null;
  createdAt: Date;
};

export type AnonymatListRow = {
  code: string;
  studentLastName: string;
  studentFirstName: string;
  classId: string;
  className: string;
  orderInClass: number;
};

export type StudentGroupForAnonymat = {
  classId: string;
  className: string;
  students: Array<{
    studentProfileId: string;
    lastName: string;
    firstName: string;
  }>;
};

export type CreateAnonymatCodeInput = {
  schoolId: string;
  assessmentSessionId: string;
  studentProfileId: string;
  classId: string;
  code: string;
  generatedByUserId: string;
};

export type CreateAnonymatTeamMemberInput = {
  schoolId: string;
  assessmentSessionId: string;
  userId: string | null;
  email: string | null;
  magicTokenHash: string;
  magicTokenExpiresAt: Date;
  assignedClassIds: string[];
  classSliceStart: number | null;
  classSliceEnd: number | null;
};

export interface AnonymatRepository {
  findCodesBySession(sessionId: string): Promise<AnonymatCodeRecord[]>;

  /** Remplace les codes existants de la session puis insère (transaction) */
  replaceCodesForSession(
    sessionId: string,
    codes: CreateAnonymatCodeInput[],
  ): Promise<void>;

  findStudentsForSessionGroupedByClass(params: {
    schoolId: string;
    classIds: string[];
  }): Promise<StudentGroupForAnonymat[]>;

  createTeamMembers(
    members: CreateAnonymatTeamMemberInput[],
  ): Promise<AnonymatTeamMemberRecord[]>;

  findTeamMemberByTokenHash(
    tokenHash: string,
  ): Promise<AnonymatTeamMemberRecord | null>;

  updateTeamMemberStatus(
    id: string,
    status: Extract<AnonymatTeamMemberStatus, 'IN_PROGRESS' | 'DONE'>,
    doneAt?: Date,
  ): Promise<void>;

  countTeamMembersNotDone(sessionId: string): Promise<number>;

  getOrderedListForMember(memberId: string): Promise<AnonymatListRow[]>;
}