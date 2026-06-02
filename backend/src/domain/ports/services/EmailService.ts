/**
 * DOMAIN LAYER — Port Service Email
 */
export interface EnvoiEmailOptions {
  destinataire: string;
  sujet: string;
  contenuHtml: string;
  contenuTexte?: string;
  pieceJointe?: {
    nom: string;
    contenu: Buffer;
    mimeType: string;
  };
}

export interface EmailService {
  envoyer(options: EnvoiEmailOptions): Promise<void>;
  envoyerAvecPDF(options: EnvoiEmailOptions & {
    pdf: { nom: string; contenu: Buffer };
  }): Promise<void>;
}
