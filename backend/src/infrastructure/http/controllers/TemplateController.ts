import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

export class TemplateController {
  constructor(private prisma: PrismaClient) {}

  importEleves = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classes = await this.prisma.class.findMany({
        where: { schoolId },
        select: { name: true },
        orderBy: { name: 'asc' },
      });

      const wb = XLSX.utils.book_new();

      const headers = ['matricule', 'nom', 'prenom', 'date_naissance', 'classe', 'email_parent', 'telephone_parent'];
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ['2025001', 'NGONO', 'Marie', '15/03/2010', '6e A', 'parent@email.cm', '+237690000001'],
        ['', 'ESSOMBA', 'Jean', '22/07/2009', '5e B', '', '+237690000002'],
        ['2025003', 'BELA', 'Paul', '10/01/2011', '6e A', 'paul.parent@email.cm', ''],
      ]);

      ws['!cols'] = headers.map(() => ({ wch: 18 }));

      XLSX.utils.book_append_sheet(wb, ws, 'Élèves');

      const ws2 = XLSX.utils.aoa_to_sheet([
        ['INSTRUCTIONS — Import des élèves'],
        [''],
        ['Colonnes obligatoires : nom, prenom'],
        ['Colonnes recommandées : matricule, date_naissance, classe'],
        ['Colonnes optionnelles : email_parent, telephone_parent'],
        [''],
        ['Format date : JJ/MM/AAAA (ex: 15/03/2010)'],
        ['Format téléphone : +237XXXXXXXXX (9 chiffres après +237)'],
        ['Email parent : optionnel, mais recommandé pour lier le parent automatiquement'],
        [''],
        ['Classes disponibles dans votre établissement :'],
        ...classes.map(c => [`  • ${c.name}`]),
        [''],
        ['Important :'],
        ['  • Les lignes grisées sont des exemples — supprimez-les avant import'],
        ['  • Le matricule peut être laissé vide (généré automatiquement)'],
        ['  • Si email_parent est fourni, un compte parent sera créé automatiquement'],
        ['  • Les élèves et parents recevront un email avec leur identifiant'],
      ]);
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
      const subjects = await this.prisma.subject.findMany({
        where: { schoolId },
        select: { name: true },
        orderBy: { name: 'asc' },
      });

      const wb = XLSX.utils.book_new();

      const headers = ['nom', 'prenom', 'email', 'telephone', 'matieres'];
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ['NGONO', 'Jean', 'jean.ngono@lycee.cm', '+237690000001', 'Mathématiques,Physique-Chimie'],
        ['ESSOMBA', 'Marie', 'marie.essomba@lycee.cm', '', 'Français,Histoire-Géographie'],
        ['BELA', 'Paul', 'paul.bela@lycee.cm', '+237690000003', 'SVT'],
      ]);

      ws['!cols'] = headers.map(() => ({ wch: 22 }));

      XLSX.utils.book_append_sheet(wb, ws, 'Enseignants');

      const ws2 = XLSX.utils.aoa_to_sheet([
        ['INSTRUCTIONS — Import des enseignants'],
        [''],
        ['Colonnes obligatoires : nom, prenom, email'],
        ['Colonnes optionnelles : telephone, matieres'],
        [''],
        ['Email : obligatoire — l\'enseignant recevra son invitation par email'],
        ['Format téléphone : +237XXXXXXXXX (9 chiffres après +237)'],
        [''],
        ['Colonne "matieres" :'],
        ['  Séparez les matières par des virgules'],
        ['  Exemple : "Mathématiques,Physique-Chimie,SVT"'],
        [''],
        ['Matières disponibles dans votre établissement :'],
        ...subjects.map(s => [`  • ${s.name}`]),
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
