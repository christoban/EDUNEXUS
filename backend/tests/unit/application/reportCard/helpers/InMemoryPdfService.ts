import type { PdfService, ContexteBulletin } from '@domain/ports/services/PdfService';

export class InMemoryPdfService implements PdfService {
  appels: ContexteBulletin[] = [];

  async genererBulletin(contexte: ContexteBulletin): Promise<Buffer> {
    this.appels.push(contexte);
    return Buffer.from('PDF_TEST');
  }

  async genererBulletinsEnMasse(
    contextes: ContexteBulletin[]
  ): Promise<{ bulletinId: string; pdf: Buffer }[]> {
    this.appels.push(...contextes);
    return contextes.map(c => ({ bulletinId: c.bulletin.id, pdf: Buffer.from('PDF_TEST') }));
  }
}
