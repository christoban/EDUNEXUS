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
import type { PrismaClient } from '@prisma/client';
import { resolveLanguage } from '../../utils/languageHelper';

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
    private readonly prisma?: PrismaClient,
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

    // Lookup rapide matière par subjectId
    const matiereParId = new Map(matieres.map(m => [m.id, m]));

    // 4. Calculer les moyennes générales de tous les élèves (pour les rangs)
    // On utilise notesDeClasse (déjà chargé par findByClasse — classId garanti correct)
    const moyennesEleves: { studentId: string; moyenne: number }[] = [];

    for (const eleve of elevesClasse) {
      const notesEleve = notesDeClasse.filter((n) =>
        n.studentId === eleve.id &&
        (n.validationStatus === 'VALIDATED' || n.validationStatus === 'LOCKED')
      );

      let sommeCoefficients = 0;
      let sommePonderee = 0;

      for (const note of notesEleve) {
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

    // 6. Résoudre la langue de rendu (sous-système + section pour le bilingue).
    //    Templates PARTAGÉS (PRIMARY/ANNUAL) : la langue vient d'ici. Les autres
    //    templates encodent déjà leur langue via commande.template.
    let langue: 'fr' | 'en' = 'fr';
    if (this.prisma) {
      const ecole = await this.prisma.school.findUnique({ where: { id: commande.schoolId }, select: { subsystem: true } });
      let sectionCode: string | null = null;
      if (ecole?.subsystem === 'BILINGUAL') {
        const cls = await this.prisma.class.findUnique({ where: { id: commande.classId }, select: { section: { select: { code: true } } } });
        sectionCode = cls?.section?.code ?? null;
      }
      langue = resolveLanguage(ecole?.subsystem, sectionCode);
    }

    // 6bis. Calculer la mention selon le template et la langue
    const mentionEn = (m: number): string =>
      m >= 18 ? 'Excellent' : m >= 16 ? 'Very Good' : m >= 14 ? 'Good' : m >= 12 ? 'Fair' : m >= 10 ? 'Pass' : 'Poor';
    const mentionApc = (m: number): string =>
      m >= 18 ? 'Expert' : m >= 15 ? 'Acquis' : m >= 11 ? 'ECA' : 'NA';
    const mentionFr = (m: number): string =>
      m >= 18 ? 'Excellent' : m >= 16 ? 'Très Bien' : m >= 14 ? 'Bien' : m >= 12 ? 'Assez Bien'
        : m >= 10 ? 'Passable' : m >= 8 ? 'Insuffisant' : m >= 6 ? 'Très Insuffisant' : 'Médiocre';

    const calculerMention = (moyenne: number): string => {
      if (commande.template === 'EN_SECONDARY') return mentionEn(moyenne);
      if (commande.template === 'MONTHLY') return mentionApc(moyenne);
      // Partagés entre sous-systèmes : la langue décide.
      if (commande.template === 'PRIMARY') return langue === 'en' ? mentionEn(moyenne) : mentionApc(moyenne);
      if (commande.template === 'ANNUAL') return langue === 'en' ? mentionEn(moyenne) : mentionFr(moyenne);
      // FR_SECONDARY, TECHNICAL_FR
      return mentionFr(moyenne);
    };

    // 7. Charger les lv2SubjectId de tous les élèves + l'ensemble des matières isLV2 (label "(LV2)")
    //    + la sélection A-Level de chaque élève (pour ne montrer que ses matières choisies).
    const lv2Map = new Map<string, string | null>(); // userId → lv2SubjectId
    const lv2SubjectIds = new Set<string>();          // subjectId des matières taggées isLV2
    const alevelMap = new Map<string, Set<string>>(); // userId → set des subjectId A-Level choisis
    if (this.prisma) {
      const profiles = await (this.prisma as any).studentProfile.findMany({
        where: { userId: { in: elevesClasse.map(e => e.id) } },
        select: { userId: true, lv2SubjectId: true, alevelSubjects: { select: { subjectId: true } } },
      });
      for (const p of profiles) {
        lv2Map.set(p.userId, p.lv2SubjectId ?? null);
        const sel: string[] = (p.alevelSubjects ?? []).map((a: any) => a.subjectId);
        if (sel.length > 0) alevelMap.set(p.userId, new Set(sel));
      }

      const lv2Subjects = await (this.prisma as any).subject.findMany({
        where: { schoolId: commande.schoolId, isLV2: true },
        select: { id: true },
      });
      for (const s of lv2Subjects) lv2SubjectIds.add(s.id);
    }

    // 7b. Générer le bulletin pour chaque élève
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

      // Construire les lignes matière depuis notesDeClasse (classId garanti correct)
      const notesEleve = notesDeClasse.filter((n) =>
        n.studentId === eleve.id &&
        (n.validationStatus === 'VALIDATED' || n.validationStatus === 'LOCKED') &&
        n.sequenceAverage !== undefined
      );

      // Grouper par subjectId — première note rencontrée avec sequenceAverage
      const noteParSubject = new Map<string, typeof notesEleve[0]>();
      for (const n of notesEleve) {
        if (!noteParSubject.has(n.subjectId)) noteParSubject.set(n.subjectId, n);
      }

      const eleveClv2 = lv2Map.get(eleve.id) ?? null;
      const alevelSelection = alevelMap.get(eleve.id) ?? null; // non-null ⇒ élève A-Level

      const lignes = Array.from(noteParSubject.entries()).flatMap(([subjectId, note]) => {
        const matiere = matiereParId.get(subjectId);
        const coeff = matiere?.coefficient ?? note.coefficient;
        const baseName = matiere?.name ?? `Matière (${subjectId.slice(0, 6)})`;
        const subjectEstLV2 = lv2SubjectIds.has(subjectId);

        // Élève A-Level : n'afficher que les matières réellement choisies (coeff A-Level officiel via matiere).
        if (alevelSelection && !alevelSelection.has(subjectId)) {
          return [];
        }

        // Anomalie : note dans une matière LV2 qui n'est pas la LV2 de l'élève → exclure + warning.
        if (subjectEstLV2 && eleveClv2 !== subjectId) {
          console.warn(
            `[Bulletin] Élève ${eleve.id} possède une note dans la LV2 "${baseName}" (${subjectId}) ` +
            `qui n'est pas sa LV2 affectée (${eleveClv2 ?? 'aucune'}) — ligne exclue du bulletin.`,
          );
          return [];
        }

        const isLignLV2 = subjectEstLV2 && eleveClv2 === subjectId;
        return [{
          id: crypto.randomUUID(),
          subjectId,
          subjectName: isLignLV2 ? `${baseName} (LV2)` : baseName,
          coefficient: coeff,
          seq1Score: note.toObject().sequenceScore,
          subjectAverage: note.sequenceAverage!,
          weightedScore: note.sequenceAverage! * coeff,
        }];
      });

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
        langue,
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