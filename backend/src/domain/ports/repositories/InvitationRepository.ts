/**
 * DOMAIN LAYER — Port Repository Invitation (SchoolInvite)
 */
export interface InvitationProps {
  id: string;
  email: string;
  schoolName: string;
  token: string;
  schoolId?: string;
  invitedByMasterId?: string;
  plan: string;
  status: 'PENDING' | 'USED' | 'EXPIRED';
  expiresAt: Date;
  notes?: string;
  createdAt: Date;
}

export interface InvitationRepository {
  findByToken(token: string): Promise<InvitationProps | null>;
  findBySchoolId(schoolId: string): Promise<InvitationProps[]>;
  findPendingByEmail(email: string): Promise<InvitationProps | null>;
  save(invitation: InvitationProps): Promise<void>;
  update(invitation: InvitationProps): Promise<void>;
  expireToutes(schoolId: string): Promise<void>;
  marquerUtilisee(token: string): Promise<void>;
}
