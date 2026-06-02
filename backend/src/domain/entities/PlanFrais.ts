/**
 * DOMAIN LAYER — Entité Plan de Frais (FeePlan)
 *
 * Loi 3 — Art. 48 MINESEC :
 * Aucune facturation supérieure aux seuils légaux.
 * verifierSeuilLegal() lance SeuilLegalDepasseError si dépassement.
 */
import type { FeeType } from '@domain/types/enums';
import { SeuilLegalDepasseError } from '@domain/errors/SeuilLegalDepasseError';

export interface PlanFraisProps {
  id: string;
  schoolId: string;
  sectionId?: string;
  name: string;
  amount: number;
  currency: string;
  feeType: FeeType;
  level?: string;
  isRefundable: boolean;
  dueDate?: Date;
  description?: string;
  createdAt: Date;
}

export interface CreerPlanFraisProps {
  schoolId: string;
  sectionId?: string;
  name: string;
  amount: number;
  currency?: string;
  feeType: FeeType;
  level?: string;
  isRefundable?: boolean;
  dueDate?: Date;
  description?: string;
}

export class PlanFrais {
  private constructor(private readonly props: PlanFraisProps) {}

  static create(props: CreerPlanFraisProps): PlanFrais {
    if (!props.name?.trim()) throw new Error('Le nom du plan est obligatoire');
    if (props.amount <= 0) throw new Error('Le montant doit être supérieur à 0');

    return new PlanFrais({
      ...props,
      id: crypto.randomUUID(),
      currency: props.currency ?? 'XAF',
      isRefundable: props.isRefundable ?? false,
      createdAt: new Date(),
    });
  }

  static reconstituer(props: PlanFraisProps): PlanFrais {
    return new PlanFrais(props);
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get name(): string { return this.props.name; }
  get amount(): number { return this.props.amount; }
  get currency(): string { return this.props.currency; }
  get feeType(): FeeType { return this.props.feeType; }
  get level(): string | undefined { return this.props.level; }
  get isRefundable(): boolean { return this.props.isRefundable; }
  get dueDate(): Date | undefined { return this.props.dueDate; }

  // --- Méthodes métier ---

  estScolarite(): boolean { return this.props.feeType === 'TUITION'; }
  estCaution(): boolean { return this.props.feeType === 'CAUTION'; }
  estAPEE(): boolean { return this.props.feeType === 'APEE_PTA'; }

  /**
   * Loi 3 — Art. 48 MINESEC
   * Vérifie que le montant ne dépasse pas le seuil légal autorisé.
   * S'applique uniquement aux frais de scolarité (TUITION).
   * Lance SeuilLegalDepasseError si dépassement.
   */
  verifierSeuilLegal(seuilLegal: number): void {
    if (!this.estScolarite()) return;
    if (this.props.amount > seuilLegal) {
      throw new SeuilLegalDepasseError(
        this.props.amount,
        seuilLegal,
        this.props.name
      );
    }
  }

  toObject(): PlanFraisProps {
    return { ...this.props };
  }
}
