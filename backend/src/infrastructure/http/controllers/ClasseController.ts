import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
import type { ModifierClasseUseCase } from '@application/class/ModifierClasseUseCase';
import type { SupprimerClasseUseCase } from '@application/class/SupprimerClasseUseCase';
import type { AssignerProfesseurPrincipalUseCase } from '@application/class/AssignerProfesseurPrincipalUseCase';
import type { CreerSousGroupeTPUseCase } from '@application/class/CreerSousGroupeTPUseCase';
import type { AssignerElevesAuSousGroupeUseCase } from '@application/class/AssignerElevesAuSousGroupeUseCase';
import { CYCLE2_LEVELS, parseSerie } from '@application/school/SubjectAssignmentHelper';

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

      if (!teacherUserId) {
        res.status(400).json({ success: false, message: 'teacherUserId requis' });
        return;
      }

      await this.assignerProfesseur.execute({
        classeId: req.params.id as string,
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
  ajouterMatiereClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params.classId as string;
      const { subjectId, coefficient } = req.body as { subjectId?: string; coefficient?: number };

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

      // Déterminer le serieCode : serie (2nd cycle), filiere (1er cycle), ou null
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
        create: {
          schoolId, subjectId, classLevel: classe.level ?? '', serieCode, coefficient,
        },
        update: { coefficient },
      });

      res.json({ success: true, data: coeff });
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
