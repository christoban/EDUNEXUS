import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient, SubjectType } from '@prisma/client';
import type { InviterEcoleUseCase } from '@application/masterAdmin/InviterEcoleUseCase';
import type { SuspendreEcoleUseCase } from '@application/masterAdmin/SuspendreEcoleUseCase';
import type { ReactiverEcoleUseCase } from '@application/masterAdmin/ReactiverEcoleUseCase';
import type { RejeterEcoleUseCase } from '@application/masterAdmin/RejeterEcoleUseCase';
import type { ChangerPlanAbonnementUseCase } from '@application/masterAdmin/ChangerPlanAbonnementUseCase';
import type { PlanType, SchoolSubsystem } from '@domain/types/enums';
import { inngest } from '../../../inngest/index.ts';
import { sendTransactionalEmail } from '../../../services/emailService';
import { listSchoolBackups } from '../../../utils/schoolBackup';
import { logMasterAction } from '../../../utils/masterAuthAudit';

export class MasterAdminHexController {
  constructor(
    private readonly inviter: InviterEcoleUseCase,
    private readonly suspendre: SuspendreEcoleUseCase,
    private readonly reactiver: ReactiverEcoleUseCase,
    private readonly rejeter: RejeterEcoleUseCase,
    private readonly changerPlan: ChangerPlanAbonnementUseCase,
    private readonly prisma: PrismaClient,
  ) {}

  // POST /api/v2/master/schools/invite
  inviterEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const { email, schoolName, plan, notes, subsystem } = req.body;

      if (!email || !schoolName) {
        res.status(400).json({ success: false, message: 'email et schoolName requis' });
        return;
      }

      const resultat = await this.inviter.execute({
        email,
        schoolName,
        plan: (plan ?? 'DISCOVERY') as PlanType,
        masterAdminId: master.id,
        notes,
        subsystem: subsystem as SchoolSubsystem | undefined,
      });

      void logMasterAction({ req, masterUserId: master.id, action: 'school_invite_sent', description: `Invitation envoyée à ${email} pour «${schoolName}»` });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/suspend
  suspendreEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const master = req.masterUser;
      await this.suspendre.execute(id);
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_suspended', targetId: id, description: `École ${id} suspendue` });
      res.json({ success: true, message: 'École suspendue' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/reactivate
  reactiverEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const master = req.masterUser;
      await this.reactiver.execute(id);
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_reactivated', targetId: id, description: `École ${id} réactivée` });
      res.json({ success: true, message: 'École réactivée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/reject
  rejeterEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const master = req.masterUser;
      const { motif } = req.body;
      if (!motif) {
        res.status(400).json({ success: false, message: 'Le motif est obligatoire' });
        return;
      }
      await this.rejeter.execute({ schoolId: id, motif });
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_rejected', targetId: id, description: `École ${id} rejetée — motif: ${motif}` });
      res.json({ success: true, message: 'École rejetée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/master/schools/:id/plan
  changerPlanEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { plan } = req.body;
      if (!plan) {
        res.status(400).json({ success: false, message: 'plan requis (DISCOVERY/STANDARD/PREMIUM/ETABLISSEMENT_PLUS)' });
        return;
      }
      await this.changerPlan.execute({
        schoolId: req.params.id as string,
        nouveauPlan: plan as PlanType,
      });
      res.json({ success: true, message: `Plan changé vers ${plan}` });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/schools
  listerEcoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, search, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const where: any = {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { subdomain: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [schools, total] = await Promise.all([
        this.prisma.school.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            invites: { where: { status: 'PENDING' }, take: 1, orderBy: { createdAt: 'desc' } },
            users: { where: { role: 'ADMIN', isActive: true }, take: 1, select: { email: true } },
            _count: { select: { users: true, classes: true } },
          },
        }),
        this.prisma.school.count({ where }),
      ]);

      res.json({
        success: true,
        data: schools,
        pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/schools/:id
  detailEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const school = await this.prisma.school.findUnique({
        where: { id: req.params.id as string },
        include: {
          invites: { orderBy: { createdAt: 'desc' }, take: 5 },
          schoolConfig: true,
          schoolSettings: true,
          _count: { select: { users: true, classes: true, subjects: true, feePlans: true } },
        },
      });

      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      res.json({ success: true, data: school });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // DELETE /api/v2/master/schools/:id
  supprimerEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const school = await this.prisma.school.findUnique({ where: { id } });
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const master = req.masterUser;
      const schoolName = school.name;

      await this.prisma.$transaction(async (tx) => {
        // TeacherSubject : la cascade School→Subject→TeacherSubject ne passe pas par schoolId direct
        await tx.teacherSubject.deleteMany({ where: { subject: { schoolId: id } } });
        // User.schoolId est nullable (SetNull par défaut) → les users resteraient orphelins sans cette ligne
        await tx.user.deleteMany({ where: { schoolId: id } });
        // School.delete() cascade tout ce qui a onDelete: Cascade (profiles, classes, notes, etc.)
        await tx.school.delete({ where: { id } });
      });

      void logMasterAction({ req, masterUserId: master?.id, action: 'school_deleted', targetId: id, description: `«${schoolName}» supprimée définitivement` });
      res.json({ success: true, message: 'École supprimée définitivement' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/resend-invite
  renvoyerInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const school = await this.prisma.school.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          invites: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const invite = school.invites[0];
      if (!invite) {
        res.status(400).json({ success: false, message: 'Aucune invitation active à renvoyer pour cette école' });
        return;
      }

      const newToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      await this.prisma.schoolInvite.update({
        where: { id: invite.id as string },
        data: { token: newToken, expiresAt },
      });

      const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const activationUrl = `${frontendUrl}/onboarding/${newToken}`;

      const master = req.masterUser;
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_invite_resent', targetId: id, description: `Invitation renvoyée à ${invite.email as string} pour «${invite.schoolName as string}»` });

      // Répondre immédiatement — l'email s'envoie en arrière-plan
      res.json({ success: true, message: `Invitation renvoyée à ${invite.email as string}` });

      sendTransactionalEmail({
        recipientEmail: invite.email as string,
        subject: `ZekoulABia — Renvoi d'invitation : ${invite.schoolName as string}`,
        html: `
          <p>Bonjour,</p>
          <p>Votre invitation pour l'établissement <strong>${invite.schoolName as string}</strong> a été renvoyée.</p>
          <p>Cliquez sur le lien ci-dessous pour activer votre espace (lien valable 72h) :</p>
          <p><a href="${activationUrl}" style="background:#059669;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Activer mon espace ZekoulABia</a></p>
          <p style="color:#888;font-size:13px">Lien direct : ${activationUrl}</p>
        `,
        template: 'school_invite',
        eventType: 'school_invite',
      }).catch(err => console.error('[Email] Échec renvoi invitation:', err));
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/cancel-approval
  annulerApprobationEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const school = await this.prisma.school.findUnique({ where: { id }, select: { id: true, status: true, name: true } });
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }
      if (school.status !== 'APPROVED') {
        res.status(400).json({ success: false, message: 'Seule une école approuvée peut voir son approbation annulée' });
        return;
      }
      await this.prisma.school.update({ where: { id }, data: { status: 'PENDING' } });
      const master = req.masterUser;
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_approval_cancelled', targetId: id, description: `«${school.name}» approbation annulée (APPROVED → PENDING)` });
      res.json({ success: true, message: `L'approbation de ${school.name} a été annulée — elle repasse en attente` });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/reexamine
  reexaminerEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const school = await this.prisma.school.findUnique({ where: { id }, select: { id: true, status: true, name: true } });
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }
      if (school.status !== 'REJECTED') {
        res.status(400).json({ success: false, message: 'Seule une école rejetée peut être réexaminée' });
        return;
      }
      await this.prisma.school.update({ where: { id }, data: { status: 'PENDING' } });
      const master = req.masterUser;
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_reexamined', targetId: id, description: `«${school.name}» remise en examen (REJECTED → PENDING)` });
      res.json({ success: true, message: `La demande de ${school.name} est remise en examen` });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/auth/logs?type=auth|actions|all
  listerLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { action, page = '1', limit = '50', type = 'all' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const where: any = {};
      if (action) {
        where.action = action;
      } else if (type === 'auth') {
        where.NOT = { action: { startsWith: 'action:' } };
      } else if (type === 'actions') {
        where.action = { startsWith: 'action:' };
      }

      const [logs, total] = await Promise.all([
        this.prisma.masterAuthAudit.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { masterUser: { select: { id: true, email: true, name: true } } },
        }),
        this.prisma.masterAuthAudit.count({ where }),
      ]);

      res.json({
        success: true,
        data: logs,
        pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/email-logs — logs email cross-schools pour le master admin
  listerEmailLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page = '1', limit = '50', search = '', schoolId } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const where: any = {};
      if (schoolId) where.schoolId = schoolId;
      if (search) {
        where.OR = [
          { to: { contains: search as string, mode: 'insensitive' } },
          { subject: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [emailLogs, total] = await Promise.all([
        this.prisma.emailLog.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { school: { select: { id: true, name: true, subdomain: true } } },
        }),
        this.prisma.emailLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: emailLogs,
        pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/sync-subjects
  // Rattrapage : crée les matières et SubjectCoefficients pour une école ACTIVE
  // dont l'activation s'est faite avant que ces étapes soient en place.
  syncSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const school = await this.prisma.school.findUnique({ where: { id } });
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }
      if (school.status !== 'ACTIVE') {
        res.status(400).json({ success: false, message: 'Seules les écoles ACTIVE peuvent être synchronisées' });
        return;
      }

      const existingCount = await this.prisma.subject.count({ where: { schoolId: id } });

      const config = (school.onboardingConfig ?? {}) as Record<string, unknown>;
      const templateCode: string | undefined = school.templateCode ?? (config.templateCode as string | undefined);

      const effectiveTemplate = templateCode
        ? await this.prisma.schoolTemplate.findUnique({ where: { code: templateCode } })
        : null;

      let subjectCount = 0;
      let subjectCoeffCount = 0;

      const CYCLE2_LEVELS: string[] = ['2nde', '1ere', '1ère', 'Tle'];
      const NIVEAU_MAP: Record<string, string> = {
        '2nde': 'SECONDE', '1ere': 'PREMIERE', '1ère': 'PREMIERE', 'Tle': 'TERMINALE',
      };

      await this.prisma.$transaction(async (tx) => {
        // Créer les matières de base si aucune n'existe
        // Skip for templates with full reference data — subjects are created on-demand below
        const TEMPLATES_WITH_REFERENCE_DATA = ['LYCEE_FR', 'CES_FR', 'PRIVE_FR', 'GHS_EN', 'GSS_EN', 'PRIVE_EN', 'LYCEE_BILINGUE'];
        const hasReferenceData = templateCode && TEMPLATES_WITH_REFERENCE_DATA.includes(templateCode);
        if (existingCount === 0 && effectiveTemplate && !hasReferenceData) {
          interface TemplateSubjectDef { name: string; code: string; coefficient: number; hoursPerWeek?: number; subjectType?: string }
          const tCfg = (effectiveTemplate.config ?? {}) as Record<string, unknown>;
          const frSubjects = (tCfg.defaultSubjects as TemplateSubjectDef[] | undefined) ?? [];
          const enSubjects = (tCfg.defaultSubjectsEN as TemplateSubjectDef[] | undefined) ?? [];

          for (const s of frSubjects) {
            await tx.subject.create({
              data: { schoolId: id, name: s.name, code: s.code, coefficient: s.coefficient, hoursPerWeek: s.hoursPerWeek ?? 2, subjectType: (s.subjectType ?? 'THEORETICAL') as SubjectType },
            });
          }
          for (const s of enSubjects) {
            await tx.subject.create({
              data: { schoolId: id, name: frSubjects.length > 0 ? `${s.name} (EN)` : s.name, code: frSubjects.length > 0 ? `${s.code}_EN` : s.code, coefficient: s.coefficient, hoursPerWeek: s.hoursPerWeek ?? 2, subjectType: (s.subjectType ?? 'THEORETICAL') as SubjectType },
            });
          }
          subjectCount = frSubjects.length + enSubjects.length;
        }

        // SubjectCoefficients 2e cycle
        const cycle2Classes = await tx.class.findMany({
          where: { schoolId: id, level: { in: CYCLE2_LEVELS } },
          select: { name: true, level: true },
        });

        if (cycle2Classes.length > 0) {
          const schoolSubjects = await tx.subject.findMany({ where: { schoolId: id }, select: { id: true, name: true } });
          const subjectByName = new Map(schoolSubjects.map(s => [s.name, s.id]));
          const processed = new Set<string>();

          for (const classe of cycle2Classes) {
            const niveauBac = NIVEAU_MAP[classe.level];
            if (!niveauBac) continue;
            const nameParts = classe.name.split(' ');
            const serieRaw2 = nameParts[1];
            if (!serieRaw2) continue;
            const dashIdx2 = serieRaw2.indexOf('-');
            const seriePart = dashIdx2 >= 0 ? serieRaw2.slice(0, dashIdx2) : serieRaw2;
            const serieCode = seriePart === 'A4' && dashIdx2 >= 0 ? serieRaw2 : seriePart;
            const key = `${niveauBac}|${serieCode}`;
            if (processed.has(key)) continue;
            processed.add(key);

            const bacCoeffs = await tx.bacCoefficient.findMany({ where: { serie: seriePart, niveau: niveauBac } });
            for (const bc of bacCoeffs) {
              let subjectName = bc.subjectName;
              if (seriePart === 'A4' && bc.subjectName === 'LV2' && dashIdx2 >= 0) {
                subjectName = serieRaw2.slice(dashIdx2 + 1);
              }
              let subjectId = subjectByName.get(subjectName);
              if (!subjectId) {
                const code = subjectName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
                const newS = await tx.subject.create({
                  data: { schoolId: id, name: subjectName, code, coefficient: bc.coefficient, hoursPerWeek: 2, subjectType: 'THEORETICAL' as SubjectType },
                });
                subjectId = newS.id;
                subjectByName.set(subjectName, subjectId);
                subjectCount++;
              }
              await tx.subjectCoefficient.upsert({
                where: { schoolId_subjectId_classLevel_serieCode: { schoolId: id, subjectId, classLevel: classe.level, serieCode } },
                update: { coefficient: bc.coefficient },
                create: { schoolId: id, subjectId, classLevel: classe.level, serieCode, coefficient: bc.coefficient },
              });
              subjectCoeffCount++;
            }
          }
        }
      });

      res.json({
        success: true,
        message: `Synchronisation terminée pour "${school.name}"`,
        data: { subjectsCreated: subjectCount, subjectCoefficientsUpserted: subjectCoeffCount },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/backup/trigger
  declencherSauvegarde = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const schoolId = typeof req.body?.schoolId === 'string' && req.body.schoolId.trim() ? req.body.schoolId.trim() : undefined;

      const response = await inngest.send({
        name: 'backup/school.requested',
        data: {
          schoolId,
          requestedByMasterId: master?.id ?? null,
          source: 'manual',
        },
      });

      void logMasterAction({
        req,
        masterUserId: master?.id,
        action: 'backup_triggered',
        targetId: schoolId ?? 'all-schools',
        description: schoolId ? `Sauvegarde déclenchée pour l'école ${schoolId}` : 'Sauvegarde globale déclenchée',
      });

      res.status(202).json({ success: true, message: 'Sauvegarde déclenchée', data: { eventId: response.ids?.[0] ?? null } });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/users/mfa-reset — débloque un compte Admin/Staff/Teacher ayant perdu
  // l'accès à son authenticator ET à ses codes de récupération. Le compte devra reconfigurer
  // le MFA depuis zéro (nouveau QR) à sa prochaine connexion — geste sensible, jamais silencieux.
  reinitialiserMfaUtilisateur = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const { subdomain, email } = req.body as { subdomain?: string; email?: string };
      if (!subdomain || !email) {
        res.status(400).json({ success: false, message: 'subdomain et email requis' });
        return;
      }

      const school = await this.prisma.school.findUnique({ where: { subdomain: subdomain.toLowerCase().trim() }, select: { id: true, name: true } });
      if (!school) {
        res.status(404).json({ success: false, message: 'Établissement introuvable' });
        return;
      }

      const user = await this.prisma.user.findFirst({
        where: { schoolId: school.id, email: email.toLowerCase().trim() },
        select: { id: true, role: true, mfaEnabled: true },
      });
      if (!user) {
        res.status(404).json({ success: false, message: 'Compte introuvable dans cet établissement' });
        return;
      }
      if (!user.mfaEnabled) {
        res.status(400).json({ success: false, message: 'Le MFA de ce compte n\'est pas actif — rien à réinitialiser.' });
        return;
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: false, mfaSecret: null, mfaTempSecret: null, mfaRecoveryCodeHashes: [], mfaRecoveryCodeGeneratedAt: null },
      });

      void logMasterAction({
        req,
        masterUserId: master?.id,
        action: 'user_mfa_reset',
        targetId: user.id,
        description: `MFA réinitialisé pour ${email} (${user.role}) — ${school.name}. Reconfiguration obligatoire à la prochaine connexion.`,
      });

      res.json({ success: true, message: 'MFA réinitialisé — ce compte devra le reconfigurer à sa prochaine connexion.' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/backup/list
  listerSauvegardes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = typeof req.query.schoolId === 'string' && req.query.schoolId.trim() ? req.query.schoolId.trim() : undefined;
      const backups = await listSchoolBackups(schoolId);
      res.json({ success: true, data: backups });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/security-audit-log — vue "Sécurité plateforme" (chantier Sécurité de
  // l'assistant IA). Transversale à tous les établissements, mais concentrée par défaut sur les
  // refus (outcome=REFUSE) — la redevabilité métier détaillée de chaque école reste la vue
  // "Journal d'établissement" côté admin d'école, jamais fusionnée avec celle-ci.
  listerJournalSecuriteIA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { schoolId, outcome, actorRole, origin, actionName, page = '1', limit = '50' } = req.query as Record<string, string>;
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const take = parseInt(limit, 10);

      const where: any = {};
      if (schoolId) where.schoolId = schoolId;
      if (outcome) where.outcome = outcome;
      if (actorRole) where.actorRole = actorRole;
      if (origin) where.origin = origin;
      if (actionName) where.actionName = actionName;

      const [entries, total] = await Promise.all([
        this.prisma.aIActionAuditLog.findMany({ where, skip, take, orderBy: { timestamp: 'desc' } }),
        this.prisma.aIActionAuditLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: entries,
        pagination: { page: parseInt(page, 10), limit: take, total, pages: Math.ceil(total / take) },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('Impossible')) {
        res.status(422).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
