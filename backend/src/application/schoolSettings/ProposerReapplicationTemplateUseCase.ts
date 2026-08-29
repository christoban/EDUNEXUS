/**
 * APPLICATION — Use Case : Proposer la ré-application du template sur une école.
 * Lecture seule : ne persiste RIEN. Retourne le diff entre config courante et defaults.
 */
import type { SchoolSettingsRepository } from '@domain/ports/repositories/SchoolSettingsRepository';
import type { SchoolTemplateVersionRepository } from '@domain/ports/repositories/SchoolTemplateVersionRepository';
import { fusionnerConfigLocaleTemplate, CHAMPS_CONFIG_LOCALE } from '@domain/rules/configLocaleTemplate';

export interface ProposerReapplicationCommande {
  schoolId: string;
  templateCode: string;
}

export interface ProposerReapplicationResultat {
  avant: Record<string, unknown>;
  apres: Record<string, unknown>;
  champsReappliques: string[];
  champsPreserves: string[];
}

export class ProposerReapplicationTemplateUseCase {
  constructor(
    private readonly settingsRepo: SchoolSettingsRepository,
    private readonly templateVersionRepo: SchoolTemplateVersionRepository,
  ) {}

  async execute(cmd: ProposerReapplicationCommande): Promise<ProposerReapplicationResultat> {
    const version = await this.templateVersionRepo.trouverVersionActive(cmd.templateCode);
    if (!version) {
      throw new Error(`Aucune version active pour le template "${cmd.templateCode}".`);
    }

    const configCourante = await this.settingsRepo.getParametresEffectifs(cmd.schoolId);
    const overrides = await this.settingsRepo.getChampsPersonnalises(cmd.schoolId);

    const configDefaults: Record<string, unknown> = {};
    for (const champ of CHAMPS_CONFIG_LOCALE) {
      configDefaults[champ] = version.config[champ] ?? configCourante[champ as keyof typeof configCourante];
    }

    const configResultante = fusionnerConfigLocaleTemplate(
      configDefaults,
      configCourante as unknown as Record<string, unknown>,
      overrides,
    );

    const champsReappliques = CHAMPS_CONFIG_LOCALE.filter((c) => !overrides.includes(c));
    const champsPreserves = CHAMPS_CONFIG_LOCALE.filter((c) => overrides.includes(c));

    return {
      avant: configCourante as unknown as Record<string, unknown>,
      apres: configResultante,
      champsReappliques,
      champsPreserves,
    };
  }
}
