/**
 * APPLICATION — Use case : Générer les paiements MINESEC attendus
 *
 * Crée automatiquement les lignes PaiementMinesec selon le niveau de la classe
 * et les tarifs en base (TarifMinesecReference).
 *
 * Règles de génération :
 * - 1er cycle (6e-3e) : SCOLARITE_PREMIER_CYCLE
 * - 2nd cycle (2nde-Tle) : SCOLARITE_SECOND_CYCLE
 * - 3e : + EXAMEN_BEPC
 * - 1ère : + EXAMEN_PROBATOIRE (francophone)
 * - Tle : + EXAMEN_BAC (francophone) ou EXAMEN_GCE_AL (anglophone)
 * - Form 5 : + EXAMEN_GCE_OL (anglophone)
 */
import type { PrismaClient, TypeFraisMinesec } from '@prisma/client';

// Niveaux par cycle
const PREMIER_CYCLE = ['6ème', '5ème', '4ème', '3ème', '6e', '5e', '4e', '3e', 'Form1', 'Form2', 'Form3', 'Form4', 'Form5'];
const DEUXIEME_CYCLE = ['2nde', '1ère', 'Terminale', 'UpperSixth', 'LowerSixth'];
const NIVEAUX_EXAMEN_BEPC = ['3ème', '3e', 'Form5'];
const NIVEAUX_EXAMEN_PROBATOIRE = ['1ère'];
const NIVEAUX_EXAMEN_BAC = ['Terminale'];
const NIVEAUX_GCE_OL = ['Form5'];
const NIVEAUX_GCE_AL = ['UpperSixth'];

export class GenererPaiementsMinesecUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: {
    schoolId: string;
    studentProfileId: string;
    anneeScolaire: string;
  }): Promise<{ generated: number; skipped: number; enrollmentCreated: boolean }> {
    // Récupérer l'élève et sa classe (source du niveau — le champ Enrollment.classe en est dérivé)
    const profile = await this.prisma.studentProfile.findFirst({
      where: { id: cmd.studentProfileId, user: { schoolId: cmd.schoolId } },
      include: {
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { class: { select: { level: true, name: true } } },
          take: 1,
        },
      },
    });
    if (!profile) throw new Error('Élève introuvable');
    const classeActuelle = profile.enrollmentsYearScoped?.[0]?.class;
    const niveau = classeActuelle?.level ?? classeActuelle?.name;
    if (!niveau) throw new Error("Cet élève n'est affecté à aucune classe — impossible de déterminer les frais applicables");

    // Trouver ou créer l'Enrollment de l'année — aucun mécanisme ne le créait auparavant,
    // ce qui rendait ce use case définitivement inatteignable (jamais d'enrollmentId valide).
    let enrollment = await this.prisma.inscriptionMinesec.findUnique({
      where: { studentId_schoolId_anneeScolaire: { studentId: profile.id, schoolId: cmd.schoolId, anneeScolaire: cmd.anneeScolaire } },
    });
    let enrollmentCreated = false;
    if (!enrollment) {
      enrollment = await this.prisma.inscriptionMinesec.create({
        data: { studentId: profile.id, schoolId: cmd.schoolId, anneeScolaire: cmd.anneeScolaire, classe: niveau, status: 'ACTIVE' },
      });
      enrollmentCreated = true;
    }

    const isAnglophone = await this.isEcoleAnglophone(cmd.schoolId);

    // Déterminer les types de frais applicables
    const typesFrais = this.getTypesFraisApplicables(niveau, isAnglophone);

    let generated = 0;
    let skipped = 0;

    for (const typeFrais of typesFrais) {
      // Vérifier si un paiement existe déjà pour ce type + enrollment
      const existing = await this.prisma.paiementMinesec.findFirst({
        where: {
          enrollmentId: enrollment.id,
          typeFrais,
        },
      });
      if (existing) {
        skipped++;
        continue;
      }

      // Récupérer le tarif depuis la base
      const tarif = await this.prisma.tarifMinesecReference.findFirst({
        where: {
          typeFrais,
          anneeScolaire: cmd.anneeScolaire,
          actif: true,
          OR: [
            { niveau: null },
            { niveau: this.getNiveauCategory(niveau) },
          ],
        },
      });

      if (!tarif) {
        skipped++;
        continue;
      }

      // Créer le paiement
      await this.prisma.paiementMinesec.create({
        data: {
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          schoolId: cmd.schoolId,
          anneeScolaire: cmd.anneeScolaire,
          typeFrais,
          montantAttendu: tarif.montantFCFA,
          status: 'IMPAYE',
          dataSource: 'MANUAL',
        },
      });
      generated++;
    }

    return { generated, skipped, enrollmentCreated };
  }

  private getTypesFraisApplicables(niveau: string, isAnglophone: boolean): TypeFraisMinesec[] {
    const types: TypeFraisMinesec[] = [];

    // Scolarité selon le cycle
    if (PREMIER_CYCLE.some(n => niveau.includes(n))) {
      types.push('SCOLARITE_PREMIER_CYCLE');
    } else if (DEUXIEME_CYCLE.some(n => niveau.includes(n))) {
      types.push('SCOLARITE_SECOND_CYCLE');
    }

    // Examens selon le niveau
    if (NIVEAUX_EXAMEN_BEPC.some(n => niveau.includes(n))) {
      types.push(isAnglophone ? 'EXAMEN_GCE_OL' : 'EXAMEN_BEPC');
    }
    if (NIVEAUX_EXAMEN_PROBATOIRE.some(n => niveau.includes(n)) && !isAnglophone) {
      types.push('EXAMEN_PROBATOIRE');
    }
    if (NIVEAUX_EXAMEN_BAC.some(n => niveau.includes(n)) && !isAnglophone) {
      types.push('EXAMEN_BAC');
    }
    if (NIVEAUX_GCE_OL.some(n => niveau.includes(n)) && isAnglophone) {
      types.push('EXAMEN_GCE_OL');
    }
    if (NIVEAUX_GCE_AL.some(n => niveau.includes(n)) && isAnglophone) {
      types.push('EXAMEN_GCE_AL');
    }

    return types;
  }

  private getNiveauCategory(niveau: string): string {
    if (PREMIER_CYCLE.some(n => niveau.includes(n))) return '1er_cycle';
    if (DEUXIEME_CYCLE.some(n => niveau.includes(n))) return '2nd_cycle';
    return '1er_cycle';
  }

  private async isEcoleAnglophone(schoolId: string): Promise<boolean> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { subsystem: true },
    });
    return school?.subsystem === 'ANGLOPHONE' || school?.subsystem === 'BILINGUAL';
  }
}
