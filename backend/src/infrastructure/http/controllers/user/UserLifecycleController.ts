import type { Request, Response, NextFunction } from 'express';
import type { InscrireUtilisateurUseCase } from '@application/user/InscrireUtilisateurUseCase';
import type { ModifierUtilisateurUseCase } from '@application/user/ModifierUtilisateurUseCase';
import type { SupprimerUtilisateurUseCase } from '@application/user/SupprimerUtilisateurUseCase';
import type { TransfererEleveUseCase } from '@application/user/TransfererEleveUseCase';
import type { DesignerAPUseCase } from '@application/user/DesignerAPUseCase';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { EnrollmentRepository } from '@domain/ports/repositories/EnrollmentRepository';
import { parseDateFR } from '../../../../shared/date/parseDateFR';
import { passwordError } from '../../../../domain/security/PasswordPolicy';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import { isNiveauPrimaireOuMaternelle } from '../../../../lib/classSerieValidator';
import { gererErreurUser } from './userAuthHelper';

export class UserLifecycleController {
  constructor(
    private readonly inscrire: InscrireUtilisateurUseCase,
    private readonly modifier: ModifierUtilisateurUseCase,
    private readonly supprimer: SupprimerUtilisateurUseCase,
    private readonly transferer: TransfererEleveUseCase,
    private readonly designerAP: DesignerAPUseCase,
    private readonly audit: AIActionAuditPort,
    private readonly userRepository: UserRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly enrollmentRepository: EnrollmentRepository,
  ) {}

  // POST /api/v2/users
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const bcrypt = await import('bcryptjs');
      const isDevMode = process.env.EMAIL_DISABLED === 'true';

      let passwordHash: string;
      if (isDevMode) {
        passwordHash = await bcrypt.hash('chris123456789', 10);
      } else {
        const crypto = await import('crypto');
        passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      }

      let dateOfBirth: Date | undefined;
      if (req.body.dateOfBirth) {
        const parsed = parseDateFR(String(req.body.dateOfBirth));
        if (!parsed) {
          res.status(400).json({ success: false, message: `Date de naissance invalide : "${req.body.dateOfBirth}"` });
          return;
        }
        dateOfBirth = parsed;
      }

      if (req.body.role === 'STUDENT' && req.body.classeId && (req.body.email || req.body.phone)) {
        const classe = await this.classeRepository.findById(req.body.classeId);
        const ecole = await this.schoolRepository.findById(user.schoolId);
        const isPrimaireClasse = classe
          ? isNiveauPrimaireOuMaternelle(classe.level ?? '')
          : getTemplateMeta(ecole?.templateCode).isPrimaire;
        if (isPrimaireClasse) {
          res.status(400).json({
            success: false,
            message:
              "Un élève de maternelle/primaire ne peut pas avoir d'identifiants de connexion propres (email/téléphone) — créez plutôt un compte PARENT pour la connexion.",
          });
          return;
        }
      }

      const resultat = await this.inscrire.execute({
        schoolId: user.schoolId,
        ...req.body,
        dateOfBirth,
        passwordHash,
      });

      this.audit.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        actionName: 'creer_eleve',
        targetType: 'User',
        targetId: resultat.userId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: resultat });

      const recipientEmail: string | undefined = (req.body.email as string | undefined)?.trim();
      const role: string = req.body.role || '';
      if (!isDevMode && recipientEmail && ['STAFF', 'TEACHER', 'STUDENT', 'PARENT'].includes(role)) {
        (async () => {
          try {
            const jwt = await import('jsonwebtoken');
            const inviteToken = jwt.default.sign(
              { sub: resultat.userId, email: recipientEmail, schoolId: user.schoolId, type: 'user_invite' },
              process.env.JWT_SECRET!,
              { expiresIn: '7d' },
            );

            const school = await this.schoolRepository.findById(user.schoolId);
            const schoolName = school?.name ?? 'votre établissement';
            const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
            const inviteUrl = `${frontendUrl}/invite/set-password?token=${inviteToken}`;

            console.log(`[Invite] Lien d'invitation pour ${recipientEmail}: ${inviteUrl}`);

            const { sendTransactionalEmail } = await import('../../../services/email/EmailService.ts');
            await sendTransactionalEmail({
              recipientEmail,
              subject: `ZekoulABia — Créez votre mot de passe · ${schoolName}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
                  <div style="background:#1a2e1e;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
                    <h1 style="color:white;margin:0;font-size:20px;">🎓 ZekoulABia</h1>
                  </div>
                  <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">
                    <h2 style="color:#1a1209;margin-top:0;">Bonjour ${String(req.body.firstName || '').trim()} ${String(req.body.lastName || '').trim()},</h2>
                    <p style="color:#6b5c45;font-size:15px;line-height:1.6;">
                      Vous avez été invité(e) à rejoindre <strong>${schoolName}</strong> sur ZekoulABia.
                      Cliquez sur le bouton ci-dessous pour créer votre mot de passe et accéder à votre espace.
                    </p>
                    <div style="text-align:center;margin:28px 0 16px;">
                      <a href="${inviteUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
                        🔑 Créer mon mot de passe
                      </a>
                    </div>
                    <p style="color:#a89478;font-size:13px;text-align:center;">Ce lien expire dans 7 jours.</p>
                    <hr style="border:none;border-top:1px solid #e8e0d4;margin:20px 0;" />
                    <p style="color:#a89478;font-size:12px;margin:0;text-align:center;">
                      ZekoulABia · Plateforme de gestion scolaire · Cameroun
                    </p>
                  </div>
                </div>
              `,
              template: 'user_invitation',
              eventType: 'user_invite',
              metadata: { schoolId: user.schoolId },
            });
          } catch (emailErr) {
            console.error('[Email] Invitation error:', emailErr);
          }
        })();
      }
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId,
        actorRole: user?.role,
        schoolId: user?.schoolId,
        actionName: 'creer_eleve',
        origin: 'UI_DIRECT',
        outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined,
        parametersSummary: req.body,
      });
      gererErreurUser(error, res, next);
    }
  };

  // GET /api/v2/users/auth/invite/validate
  validateInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.query.token as string;
      if (!token) {
        res.status(400).json({ success: false, message: 'Token manquant' });
        return;
      }

      const jwt = await import('jsonwebtoken');
      let payload: any;
      try {
        payload = jwt.default.verify(token, process.env.JWT_SECRET!);
      } catch {
        res.status(401).json({ success: false, message: 'Lien invalide ou expiré. Contactez votre administrateur.' });
        return;
      }

      if (payload.type !== 'user_invite') {
        res.status(401).json({ success: false, message: 'Lien invalide.' });
        return;
      }

      const user = await this.userRepository.findById(payload.sub as string);
      if (!user) {
        res.status(404).json({ success: false, message: 'Compte introuvable.' });
        return;
      }

      const school = await this.schoolRepository.findById(user.schoolId);

      res.json({
        success: true,
        data: {
          email: user.email || payload.email,
          firstName: user.firstName,
          lastName: user.lastName,
          schoolName: school?.name ?? '',
          subdomain: school?.subdomain ?? '',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/users/auth/invite/complete
  completeInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, password, confirmPassword } = req.body as {
        token?: string;
        password?: string;
        confirmPassword?: string;
      };

      if (!token || !password) {
        res.status(400).json({ success: false, message: 'Token et mot de passe requis.' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas.' });
        return;
      }
      const pwdErr = passwordError(password);
      if (pwdErr) {
        res.status(400).json({ success: false, message: pwdErr });
        return;
      }

      const jwt = await import('jsonwebtoken');
      let payload: any;
      try {
        payload = jwt.default.verify(token, process.env.JWT_SECRET!);
      } catch {
        res.status(401).json({ success: false, message: 'Lien invalide ou expiré. Contactez votre administrateur.' });
        return;
      }

      if (payload.type !== 'user_invite') {
        res.status(401).json({ success: false, message: 'Lien invalide.' });
        return;
      }

      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);
      await this.userRepository.definirMotDePasseInvitation(payload.sub as string, passwordHash);

      res.json({
        success: true,
        message: 'Mot de passe créé avec succès. Vous pouvez maintenant vous connecter.',
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v2/users/:id
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      let passwordHash: string | undefined;

      if (req.body.password) {
        const bcrypt = await import('bcryptjs');
        passwordHash = await bcrypt.hash(req.body.password, 10);
      }

      let dateOfBirth: Date | undefined;
      if (req.body.dateOfBirth) {
        const parsed = parseDateFR(String(req.body.dateOfBirth));
        if (!parsed) {
          res.status(400).json({ success: false, message: `Date de naissance invalide : "${req.body.dateOfBirth}"` });
          return;
        }
        dateOfBirth = parsed;
      }

      if (req.body.email || req.body.phone) {
        const cible = await this.userRepository.findById(req.params.id as string);
        const effectiveRole = req.body.role ?? cible?.role;
        if (effectiveRole === 'STUDENT') {
          const ecole = await this.schoolRepository.findById(user.schoolId);
          const classeActuelle = await this.enrollmentRepository.getClasseActuelleEleve(req.params.id as string);
          const niveauClasse = classeActuelle?.level;
          const isPrimaireClasse = niveauClasse
            ? isNiveauPrimaireOuMaternelle(niveauClasse)
            : getTemplateMeta(ecole?.templateCode).isPrimaire;
          if (isPrimaireClasse) {
            res.status(400).json({
              success: false,
              message:
                "Un élève de maternelle/primaire ne peut pas avoir d'identifiants de connexion propres (email/téléphone) — créez plutôt un compte PARENT pour la connexion.",
            });
            return;
          }
        }
      }

      await this.modifier.execute({
        cibleUserId: req.params.id as string,
        demandeurId: user.userId,
        demandeurRole: user.role,
        schoolId: user.schoolId,
        ...req.body,
        dateOfBirth,
        passwordHash,
      });

      this.audit.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        actionName: 'modifier_eleve',
        targetType: 'User',
        targetId: req.params.id as string,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: req.body,
      });
      res.json({ success: true, message: 'Utilisateur mis à jour' });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId,
        actorRole: user?.role,
        schoolId: user?.schoolId,
        actionName: 'modifier_eleve',
        targetType: 'User',
        targetId: req.params.id as string,
        origin: 'UI_DIRECT',
        outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined,
        parametersSummary: req.body,
      });
      gererErreurUser(error, res, next);
    }
  };

  // DELETE /api/v2/users/:id
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.supprimer.execute({
        userId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurRole: user.role,
        demandeurId: user.userId,
      });
      res.json({ success: true, message: 'Utilisateur mis à la corbeille' });
    } catch (error) {
      gererErreurUser(error, res, next);
    }
  };

  // POST /api/v2/students/:id/transfer
  transfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { fromClasseId, toClasseId } = req.body;

      if (!fromClasseId || !toClasseId) {
        res.status(400).json({ success: false, message: 'fromClasseId et toClasseId requis' });
        return;
      }

      await this.transferer.execute({
        studentId: req.params.id as string,
        fromClasseId,
        toClasseId,
        schoolId: user.schoolId,
        demandeurId: user.userId,
      });

      this.audit.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        actionName: 'transferer_eleve',
        targetType: 'User',
        targetId: req.params.id as string,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { fromClasseId, toClasseId },
      });
      res.json({ success: true, message: 'Élève transféré avec succès' });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId,
        actorRole: user?.role,
        schoolId: user?.schoolId,
        actionName: 'transferer_eleve',
        targetType: 'User',
        targetId: req.params.id as string,
        origin: 'UI_DIRECT',
        outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined,
        parametersSummary: req.body,
      });
      gererErreurUser(error, res, next);
    }
  };

  // PATCH /api/v2/users/:id/ap-designation
  apDesignation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { departmentSubjectIds, action } = req.body as {
        departmentSubjectIds?: string[];
        action?: string;
      };

      if (action !== 'ASSIGN' && action !== 'REMOVE') {
        res.status(400).json({ success: false, message: "action doit être 'ASSIGN' ou 'REMOVE'" });
        return;
      }
      if (!Array.isArray(departmentSubjectIds)) {
        res.status(400).json({ success: false, message: 'departmentSubjectIds (tableau) requis' });
        return;
      }

      await this.designerAP.execute({
        userId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurRole: user.role,
        departmentSubjectIds,
        action,
      });

      const msg =
        action === 'ASSIGN'
          ? 'Enseignant désigné Animateur Pédagogique avec succès'
          : 'Désignation AP retirée avec succès';
      res.json({ success: true, message: msg });
    } catch (error) {
      gererErreurUser(error, res, next);
    }
  };
}
