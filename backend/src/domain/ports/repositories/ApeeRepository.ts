export interface ApeeTransactionData {
  id: string;
  schoolId: string;
  creeParId: string;
  type: string;
  montant: number;
  categorie: string | null;
  description: string | null;
  date: Date;
  valide: boolean;
  valideParId: string | null;
  valideAt: Date | null;
  justificatifUrl: string | null;
  createdAt: Date;
}

export interface ApeeRepository {
  creer(data: {
    schoolId: string;
    creeParId: string;
    type: string;
    montant: number;
    categorie?: string;
    description?: string;
    date: Date;
    valide: boolean;
  }): Promise<ApeeTransactionData>;

  trouverParId(id: string, schoolId: string): Promise<ApeeTransactionData | null>;

  valider(id: string, valideParId: string): Promise<ApeeTransactionData>;
}
