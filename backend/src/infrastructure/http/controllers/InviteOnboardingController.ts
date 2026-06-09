import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { sendTransactionalEmail } from '../../../services/emailService';

export class InviteOnboardingController {
  constructor(private readonly prisma: PrismaClient) {}

  // GET /api/v2/onboarding/invite/:token
  validateInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token as string;
      const invite = await this.prisma.schoolInvite.findUnique({
        where: { token },
        select: { id: true, email: true, schoolName: true, plan: true, status: true, expiresAt: true, notes: true },
      });

      if (!invite) {
        res.status(404).json({ success: false, message: 'Invitation introuvable ou invalide.' });
        return;
      }
      if (invite.status === 'USED') {
        res.status(410).json({ success: false, message: 'Cette invitation a déjà été utilisée. Votre espace est en cours de configuration.' });
        return;
      }
      if (invite.status === 'EXPIRED' || invite.expiresAt < new Date()) {
        res.status(410).json({ success: false, message: 'Cette invitation a expiré. Contactez EduNexus pour en obtenir une nouvelle.' });
        return;
      }

      res.json({
        success: true,
        data: {
          schoolName: invite.schoolName,
          email: invite.email,
          plan: invite.plan,
          notes: invite.notes ?? null,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/onboarding/invite/:token/complete
  completeOnboarding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token as string;
      const {
        nom, subdomain, adresse, ville, region, telephone, email,
        subsystem, educationType, ownership,
        adminPrenom, adminNom, adminEmail, password, logoBase64,
      } = req.body;

      const required = ['nom', 'subdomain', 'subsystem', 'educationType', 'ownership', 'adminPrenom', 'adminNom', 'adminEmail', 'password'];
      const missing = required.filter(f => !String(req.body[f] ?? '').trim());
      if (missing.length > 0) {
        res.status(400).json({ success: false, message: `Champs manquants : ${missing.join(', ')}` });
        return;
      }
      if (String(password).length < 8) {
        res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' });
        return;
      }

      const invite2 = await this.prisma.schoolInvite.findUnique({ where: { token } });
      if (!invite2 || invite2.status !== 'PENDING') {
        res.status(404).json({ success: false, message: 'Invitation invalide ou déjà utilisée.' });
        return;
      }
      if (invite2.expiresAt < new Date()) {
        await this.prisma.schoolInvite.update({ where: { token }, data: { status: 'EXPIRED' } });
        res.status(410).json({ success: false, message: 'Cette invitation a expiré.' });
        return;
      }

      const subdomainClean = String(subdomain).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const existing = await this.prisma.school.findUnique({ where: { subdomain: subdomainClean } });
      if (existing) {
        res.status(409).json({ success: false, message: `Le sous-domaine "${subdomainClean}" est déjà pris. Choisissez-en un autre.` });
        return;
      }

      const passwordHash = await bcrypt.hash(String(password), 10);

      const { school } = await this.prisma.$transaction(async (tx) => {
        const validLogo = typeof logoBase64 === 'string' && logoBase64.startsWith('data:image/') && logoBase64.length <= 2_000_000
          ? logoBase64
          : null;

        const school = await tx.school.create({
          data: {
            name: String(nom).trim(),
            subdomain: subdomainClean,
            address: adresse?.trim() || null,
            city: ville?.trim() || null,
            region: region?.trim() || null,
            phone: telephone?.trim() || null,
            email: email?.trim() || null,
            subsystem,
            educationType,
            ownership,
            status: 'PENDING',
            plan: invite2.plan,
            logoUrl: validLogo,
          },
        });

        await tx.user.create({
          data: {
            schoolId: school.id,
            role: 'ADMIN',
            email: String(adminEmail).trim().toLowerCase(),
            firstName: String(adminPrenom).trim(),
            lastName: String(adminNom).trim(),
            passwordHash,
          },
        });

        await tx.schoolInvite.update({
          where: { token },
          data: { status: 'USED', schoolId: school.id },
        });

        return { school };
      });

      res.status(201).json({
        success: true,
        data: {
          schoolId: school.id,
          message: 'Votre demande a été soumise avec succès.',
        },
      });

      // Email de confirmation à l'administrateur de l'école
      sendTransactionalEmail({
        recipientEmail: String(adminEmail),
        subject: 'EduNexus — Demande reçue, en attente d\'approbation',
        html: `
          <p>Bonjour ${String(adminPrenom).trim()},</p>
          <p>Votre inscription pour l'établissement <strong>${String(nom).trim()}</strong> a bien été enregistrée.</p>
          <p>Notre équipe va examiner votre dossier sous <strong>24 à 48 heures</strong>. Vous recevrez un email dès validation.</p>
          <p style="color:#888;font-size:13px">EduNexus — Plateforme de gestion scolaire · Cameroun</p>
        `,
        template: 'school_invite',
        eventType: 'school_invite',
      }).catch(err => console.error('[Email] Onboarding confirmation error:', err));

      // Notification au Super Admin — envoyée via Resend (destinataire = SUPER_ADMIN_EMAIL)
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'christoban2005@gmail.com';
      const masterDashboardUrl = `${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/master/dashboard`;
      const planLabels: Record<string, string> = { DISCOVERY: 'Découverte (gratuit)', STANDARD: 'Standard', PREMIUM: 'Premium' };

      sendTransactionalEmail({
        recipientEmail: superAdminEmail,
        subject: `🏫 Nouvelle demande EduNexus — ${String(nom).trim()}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;">
            <div style="background:#1a2e1e;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:white;margin:0;font-size:22px;">🎓 EduNexus — Nouvelle demande d'inscription</h1>
            </div>
            <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">
              <p style="color:#1a1209;font-size:16px;margin-top:0;">
                Un établissement vient de compléter son formulaire d'inscription et attend votre approbation.
              </p>

              <h2 style="color:#059669;font-size:18px;margin-bottom:16px;">🏫 Informations sur l'établissement</h2>
              <table style="width:100%;border-collapse:collapse;font-size:15px;">
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;width:40%;">Nom</td>
                  <td style="padding:10px 12px;color:#1a1209;font-weight:800;">${String(nom).trim()}</td>
                </tr>
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Sous-domaine</td>
                  <td style="padding:10px 12px;color:#1a1209;font-family:monospace;">${subdomainClean}</td>
                </tr>
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Plan tarifaire</td>
                  <td style="padding:10px 12px;color:#1a1209;">${planLabels[invite2.plan] ?? invite2.plan}</td>
                </tr>
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Sous-système</td>
                  <td style="padding:10px 12px;color:#1a1209;">${subsystem ?? '—'}</td>
                </tr>
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Type d'enseignement</td>
                  <td style="padding:10px 12px;color:#1a1209;">${educationType ?? '—'}</td>
                </tr>
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Statut juridique</td>
                  <td style="padding:10px 12px;color:#1a1209;">${ownership ?? '—'}</td>
                </tr>
                ${ville ? `<tr style="border-bottom:1px solid #f0ebe3;"><td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Ville</td><td style="padding:10px 12px;color:#1a1209;">${String(ville).trim()}${region ? ` · ${String(region).trim()}` : ''}</td></tr>` : ''}
                ${telephone ? `<tr style="border-bottom:1px solid #f0ebe3;"><td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Téléphone</td><td style="padding:10px 12px;color:#1a1209;">${String(telephone).trim()}</td></tr>` : ''}
              </table>

              <h2 style="color:#1d4ed8;font-size:18px;margin-top:28px;margin-bottom:16px;">👤 Administrateur de l'établissement</h2>
              <table style="width:100%;border-collapse:collapse;font-size:15px;">
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;width:40%;">Nom complet</td>
                  <td style="padding:10px 12px;color:#1a1209;font-weight:800;">${String(adminPrenom).trim()} ${String(adminNom).trim()}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Email</td>
                  <td style="padding:10px 12px;"><a href="mailto:${String(adminEmail).trim()}" style="color:#059669;font-weight:700;">${String(adminEmail).trim()}</a></td>
                </tr>
              </table>

              <div style="text-align:center;margin:32px 0 16px;">
                <a href="${masterDashboardUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                  🔍 Examiner la demande sur le dashboard
                </a>
              </div>

              <p style="color:#a89478;font-size:13px;text-align:center;margin:0;">
                Lien direct : <a href="${masterDashboardUrl}" style="color:#059669;">${masterDashboardUrl}</a>
              </p>
              <hr style="border:none;border-top:1px solid #e8e0d4;margin:24px 0;" />
              <p style="color:#a89478;font-size:12px;text-align:center;margin:0;">
                EduNexus · Plateforme de gestion scolaire · Cameroun
              </p>
            </div>
          </div>
        `,
        template: 'school_pending_notification',
        eventType: 'school_pending_notification',
      }).catch(err => console.error('[Email] Super admin notification error:', err));
    } catch (error) {
      next(error);
    }
  };
}
