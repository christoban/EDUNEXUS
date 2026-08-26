import type { Request, Response, NextFunction } from 'express';
import type { SaisirNoteUseCase } from '@application/grade/SaisirNoteUseCase';
import type { SoumettreNoteUseCase } from '@application/grade/SoumettreNoteUseCase';
import type { ValiderNoteUseCase } from '@application/grade/ValiderNoteUseCase';
import type { RejeterNoteUseCase } from '@application/grade/RejeterNoteUseCase';
import type { ValiderEnBlocUseCase } from '@application/grade/ValiderEnBlocUseCase';
import type { ModifierNoteUseCase } from '@application/grade/ModifierNoteUseCase';
import type { DraftEnMasseUseCase } from '@application/grade/DraftEnMasseUseCase';
import type { ListerNotesUseCase } from '@application/grade/ListerNotesUseCase';
import type { ListerNotesEnAttenteUseCase } from '@application/grade/ListerNotesEnAttenteUseCase';
import type { StatutParClasseUseCase } from '@application/grade/StatutParClasseUseCase';
import type { CalculerMoyenneUseCase } from '@application/grade/CalculerMoyenneUseCase';
import type { ImporterNotesExcelUseCase } from '@application/grade/ImporterNotesExcelUseCase';
import { validerSaisirNoteDto } from '@infrastructure/http/dto/grade.dto';
import { BulletinBloqueError } from '@domain/errors/BulletinBloqueError';
import { ConseilBloqueError } from '@domain/errors/ConseilBloqueError';
import { NoteValideeSyncError } from '@domain/errors/NoteValideeSyncError';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import { logActivity } from '../../services/audit/ActivityLogService';
import { resolveLanguage } from '../../../domain/policies/LanguagePolicy';
import type { UserRole, StaffPermissionType } from '@domain/types/enums';
import { inngest } from '../../inngest/client/index.ts';
import * as XLSX from 'xlsx';

// ponytail: genererTemplate et soumettreEnMasse conservent encore des appels Prisma directs
// car les données qu'ils accèdent (profils élèves par classe, query bulk par filtres composites)
// n'ont pas encore de repository dédié. À extraire quand un Use Case sera créé pour chacun.

export class GradeController {
  constructor(
    private readonly saisirNote: SaisirNoteUseCase,
    private readonly soumettreNote: SoumettreNoteUseCase,
    private readonly validerNote: ValiderNoteUseCase,
    private readonly rejeterNote: RejeterNoteUseCase,
    private readonly validerEnBloc: ValiderEnBlocUseCase,
    private readonly modifierNote: ModifierNoteUseCase,
    private readonly draftEnMasseUC: DraftEnMasseUseCase,
    private readonly listerNotes: ListerNotesUseCase,
    private readonly listerNotesEnAttente: ListerNotesEnAttenteUseCase,
    private readonly statutParClasseUC: StatutParClasseUseCase,
    private readonly calculerMoyenneUC: CalculerMoyenneUseCase,
    private readonly importerNotesExcel: ImporterNotesExcelUseCase,
    private readonly schoolRepository: SchoolRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly matiereRepository: MatiereRepository,
  ) {}

  // POST /api/v2/grades
  saisir = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = validerSaisirNoteDto(req.body);
      const user = req.user;

      const resultat = await this.saisirNote.execute({
        schoolId: user.schoolId,
        academicYearId: req.body.academicYearId,
        recordedById: user.userId,
        ...dto,
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/grades/:id/submit
  soumettre = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.soumettreNote.execute({
        noteId: req.params.id as string,
        demandeurId: user.userId,
        schoolId: user.schoolId,
      });
      res.json({ success: true, message: 'Note soumise pour validation' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/grades/:id/validate
  valider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.validerNote.execute({
        noteId: req.params.id as string,
        validateurId: user.userId,
        schoolId: user.schoolId,
      });

      // Déclenche la détection de chute par matière (Phase 3) — fire-and-forget, ne bloque
      // jamais la réponse de validation même si l'envoi de l'événement échoue.
      // NOTE: ce lookup reste via Prisma car le NoteRepository ne retourne pas les
      // champs subjectId/schoolId/sequenceId du domaine brut. À remplacer quand le
      // use case validerNote retournera ces champs.
      const { prisma } = await import('@infrastructure/persistence/prisma/prisma.client');
      const grade = await prisma.grade.findUnique({
        where: { id: req.params.id as string },
        select: { studentId: true, subjectId: true, schoolId: true, sequenceId: true },
      }).catch(() => null);
      if (grade) {
        void inngest.send({
          name: 'grade/validated',
          data: { gradeId: req.params.id as string, ...grade },
        }).catch((err) => console.error('[GradeController] Échec envoi grade/validated:', err?.message));
      }

      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Note validée', details: `Note ${req.params.id} validée` });

      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/grades/:id/reject
  rejeter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { motif } = req.body;
      if (!motif) {
        res.status(400).json({ success: false, message: 'Le motif de rejet est obligatoire' });
        return;
      }
      const user = req.user;
      const school = await this.schoolRepository.findById(user.schoolId);
      const lang = resolveLanguage(school?.subsystem);
      await this.rejeterNote.execute({
        noteId: req.params.id as string,
        validateurId: user.userId,
        motif,
        lang,
        schoolId: user.schoolId,
      });
      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Note rejetée', details: `Note ${req.params.id} rejetée : ${motif}` });
      res.json({ success: true, message: 'Note rejetée — enseignant notifié' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/grades/bulk-validate
  validerTout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { classId, sequenceId } = req.body;
      if (!classId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId et sequenceId requis' });
        return;
      }
      const user = req.user;
      const resultat = await this.validerEnBloc.execute({
        classId,
        sequenceId,
        validateurId: user.userId,
      });

      // UN SEUL événement pour tout le lot (pas un par note) : un enseignant qui
      // valide toute une classe d'un coup ne doit recevoir qu'UNE seule notification
      // groupée, pas un push par élève détecté (relecture juillet 2026).
      if (resultat.gradesValidees.length > 0) {
        void inngest.send({
          name: 'grade/validated-batch',
          data: {
            schoolId: resultat.gradesValidees[0]!.schoolId,
            grades: resultat.gradesValidees.map((g) => ({ studentId: g.studentId, subjectId: g.subjectId, sequenceId: g.sequenceId })),
          },
        }).catch((err) => console.error('[GradeController] Échec envoi grade/validated-batch:', err?.message));
      }

      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Notes validées en masse', details: `Classe ${classId}, séquence ${sequenceId} : ${resultat.gradesValidees.length} notes` });

      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/grades/draft — sauvegarde en masse (upsert)
  draftEnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, sequenceId, grades } = req.body;

      if (!classId || !subjectId || !sequenceId || !grades?.length) {
        res.status(400).json({ success: false, message: 'classId, subjectId, sequenceId et grades sont requis' });
        return;
      }

      // Résolution de l'année académique via la séquence (2 requêtes repository
      // au lieu d'un Prisma include — supprime l'import Prisma de ce handler).
      const sequence = await this.anneeRepository.findSequenceById(sequenceId, user.schoolId);
      if (!sequence) {
        res.status(400).json({
          success: false,
          message: `Séquence introuvable (id: ${sequenceId}) — impossible de déterminer l'année académique`,
        });
        return;
      }
      const periode = await this.anneeRepository.findPeriodeById(sequence.academicPeriodId, user.schoolId);
      const academicYearId = periode?.academicYearId;

      if (!academicYearId) {
        res.status(400).json({
          success: false,
          message: `Séquence introuvable (id: ${sequenceId}) — impossible de déterminer l'année académique`,
        });
        return;
      }

      const resultat = await this.draftEnMasseUC.execute({
        schoolId: user.schoolId,
        userId: user.userId,
        userRole: user.role,
        classId,
        subjectId,
        sequenceId,
        academicYearId,
        grades: grades.map((g: { studentId: string; value: number; observation?: string }) => ({
          studentId: g.studentId,
          value: Number(g.value),
          observation: g.observation,
        })),
      });

      res.json({ success: true, data: resultat.results, count: resultat.results.length });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/grades/submit — soumettre en masse les brouillons
  // ponytail: non extrait en use case — conflit detection + bulk update restent ici
  // en attendant un SoumettreEnMasseUseCase dédié.
  soumettreEnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, sequenceId, grades: gradesWithVersion, forcerEcrasement } = req.body;

      if (!classId || !subjectId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId, subjectId et sequenceId sont requis' });
        return;
      }

      const { prisma } = await import('@infrastructure/persistence/prisma/prisma.client');

      // Si gradesWithVersion est fourni (sync offline avec détection de conflit V1 §12),
      // vérifier les conflits de version avant de soumettre — SAUF si forcerEcrasement est vrai
      if (Array.isArray(gradesWithVersion) && gradesWithVersion.length > 0 && !forcerEcrasement) {
        const conflicts: {
          studentId: string;
          versionServeur: { updatedAt: string; sequenceScore: number | null };
          versionLocale: { updatedAt: string | null; value: number | null; observation: string | null };
        }[] = [];

        const existingGrades = await prisma.grade.findMany({
          where: {
            schoolId: user.schoolId,
            classId,
            subjectId,
            sequenceId,
            validationStatus: { in: ['DRAFT', 'REJECTED'] },
            recordedById: user.userId,
          },
          select: { id: true, studentId: true, updatedAt: true, sequenceScore: true },
        });

        const existingByStudent = new Map(existingGrades.map(g => [g.studentId, g]));

        for (const gwv of gradesWithVersion) {
          if (!gwv.studentId) continue;
          const existing = existingByStudent.get(gwv.studentId);
          const baseUpdatedAt = gwv.baseUpdatedAt ? new Date(gwv.baseUpdatedAt).getTime() : null;

          if (existing && baseUpdatedAt !== null && existing.updatedAt.getTime() !== baseUpdatedAt) {
            conflicts.push({
              studentId: gwv.studentId,
              versionServeur: { updatedAt: existing.updatedAt.toISOString(), sequenceScore: existing.sequenceScore },
              versionLocale: { updatedAt: gwv.baseUpdatedAt, value: gwv.value ?? null, observation: gwv.observation ?? null },
            });
          }
        }

        if (conflicts.length > 0) {
          res.status(409).json({
            success: false,
            code: 'CONFLIT_VERSION',
            message: 'Conflit de version détecté — une tierce personne a modifié ces notes',
            conflicts,
          });
          return;
        }
      }

      const result = await prisma.grade.updateMany({
        where: {
          schoolId: user.schoolId,
          classId,
          subjectId,
          sequenceId,
          validationStatus: { in: ['DRAFT', 'REJECTED'] },
          recordedById: user.userId,
        },
        data: { validationStatus: 'SUBMITTED', rejectionReason: null },
      });

      if (result.count === 0) {
        res.status(404).json({ success: false, message: 'Aucune note à soumettre (DRAFT ou REJECTED) trouvée pour cette classe/matière/séquence. Vérifie que les notes ont bien été sauvegardées.' });
        return;
      }

      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Notes soumises en masse', details: `Classe ${classId}, matière ${subjectId}, séquence ${sequenceId} : ${result.count} notes` });

      res.json({ success: true, data: { count: result.count } });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, sequenceId, studentId, validationStatus, page = '1', limit = '50' } =
        req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const result = await this.listerNotes.execute({
        schoolId: user.schoolId,
        userId: user.userId,
        userRole: user.role as UserRole,
        userPermissions: user.permissions as StaffPermissionType[],
        filters: {
          classId,
          subjectId,
          sequenceId,
          studentId,
          ...(validationStatus ? { validationStatus } : {}),
        },
        pagination: { page: pageNum, limit: limitNum },
      });

      res.json({
        grades: result.items,
        pagination: { total: result.total, page: result.page, pages: result.pages, limit: result.limit },
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades/pending
  listerEnAttente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const permissions: string[] = user.permissions ?? [];
      const { classId, subjectId, sequenceId } = req.query as Record<string, string>;

      const resultat = await this.listerNotesEnAttente.execute({
        schoolId: user.schoolId,
        userRole: user.role,
        userPermissions: permissions,
        filters: { classId, subjectId, sequenceId },
      });

      res.json({ grades: resultat.grades, grouped: resultat.grouped, total: resultat.total });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades/status/:classId
  statutParClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId } = req.params as { classId: string };
      const { sequenceId } = req.query as { sequenceId?: string };

      const resultat = await this.statutParClasseUC.execute({
        schoolId: user.schoolId,
        classId,
        sequenceId,
      });

      res.json({
        classId: resultat.classId,
        stats: resultat.stats,
        bySubject: resultat.bySubject,
        canGenerateReportCard: resultat.canGenerateReportCard,
        grades: resultat.grades,
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades/average/:studentId
  moyenneEleve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const studentId = req.params.studentId as string;
      const classId = req.query.classId as string | undefined;
      const sequenceId = req.query.sequenceId as string | undefined;

      if (!classId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId et sequenceId sont requis' });
        return;
      }

      const result = await this.calculerMoyenneUC.execute({
        schoolId: user.schoolId,
        studentId,
        classId,
        sequenceId,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v2/grades/:id
  modifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;

      const resultat = await this.modifierNote.execute({
        schoolId: user.schoolId,
        userId: user.userId,
        userRole: user.role,
        gradeId: req.params.id as string,
        sequenceScore: req.body.sequenceScore !== undefined ? Number(req.body.sequenceScore) : undefined,
        classTestScore: req.body.classTestScore !== undefined ? Number(req.body.classTestScore) : undefined,
        terminalExamScore: req.body.terminalExamScore !== undefined ? Number(req.body.terminalExamScore) : undefined,
        theoreticalScore: req.body.theoreticalScore !== undefined ? Number(req.body.theoreticalScore) : undefined,
        practicalScore: req.body.practicalScore !== undefined ? Number(req.body.practicalScore) : undefined,
        professionalAttitude: req.body.professionalAttitude !== undefined ? Number(req.body.professionalAttitude) : undefined,
        oralScore: req.body.oralScore !== undefined ? Number(req.body.oralScore) : undefined,
        selfDevelopmentScore: req.body.selfDevelopmentScore !== undefined ? Number(req.body.selfDevelopmentScore) : undefined,
        maxValue: req.body.maxValue !== undefined ? Number(req.body.maxValue) : undefined,
        seq1Score: req.body.seq1Score !== undefined ? Number(req.body.seq1Score) : undefined,
        seq2Score: req.body.seq2Score !== undefined ? Number(req.body.seq2Score) : undefined,
        compositionScore: req.body.compositionScore !== undefined ? Number(req.body.compositionScore) : undefined,
      });

      res.json({ success: true, grade: { sequenceAverage: resultat.sequenceAverage } });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades/template?classId=&subjectId=&sequenceId=
  // ponytail: génération d'Excel depuis données brutes — pas de use case nécessaire.
  genererTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, sequenceId } = req.query as Record<string, string>;

      if (!classId || !subjectId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId, subjectId et sequenceId sont requis' });
        return;
      }

      const [classe, matiere, sequence] = await Promise.all([
        this.classeRepository.findById(classId),
        this.matiereRepository.findById(subjectId),
        this.anneeRepository.findSequenceById(sequenceId, user.schoolId),
      ]);

      // ponytail: la query studentProfile reste en Prisma — aucun repository ne couvre
      // les profils élèves par classe avec matricule + nom. À extraire si un Use Case
      // template ou un StudentProfileRepository.findByClasse est ajouté.
      const { prisma } = await import('@infrastructure/persistence/prisma/prisma.client');
      const students = await prisma.studentProfile.findMany({
        where: {
          user: { schoolId: user.schoolId },
          enrollmentsYearScoped: { some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } } },
        },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { user: { lastName: 'asc' } },
      });

      const wb = XLSX.utils.book_new();

      const headers = ['matricule', 'nom', 'prenom', 'note (/20)', 'observation'];
      const dataRows = students.map((s) => [
        s.matricule ?? '',
        s.user.lastName,
        s.user.firstName,
        '',
        '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 32 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Notes');

      const ws2 = XLSX.utils.aoa_to_sheet([
        [`Classe : ${classe?.name ?? classId}`],
        [`Matière : ${matiere?.name ?? subjectId}`],
        [`Séquence : ${sequence?.name ?? sequenceId}`],
        [''],
        ['Instructions :'],
        ['  • Remplissez la colonne "note (/20)" pour chaque élève (0 à 20)'],
        ['  • La colonne "observation" est optionnelle'],
        ['  • Ne modifiez pas le matricule, le nom ou le prénom'],
        ['  • Les lignes sans note seront ignorées à l\'import'],
        ['  • Les élèves sans matricule ne peuvent pas être importés'],
        ['  • Ne supprimez pas la première ligne (en-têtes)'],
      ]);
      ws2['!cols'] = [{ wch: 64 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const safeName = (s?: string) => (s ?? '').replace(/[^a-z0-9]/gi, '-');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="notes-${safeName(classe?.name)}-${safeName(matiere?.name)}.xlsx"`,
      );
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/grades/import (multipart/form-data)
  importerDepuisExcel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, sequenceId } = req.body;

      if (!classId || !subjectId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId, subjectId et sequenceId sont requis' });
        return;
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ success: false, message: 'Fichier Excel requis (champ "file")' });
        return;
      }

      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });

      if (rows.length < 2) {
        res.status(400).json({ success: false, message: 'Le fichier est vide ou ne contient pas de données' });
        return;
      }

      const headers = (rows[0] as string[]).map((h) => h.toString().toLowerCase().trim());
      const matriculeIdx = headers.findIndex((h) => h.includes('matricule'));
      const noteIdx = headers.findIndex((h) => h.includes('note'));
      const obsIdx = headers.findIndex((h) => h.includes('observation'));

      if (matriculeIdx === -1 || noteIdx === -1) {
        res.status(400).json({
          success: false,
          message: 'Colonnes "matricule" et "note" introuvables — utilisez le template téléchargé',
        });
        return;
      }

      const sequence = await this.anneeRepository.findSequenceById(sequenceId, user.schoolId);
      if (!sequence) {
        res.status(400).json({ success: false, message: 'Séquence introuvable' });
        return;
      }
      const periode = await this.anneeRepository.findPeriodeById(sequence.academicPeriodId, user.schoolId);
      const academicYearId = periode?.academicYearId;

      const parsedRows: { matricule: string; value: number | null; observation: string; line: number }[] = [];
      const parseErrors: { line: number; matricule: string; error: string }[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const matricule = row[matriculeIdx]?.toString().trim() ?? '';
        const noteRaw = row[noteIdx];
        const observation = obsIdx >= 0 ? (row[obsIdx]?.toString().trim() ?? '') : '';

        if (!matricule && (noteRaw === '' || noteRaw === undefined || noteRaw === null)) continue;

        if (!matricule) {
          parseErrors.push({ line: i + 1, matricule: '', error: 'Matricule manquant' });
          continue;
        }

        if (noteRaw === '' || noteRaw === undefined || noteRaw === null) {
          parsedRows.push({ matricule, value: null, observation, line: i + 1 });
          continue;
        }

        const value = Number(noteRaw);
        if (isNaN(value) || value < 0 || value > 20) {
          parseErrors.push({ line: i + 1, matricule, error: `Note invalide : "${noteRaw}" (doit être entre 0 et 20)` });
          continue;
        }

        parsedRows.push({ matricule, value, observation, line: i + 1 });
      }

      const resultat = await this.importerNotesExcel.execute({
        schoolId: user.schoolId,
        userId: user.userId,
        userRole: user.role,
        classId,
        subjectId,
        sequenceId,
        academicYearId,
        rows: parsedRows,
      });

      res.json({
        success: true,
        imported: resultat.imported,
        updated: resultat.updated,
        errors: [...parseErrors, ...resultat.errors],
        total: parsedRows.length + parseErrors.length,
        skipped: resultat.skipped + parseErrors.length,
      });
    } catch (error) {
      next(error);
    }
  };

  // ─── Helpers privés ───────────────────────────────────────────────────────────

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof NoteValideeSyncError) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof BulletinBloqueError) {
      res.status(422).json({ success: false, message: error.message, notesBloquantes: error.notesBloquantes });
      return;
    }
    if (error instanceof ConseilBloqueError) {
      res.status(422).json({ success: false, message: error.message, notesManquantes: error.notesManquantes });
      return;
    }
    if (error instanceof Error) {
      if (error.message.startsWith('Données invalides')) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('Permission')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
