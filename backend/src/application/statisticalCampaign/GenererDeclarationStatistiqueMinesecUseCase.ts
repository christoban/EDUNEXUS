/**
 * APPLICATION — Use case : générer la déclaration statistique MINESEC officielle, en
 * écrivant dans une copie du vrai fichier téléchargé (jamais un fac-similé). Bloque
 * immédiatement si le formulaire complémentaire (Catégorie C) n'est pas complet.
 */
import fs from 'fs';
import path from 'path';
import type { StatisticalQueryPort } from '@domain/ports/repositories/StatisticalQueryPort';
import type { StatisticalCampaignRepository } from '@domain/ports/repositories/StatisticalCampaignRepository';
import { decryptTemplate, setCellValue, writeWorkbookToFile, cleanupSession, type WorkbookSession } from './xlsEngine';
import { resolveEsgFields, resolveIdentificationAutoFields, resolveFeeAutoFields, type ResolvedCell } from './resolveAutoFields';
import { resolveEsgEngFields } from './resolveEsgEngFields';
import { resolvePersonnelFields } from './resolvePersonnelFields';
import { VerifierCompletudeSupplementUseCase } from './VerifierCompletudeSupplementUseCase';
import { IDENTIFICATION_FIELDS, INFRASTRUCTURE_FIELDS, FINANCEMENT_FIELDS } from './minesecFixedFieldMap';
import { ESTP_GRID_BLOCKS } from './minesecEstpGridMap';
import { ESTP_ENG_GRID_BLOCKS } from './minesecEstpEngGridMap';
import { MANUELS_FIELD_MAPPING } from './minesecManuelsFieldMap';
import { THEMES_FIELD_MAPPING } from './minesecThemesFieldMap';
import type { ChampNonResolu, GenererDeclarationStatistiqueCommande, GenererDeclarationStatistiqueResultat } from './types';

function getByPath(obj: any, keyPath: string): any {
  // Supporte "a.b.c" et "a[0].b"
  const parts = keyPath.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

const STORAGE_DIR = path.resolve(process.cwd(), 'storage', 'statistical-submissions');

export class GenererDeclarationStatistiqueMinesecUseCase {
  constructor(
    private readonly query: StatisticalQueryPort,
    private readonly campaignRepository: StatisticalCampaignRepository,
    private readonly verifierCompletude: VerifierCompletudeSupplementUseCase,
  ) {}

  async execute(cmd: GenererDeclarationStatistiqueCommande): Promise<GenererDeclarationStatistiqueResultat> {
    const completude = await this.verifierCompletude.execute({ schoolId: cmd.schoolId });
    if (!completude.complet) {
      const template = await this.campaignRepository.trouverTemplateActif('MINESEC');
      const submission = await this.campaignRepository.creerSubmission({
        schoolId: cmd.schoolId,
        templateId: template?.id ?? '',
        generatedBy: cmd.generatedByUserId,
        status: 'PENDING_MANUAL_DATA',
      });
      return {
        status: 'PENDING_MANUAL_DATA',
        submissionId: submission.id,
        filePath: null,
        champsManquants: completude.champsManquants,
        champsNonResolus: [],
      };
    }

    const template = await this.getActiveTemplate();
    const supplement = await this.campaignRepository.trouverSupplement(cmd.schoolId);
    const school = await this.query.trouverEcole(cmd.schoolId);

    const session = await decryptTemplate(template.filePath);
    try {
      return await this.remplirEtEcrire(session, cmd, template, supplement, school);
    } catch (err) {
      cleanupSession(session);
      throw err;
    }
  }

  private async remplirEtEcrire(
    session: WorkbookSession,
    cmd: GenererDeclarationStatistiqueCommande,
    template: any,
    supplement: any,
    school: any,
  ): Promise<GenererDeclarationStatistiqueResultat> {
    const wb = session.workbook;
    const champsNonResolus: ChampNonResolu[] = [];

    const applyCells = (cells: ResolvedCell[]) => {
      for (const cell of cells) {
        const ws = wb.getWorksheet(cell.sheetName);
        if (!ws) continue;
        setCellValue(ws, cell.cellReference, cell.value, cell.dataType);
      }
    };

    // ── Catégorie A_AUTO ──
    applyCells(await resolveIdentificationAutoFields(this.query, cmd.schoolId));
    const esg = await resolveEsgFields(this.query, cmd.schoolId);
    applyCells(esg.cells);
    champsNonResolus.push(...esg.nonCouverts);
    const esgEng = await resolveEsgEngFields(this.query, cmd.schoolId);
    applyCells(esgEng.cells);
    champsNonResolus.push(...esgEng.nonCouverts);
    applyCells(await resolveFeeAutoFields(this.query, cmd.schoolId));
    const personnel = await resolvePersonnelFields(this.query, cmd.schoolId);
    applyCells(personnel.cells);
    champsNonResolus.push(...personnel.nonCouverts);

    // ── Catégorie C_MANUAL (Identification/Infrastructures/Financement) ──
    const fixedManualFields = [...IDENTIFICATION_FIELDS, ...INFRASTRUCTURE_FIELDS, ...FINANCEMENT_FIELDS].filter(
      (f) => f.category === 'C_MANUAL',
    );
    for (const field of fixedManualFields) {
      const ws = wb.getWorksheet(field.sheetName);
      if (!ws || !field.supplementKey) continue;
      const value = getByPath(supplement, field.supplementKey);
      if (value === undefined || value === null) {
        champsNonResolus.push({
          fieldCode: field.fieldCode,
          sheetName: field.sheetName,
          cellReference: field.cellReference,
          fieldLabel: field.fieldLabel,
          raison: 'Non renseigné dans le formulaire complémentaire.',
        });
        continue;
      }
      const dataType = typeof value === 'boolean' ? 'BOOLEAN' : typeof value === 'number' ? 'NUMBER' : 'TEXT';
      const written = setCellValue(ws, field.cellReference, value, dataType);
      if (!written) {
        // La cellule cible contient une formule (bug de mapping potentiel) — jamais perdre
        // silencieusement une donnée renseignée par l'admin, toujours le signaler.
        champsNonResolus.push({
          fieldCode: field.fieldCode,
          sheetName: field.sheetName,
          cellReference: field.cellReference,
          fieldLabel: field.fieldLabel,
          raison: `Valeur renseignée (${value}) mais la cellule cible est une formule Excel — mapping à corriger, valeur non écrite.`,
        });
      }
    }

    // Total "Nombre de locaux" par sous-système/type (Infrastructures, colonne F/N/V/AD) :
    // formule SUM(H:M) dans le template sur les 6 valeurs de répartition matériau × état déjà
    // écrites ci-dessus via INFRASTRUCTURE_FIELDS (C_MANUAL) — préservée et recalculée seule à
    // l'ouverture depuis la migration LibreOffice+exceljs, plus besoin de la recalculer à la
    // main (vérifié empiriquement, voir rapport de migration).

    // ── Catégorie C_MANUAL — spécialités techniques ESTP (grille dynamique) ──
    const wsEstp = wb.getWorksheet('Eleves_ESTP_Fr');
    const effectifsTechniques: any[] = Array.isArray(supplement?.effectifsTechniquesDetail) ? supplement.effectifsTechniquesDetail : [];
    const blockByAnnee = new Map<string, typeof ESTP_GRID_BLOCKS>();
    for (const block of ESTP_GRID_BLOCKS) {
      const base = block.blockLabel.replace(/ suite$/, '');
      if (!blockByAnnee.has(base)) blockByAnnee.set(base, []);
      blockByAnnee.get(base)!.push(block);
    }
    const usedSlotIndex = new Map<string, number>(); // "base" -> nombre de créneaux déjà utilisés

    if (wsEstp) {
      for (const entry of effectifsTechniques) {
        const base: string = entry.anneeEtude;
        const blocks = blockByAnnee.get(base);
        if (!blocks) {
          champsNonResolus.push({ fieldCode: 'ESTP_ANNEE_INCONNUE', sheetName: 'Eleves_ESTP_Fr', cellReference: '', fieldLabel: `Spécialité ${entry.specialiteAcronyme} — année "${base}"`, raison: "Année d'étude non reconnue dans la grille officielle." });
          continue;
        }
        const used = usedSlotIndex.get(base) ?? 0;
        // Trouve le bloc (principal ou "suite") et l'index de créneau correspondant à `used`
        let remaining = used;
        let targetBlock = null as typeof ESTP_GRID_BLOCKS[number] | null;
        let slotIdx = 0;
        for (const b of blocks) {
          if (remaining < b.nbSlots) { targetBlock = b; slotIdx = remaining; break; }
          remaining -= b.nbSlots;
        }
        if (!targetBlock) {
          champsNonResolus.push({ fieldCode: 'ESTP_CRENEAUX_INSUFFISANTS', sheetName: 'Eleves_ESTP_Fr', cellReference: '', fieldLabel: `Spécialité ${entry.specialiteAcronyme} — ${base}`, raison: 'Nombre de spécialités déclarées supérieur au nombre de créneaux disponibles sur le formulaire officiel (19 max par année).' });
          continue;
        }
        usedSlotIndex.set(base, used + 1);

        // Colonnes calculées par décalage direct depuis firstSlotCols (2 colonnes par créneau)
        const startColIdx = colToIndex(targetBlock.firstSlotCols[0]);
        const fillesColIdx = startColIdx + slotIdx * 2;
        const garconsColIdx = fillesColIdx + 1;
        const fillesCol = indexToCol(fillesColIdx);
        const garconsCol = indexToCol(garconsColIdx);

        setCellValue(wsEstp, `${fillesCol}${targetBlock.nameRow}`, entry.specialiteAcronyme, 'TEXT');
        setCellValue(wsEstp, `${fillesCol}${targetBlock.divRow}`, entry.divisions ?? 0, 'NUMBER');
        setCellValue(wsEstp, `${fillesCol}${targetBlock.totalRow}`, entry.fillesTotal ?? 0, 'NUMBER');
        setCellValue(wsEstp, `${garconsCol}${targetBlock.totalRow}`, entry.garconsTotal ?? 0, 'NUMBER');
        setCellValue(wsEstp, `${fillesCol}${targetBlock.redoubRow}`, entry.fillesRedoublants ?? 0, 'NUMBER');
        setCellValue(wsEstp, `${garconsCol}${targetBlock.redoubRow}`, entry.garconsRedoublants ?? 0, 'NUMBER');
      }
    }

    // ── Catégorie C_MANUAL — spécialités techniques ESTP EN (grille dynamique) ──
    const wsEstpEng = wb.getWorksheet('Students_ESTP_Eng');
    const blockByAnneeEng = new Map<string, typeof ESTP_ENG_GRID_BLOCKS>();
    for (const block of ESTP_ENG_GRID_BLOCKS) {
      const base = block.blockLabel.replace(/ suite$/, '');
      if (!blockByAnneeEng.has(base)) blockByAnneeEng.set(base, []);
      blockByAnneeEng.get(base)!.push(block);
    }
    const usedSlotIndexEng = new Map<string, number>();

    if (wsEstpEng) {
      for (const entry of effectifsTechniques) {
        const base: string = entry.anneeEtude;
        const blocks = blockByAnneeEng.get(base);
        if (!blocks) {
          champsNonResolus.push({ fieldCode: 'ESTP_ENG_ANNEE_INCONNUE', sheetName: 'Students_ESTP_Eng', cellReference: '', fieldLabel: `Specialite ${entry.specialiteAcronyme} — annee "${base}"`, raison: "Annee d'etude non reconnue dans la grille officielle." });
          continue;
        }
        const used = usedSlotIndexEng.get(base) ?? 0;
        let remaining = used;
        let targetBlock = null as typeof ESTP_ENG_GRID_BLOCKS[number] | null;
        let slotIdx = 0;
        for (const b of blocks) {
          if (remaining < b.nbSlots) { targetBlock = b; slotIdx = remaining; break; }
          remaining -= b.nbSlots;
        }
        if (!targetBlock) {
          champsNonResolus.push({ fieldCode: 'ESTP_ENG_CRENEAUX_INSUFFISANTS', sheetName: 'Students_ESTP_Eng', cellReference: '', fieldLabel: `Specialite ${entry.specialiteAcronyme} — ${base}`, raison: 'Nombre de specialites declarées superieur au nombre de creneaux disponibles.' });
          continue;
        }
        usedSlotIndexEng.set(base, used + 1);

        const startColIdx = colToIndex(targetBlock.firstSlotCols[0]);
        const fillesColIdx = startColIdx + slotIdx * 2;
        const garconsColIdx = fillesColIdx + 1;
        const fillesCol = indexToCol(fillesColIdx);
        const garconsCol = indexToCol(garconsColIdx);

        setCellValue(wsEstpEng, `${fillesCol}${targetBlock.nameRow}`, entry.specialiteAcronyme, 'TEXT');
        setCellValue(wsEstpEng, `${fillesCol}${targetBlock.divRow}`, entry.divisions ?? 0, 'NUMBER');
        setCellValue(wsEstpEng, `${fillesCol}${targetBlock.totalRow}`, entry.fillesTotal ?? 0, 'NUMBER');
        setCellValue(wsEstpEng, `${garconsCol}${targetBlock.totalRow}`, entry.garconsTotal ?? 0, 'NUMBER');
        setCellValue(wsEstpEng, `${fillesCol}${targetBlock.redoubRow}`, entry.fillesRedoublants ?? 0, 'NUMBER');
        setCellValue(wsEstpEng, `${garconsCol}${targetBlock.redoubRow}`, entry.garconsRedoublants ?? 0, 'NUMBER');
      }
    }

    // ── Catégorie C_MANUAL — Manuels-Didactics ──
    const manuelsDetail: any[] = Array.isArray(supplement?.manuelDetail) ? supplement.manuelDetail : [];
    for (const mapping of MANUELS_FIELD_MAPPING) {
      const ws = wb.getWorksheet('Manuels-Didactics');
      if (!ws) continue;
      const entry = manuelsDetail.find((m: any) => m.code === mapping.fieldCode || m.discipline === mapping.discipline);
      if (!entry) {
        champsNonResolus.push({ fieldCode: mapping.fieldCode, sheetName: 'Manuels-Didactics', cellReference: mapping.otherCell, fieldLabel: mapping.discipline, raison: 'Non renseigne dans le formulaire complementaire.' });
        continue;
      }
      for (const c of mapping.anglophoneCells) {
        const val = entry.niveaux?.[c.level] ?? 0;
        setCellValue(ws, c.cell, val, 'NUMBER');
      }
      for (const c of mapping.francophoneCells) {
        const val = entry.niveaux?.[c.level] ?? 0;
        setCellValue(ws, c.cell, val, 'NUMBER');
      }
      setCellValue(ws, mapping.otherCell, entry.other ?? 0, 'NUMBER');
    }

    // ── Catégorie C_MANUAL — Themes Transversaux ──
    const themesDetail: any = supplement?.themesTransversauxDetail ?? null;
    if (themesDetail) {
      const ws = wb.getWorksheet('Themes_Tranversaux');
      if (ws) {
        for (const mapping of THEMES_FIELD_MAPPING) {
          const value = themesDetail[mapping.questionRef];
          if (value === undefined || value === null) {
            champsNonResolus.push({ fieldCode: mapping.fieldCode, sheetName: 'Themes_Tranversaux', cellReference: mapping.cellRef, fieldLabel: mapping.fieldLabel, raison: 'Non renseigne dans le formulaire complementaire.' });
            continue;
          }
          setCellValue(ws, mapping.cellRef, value, mapping.dataType);
        }
      }
    }

    const outDir = path.join(STORAGE_DIR, cmd.schoolId);
    fs.mkdirSync(outDir, { recursive: true });
    const fileName = `declaration-minesec-${school?.subdomain ?? cmd.schoolId}-${Date.now()}.xls`;
    const outputPath = path.join(outDir, fileName);
    await writeWorkbookToFile(session, outputPath);

    const submission = await this.campaignRepository.creerSubmission({
      schoolId: cmd.schoolId,
      templateId: template.id,
      generatedBy: cmd.generatedByUserId,
      status: 'DRAFT',
      filePath: outputPath,
      unresolvedFieldsReport: champsNonResolus,
    });

    return {
      status: 'DRAFT',
      submissionId: submission.id,
      filePath: outputPath,
      champsManquants: [],
      champsNonResolus,
    };
  }

  private async getActiveTemplate() {
    const template = await this.campaignRepository.trouverTemplateActif('MINESEC');
    if (!template) throw new Error("Aucun template de campagne MINESEC actif — contactez l'équipe technique.");
    return template;
  }
}

function colToIndex(col: string): number {
  let idx = 0;
  for (const ch of col) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}
function indexToCol(idx: number): string {
  let n = idx + 1;
  let col = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}
