import { describe, it, expect } from 'bun:test';
import { listTemplateCatalog, findTemplateInCatalog } from '../../../../src/application/school/templateCatalog.ts';
import { getTemplateMeta } from '../../../../src/application/school/schoolTemplateConfig.ts';

describe('templateCatalog', () => {
  it('listTemplateCatalog length === nombre de clés TEMPLATE_CONFIG', () => {
    const catalog = listTemplateCatalog();
    expect(catalog.length).toBe(19);
  });

  it('chaque entrée est retrouvable via findTemplateInCatalog', () => {
    const catalog = listTemplateCatalog();
    for (const entry of catalog) {
      expect(findTemplateInCatalog(entry.code)).toBeDefined();
      expect(findTemplateInCatalog(entry.code)!.code).toBe(entry.code);
    }
  });

  it('getTemplateMeta cohérent avec catalogue (isPrimaire/isTechnique/langMode)', () => {
    const catalog = listTemplateCatalog();
    for (const entry of catalog) {
      const meta = getTemplateMeta(entry.code);
      expect(meta.isPrimaire).toBe(entry.isPrimaire);
      expect(meta.isTechnique).toBe(entry.isTechnique);
      expect(meta.langMode).toBe(entry.langMode);
    }
  });

  it('SAR_SM et CFM → PROFESSIONAL', () => {
    expect(findTemplateInCatalog('SAR_SM')!.educationType).toBe('PROFESSIONAL');
    expect(findTemplateInCatalog('CFM')!.educationType).toBe('PROFESSIONAL');
  });

  it('BILINGUAL et MIXED correctement typés', () => {
    expect(findTemplateInCatalog('LYCEE_BILINGUE')!.subsystem).toBe('BILINGUAL');
    expect(findTemplateInCatalog('COMPLEXE_SCOLAIRE')!.educationType).toBe('MIXED');
    expect(findTemplateInCatalog('COMPLEXE_SCOLAIRE')!.level).toBe('COMPLEX');
    expect(findTemplateInCatalog('COMPLEXE_SCOLAIRE')!.isComplexe).toBe(true);
  });

  it('PRIVE_FR/PRIVE_EN ont ownershipHint privé', () => {
    expect(findTemplateInCatalog('PRIVE_FR')!.ownershipHint).toEqual(['PRIVATE_SECULAR', 'PRIVATE_FAITH']);
    expect(findTemplateInCatalog('PRIVE_EN')!.ownershipHint).toEqual(['PRIVATE_SECULAR', 'PRIVATE_FAITH']);
  });

  it('code inconnu → undefined', () => {
    expect(findTemplateInCatalog('NOT_A_TEMPLATE')).toBeUndefined();
  });
});
