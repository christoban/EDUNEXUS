import type { Request, Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';

export class TemplateController {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly matiereRepository: MatiereRepository,
  ) {}

  importEleves = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      const [classes, pebsFlags, lv2Subjects] = await Promise.all([
        this.classeRepository.findBySchool(schoolId),
        this.schoolRepository.findPEBSFlags(schoolId),
        this.matiereRepository.findLV2BySchool(schoolId),
      ]);

      const classNames = classes.map((c) => c.name).sort((a, b) => a.localeCompare(b));
      const lv2Names = lv2Subjects.map((s) => s.name).sort((a, b) => a.localeCompare(b));

      const hasPEBS = !!(pebsFlags?.hasPEBSFrancophone || pebsFlags?.hasPEBSAnglophone);

      const baseHeaders = ['matricule', 'nom', 'prenom', 'email', 'date_naissance', 'classe', 'nom_parent', 'prenom_parent', 'email_parent', 'telephone_parent'];
      const baseRow1 = ['2025001', 'NGONO', 'Marie', 'marie.ngono@eleve.cm', '15/03/2010', '6e A', 'NGONO', 'Robert', 'robert.ngono@email.cm', '+237690000001'];
      const baseRow2 = ['', 'ESSOMBA', 'Jean', '', '22/07/2009', '5e B', 'ESSOMBA', 'Cécile', '', '+237690000002'];
      const baseRow3 = ['2025003', 'BELA', 'Paul', 'paul.bela@eleve.cm', '10/01/2011', '6e A', 'BELA', 'Hortense', 'hortense.bela@email.cm', ''];

      const extraHeaders: string[] = [];
      const extraRow1: string[] = [];
      const extraRow2: string[] = [];
      const extraRow3: string[] = [];

      if (hasPEBS) {
        extraHeaders.push('pebs');
        extraRow1.push('FR_PEBS');
        extraRow2.push('');
        extraRow3.push('');
      }
      if (lv2Names.length > 0) {
        extraHeaders.push('lv2');
        extraRow1.push(lv2Names[0]);
        extraRow2.push('');
        extraRow3.push('');
      }

      const headers = [...baseHeaders, ...extraHeaders];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        [...baseRow1, ...extraRow1],
        [...baseRow2, ...extraRow2],
        [...baseRow3, ...extraRow3],
      ]);

      ws['!cols'] = headers.map((h) => ({ wch: h.startsWith('email') ? 28 : h === 'lv2' ? 22 : 18 }));

      XLSX.utils.book_append_sheet(wb, ws, 'Élèves');

      const instrLines: any[][] = [
        ['INSTRUCTIONS — Import des élèves'],
        [''],
        ['Colonnes obligatoires : nom, prenom'],
        ['Colonnes recommandées : matricule, email, date_naissance, classe'],
        ['Colonnes optionnelles : nom_parent, prenom_parent, email_parent, telephone_parent'],
      ];

      if (hasPEBS) {
        instrLines.push(
          [''],
          ['--- COLONNES OPTIONNELLES AVANCÉES ---'],
          [''],
          ['Colonne "pebs" (Programme d\'Éducation Bilingue Spécial) :'],
          ['  Valeurs acceptées : FR_PEBS ou EN_PEBS'],
          ['  Laissez vide pour les élèves non-PEBS'],
        );
      }
      if (lv2Names.length > 0) {
        if (!hasPEBS) instrLines.push([''], ['--- COLONNES OPTIONNELLES AVANCÉES ---']);
        instrLines.push(
          [''],
          ['Colonne "lv2" (Langue Vivante 2) — valeurs acceptées :'],
          ...lv2Names.map(s => [`  • ${s}`]),
          ['  Laissez vide si l\'élève n\'a pas de LV2'],
        );
      }

      instrLines.push(
        [''],
        ['Format date : JJ/MM/AAAA (ex: 15/03/2010)'],
        ['Format téléphone : +237XXXXXXXXX (9 chiffres après +237)'],
        [''],
        ['Classes disponibles dans votre établissement :'],
        ...classNames.map(c => [`  • ${c}`]),
        [''],
        ['Important :'],
        ['  • Les lignes grisées sont des exemples — supprimez-les avant import'],
        ['  • Le matricule peut être laissé vide (généré automatiquement)'],
        ['  • Si email_parent est fourni, un compte parent sera créé automatiquement'],
        ['  • Les élèves et parents recevront un email avec leur identifiant'],
      );

      const ws2 = XLSX.utils.aoa_to_sheet(instrLines);
      ws2['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="import-eleves.xlsx"');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  importEnseignants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const [subjects, classes] = await Promise.all([
        this.matiereRepository.findBySchool(schoolId),
        this.classeRepository.findBySchool(schoolId),
      ]);

      const subjectNames = subjects.map(s => s.name).sort((a, b) => a.localeCompare(b));
      const classNames = classes.map(c => c.name).sort((a, b) => a.localeCompare(b));

      const wb = XLSX.utils.book_new();

      const headers = ['nom', 'prenom', 'email', 'telephone', 'matieres', 'classe_principale'];
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ['NGONO', 'Jean', 'jean.ngono@lycee.cm', '+237690000001', 'Mathématiques,Physique', '6e A'],
        ['ESSOMBA', 'Marie', 'marie.essomba@lycee.cm', '', 'Français,Histoire-Géographie', ''],
        ['BELA', 'Paul', 'paul.bela@lycee.cm', '+237690000003', 'SVTEEHB', ''],
      ]);

      ws['!cols'] = headers.map((_, i) => ({ wch: i >= 5 ? 26 : 22 }));

      XLSX.utils.book_append_sheet(wb, ws, 'Enseignants');

      const ws2 = XLSX.utils.aoa_to_sheet([
        ['INSTRUCTIONS — Import des enseignants'],
        [''],
        ['Colonnes obligatoires : nom, prenom, email'],
        ['Colonnes optionnelles : telephone, matieres, classe_principale'],
        [''],
        ['Email : obligatoire — l\'enseignant recevra son invitation par email'],
        ['Format téléphone : +237XXXXXXXXX (9 chiffres après +237)'],
        [''],
        ['Colonne "matieres" :'],
        ['  Séparez les matières par des virgules'],
        ['  Exemple : "Mathématiques,Physique,SVTEEHB"'],
        [''],
        ['Colonnes optionnelles avancées :'],
        [''],
        ['  classe_principale :'],
        ['    Désigne cet enseignant comme Professeur Principal d\'une classe.'],
        ['    Indiquez le nom exact de la classe (ex: "6e A").'],
        ['    Une seule personne peut être PP par classe.'],
        [''],

        ['Matières disponibles dans votre établissement :'],
        ...subjectNames.map(s => [`  • ${s}`]),
        [''],
        ['Classes disponibles dans votre établissement :'],
        ...classNames.map(c => [`  • ${c}`]),
        [''],
        ['Important :'],
        ['  • Un mot de passe temporaire sera généré automatiquement'],
        ['  • L\'enseignant recevra un email avec son lien de connexion'],
        ['  • Les lignes grisées sont des exemples — supprimez-les avant import'],
      ]);
      ws2['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="import-enseignants.xlsx"');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
