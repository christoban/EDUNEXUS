import { describe, it, expect } from 'bun:test';
import { determinerRecipientType, peutTransitionnerDepuisPendingValidation, peutSoumettreFormulaire } from '../rules';

describe('determinerRecipientType', () => {
  it('force PARENT pour sourceType CONCOURS, même sans rien d\'autre renseigné', () => {
    expect(determinerRecipientType({ sourceType: 'CONCOURS' })).toBe('PARENT');
  });

  it('force PARENT pour CONCOURS même si un recipientType explicite ELEVE est passé (aucun override possible)', () => {
    expect(determinerRecipientType({ sourceType: 'CONCOURS', recipientTypeExplicite: 'ELEVE' })).toBe('PARENT');
  });

  it('force PARENT pour CONCOURS même si defaultRecipient de l\'école est ELEVE', () => {
    expect(determinerRecipientType({ sourceType: 'CONCOURS', defaultRecipient: 'ELEVE' })).toBe('PARENT');
  });

  it('force PARENT pour CONCOURS même si recipientTypeExplicite ET defaultRecipient valent tous deux ELEVE', () => {
    expect(determinerRecipientType({ sourceType: 'CONCOURS', recipientTypeExplicite: 'ELEVE', defaultRecipient: 'ELEVE' })).toBe('PARENT');
  });

  it('utilise le recipientType explicite pour AUTOSERVICE quand fourni', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', recipientTypeExplicite: 'LES_DEUX', defaultRecipient: 'ELEVE' })).toBe('LES_DEUX');
  });

  it('retombe sur defaultRecipient pour AUTOSERVICE si aucun recipientType explicite', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', defaultRecipient: 'PARENT' })).toBe('PARENT');
  });

  it('retombe sur ELEVE par défaut si ni recipientType explicite ni defaultRecipient', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE' })).toBe('ELEVE');
  });

  it('même comportement de repli pour IMPORT_MASSE (aucun forçage spécifique, contrairement à CONCOURS)', () => {
    expect(determinerRecipientType({ sourceType: 'IMPORT_MASSE', recipientTypeExplicite: 'PARENT' })).toBe('PARENT');
    expect(determinerRecipientType({ sourceType: 'IMPORT_MASSE' })).toBe('ELEVE');
  });
});

describe('peutTransitionnerDepuisPendingValidation (règle métier n°1 : PENDING_VALIDATION obligatoire)', () => {
  it('autorise la transition uniquement depuis PENDING_VALIDATION', () => {
    expect(peutTransitionnerDepuisPendingValidation('PENDING_VALIDATION')).toBe(true);
  });

  it('refuse toute transition directe vers VALIDATED/ACTIVATED depuis les autres statuts', () => {
    const autresStatuts = ['DRAFT', 'LINK_SENT', 'SUBMITTED', 'VALIDATED', 'ACTIVATED', 'REJECTED', 'EXPIRED'] as const;
    for (const statut of autresStatuts) {
      expect(peutTransitionnerDepuisPendingValidation(statut)).toBe(false);
    }
  });

  it('refuse une double validation (dossier déjà ACTIVATED)', () => {
    expect(peutTransitionnerDepuisPendingValidation('ACTIVATED')).toBe(false);
  });

  it('refuse de rejeter un dossier déjà REJECTED', () => {
    expect(peutTransitionnerDepuisPendingValidation('REJECTED')).toBe(false);
  });
});

describe('peutSoumettreFormulaire', () => {
  it('autorise la soumission uniquement depuis LINK_SENT', () => {
    expect(peutSoumettreFormulaire('LINK_SENT')).toBe(true);
  });

  it('refuse la soumission depuis les autres statuts (déjà soumis, expiré, etc.)', () => {
    const autresStatuts = ['DRAFT', 'SUBMITTED', 'PENDING_VALIDATION', 'VALIDATED', 'ACTIVATED', 'REJECTED', 'EXPIRED'] as const;
    for (const statut of autresStatuts) {
      expect(peutSoumettreFormulaire(statut)).toBe(false);
    }
  });
});
