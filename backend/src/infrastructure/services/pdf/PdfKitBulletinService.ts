import type { PdfService, ContexteBulletin } from '@domain/ports/services/PdfService';
import type { LigneMatiereProps } from '@domain/entities/Bulletin';
import { generateBulletinPdf } from '../../pdf/report-card/BulletinTemplates.ts';

export class PdfKitBulletinService implements PdfService {
  async genererBulletin(contexte: ContexteBulletin): Promise<Buffer> {
    return generateBulletinPdf(contexte.bulletin.template, this.mapperContexte(contexte));
  }

  async genererBulletinsEnMasse(
    contextes: ContexteBulletin[]
  ): Promise<{ bulletinId: string; pdf: Buffer }[]> {
    return Promise.all(
      contextes.map(async (contexte) => ({
        bulletinId: contexte.bulletin.id,
        pdf: await generateBulletinPdf(contexte.bulletin.template, this.mapperContexte(contexte)),
      }))
    );
  }

  private mapperContexte(contexte: ContexteBulletin) {
    return {
      schoolName: contexte.nomEtablissement,
      logoUrl: contexte.logoUrl,
      studentName: contexte.nomEleve,
      className: contexte.nomClasse,
      periodName: contexte.nomPeriode,
      yearName: contexte.anneeAcademique,
      generalAverage: contexte.bulletin.generalAverage ?? 0,
      rank: contexte.bulletin.rank ?? null,
      totalStudents: contexte.bulletin.totalStudents ?? null,
      absenceCount: contexte.bulletin.absenceCount,
      mention: contexte.bulletin.mention ?? '',
      classMasterComment: contexte.bulletin.classMasterComment ?? null,
      isOfficial: contexte.bulletin.validationStatus === 'GENERATED',
      language: contexte.langue ?? 'fr',
      subjectLines: contexte.bulletin.lignesMatiere.map(this.mapperLigne),
    };
  }

  private mapperLigne(ligne: LigneMatiereProps) {
    return {
      subjectName: ligne.subjectName,
      coefficient: ligne.coefficient,
      seq1Score: ligne.seq1Score,
      seq2Score: ligne.seq2Score,
      compositionScore: ligne.compositionScore,
      seq3Score: ligne.seq3Score,
      seq4Score: ligne.seq4Score,
      seq5Score: ligne.seq5Score,
      seq6Score: ligne.seq6Score,
      classTestScore: ligne.classTestScore,
      terminalExamScore: ligne.terminalExamScore,
      theoreticalScore: ligne.theoreticalScore,
      practicalScore: ligne.practicalScore,
      professionalAttitude: ligne.professionalAttitude,
      oralScore: ligne.oralScore,
      selfDevelopmentScore: ligne.selfDevelopmentScore,
      subjectAverage: ligne.subjectAverage,
      teacherComment: ligne.teacherComment,
      competenceLabel: ligne.competenceLabel,
    };
  }
}
