import type { IOrientationRepository, TestDetail } from '@domain/ports/repositories/IOrientationRepository';
import type { TypeTest } from '@domain/entities/FicheOrientation';

export interface AjouterTestCommande {
  ficheId:        string;
  schoolId:       string;
  type:           TypeTest;
  datePassage:    Date;
  resultats:      string;
  interpretation?: string;
  scoreGlobal?:   number;
}

export class AjouterTestAptitudeUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: AjouterTestCommande): Promise<TestDetail> {
    const fiche = await this.repo.findFicheById(cmd.ficheId, cmd.schoolId);
    if (!fiche) throw new Error('Fiche d\'orientation introuvable');
    fiche.verifierPeutRecevoirTest();

    return this.repo.createTest(cmd.ficheId, {
      type:           cmd.type,
      datePassage:    cmd.datePassage,
      resultats:      cmd.resultats,
      interpretation: cmd.interpretation,
      scoreGlobal:    cmd.scoreGlobal,
    });
  }
}
