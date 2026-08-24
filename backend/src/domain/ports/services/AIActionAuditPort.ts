export interface AIActionAuditPort {
  journaliser(params: {
    actorUserId: string;
    actorRole: string;
    schoolId?: string | null;
    actionName: string;
    targetType?: string | null;
    targetId?: string | null;
    origin: 'UI_DIRECT' | 'AI_ASSISTANT';
    outcome: 'SUCCES' | 'REFUSE' | 'ERREUR';
    refusalReason?: string | null;
    parametersSummary?: unknown;
  }): void;
}
