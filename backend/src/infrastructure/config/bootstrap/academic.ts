import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { SchoolOnboardingController } from '@infrastructure/http/controllers/SchoolOnboardingController';
import { ReportCardController } from '@infrastructure/http/controllers/ReportCardController';
import { ClassCouncilController } from '@infrastructure/http/controllers/ClassCouncilController';
import { AcademicYearController } from '@infrastructure/http/controllers/AcademicYearController';
import { PedagogieController } from '@infrastructure/http/controllers/PedagogieController';
import { TemplateController } from '@infrastructure/http/controllers/TemplateController';
import { StudentDocumentController } from '@infrastructure/http/controllers/StudentDocumentController';
import { InviteOnboardingController } from '@infrastructure/http/controllers/InviteOnboardingController';
import { GroqIAService } from '@infrastructure/services/ai/GroqIAService';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { creerOnboardingRoutes } from '@infrastructure/http/routes/onboarding.routes';
import { creerReportCardRoutes } from '@infrastructure/http/routes/reportCard.routes';
import { creerClassCouncilRoutes } from '@infrastructure/http/routes/classCouncil.routes';
import { creerAcademicYearRoutes } from '@infrastructure/http/routes/academicYear.routes';
import { creerPedagogieRoutes } from '@infrastructure/http/routes/pedagogie.routes';
import { creerStudentDocumentRoutes } from '@infrastructure/http/routes/studentDocument.routes';
import { requireAuth, requireRole } from '../../http/middlewares/auth';

type Container = ReturnType<typeof creerContainer>;

export function registerAcademic(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerAcademicRoutes(app, _prisma, container);
}

export function registerAcademicRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  const onboardingController = new SchoolOnboardingController(
    c.school.onboarder,
    c.school.approuver,
  );

  const reportCardController = new ReportCardController(
    c.reportCard.generer,
    c.reportCard.envoyer,
    new GroqIAService(),
    c.school.schoolRepository,
    c.school.classeRepository,
    c.school.anneeRepository,
    c.school.sectionRepository,
    c.reportCard.bulletinRepository,
    c.reportCard.parentRepository,
    new AIActionAuditAdapter(p as any),
    c.reportCard.verifierDisponibilite,
    c.reportCard.lister,
  );

  const classCouncilController = new ClassCouncilController(
    c.classCouncil.creerSession,
    c.classCouncil.preparerVue,
    c.classCouncil.listerSessions,
    c.classCouncil.obtenirSession,
    c.classCouncil.ajouterDecision,
    c.classCouncil.ajouterDecisionsEnBloc,
    c.classCouncil.verrouiller,
    c.classCouncil.publierBulletins,
    c.classCouncil.genererPV,
    c.classCouncil.genererRapport,
  );

  const inviteOnboardingController = new InviteOnboardingController(p as any);
  app.get('/api/v2/onboarding/invite/:token', inviteOnboardingController.validateInvite);
  app.post('/api/v2/onboarding/invite/:token/complete', inviteOnboardingController.completeOnboarding);
  app.post('/api/v2/onboarding/preview-structure', inviteOnboardingController.previewStructure);

  app.get('/api/v2/onboarding/anglophone-streams', async (_req, res, next) => {
    try {
      const combos = await p.anglophoneStreamCombination.findMany({
        orderBy: { filiere: 'asc' },
      });
      const toEntry = (combo: typeof combos[number]) => {
        const core = Array.isArray(combo.coreSubjects) ? (combo.coreSubjects as string[]) : [];
        const electives = Array.isArray(combo.electiveGroup)
          ? (combo.electiveGroup as string[][]).flat().filter((x): x is string => typeof x === 'string')
          : [];
        const subjects = [...new Set([...core, ...electives])];
        return {
          code: combo.filiere,
          type: combo.type,
          label: combo.description ?? core.join(', '),
          coreSubjects: core,
          subjects,
        };
      };
      res.json({
        success: true,
        data: {
          arts:    combos.filter(ct => ct.type === 'ARTS').map(toEntry),
          science: combos.filter(ct => ct.type === 'SCIENCES').map(toEntry),
        },
      });
    } catch (err) { next(err); }
  });

  const templateController = new TemplateController(p as any);
  app.get('/api/v2/templates/import-eleves', requireAuth, requireRole('ADMIN'), templateController.importEleves);
  app.get('/api/v2/templates/import-enseignants', requireAuth, requireRole('ADMIN'), templateController.importEnseignants);

  const studentDocumentController = new StudentDocumentController(
    c.studentDocument.studentProfileRepository,
    c.studentDocument.schoolRepository,
    c.studentDocument.anneeRepository,
    c.studentDocument.bulletinRepository,
    c.studentDocument.documentRepository,
  );
  app.use('/api/v2', creerStudentDocumentRoutes(studentDocumentController));

  const academicYearController = new AcademicYearController(
    c.academicYear.creer,
    c.academicYear.definirPeriode,
    c.academicYear.verifierPrerequis,
    c.academicYear.cloturer,
    c.academicYear.mettreAJourCalendrier,
    c.academicYear.proposerStructureSuivante,
    c.academicYear.validerStructureSuivante,
    c.academicYear.annulerStructureSuivante,
  );
  app.use('/api/v2/academic-years', creerAcademicYearRoutes(academicYearController));

  const pedagogieController = new PedagogieController(
    c.pedagogie.listerProgramme,
    c.pedagogie.gererProgramme,
    c.pedagogie.gererChapitre,
    c.pedagogie.gererCahier,
    c.pedagogie.calculerProgression,
    c.pedagogie.obtenirSlot,
    c.pedagogie.genererRapport,
    new AIActionAuditAdapter(p as any),
  );
  app.use('/api/v2/pedagogie', requireAuth, creerPedagogieRoutes(pedagogieController));

  app.use('/api/v2/onboarding', creerOnboardingRoutes(onboardingController));
  app.use('/api/v2/report-cards', creerReportCardRoutes(reportCardController));
  app.use('/api/v2/class-councils', creerClassCouncilRoutes(classCouncilController));
}
