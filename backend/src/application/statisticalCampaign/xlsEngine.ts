/**
 * Moteur de lecture/écriture du fichier officiel MINESEC (.xls legacy BIFF8, protection
 * "VelvetSweatshop" — convention Excel pour un classeur marqué protégé sans mot de passe
 * personnalisé, pas un chiffrement réel). 100% JS/Bun (officecrypto-tool + xlsx), aucune
 * dépendance externe au déploiement (voir décision actée : pas de sidecar Python).
 *
 * Limite connue et acceptée : l'écriture BIFF8 via SheetJS ne préserve pas la mise en forme
 * (couleurs de fond, etc.) des cellules modifiées — la structure, les feuilles et les valeurs
 * restent exactes. Compromis choisi pour rester 100% Bun/TS sans nouvelle brique d'infra.
 */
import fs from 'fs';
import officecrypto from 'officecrypto-tool';
import * as XLSX from 'xlsx';

const VELVET_SWEATSHOP_PASSWORD = 'VelvetSweatshop';

export async function decryptTemplate(filePath: string): Promise<XLSX.WorkBook> {
  const buf = fs.readFileSync(filePath);
  const decrypted = await officecrypto.decrypt(buf, { password: VELVET_SWEATSHOP_PASSWORD });
  return XLSX.read(decrypted, { type: 'buffer', cellFormula: true });
}

export type CellDataType = 'NUMBER' | 'TEXT' | 'BOOLEAN';

/**
 * Écrit une valeur dans une cellule, en refusant par défaut d'écraser une formule Excel
 * (protection contre un mapping qui viserait accidentellement une cellule calculée plutôt
 * qu'une cellule d'entrée réelle). Retourne false (et n'écrit rien) si la cellule cible
 * contient déjà une formule et que `allowFormulaOverwrite` n'est pas explicitement activé.
 *
 * IMPORTANT : l'écriture BIFF8 via SheetJS NE PRÉSERVE PAS les formules Excel au round-trip
 * (vérifié empiriquement — pas seulement la mise en forme). Toute cellule connue comme étant
 * une formule "Total"/"Ensemble" dans le template original DOIT donc être recalculée côté
 * code et écrite explicitement avec `allowFormulaOverwrite: true`, sous peine d'afficher une
 * valeur figée (souvent 0) dans le fichier livré au lieu du vrai total.
 */
export function setCellValue(
  ws: XLSX.WorkSheet,
  cellRef: string,
  value: string | number | boolean | null,
  dataType: CellDataType = 'NUMBER',
  allowFormulaOverwrite = false,
): boolean {
  const existing = ws[cellRef];
  if (existing?.f && !allowFormulaOverwrite) return false; // jamais écraser une formule par accident
  if (value === null || value === undefined) return true; // rien à écrire, pas une erreur

  if (dataType === 'NUMBER') {
    ws[cellRef] = { t: 'n', v: Number(value) };
  } else if (dataType === 'BOOLEAN') {
    ws[cellRef] = { t: 's', v: value ? 'Oui' : 'Non' };
  } else {
    ws[cellRef] = { t: 's', v: String(value) };
  }

  // Étendre !ref si la cellule est hors de la plage actuelle de la feuille.
  const addr = XLSX.utils.decode_cell(cellRef);
  const range = XLSX.utils.decode_range(ws['!ref']!);
  const changed =
    addr.r < range.s.r || addr.r > range.e.r || addr.c < range.s.c || addr.c > range.e.c;
  if (changed) {
    range.s.r = Math.min(range.s.r, addr.r);
    range.e.r = Math.max(range.e.r, addr.r);
    range.s.c = Math.min(range.s.c, addr.c);
    range.e.c = Math.max(range.e.c, addr.c);
    ws['!ref'] = XLSX.utils.encode_range(range);
  }
  return true;
}

export function writeWorkbookToFile(wb: XLSX.WorkBook, outputPath: string): void {
  const buf = XLSX.write(wb, { bookType: 'biff8', type: 'buffer' });
  fs.writeFileSync(outputPath, buf);
}
