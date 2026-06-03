/**
 * DOMAIN LAYER — Export centralisé des ports repositories
 */
export type { UserRepository } from './UserRepository';
export type { SchoolRepository } from './SchoolRepository';
export type { ClasseRepository } from './ClasseRepository';
export type { NoteRepository, NoteNonValideeInfo } from './NoteRepository';
export type { PresenceRepository, StatistiquesPresence } from './PresenceRepository';
export type { BulletinRepository } from './BulletinRepository';
export type {
  MatiereRepository,
  MatiereProps,
  CoefficientMatiere
} from './MatiereRepository';
export type {
  AnneeAcademiqueRepository,
  AnneeAcademiqueProps,
  PeriodeAcademiqueProps,
  SequenceAcademiqueProps,
  CalendrierPeriode,
} from './AnneeAcademiqueRepository';
export type {
  PromotionRepository,
  ClassPromotionMapping,
  DecisionConseil,
  PromotionEleveParams,
} from './PromotionRepository';
export type { InvitationRepository, InvitationProps } from './InvitationRepository';
export type { PlanFraisRepository } from './PlanFraisRepository';
export type { FactureRepository, FactureEnRetard } from './FactureRepository';
export type { PaiementRepository, RevenusParPeriode } from './PaiementRepository';
export type { DepenseRepository } from './DepenseRepository';
export type { SousGroupeRepository, SousGroupeProps } from './SousGroupeRepository';
export type { TimetableRepository, CreneauConflitInfo } from './TimetableRepository';
export type { ExamenRepository, ExamenProps, SoumissionProps } from './ExamenRepository';
export type { SanteEleveRepository, DonneesSanteEleve } from './SanteEleveRepository';
export type {
  SchoolSettingsRepository,
  SchoolSettingsComplets,
} from './SchoolSettingsRepository';
export type { ParentRepository, EnfantAvecStats } from './ParentRepository';
