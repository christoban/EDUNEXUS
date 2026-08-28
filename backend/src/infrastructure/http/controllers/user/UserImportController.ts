import type { Request, Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';
import type { ImporterUtilisateursUseCase } from '@application/user/ImporterUtilisateursUseCase';
import { gererErreurUser } from './userAuthHelper';

export class UserImportController {
  constructor(private readonly importer: ImporterUtilisateursUseCase) {}

  // POST /api/v2/users/import
  importUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role = req.body.role as string;
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({ success: false, message: 'Fichier requis (.xlsx ou .xls)' });
        return;
      }
      if (role !== 'STUDENT' && role !== 'TEACHER') {
        res.status(400).json({ success: false, message: "role doit être 'STUDENT' ou 'TEACHER'" });
        return;
      }

      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rowsJson = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      const rows = rowsJson.map((r, i) => ({
        ligne: i + 2,
        nom: String(r.nom || '').trim(),
        prenom: String(r.prenom || '').trim(),
        email: String(r.email || '').trim(),
        telephone: String(r.telephone || '').trim(),
        matricule: String(r.matricule || '').trim(),
        dateNaissance: String(r.date_naissance || '').trim(),
        sexe: String(r.sexe ?? r.genre ?? r.sex ?? '').trim(),
        classe: String(r.classe || '').trim(),
        nomParent: String(r.nom_parent || '').trim(),
        prenomParent: String(r.prenom_parent || '').trim(),
        emailParent: String(r.email_parent || '').trim(),
        telephoneParent: String(r.telephone_parent || '').trim(),
        matieres: String(r.matieres || '').trim(),
        classePrincipale: String(r.classe_principale || '').trim(),
        pebs: String(r.pebs ?? r.PEBS ?? '').trim(),
        lv2: String(r.lv2 ?? r.LV2 ?? '').trim(),
      }));

      if (rows.length === 0) {
        res.status(400).json({ success: false, message: 'Aucune ligne trouvée dans le fichier' });
        return;
      }

      const resultat = await this.importer.execute(user.schoolId, rows, role as 'STUDENT' | 'TEACHER');

      res.json({ success: true, data: resultat });
    } catch (error) {
      gererErreurUser(error, res, next);
    }
  };
}
