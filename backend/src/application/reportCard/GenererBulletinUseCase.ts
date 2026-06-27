/**
 * APPLICATION LAYER — Use Case : Générer les bulletins d'une classe
 *
 * Loi 4 : bloqué si une note n'est pas VALIDATED.
 * Calcule les moyennes, rangs, mentions puis génère les PDFs.
 */
import { Bulletin } from '@domain/entities/Bulletin';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { PresenceRepository } from '@domain/ports/repositories/PresenceRepository';
import type { PdfService } from '@domain/ports/services/PdfService';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import type { BulletinTemplate } from '@domain/types/enums';

export interface GenererBulletinCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  academicYearId: string;
  template: BulletinTemplate;
  nomEtablissement: string;
  logoUrl?: string;
  demandeurId: string;
}

export interface GenererBulletinResultat {
  bulletinsGeneres: number;
  bulletinsIgnores: number; // déjà générés
  message: string;
}

export class GenererBulletinUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly bulletinRepository: BulletinRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly userRepository: UserRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly pdfService: PdfService,
    private readonly classCouncilRepository: ClassCouncilRepository,
  ) {}

  async execute(commande: GenererBulletinCommande): Promise<GenererBulletinResultat> {
    // 1. Vérifier Loi 4 — toutes les notes doivent être VALIDATED
    const notesNonValidees = await this.noteRepository.findNotesNonValideesParClasse(
      commande.classId,
      commande.academicPeriodId
    );

    const classe = await this.classeRepository.findById(commande.classId);
    if (!classe) throw new Error(`Classe introuvable : ${commande.classId}`);

    // Lance BulletinBloqueError si des notes ne sont pas validées
    Bulletin.verifierPrerequisGeneration(notesNonValidees, classe.nomComplet);

    // Loi 5b — le conseil de classe doit être LOCKED avant la génération des bulletins
    const conseilVerrouille = await this.classCouncilRepository.sessionVerrouilleeExiste(
      commande.classId,
      commande.academicPeriodId,
    );
    if (!conseilVerrouille) {
      throw new Error(
        `Le Conseil de Classe de "${classe.nomComplet}" doit être tenu et verrouillé avant de générer les bulletins.`,
      );
    }

    // 2. Récupérer les élèves ayant des notes dans cette classe sur la période
    // findByRole renvoie TOUS les élèves de l'école — on filtre via les notes par séquence
    const sequences = await this.anneeRepository.findSequencesByPeriode(commande.academicPeriodId);
    const notesDeClasse: import('@domain/entities/Note').Note[] = [];
    for (const seq of sequences) {
      const notes = await this.noteRepository.findByClasse(commande.classId, seq.id);
      notesDeClasse.push(...notes);
    }
    const studentIdsClasse = [...new Set(notesDeClasse.map((n) => n.studentId))];

    const eleves = await this.userRepository.findByRole(commande.schoolId, 'STUDENT');
    const elevesClasse = eleves.filter((e) => e.isActive && studentIdsClasse.includes(e.id));

    if (elevesClasse.length === 0) {
      return { bulletinsGeneres: 0, bulletinsIgnores: 0, message: 'Aucun élève avec des notes validées dans cette classe' };
    }

    // 3. Récupérer les matières et la période
    const matieres = await this.matiereRepository.findBySchool(commande.schoolId);
    const periode = await this.anneeRepository.findPeriodeById(commande.academicPeriodId);
    if (!periode) throw new Error('Période académique introuvable');

    const annee = await this.anneeRepository.findById(commande.academicYearId);
    if (!annee) throw new Error('Année académique introuvable');

    // 4. Calculer les moyennes générales de tous les élèves (pour les rangs)
    const moyennesEleves: { studentId: string; moyenne: number }[] = [];

    for (const eleve of elevesClasse) {
      const notes = await this.noteRepository.findByEleve(eleve.id, commande.academicYearId);
      const notesClasse = notes.filter((n) =>
        n.classId === commande.classId && n.estValidee()
      );

      let sommeCoefficients = 0;
      let sommePonderee = 0;

      for (const note of notesClasse) {
        if (note.sequenceAverage !== undefined) {
          sommePonderee += note.sequenceAverage * note.coefficient;
          sommeCoefficients += note.coefficient;
        }
      }

      const moyenne = sommeCoefficients > 0
        ? Math.round((sommePonderee / sommeCoefficients) * 100) / 100
        : 0;

      moyennesEleves.push({ studentId: eleve.id, moyenne });
    }

    // 5. Calculer les rangs (tri décroissant)
    const classeesParMoyenne = [...moyennesEleves].sort((a, b) => b.moyenne - a.moyenne);
    const rangs = new Map<string, number>();
    classeesParMoyenne.forEach((item, index) => {
      rangs.set(item.studentId, index + 1);
    });

    // 6. Calculer la mention selon les règles MINESEC
    const calculerMention = (moyenne: number): string => {
      if (moyenne >= 18) return 'Excellent';
      if (moyenne >= 16) return 'Très Bien';
      if (moyenne >= 14) return 'Bien';
      if (moyenne >= 12) return 'Assez Bien';
      if (moyenne >= 10) return 'Passable';
      if (moyenne >= 8) return 'Insuffisant';
      if (moyenne >= 6) return 'Très Insuffisant';
      return 'Médiocre';
    };

    // 7. Générer le bulletin pour chaque élève
    let generes = 0;
    let ignores = 0;

    for (const eleve of elevesClasse) {
      // Vérifier si bulletin déjà généré
      const bulletinExistant = await this.bulletinRepository.findByEleveEtPeriode(
        eleve.id,
        commande.academicPeriodId
      );
      if (bulletinExistant?.estGenere()) {
        ignores++;
        continue;
      }

      const moyenneEleve = moyennesEleves.find((m) => m.studentId === eleve.id)?.moyenne ?? 0;
      const rang = rangs.get(eleve.id) ?? elevesClasse.length;
      const mention = calculerMention(moyenneEleve);

      // Statistiques présences
      const statsPresence = await this.presenceRepository.getStatistiquesEleve(
        eleve.id,
        commande.academicPeriodId
      );

      // Créer ou réutiliser le bulletin
      const bulletin = bulletinExistant ?? Bulletin.create({
        schoolId: commande.schoolId,
        studentId: eleve.id,
        academicYearId: commande.academicYearId,
        academicPeriodId: commande.academicPeriodId,
        template: commande.template,
      });

      // Construire les lignes matière
      const notes = await this.noteRepository.findByEleve(eleve.id, commande.academicYearId);
      const lignes = matieres.map((matiere) => {
        const note = notes.find((n) =>
          n.subjectId === matiere.id &&
          n.classId === commande.classId
        );
        return {
          id: crypto.randomUUID(),
          subjectId: matiere.id,
          subjectName: matiere.name,
          coefficient: matiere.coefficient,
          seq1Score: note?.toObject().sequenceScore,
          subjectAverage: note?.sequenceAverage,
          weightedScore: note?.sequenceAverage
            ? note.sequenceAverage * matiere.coefficient
            : undefined,
        };
      }).filter((l) => l.subjectAverage !== undefined);

      bulletin.definirLignesMatiere(lignes);
      bulletin.definirResultats({
        generalAverage: moyenneEleve,
        rank: rang,
        totalStudents: elevesClasse.length,
        mention,
        absenceCount: statsPresence.joursAbsent,
      });

      // Générer le PDF
      const professorPrincipal = classe.professorPrincipalId
        ? await this.userRepository.findById(classe.professorPrincipalId)
        : null;

      await this.pdfService.genererBulletin({
        bulletin: bulletin.toObject(),
        nomEleve: eleve.nomComplet,
        nomClasse: classe.nomComplet,
        nomEtablissement: commande.nomEtablissement,
        logoUrl: commande.logoUrl,
        anneeAcademique: annee.name,
        nomPeriode: periode.name,
        nomProfesseurPrincipal: professorPrincipal?.nomComplet,
        moyenneClasse: moyennesEleves.reduce((s, m) => s + m.moyenne, 0) / elevesClasse.length,
      });

      const pdfUrl = `bulletins/${commande.schoolId}/${bulletin.id}.pdf`;
      bulletin.marquerGenere(pdfUrl);

      // Sauvegarder
      if (bulletinExistant) {
        await this.bulletinRepository.update(bulletin);
      } else {
        await this.bulletinRepository.save(bulletin);
      }

      // Loi 6 — verrouiller les notes VALIDATED après génération du bulletin
      await this.noteRepository.verrouillerNotesValidees(
        eleve.id,
        commande.classId,
        commande.academicPeriodId,
      );

      generes++;
    }

    return {
      bulletinsGeneres: generes,
      bulletinsIgnores: ignores,
      message: `${generes} bulletin(s) généré(s) — ${ignores} déjà généré(s) ignoré(s)`,
    };
  }
}