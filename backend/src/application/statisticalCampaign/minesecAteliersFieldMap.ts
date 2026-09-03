/**
 * Mapping Atelier_Workshop — STUB V2.14 P1
 *
 * Inventaire template 2022 (backend/storage/statistical-templates/1-DPPC-MINESEC-SECONDAIRE-2022.xls):
 * 18 onglets dont Atelier_Workshop est présent (row 2: "Informations sur les ateliers").
 * Structure observée (dump /tmp/test_decrypted.xlsx):
 *   R7: N° | Atelier | Etat de l'atelier | Quantités | Etat de l'équipement | Nombre de Postes | Workshop | State ...
 *   Dimensions: columns C (3) to R (44), ~207 lignes.
 * Mapping cellules exactes NON vérifié — ne pas écrire tant que LibreOffice n'a pas été
 * utilisé pour relever les adresses précises (ex. ESTP le fait avec colToIndex).
 *
 * TODO: relever cellule par cellule (LibreOffice) et remplir ATELIER_GRID_BLOCKS.
 * En attendant, GenererDeclarationStatistiqueMinesecUseCase pousse un champsNonResolu
 * explicite si ateliersDetail est renseigné mais que le mapping n'est pas prêt — jamais de
 * données inventées.
 */

export interface AtelierGridBlock {
  blockLabel: string;
  nameRow: number;
  capacityRow?: number;
  firstSlotCol: string;
  nbSlots: number;
}

// À REMPLIR uniquement après lecture du fichier officiel — ne pas inventer de cellules
export const ATELIER_GRID_BLOCKS: AtelierGridBlock[] = [];
