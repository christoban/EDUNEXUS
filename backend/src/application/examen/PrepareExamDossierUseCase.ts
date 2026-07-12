/**
 * APPLICATION — Use case : Préparer le dossier d'inscription à un examen
 *
 * Validations :
 * 1. L'élève a un matriculeNational → sinon blocage
 * 2. Le paiement MINESEC pour cet examen est PAYE ou VERIFIE → sinon avertissement
 * 3. La classe correspond au type d'examen
 */
import type { PrismaClient } from '@prisma/client';
import type { PrepareExamDossierCommande, ExamDossier } from './types';

// Correspondance niveau → type d'examen
const NIVEAU_TO_EXAMEN: Record<string, string[]> = {
  '3ème': ['BEPC'], '3e': ['BEPC'], 'Form5': ['GCE_OL'],
  '1ère': ['PROBATOIRE'], 'UpperSixth': ['GCE_AL'],
  'Terminale': ['BAC'], 'UpperSixth_Tle': ['GCE_AL', 'BAC'],
};

const EXAMEN_TO_FRAIS: Record<string, string> = {
  'BEPC': 'EXAMEN_BEPC',
  'PROBATOIRE': 'EXAMEN_PROBATOIRE',
  'BAC': 'EXAMEN_BAC',
  'GCE_OL': 'EXAMEN_GCE_OL',
  'GCE_AL': 'EXAMEN_GCE_AL',
};

export class PrepareExamDossierUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: PrepareExamDossierCommande): Promise<ExamDossier> {
    // Récupérer le profil élève
    const profile = await (this.prisma as any).studentProfile.findFirst({
      where: { user: { id: cmd.studentUserId, schoolId: cmd.schoolId } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        class: { select: { name: true, level: true } },
      },
    });
    if (!profile) throw new Error('Élève introuvable');

    // Validation 1 : matricule obligatoire
    if (!profile.matricule) {
      throw new Error('Cet élève n\'a pas de matricule national. Impossible de l\'inscrire à un examen officiel.');
    }

    // Validation 2 : vérifier que le type d'examen est cohérent avec la classe
    const niveau = profile.class?.level ?? '';
    const examensApplicables = NIVEAU_TO_EXAMEN[niveau] ?? [];
    if (examensApplicables.length > 0 && !examensApplicables.includes(cmd.typeExamen)) {
      throw new Error(`Le type d'examen ${cmd.typeExamen} n'est pas applicable pour le niveau ${niveau}`);
    }

    // Vérifier si une inscription existe déjà
    const existing = await (this.prisma as any).examRegistration.findFirst({
      where: {
        studentId: profile.id,
        anneeScolaire: cmd.anneeScolaire,
        typeExamen: cmd.typeExamen,
      },
    });
    if (existing) {
      throw new Error('Cet élève est déjà inscrit à cet examen');
    }

    // Vérifier le paiement MINESEC
    const fraisKey = EXAMEN_TO_FRAIS[cmd.typeExamen];
    let paiementStatus: string | null = null;
    let paiementId: string | null = null;
    if (fraisKey) {
      const paiement = await (this.prisma as any).paiementMinesec.findFirst({
        where: {
          studentId: profile.id,
          typeFrais: fraisKey,
          anneeScolaire: cmd.anneeScolaire,
        },
      });
      paiementStatus = paiement?.status ?? null;
      paiementId = paiement?.id ?? null;
    }

    // Vérifier la date de vérification du matricule
    const matriculeVerifie = profile.matriculeVerifieAt !== null;

    // Trouver ou créer l'Enrollment de l'année (même logique que GenererPaiementsMinesecUseCase —
    // avant ce correctif, enrollmentId était laissé à '' faute de mécanisme de création).
    let enrollment = await (this.prisma as any).enrollment.findUnique({
      where: { studentId_schoolId_anneeScolaire: { studentId: profile.id, schoolId: cmd.schoolId, anneeScolaire: cmd.anneeScolaire } },
    });
    if (!enrollment) {
      enrollment = await (this.prisma as any).enrollment.create({
        data: { studentId: profile.id, schoolId: cmd.schoolId, anneeScolaire: cmd.anneeScolaire, classe: niveau, status: 'ACTIVE' },
      });
    }

    // Créer l'inscription
    const session = new Date().getFullYear();
    const registration = await (this.prisma as any).examRegistration.create({
      data: {
        studentId: profile.id,
        enrollmentId: enrollment.id,
        schoolId: cmd.schoolId,
        anneeScolaire: cmd.anneeScolaire,
        typeExamen: cmd.typeExamen,
        session,
        matriculeNational: profile.matricule,
        paiementMinesecId: paiementId,
        status: 'DRAFT',
      },
    });

    // Construire le message
    let message = 'Dossier créé avec succès.';
    if (!matriculeVerifie) {
      message += ' Attention : le matricule n\'a pas encore été vérifié sur cartescolaire.cm.';
    }
    if (paiementStatus === 'IMPAYE') {
      message += ' Attention : les frais d\'examen n\'ont pas encore été payés.';
    } else if (!paiementStatus) {
      message += ' Aucun frais d\'examen enregistré pour cet élève.';
    }

    return {
      registrationId: registration.id,
      student: {
        nom: profile.user.lastName,
        prenom: profile.user.firstName,
        matricule: profile.matricule,
        classe: profile.class?.name ?? '',
      },
      typeExamen: cmd.typeExamen,
      anneeScolaire: cmd.anneeScolaire,
      session,
      status: 'DRAFT',
      matriculeVerifie,
      paiementMinesecStatus: paiementStatus,
      message,
    };
  }
}
