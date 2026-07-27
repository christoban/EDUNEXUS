/**
 * APPLICATION LAYER — L'Admin de l'école CIBLE accepte une demande de transfert d'enseignant
 * vacataire. Plus simple que le cas élève (pas de notes/présences à préserver au même degré) :
 * création directe d'un nouveau compte TEACHER dans l'école cible via le flux d'invitation
 * déjà existant — statut ACCEPTED immédiatement, pas d'étape de validation famille (Section 5).
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { InscrireUtilisateurUseCase } from '../user/InscrireUtilisateurUseCase';

export interface AccepterTransfertEnseignantCommande {
  demandeId: string;
  targetSchoolId: string; // dérivé du token Admin, jamais du corps de la requête
}

export class AccepterTransfertEnseignantUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly inscrire: InscrireUtilisateurUseCase,
  ) {}

  async execute(cmd: AccepterTransfertEnseignantCommande) {
    const demande = await this.prisma.groupTransferRequest.findUnique({ where: { id: cmd.demandeId } });
    if (!demande) throw new Error('Demande de transfert introuvable');
    if (demande.targetSchoolId !== cmd.targetSchoolId) throw new Error('Accès refusé');
    if (demande.status !== 'PENDING_TARGET_ADMIN') throw new Error(`Cette demande est déjà au statut ${demande.status}`);
    if (demande.type !== 'STAFF') throw new Error('Cette demande ne concerne pas un enseignant');

    const sourceTeacher = await this.prisma.user.findUnique({
      where: { id: demande.sourceUserId },
      select: { firstName: true, lastName: true, email: true, phone: true },
    });
    if (!sourceTeacher) throw new Error('Enseignant introuvable dans l\'école source');
    if (!sourceTeacher.email) throw new Error('Cet enseignant n\'a pas d\'email — impossible de lui envoyer un lien de création de compte');

    const isDevMode = process.env.EMAIL_DISABLED === 'true';
    const passwordHash = isDevMode
      ? await bcrypt.hash('chris123456789', 10)
      : await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    const resultat = await this.inscrire.execute({
      schoolId: cmd.targetSchoolId,
      role: 'TEACHER',
      email: sourceTeacher.email,
      phone: sourceTeacher.phone ?? undefined,
      firstName: sourceTeacher.firstName,
      lastName: sourceTeacher.lastName,
      passwordHash,
    });

    await this.prisma.groupTransferRequest.update({
      where: { id: demande.id },
      data: { status: 'ACCEPTED', decidedAt: new Date() },
    });

    return { userId: resultat.userId, email: sourceTeacher.email, firstName: sourceTeacher.firstName, lastName: sourceTeacher.lastName };
  }
}
