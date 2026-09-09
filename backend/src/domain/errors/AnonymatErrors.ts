export class AnonymatDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AnonymatDomainError';
  }
}

export class ForbiddenAnonymatError extends AnonymatDomainError {
  constructor() {
    super('Action réservée au Censeur / Vice-Principal / Admin', 'FORBIDDEN_MANAGE_ANONYMAT');
  }
}

export class SessionNotFoundError extends AnonymatDomainError {
  constructor() {
    super('Session introuvable', 'SESSION_NOT_FOUND');
  }
}

export class SessionNotAnonymizedError extends AnonymatDomainError {
  constructor() {
    super('Session non anonymisée', 'SESSION_NOT_ANONYMIZED');
  }
}

export class InvalidAnonymatStateError extends AnonymatDomainError {
  constructor(detail: string) {
    super(detail, 'INVALID_ANONYMAT_STATE');
  }
}

export class NoStudentsInSessionError extends AnonymatDomainError {
  constructor() {
    super('Aucun élève pour cette session', 'NO_STUDENTS_IN_SESSION');
  }
}

export class InvalidMagicTokenError extends AnonymatDomainError {
  constructor(code: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'ALREADY_DONE' = 'TOKEN_INVALID') {
    const messages = {
      TOKEN_INVALID: 'Lien invalide',
      TOKEN_EXPIRED: 'Lien expiré',
      ALREADY_DONE: 'Liste déjà clôturée',
    } as const;
    super(messages[code], code);
  }
}