import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { OuvrirFenetreChoixLV2UseCase } from '@application/lv2Choice/OuvrirFenetreChoixLV2UseCase';
import { SoumettreChoixLV2EleveUseCase } from '@application/lv2Choice/SoumettreChoixLV2EleveUseCase';
import { SaisirChoixLV2ManuelUseCase } from '@application/lv2Choice/SaisirChoixLV2ManuelUseCase';
import { AppliquerChoixLV2UseCase } from '@application/lv2Choice/AppliquerChoixLV2UseCase';
import { SuivreFenetreChoixLV2UseCase } from '@application/lv2Choice/SuivreFenetreChoixLV2UseCase';
import { notifyLv2WindowOpenSms } from '@infrastructure/services/SmsNotificationService';

export class Lv2ChoiceController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly ouvrirFenetre: OuvrirFenetreChoixLV2UseCase,
    private readonly soumettreChoix: SoumettreChoixLV2EleveUseCase,
    private readonly saisirManuel: SaisirChoixLV2ManuelUseCase,
    private readonly appliquerChoix: AppliquerChoixLV2UseCase,
    private readonly suivreFenetre: SuivreFenetreChoixLV2UseCase,
  ) {}

  // POST /api/v2/lv2-choice-windows
  creerFenetre = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const { level, academicYearId, openDate, closeDate } = req.body as {
        level: string; academicYearId: string; openDate: string; closeDate: string;
      };
      if (!level || !academicYearId || !openDate || !closeDate) {
        res.status(400).json({ success: false, message: 'level, academicYearId, openDate, closeDate requis' });
        return;
      }
      const result = await this.ouvrirFenetre.execute({
        schoolId, level, academicYearId,
        openDate: new Date(openDate), closeDate: new Date(closeDate),
      });
      res.status(201).json({ success: true, data: result });
      for (const e of result.eleves) {
        void notifyLv2WindowOpenSms({
          schoolId, studentUserId: e.studentUserId, studentName: e.studentName, level: result.level, closeDate: result.closeDate,
        });
      }
    } catch (err) { next(err); }
  };

  // GET /api/v2/lv2-choice-windows/:id/tracking
  suivi = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const windowId = String(req.params['id']);
      const result = await this.suivreFenetre.execute({ schoolId, windowId });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/lv2-choice-windows/:id/manual-submission
  saisieManuelle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const submittedByUserId = req.user!.userId;
      const windowId = String(req.params['id']);
      const { studentProfileId, chosenSubjectId } = req.body as {
        studentProfileId: string; chosenSubjectId: string;
      };
      if (!studentProfileId || !chosenSubjectId) {
        res.status(400).json({ success: false, message: 'studentProfileId et chosenSubjectId requis' });
        return;
      }
      await this.saisirManuel.execute({ schoolId, windowId, studentProfileId, chosenSubjectId, submittedByUserId });
      res.json({ success: true, message: 'Choix enregistré' });
    } catch (err) { next(err); }
  };

  // POST /api/v2/lv2-choice-windows/:id/apply
  appliquer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const windowId = String(req.params['id']);
      const result = await this.appliquerChoix.execute({ schoolId, windowId });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // GET /api/v2/students/me/lv2-choice-window (élève)
  fenetreEleve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;

      // Récupérer le profil élève
      const profile = await (this.prisma as any).studentProfile.findFirst({
        where: { user: { id: userId, schoolId } },
      });
      if (!profile) {
        res.status(404).json({ success: false, message: 'Profil élève introuvable' });
        return;
      }

      const classe = await this.prisma.class.findUnique({ where: { id: profile.classId } });
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      // Fenêtre ouverte pour le niveau
      const window = await (this.prisma as any).lv2ChoiceWindow.findFirst({
        where: {
          schoolId,
          level: classe.level,
          status: 'OPEN',
          openDate: { lte: new Date() },
          closeDate: { gte: new Date() },
        },
      });

      if (!window) {
        res.json({ success: true, data: null });
        return;
      }

      // Soumission existante
      const submission = await (this.prisma as any).lv2ChoiceSubmission.findUnique({
        where: {
          windowId_studentProfileId: { windowId: window.id, studentProfileId: profile.id },
        },
        include: { chosenSubject: { select: { id: true, name: true } } },
      });

      // Matières LV2 disponibles — filtrées sur le flag isLV2 (matières-langues réelles créées à l'activation)
      const lv2Subjects = await this.prisma.subject.findMany({
        where: { schoolId, isLV2: true },
        select: { id: true, name: true },
      });

      res.json({
        success: true,
        data: {
          window: { id: window.id, level: window.level, openDate: window.openDate, closeDate: window.closeDate },
          currentChoice: submission ? { subjectId: submission.chosenSubjectId, subjectName: submission.chosenSubject?.name } : null,
          availableSubjects: lv2Subjects,
        },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/students/me/lv2-choice (élève soumet)
  soumettreEleve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.user!.userId;
      const { chosenSubjectId } = req.body as { chosenSubjectId: string };
      if (!chosenSubjectId) {
        res.status(400).json({ success: false, message: 'chosenSubjectId requis' });
        return;
      }
      await this.soumettreChoix.execute({ schoolId, studentUserId, chosenSubjectId });
      res.json({ success: true, message: 'Choix enregistré' });
    } catch (err) { next(err); }
  };
}
