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

      sendTransactionalEmail({
        recipientEmail: String(adminEmail),
        subject: 'EduNexus — Demande reçue, en attente d\'approbation',
        html: `
          <p>Bonjour ${adminPrenom},</p>
          <p>Votre inscription pour l'établissement <strong>${nom}</strong> a bien été enregistrée.</p>
          <p>Notre équipe va examiner votre dossier sous <strong>24 à 48 heures</strong>. Vous recevrez un email dès validation.</p>
          <p style="color:#888;font-size:13px">EduNexus — Plateforme de gestion scolaire · Cameroun</p>
        `,
        template: 'school_invite',
        eventType: 'school_invite',
      }).catch(err => console.error('[Email] Onboarding confirmation error:', err));
    } catch (error) {
      next(error);
    }
  };
}
