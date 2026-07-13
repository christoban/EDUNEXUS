/**
 * Mapping des champs eleves ESG (Enseignement Secondaire General), feuille Eleves_ESG_Fr.
 * Genere a partir d une extraction automatisee et auto-verifiee du fichier officiel
 * 1-DPPC-MINESEC-SECONDAIRE-2022.xls (formules Excel utilisees comme controle croise).
 *
 * Chaque groupe niveau/filiere/LV2 produit jusqu a 3 entrees : nombre de divisions, total
 * eleves (F/G) et redoublants (F/G). Les colonnes "Total"/"Ensemble" du fichier sont des
 * FORMULES Excel dans le template original -- mais SheetJS (ecriture BIFF8) ne preserve PAS
 * les formules au round-trip (verifie empiriquement, pas seulement le formatage). La cellule
 * totalCell doit donc etre calculee cote code et ecrite comme valeur statique, jamais laissee
 * a un recalcul Excel qui n aura pas lieu (la formule est litteralement absente du fichier
 * de sortie, pas juste "en attente de recalcul").
 *
 * track "NON_COUVERT" = "Anglais Renforce", gap confirme non modelise dans ZekoulABia
 * (ni pebsFiliere, ni lv2SubjectId ne le couvrent) -- decision actee : cellule laissee
 * vide, signalee dans le rapport d accompagnement comme pour un gap RH classique.
 */

export type EsgTrack =
  | 'GENERAL'
  | 'BILINGUE'
  | 'LV2'
  | 'LV2_AUTRES'
  | 'SERIE'
  | 'SERIE_RESIDUELLE'
  | 'NON_COUVERT';

export interface EsgLevelMeta {
  niveau: string;
  serie?: string;
  track: EsgTrack;
  lv2?: 'ESP' | 'ALL' | 'ARABE' | 'CHINOIS' | 'ITALIEN';
  serieExclues?: string[];
}

export interface EsgFieldEntry {
  fieldCode: string;
  kind: 'DIVISIONS' | 'TOTAL_ELEVES' | 'REDOUBLANTS';
  levelLabel: string;
  cell?: string; // pour kind === 'DIVISIONS'
  totalCell?: string | null; // cellule "Total" (ex-formule Excel, jamais preservee a l ecriture BIFF8 -- doit etre calculee et ecrite comme valeur statique)
  fillesCell?: string;
  garconsCell?: string;
  meta: EsgLevelMeta;
}
export const ESG_FIELD_MAPPING: EsgFieldEntry[] = [
  {
    "fieldCode": "2120",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "6ème",
    "fillesCell": "D43",
    "garconsCell": "E43",
    "meta": {
      "niveau": "6e",
      "track": "GENERAL"
    },
    "totalCell": "F43"
  },
  {
    "fieldCode": "2121",
    "kind": "REDOUBLANTS",
    "levelLabel": "6ème",
    "fillesCell": "D44",
    "garconsCell": "E44",
    "meta": {
      "niveau": "6e",
      "track": "GENERAL"
    },
    "totalCell": "F44"
  },
  {
    "fieldCode": "2120",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "6ème Bilingue",
    "fillesCell": "G43",
    "garconsCell": "H43",
    "meta": {
      "niveau": "6e",
      "track": "BILINGUE"
    },
    "totalCell": "I43"
  },
  {
    "fieldCode": "2121",
    "kind": "REDOUBLANTS",
    "levelLabel": "6ème Bilingue",
    "fillesCell": "G44",
    "garconsCell": "H44",
    "meta": {
      "niveau": "6e",
      "track": "BILINGUE"
    },
    "totalCell": "I44"
  },
  {
    "fieldCode": "2120",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "5ème",
    "fillesCell": "J43",
    "garconsCell": "K43",
    "meta": {
      "niveau": "5e",
      "track": "GENERAL"
    },
    "totalCell": "L43"
  },
  {
    "fieldCode": "2121",
    "kind": "REDOUBLANTS",
    "levelLabel": "5ème",
    "fillesCell": "J44",
    "garconsCell": "K44",
    "meta": {
      "niveau": "5e",
      "track": "GENERAL"
    },
    "totalCell": "L44"
  },
  {
    "fieldCode": "2120",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "5ème Bilingue",
    "fillesCell": "M43",
    "garconsCell": "N43",
    "meta": {
      "niveau": "5e",
      "track": "BILINGUE"
    },
    "totalCell": "O43"
  },
  {
    "fieldCode": "2121",
    "kind": "REDOUBLANTS",
    "levelLabel": "5ème Bilingue",
    "fillesCell": "M44",
    "garconsCell": "N44",
    "meta": {
      "niveau": "5e",
      "track": "BILINGUE"
    },
    "totalCell": "O44"
  },
  {
    "fieldCode": "2120",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "4ème Esp",
    "fillesCell": "P43",
    "garconsCell": "Q43",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ESP"
    },
    "totalCell": "R43"
  },
  {
    "fieldCode": "2121",
    "kind": "REDOUBLANTS",
    "levelLabel": "4ème Esp",
    "fillesCell": "P44",
    "garconsCell": "Q44",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ESP"
    },
    "totalCell": "R44"
  },
  {
    "fieldCode": "2120",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "4ème All",
    "fillesCell": "S43",
    "garconsCell": "T43",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ALL"
    },
    "totalCell": "U43"
  },
  {
    "fieldCode": "2121",
    "kind": "REDOUBLANTS",
    "levelLabel": "4ème All",
    "fillesCell": "S44",
    "garconsCell": "T44",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ALL"
    },
    "totalCell": "U44"
  },
  {
    "fieldCode": "2119",
    "kind": "DIVISIONS",
    "levelLabel": "6ème",
    "cell": "D41",
    "meta": {
      "niveau": "6e",
      "track": "GENERAL"
    }
  },
  {
    "fieldCode": "2119",
    "kind": "DIVISIONS",
    "levelLabel": "6ème Bilingue",
    "cell": "G41",
    "meta": {
      "niveau": "6e",
      "track": "BILINGUE"
    }
  },
  {
    "fieldCode": "2119",
    "kind": "DIVISIONS",
    "levelLabel": "5ème",
    "cell": "J41",
    "meta": {
      "niveau": "5e",
      "track": "GENERAL"
    }
  },
  {
    "fieldCode": "2119",
    "kind": "DIVISIONS",
    "levelLabel": "5ème Bilingue",
    "cell": "M41",
    "meta": {
      "niveau": "5e",
      "track": "BILINGUE"
    }
  },
  {
    "fieldCode": "2119",
    "kind": "DIVISIONS",
    "levelLabel": "4ème Esp",
    "cell": "P41",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ESP"
    }
  },
  {
    "fieldCode": "2119",
    "kind": "DIVISIONS",
    "levelLabel": "4ème All",
    "cell": "S41",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ALL"
    }
  },
  {
    "fieldCode": "2123",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "4ème Bilingue",
    "fillesCell": "D49",
    "garconsCell": "E49",
    "meta": {
      "niveau": "4e",
      "track": "BILINGUE"
    },
    "totalCell": "F49"
  },
  {
    "fieldCode": "2124",
    "kind": "REDOUBLANTS",
    "levelLabel": "4ème Bilingue",
    "fillesCell": "D50",
    "garconsCell": "E50",
    "meta": {
      "niveau": "4e",
      "track": "BILINGUE"
    },
    "totalCell": "F50"
  },
  {
    "fieldCode": "2123",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "4ème Ang Renforcé",
    "fillesCell": "G49",
    "garconsCell": "H49",
    "meta": {
      "niveau": "4e",
      "track": "NON_COUVERT"
    },
    "totalCell": "I49"
  },
  {
    "fieldCode": "2124",
    "kind": "REDOUBLANTS",
    "levelLabel": "4ème Ang Renforcé",
    "fillesCell": "G50",
    "garconsCell": "H50",
    "meta": {
      "niveau": "4e",
      "track": "NON_COUVERT"
    },
    "totalCell": "I50"
  },
  {
    "fieldCode": "2123",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "4ème Arabe",
    "fillesCell": "J49",
    "garconsCell": "K49",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ARABE"
    },
    "totalCell": "L49"
  },
  {
    "fieldCode": "2124",
    "kind": "REDOUBLANTS",
    "levelLabel": "4ème Arabe",
    "fillesCell": "J50",
    "garconsCell": "K50",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ARABE"
    },
    "totalCell": "L50"
  },
  {
    "fieldCode": "2123",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "4ème Chinois",
    "fillesCell": "M49",
    "garconsCell": "N49",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "CHINOIS"
    },
    "totalCell": "O49"
  },
  {
    "fieldCode": "2124",
    "kind": "REDOUBLANTS",
    "levelLabel": "4ème Chinois",
    "fillesCell": "M50",
    "garconsCell": "N50",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "CHINOIS"
    },
    "totalCell": "O50"
  },
  {
    "fieldCode": "2123",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "4ème Italien",
    "fillesCell": "P49",
    "garconsCell": "Q49",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ITALIEN"
    },
    "totalCell": "R49"
  },
  {
    "fieldCode": "2124",
    "kind": "REDOUBLANTS",
    "levelLabel": "4ème Italien",
    "fillesCell": "P50",
    "garconsCell": "Q50",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ITALIEN"
    },
    "totalCell": "R50"
  },
  {
    "fieldCode": "2123",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "4ème Autres",
    "fillesCell": "S49",
    "garconsCell": "T49",
    "meta": {
      "niveau": "4e",
      "track": "LV2_AUTRES"
    },
    "totalCell": "U49"
  },
  {
    "fieldCode": "2124",
    "kind": "REDOUBLANTS",
    "levelLabel": "4ème Autres",
    "fillesCell": "S50",
    "garconsCell": "T50",
    "meta": {
      "niveau": "4e",
      "track": "LV2_AUTRES"
    },
    "totalCell": "U50"
  },
  {
    "fieldCode": "2122",
    "kind": "DIVISIONS",
    "levelLabel": "4ème Bilingue",
    "cell": "D47",
    "meta": {
      "niveau": "4e",
      "track": "BILINGUE"
    }
  },
  {
    "fieldCode": "2122",
    "kind": "DIVISIONS",
    "levelLabel": "4ème Ang Renforcé",
    "cell": "G47",
    "meta": {
      "niveau": "4e",
      "track": "NON_COUVERT"
    }
  },
  {
    "fieldCode": "2122",
    "kind": "DIVISIONS",
    "levelLabel": "4ème Arabe",
    "cell": "J47",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ARABE"
    }
  },
  {
    "fieldCode": "2122",
    "kind": "DIVISIONS",
    "levelLabel": "4ème Chinois",
    "cell": "M47",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "CHINOIS"
    }
  },
  {
    "fieldCode": "2122",
    "kind": "DIVISIONS",
    "levelLabel": "4ème Italien",
    "cell": "P47",
    "meta": {
      "niveau": "4e",
      "track": "LV2",
      "lv2": "ITALIEN"
    }
  },
  {
    "fieldCode": "2122",
    "kind": "DIVISIONS",
    "levelLabel": "4ème Autres",
    "cell": "S47",
    "meta": {
      "niveau": "4e",
      "track": "LV2_AUTRES"
    }
  },
  {
    "fieldCode": "2126",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "3ème Esp",
    "fillesCell": "D55",
    "garconsCell": "E55",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "ESP"
    },
    "totalCell": "F55"
  },
  {
    "fieldCode": "2127",
    "kind": "REDOUBLANTS",
    "levelLabel": "3ème Esp",
    "fillesCell": "D56",
    "garconsCell": "E56",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "ESP"
    },
    "totalCell": "F56"
  },
  {
    "fieldCode": "2126",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "3ème All",
    "fillesCell": "G55",
    "garconsCell": "H55",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "ALL"
    },
    "totalCell": "I55"
  },
  {
    "fieldCode": "2127",
    "kind": "REDOUBLANTS",
    "levelLabel": "3ème All",
    "fillesCell": "G56",
    "garconsCell": "H56",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "ALL"
    },
    "totalCell": "I56"
  },
  {
    "fieldCode": "2126",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "3ème Bilingue",
    "fillesCell": "J55",
    "garconsCell": "K55",
    "meta": {
      "niveau": "3e",
      "track": "BILINGUE"
    },
    "totalCell": "L55"
  },
  {
    "fieldCode": "2127",
    "kind": "REDOUBLANTS",
    "levelLabel": "3ème Bilingue",
    "fillesCell": "J56",
    "garconsCell": "K56",
    "meta": {
      "niveau": "3e",
      "track": "BILINGUE"
    },
    "totalCell": "L56"
  },
  {
    "fieldCode": "2126",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "3ème Ang Renforcé",
    "fillesCell": "M55",
    "garconsCell": "N55",
    "meta": {
      "niveau": "3e",
      "track": "NON_COUVERT"
    },
    "totalCell": "O55"
  },
  {
    "fieldCode": "2127",
    "kind": "REDOUBLANTS",
    "levelLabel": "3ème Ang Renforcé",
    "fillesCell": "M56",
    "garconsCell": "N56",
    "meta": {
      "niveau": "3e",
      "track": "NON_COUVERT"
    },
    "totalCell": "O56"
  },
  {
    "fieldCode": "2126",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "3ème Arabe",
    "fillesCell": "P55",
    "garconsCell": "Q55",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "ARABE"
    },
    "totalCell": "R55"
  },
  {
    "fieldCode": "2127",
    "kind": "REDOUBLANTS",
    "levelLabel": "3ème Arabe",
    "fillesCell": "P56",
    "garconsCell": "Q56",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "ARABE"
    },
    "totalCell": "R56"
  },
  {
    "fieldCode": "2126",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "3ème Chinois",
    "fillesCell": "S55",
    "garconsCell": "T55",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "CHINOIS"
    },
    "totalCell": "U55"
  },
  {
    "fieldCode": "2127",
    "kind": "REDOUBLANTS",
    "levelLabel": "3ème Chinois",
    "fillesCell": "S56",
    "garconsCell": "T56",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "CHINOIS"
    },
    "totalCell": "U56"
  },
  {
    "fieldCode": "2125",
    "kind": "DIVISIONS",
    "levelLabel": "3ème Esp",
    "cell": "D53",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "ESP"
    }
  },
  {
    "fieldCode": "2125",
    "kind": "DIVISIONS",
    "levelLabel": "3ème All",
    "cell": "G53",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "ALL"
    }
  },
  {
    "fieldCode": "2125",
    "kind": "DIVISIONS",
    "levelLabel": "3ème Bilingue",
    "cell": "J53",
    "meta": {
      "niveau": "3e",
      "track": "BILINGUE"
    }
  },
  {
    "fieldCode": "2125",
    "kind": "DIVISIONS",
    "levelLabel": "3ème Ang Renforcé",
    "cell": "M53",
    "meta": {
      "niveau": "3e",
      "track": "NON_COUVERT"
    }
  },
  {
    "fieldCode": "2125",
    "kind": "DIVISIONS",
    "levelLabel": "3ème Arabe",
    "cell": "P53",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "ARABE"
    }
  },
  {
    "fieldCode": "2125",
    "kind": "DIVISIONS",
    "levelLabel": "3ème Chinois",
    "cell": "S53",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "CHINOIS"
    }
  },
  {
    "fieldCode": "2129",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "3ème Italien",
    "fillesCell": "D61",
    "garconsCell": "E61",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "ITALIEN"
    },
    "totalCell": "F61"
  },
  {
    "fieldCode": "2130",
    "kind": "REDOUBLANTS",
    "levelLabel": "3ème Italien",
    "fillesCell": "D62",
    "garconsCell": "E62",
    "meta": {
      "niveau": "3e",
      "track": "LV2",
      "lv2": "ITALIEN"
    },
    "totalCell": "F62"
  },
  {
    "fieldCode": "2129",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "3ème Autres",
    "fillesCell": "G61",
    "garconsCell": "H61",
    "meta": {
      "niveau": "3e",
      "track": "LV2_AUTRES"
    },
    "totalCell": "I61"
  },
  {
    "fieldCode": "2130",
    "kind": "REDOUBLANTS",
    "levelLabel": "3ème Autres",
    "fillesCell": "G62",
    "garconsCell": "H62",
    "meta": {
      "niveau": "3e",
      "track": "LV2_AUTRES"
    },
    "totalCell": "I62"
  },
  {
    "fieldCode": "2135",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "2nde A4 All",
    "fillesCell": "D82",
    "garconsCell": "E82",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ALL"
    },
    "totalCell": "F82"
  },
  {
    "fieldCode": "2136",
    "kind": "REDOUBLANTS",
    "levelLabel": "2nde A4 All",
    "fillesCell": "D83",
    "garconsCell": "E83",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ALL"
    },
    "totalCell": "F83"
  },
  {
    "fieldCode": "2135",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "2nde A4 Esp",
    "fillesCell": "G82",
    "garconsCell": "H82",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ESP"
    },
    "totalCell": "I82"
  },
  {
    "fieldCode": "2136",
    "kind": "REDOUBLANTS",
    "levelLabel": "2nde A4 Esp",
    "fillesCell": "G83",
    "garconsCell": "H83",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ESP"
    },
    "totalCell": "I83"
  },
  {
    "fieldCode": "2135",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "2nde A Bilingue",
    "fillesCell": "J82",
    "garconsCell": "K82",
    "meta": {
      "niveau": "2nde",
      "serie": "ABI",
      "track": "BILINGUE"
    },
    "totalCell": "L82"
  },
  {
    "fieldCode": "2136",
    "kind": "REDOUBLANTS",
    "levelLabel": "2nde A Bilingue",
    "fillesCell": "J83",
    "garconsCell": "K83",
    "meta": {
      "niveau": "2nde",
      "serie": "ABI",
      "track": "BILINGUE"
    },
    "totalCell": "L83"
  },
  {
    "fieldCode": "2135",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "2nde Ang Renforcé",
    "fillesCell": "M82",
    "garconsCell": "N82",
    "meta": {
      "niveau": "2nde",
      "track": "NON_COUVERT"
    },
    "totalCell": "O82"
  },
  {
    "fieldCode": "2136",
    "kind": "REDOUBLANTS",
    "levelLabel": "2nde Ang Renforcé",
    "fillesCell": "M83",
    "garconsCell": "N83",
    "meta": {
      "niveau": "2nde",
      "track": "NON_COUVERT"
    },
    "totalCell": "O83"
  },
  {
    "fieldCode": "2135",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "2nde Arabe",
    "fillesCell": "P82",
    "garconsCell": "Q82",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ARABE"
    },
    "totalCell": "R82"
  },
  {
    "fieldCode": "2136",
    "kind": "REDOUBLANTS",
    "levelLabel": "2nde Arabe",
    "fillesCell": "P83",
    "garconsCell": "Q83",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ARABE"
    },
    "totalCell": "R83"
  },
  {
    "fieldCode": "2135",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "2nde Chinois",
    "fillesCell": "S82",
    "garconsCell": "T82",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "CHINOIS"
    },
    "totalCell": "U82"
  },
  {
    "fieldCode": "2136",
    "kind": "REDOUBLANTS",
    "levelLabel": "2nde Chinois",
    "fillesCell": "S83",
    "garconsCell": "T83",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "CHINOIS"
    },
    "totalCell": "U83"
  },
  {
    "fieldCode": "2134",
    "kind": "DIVISIONS",
    "levelLabel": "2nde A4 All",
    "cell": "D80",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ALL"
    }
  },
  {
    "fieldCode": "2134",
    "kind": "DIVISIONS",
    "levelLabel": "2nde A4 Esp",
    "cell": "G80",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ESP"
    }
  },
  {
    "fieldCode": "2134",
    "kind": "DIVISIONS",
    "levelLabel": "2nde A Bilingue",
    "cell": "J80",
    "meta": {
      "niveau": "2nde",
      "serie": "ABI",
      "track": "BILINGUE"
    }
  },
  {
    "fieldCode": "2134",
    "kind": "DIVISIONS",
    "levelLabel": "2nde Ang Renforcé",
    "cell": "M80",
    "meta": {
      "niveau": "2nde",
      "track": "NON_COUVERT"
    }
  },
  {
    "fieldCode": "2134",
    "kind": "DIVISIONS",
    "levelLabel": "2nde Arabe",
    "cell": "P80",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ARABE"
    }
  },
  {
    "fieldCode": "2134",
    "kind": "DIVISIONS",
    "levelLabel": "2nde Chinois",
    "cell": "S80",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "CHINOIS"
    }
  },
  {
    "fieldCode": "2138",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "2nde Italien",
    "fillesCell": "D88",
    "garconsCell": "E88",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ITALIEN"
    },
    "totalCell": "F88"
  },
  {
    "fieldCode": "2139",
    "kind": "REDOUBLANTS",
    "levelLabel": "2nde Italien",
    "fillesCell": "D89",
    "garconsCell": "E89",
    "meta": {
      "niveau": "2nde",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ITALIEN"
    },
    "totalCell": "F89"
  },
  {
    "fieldCode": "2138",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "2nde C",
    "fillesCell": "G88",
    "garconsCell": "H88",
    "meta": {
      "niveau": "2nde",
      "serie": "C",
      "track": "SERIE"
    },
    "totalCell": "I88"
  },
  {
    "fieldCode": "2139",
    "kind": "REDOUBLANTS",
    "levelLabel": "2nde C",
    "fillesCell": "G89",
    "garconsCell": "H89",
    "meta": {
      "niveau": "2nde",
      "serie": "C",
      "track": "SERIE"
    },
    "totalCell": "I89"
  },
  {
    "fieldCode": "2138",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Autres 2nde",
    "fillesCell": "J88",
    "garconsCell": "K88",
    "meta": {
      "niveau": "2nde",
      "track": "SERIE_RESIDUELLE",
      "serieExclues": [
        "A4",
        "ABI",
        "C"
      ]
    },
    "totalCell": "L88"
  },
  {
    "fieldCode": "2139",
    "kind": "REDOUBLANTS",
    "levelLabel": "Autres 2nde",
    "fillesCell": "J89",
    "garconsCell": "K89",
    "meta": {
      "niveau": "2nde",
      "track": "SERIE_RESIDUELLE",
      "serieExclues": [
        "A4",
        "ABI",
        "C"
      ]
    },
    "totalCell": "L89"
  },
  {
    "fieldCode": "2138",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "1ère A4 All",
    "fillesCell": "M88",
    "garconsCell": "N88",
    "meta": {
      "niveau": "1ere",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ALL"
    },
    "totalCell": "O88"
  },
  {
    "fieldCode": "2139",
    "kind": "REDOUBLANTS",
    "levelLabel": "1ère A4 All",
    "fillesCell": "M89",
    "garconsCell": "N89",
    "meta": {
      "niveau": "1ere",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ALL"
    },
    "totalCell": "O89"
  },
  {
    "fieldCode": "2138",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "1ère A4 Esp",
    "fillesCell": "P88",
    "garconsCell": "Q88",
    "meta": {
      "niveau": "1ere",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ESP"
    },
    "totalCell": "R88"
  },
  {
    "fieldCode": "2139",
    "kind": "REDOUBLANTS",
    "levelLabel": "1ère A4 Esp",
    "fillesCell": "P89",
    "garconsCell": "Q89",
    "meta": {
      "niveau": "1ere",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ESP"
    },
    "totalCell": "R89"
  },
  {
    "fieldCode": "2138",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "1èreA Bilingue",
    "fillesCell": "S88",
    "garconsCell": "T88",
    "meta": {
      "niveau": "1ere",
      "serie": "ABI",
      "track": "BILINGUE"
    },
    "totalCell": "U88"
  },
  {
    "fieldCode": "2139",
    "kind": "REDOUBLANTS",
    "levelLabel": "1èreA Bilingue",
    "fillesCell": "S89",
    "garconsCell": "T89",
    "meta": {
      "niveau": "1ere",
      "serie": "ABI",
      "track": "BILINGUE"
    },
    "totalCell": "U89"
  },
  {
    "fieldCode": "2141",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "1ère Ang Renforcé",
    "fillesCell": "D94",
    "garconsCell": "E94",
    "meta": {
      "niveau": "1ere",
      "track": "NON_COUVERT"
    },
    "totalCell": "F94"
  },
  {
    "fieldCode": "2142",
    "kind": "REDOUBLANTS",
    "levelLabel": "1ère Ang Renforcé",
    "fillesCell": "D95",
    "garconsCell": "E95",
    "meta": {
      "niveau": "1ere",
      "track": "NON_COUVERT"
    },
    "totalCell": "F95"
  },
  {
    "fieldCode": "2141",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "1ère Arabe",
    "fillesCell": "G94",
    "garconsCell": "H94",
    "meta": {
      "niveau": "1ere",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ARABE"
    },
    "totalCell": "I94"
  },
  {
    "fieldCode": "2142",
    "kind": "REDOUBLANTS",
    "levelLabel": "1ère Arabe",
    "fillesCell": "G95",
    "garconsCell": "H95",
    "meta": {
      "niveau": "1ere",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ARABE"
    },
    "totalCell": "I95"
  },
  {
    "fieldCode": "2141",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "1ère Chinois",
    "fillesCell": "J94",
    "garconsCell": "K94",
    "meta": {
      "niveau": "1ere",
      "serie": "A4",
      "track": "LV2",
      "lv2": "CHINOIS"
    },
    "totalCell": "L94"
  },
  {
    "fieldCode": "2142",
    "kind": "REDOUBLANTS",
    "levelLabel": "1ère Chinois",
    "fillesCell": "J95",
    "garconsCell": "K95",
    "meta": {
      "niveau": "1ere",
      "serie": "A4",
      "track": "LV2",
      "lv2": "CHINOIS"
    },
    "totalCell": "L95"
  },
  {
    "fieldCode": "2141",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "1ère Italien",
    "fillesCell": "M94",
    "garconsCell": "N94",
    "meta": {
      "niveau": "1ere",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ITALIEN"
    },
    "totalCell": "O94"
  },
  {
    "fieldCode": "2142",
    "kind": "REDOUBLANTS",
    "levelLabel": "1ère Italien",
    "fillesCell": "M95",
    "garconsCell": "N95",
    "meta": {
      "niveau": "1ere",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ITALIEN"
    },
    "totalCell": "O95"
  },
  {
    "fieldCode": "2141",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "1ère C",
    "fillesCell": "P94",
    "garconsCell": "Q94",
    "meta": {
      "niveau": "1ere",
      "serie": "C",
      "track": "SERIE"
    },
    "totalCell": "R94"
  },
  {
    "fieldCode": "2142",
    "kind": "REDOUBLANTS",
    "levelLabel": "1ère C",
    "fillesCell": "P95",
    "garconsCell": "Q95",
    "meta": {
      "niveau": "1ere",
      "serie": "C",
      "track": "SERIE"
    },
    "totalCell": "R95"
  },
  {
    "fieldCode": "2141",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "1ère D",
    "fillesCell": "S94",
    "garconsCell": "T94",
    "meta": {
      "niveau": "1ere",
      "serie": "D",
      "track": "SERIE"
    },
    "totalCell": "U94"
  },
  {
    "fieldCode": "2142",
    "kind": "REDOUBLANTS",
    "levelLabel": "1ère D",
    "fillesCell": "S95",
    "garconsCell": "T95",
    "meta": {
      "niveau": "1ere",
      "serie": "D",
      "track": "SERIE"
    },
    "totalCell": "U95"
  },
  {
    "fieldCode": "2144",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "1ère TI",
    "fillesCell": "D100",
    "garconsCell": "E100",
    "meta": {
      "niveau": "1ere",
      "serie": "TI",
      "track": "SERIE"
    },
    "totalCell": "F100"
  },
  {
    "fieldCode": "2145",
    "kind": "REDOUBLANTS",
    "levelLabel": "1ère TI",
    "fillesCell": "D101",
    "garconsCell": "E101",
    "meta": {
      "niveau": "1ere",
      "serie": "TI",
      "track": "SERIE"
    },
    "totalCell": "F101"
  },
  {
    "fieldCode": "2144",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Autres 1ère",
    "fillesCell": "G100",
    "garconsCell": "H100",
    "meta": {
      "niveau": "1ere",
      "track": "SERIE_RESIDUELLE",
      "serieExclues": [
        "A4",
        "ABI",
        "C",
        "D",
        "TI"
      ]
    },
    "totalCell": "I100"
  },
  {
    "fieldCode": "2145",
    "kind": "REDOUBLANTS",
    "levelLabel": "Autres 1ère",
    "fillesCell": "G101",
    "garconsCell": "H101",
    "meta": {
      "niveau": "1ere",
      "track": "SERIE_RESIDUELLE",
      "serieExclues": [
        "A4",
        "ABI",
        "C",
        "D",
        "TI"
      ]
    },
    "totalCell": "I101"
  },
  {
    "fieldCode": "2144",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Terminale A4 All",
    "fillesCell": "J100",
    "garconsCell": "K100",
    "meta": {
      "niveau": "Tle",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ALL"
    },
    "totalCell": "L100"
  },
  {
    "fieldCode": "2145",
    "kind": "REDOUBLANTS",
    "levelLabel": "Terminale A4 All",
    "fillesCell": "J101",
    "garconsCell": "K101",
    "meta": {
      "niveau": "Tle",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ALL"
    },
    "totalCell": "L101"
  },
  {
    "fieldCode": "2144",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Terminale A4 Esp",
    "fillesCell": "M100",
    "garconsCell": "N100",
    "meta": {
      "niveau": "Tle",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ESP"
    },
    "totalCell": "O100"
  },
  {
    "fieldCode": "2145",
    "kind": "REDOUBLANTS",
    "levelLabel": "Terminale A4 Esp",
    "fillesCell": "M101",
    "garconsCell": "N101",
    "meta": {
      "niveau": "Tle",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ESP"
    },
    "totalCell": "O101"
  },
  {
    "fieldCode": "2144",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Terminale A Bilingue",
    "fillesCell": "P100",
    "garconsCell": "Q100",
    "meta": {
      "niveau": "Tle",
      "serie": "ABI",
      "track": "BILINGUE"
    },
    "totalCell": "R100"
  },
  {
    "fieldCode": "2145",
    "kind": "REDOUBLANTS",
    "levelLabel": "Terminale A Bilingue",
    "fillesCell": "P101",
    "garconsCell": "Q101",
    "meta": {
      "niveau": "Tle",
      "serie": "ABI",
      "track": "BILINGUE"
    },
    "totalCell": "R101"
  },
  {
    "fieldCode": "2144",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Terminale Ang Renforcé",
    "fillesCell": "S100",
    "garconsCell": "T100",
    "meta": {
      "niveau": "Tle",
      "track": "NON_COUVERT"
    },
    "totalCell": "U100"
  },
  {
    "fieldCode": "2145",
    "kind": "REDOUBLANTS",
    "levelLabel": "Terminale Ang Renforcé",
    "fillesCell": "S101",
    "garconsCell": "T101",
    "meta": {
      "niveau": "Tle",
      "track": "NON_COUVERT"
    },
    "totalCell": "U101"
  },
  {
    "fieldCode": "2147",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Terminale Arabe",
    "fillesCell": "D106",
    "garconsCell": "E106",
    "meta": {
      "niveau": "Tle",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ARABE"
    },
    "totalCell": "F106"
  },
  {
    "fieldCode": "2148",
    "kind": "REDOUBLANTS",
    "levelLabel": "Terminale Arabe",
    "fillesCell": "D107",
    "garconsCell": "E107",
    "meta": {
      "niveau": "Tle",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ARABE"
    },
    "totalCell": "F107"
  },
  {
    "fieldCode": "2147",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Terminale Chinois",
    "fillesCell": "G106",
    "garconsCell": "H106",
    "meta": {
      "niveau": "Tle",
      "serie": "A4",
      "track": "LV2",
      "lv2": "CHINOIS"
    },
    "totalCell": "I106"
  },
  {
    "fieldCode": "2148",
    "kind": "REDOUBLANTS",
    "levelLabel": "Terminale Chinois",
    "fillesCell": "G107",
    "garconsCell": "H107",
    "meta": {
      "niveau": "Tle",
      "serie": "A4",
      "track": "LV2",
      "lv2": "CHINOIS"
    },
    "totalCell": "I107"
  },
  {
    "fieldCode": "2147",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Terminale Italien",
    "fillesCell": "J106",
    "garconsCell": "K106",
    "meta": {
      "niveau": "Tle",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ITALIEN"
    },
    "totalCell": "L106"
  },
  {
    "fieldCode": "2148",
    "kind": "REDOUBLANTS",
    "levelLabel": "Terminale Italien",
    "fillesCell": "J107",
    "garconsCell": "K107",
    "meta": {
      "niveau": "Tle",
      "serie": "A4",
      "track": "LV2",
      "lv2": "ITALIEN"
    },
    "totalCell": "L107"
  },
  {
    "fieldCode": "2147",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Terminale C",
    "fillesCell": "M106",
    "garconsCell": "N106",
    "meta": {
      "niveau": "Tle",
      "serie": "C",
      "track": "SERIE"
    },
    "totalCell": "O106"
  },
  {
    "fieldCode": "2148",
    "kind": "REDOUBLANTS",
    "levelLabel": "Terminale C",
    "fillesCell": "M107",
    "garconsCell": "N107",
    "meta": {
      "niveau": "Tle",
      "serie": "C",
      "track": "SERIE"
    },
    "totalCell": "O107"
  },
  {
    "fieldCode": "2147",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Terminale D",
    "fillesCell": "P106",
    "garconsCell": "Q106",
    "meta": {
      "niveau": "Tle",
      "serie": "D",
      "track": "SERIE"
    },
    "totalCell": "R106"
  },
  {
    "fieldCode": "2148",
    "kind": "REDOUBLANTS",
    "levelLabel": "Terminale D",
    "fillesCell": "P107",
    "garconsCell": "Q107",
    "meta": {
      "niveau": "Tle",
      "serie": "D",
      "track": "SERIE"
    },
    "totalCell": "R107"
  },
  {
    "fieldCode": "2147",
    "kind": "TOTAL_ELEVES",
    "levelLabel": "Terminale TI",
    "fillesCell": "S106",
    "garconsCell": "T106",
    "meta": {
      "niveau": "Tle",
      "serie": "TI",
      "track": "SERIE"
    },
    "totalCell": "U106"
  },
  {
    "fieldCode": "2148",
    "kind": "REDOUBLANTS",
    "levelLabel": "Terminale TI",
    "fillesCell": "S107",
    "garconsCell": "T107",
    "meta": {
      "niveau": "Tle",
      "serie": "TI",
      "track": "SERIE"
    },
    "totalCell": "U107"
  }
];
