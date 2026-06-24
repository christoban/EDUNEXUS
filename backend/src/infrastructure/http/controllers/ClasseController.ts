import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
import type { ModifierClasseUseCase } from '@application/class/ModifierClasseUseCase';
import type { SupprimerClasseUseCase } from '@application/class/SupprimerClasseUseCase';
import type { AssignerProfesseurPrincipalUseCase } from '@application/class/AssignerProfesseurPrincipalUseCase';
import type { CreerSousGroupeTPUseCase } from '@application/class/CreerSousGroupeTPUseCase';
import type { AssignerElevesAuSousGroupeUseCase } from '@application/class/AssignerElevesAuSousGroupeUseCase';
import { CYCLE2_LEVELS, NIVEAU_MAP, parseSerie } from '@application/school/SubjectAssignmentHelper';

export class ClasseController {
  constructor(
    private readonly creer: CreerClasseUseCase,
    private readonly modifier: ModifierClasseUseCase,
    private readonly supprimer: SupprimerClasseUseCase,
    private readonly assignerProfesseur: AssignerProfesseurPrincipalUseCase,
    private readonly creerSousGroupe: CreerSousGroupeTPUseCase,
    private readonly assignerEleves: AssignerElevesAuSousGroupeUseCase,
    private readonly prisma: PrismaClient,
  ) {}

  creerClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { level, serie } = req.body as { level?: string; serie?: string };

      // Validation : pour le 2nd cycle, la combinaison (niveau, série) doit exister
      // dans les BacCoefficients (source de vérité MINESEC Cameroun)
      if (level && serie && (CYCLE2_LEVELS as string[]).includes(level)) {
        const niveauBac = NIVEAU_MAP[level];
        if (niveauBac) {
          const seriePart = serie.includes('-') ? serie.split('-')[0] : serie;
          const exists = await this.prisma.bacCoefficient.findFirst({
            where: { serie: seriePart, niveau: niveauBac as any },
            select: { id: true },
          });
          if (!exists) {
            res.status(400).json({
              success: false,
              message: `La série "${serie}" n'existe pas au niveau "${level}" dans le programme officiel MINESEC. Vérifiez la combinaison niveau/série.`,
            });
            return;
          }
        }
      }

      const resultat = await this.creer.execute({
        schoolId: user.schoolId,
        ...req.body,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  modifierClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      await this.modifier.execute({
        classeId: req.params.id as string,
        schoolId: user.schoolId,
        ...req.body,
      });
      res.json({ success: true, message: 'Classe mise à jour' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  supprimerClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      await this.supprimer.execute({
        classeId: req.params.id as string,
        schoolId: user.schoolId,
      });
      res.json({ success: true, message: 'Classe supprimée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  assignerProfesseurPrincipal = async (
    req: Request, res: Response, next: NextFunction
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const { teacherUserId } = req.body;
      const classeId = req.params.id as string;

      if (!teacherUserId) {
        res.status(400).json({ success: false, message: 'teacherUserId requis' });
        return;
      }

      // Un PP doit obligatoirement enseigner au moins une matière dans cette classe
      const assignment = await this.prisma.teachingAssignment.findFirst({
        where: { classId: classeId, teacherId: teacherUserId, schoolId: user.schoolId },
        select: { id: true },
      });
      if (!assignment) {
        res.status(400).json({
          success: false,
          code: 'PP_SANS_MATIERE',
          message: 'Cet enseignant n\'enseigne aucune matière dans cette classe. Assignez-lui d\'abord une matière avant de le désigner Professeur Principal.',
        });
        return;
      }

      await this.assignerProfesseur.execute({
        classeId,
        teacherUserId,
        schoolId: user.schoolId,
        demandeurRole: user.role,
      });
      res.json({ success: true, message: 'Professeur Principal assigné' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  creerSousGroupeTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { name } = req.body;

      if (!name) {
        res.status(400).json({ success: false, message: 'name requis (ex: "Groupe A")' });
        return;
      }

      const resultat = await this.creerSousGroupe.execute({
        classeId: req.params.id as string,
        name,
        schoolId: user.schoolId,
        demandeurRole: user.role,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  assignerElevesAuSousGroupe = async (
    req: Request, res: Response, next: NextFunction
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const { studentProfileIds } = req.body;

      const resultat = await this.assignerEleves.execute({
        subGroupId: req.params.subGroupId as string,
        studentProfileIds,
        schoolId: user.schoolId,
        demandeurRole: user.role,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /:classId/subjects — Ajouter ou modifier une matière dans une classe
  // body: { subjectId, coefficient, classOnly?: boolean }
  // classOnly=true  → ClassSubjectOverride (uniquement cette classe)
  // classOnly=false → SubjectCoefficient   (toutes les classes du même niveau)
  ajouterMatiereClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params.classId as string;
      const { subjectId, coefficient, classOnly } = req.body as { subjectId?: string; coefficient?: number; classOnly?: boolean };

      if (!subjectId || coefficient == null) {
        res.status(400).json({ success: false, message: 'subjectId et coefficient requis' });
        return;
      }

      const classe = await this.prisma.class.findFirst({
        where: { id: classId, schoolId },
        select: { id: true, level: true, serie: true, filiere: true, name: true },
      });
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      // Si un ClassSubjectOverride existe déjà pour cette classe+matière, on le met à jour
      const existingOverride = await this.prisma.classSubjectOverride.findUnique({
        where: { classId_subjectId: { classId, subjectId } },
      });

      if (classOnly || existingOverride) {
        const override = await this.prisma.classSubjectOverride.upsert({
          where: { classId_subjectId: { classId, subjectId } },
          create: { schoolId, classId, subjectId, coefficient },
          update: { coefficient },
        });
        res.json({ success: true, data: { ...override, classOnly: true } });
        return;
      }

      // Comportement par défaut : SubjectCoefficient partagé par niveau
      const serieCode: string | null =
        classe.serie ??
        classe.filiere ??
        ((classe.level && (CYCLE2_LEVELS as string[]).includes(classe.level))
          ? parseSerie(classe.name ?? '', classe.level) : null);

      const coeff = await this.prisma.subjectCoefficient.upsert({
        where: {
          schoolId_subjectId_classLevel_serieCode: {
            schoolId, subjectId, classLevel: classe.level ?? '', serieCode: serieCode ?? '',
          },
        },
        create: { schoolId, subjectId, classLevel: classe.level ?? '', serieCode, coefficient },
        update: { coefficient },
      });

      res.json({ success: true, data: { ...coeff, classOnly: false } });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // DELETE /:classId/subjects/:subjectId — Retirer une matière d'une classe
  supprimerMatiereClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params.classId as string;
      const subjectId = req.params.subjectId as string;

      // Vérifier d'abord si c'est un override spécifique à cette classe
      const override = await this.prisma.classSubjectOverride.findUnique({
        where: { classId_subjectId: { classId, subjectId } },
      });
      if (override) {
        await this.prisma.classSubjectOverride.delete({ where: { classId_subjectId: { classId, subjectId } } });
        res.json({ success: true, message: 'Matière spécifique retirée de cette classe' });
        return;
      }

      // Sinon supprimer le SubjectCoefficient partagé (affecte toutes les classes du niveau)
      const classe = await this.prisma.class.findFirst({
        where: { id: classId, schoolId },
        select: { id: true, level: true, serie: true, filiere: true, name: true },
      });
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      const serieCode: string | null =
        classe.serie ??
        classe.filiere ??
        ((classe.level && (CYCLE2_LEVELS as string[]).includes(classe.level))
          ? parseSerie(classe.name ?? '', classe.level) : null);

      await this.prisma.subjectCoefficient.deleteMany({
        where: {
          schoolId, subjectId, classLevel: classe.level ?? undefined,
          ...(serieCode !== null ? { serieCode } : { serieCode: null }),
        },
      });

      res.json({ success: true, message: 'Matière retirée de la classe' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (
        error.message.includes('Seul') ||
        error.message.includes('refusé') ||
        error.message.includes('pas un enseignant')
      ) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
