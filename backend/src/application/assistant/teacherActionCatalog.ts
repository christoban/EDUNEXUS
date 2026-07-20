/**
 * APPLICATION LAYER — Catalogue d'actions de l'assistant IA (copilot), rôle TEACHER.
 *
 * Même principe que `adminActionCatalog.ts` (voir ce fichier pour le contexte complet du
 * chantier) : chaque entrée mappe UNE intention en langage naturel vers UN use case déjà
 * existant, jamais de réimplémentation de logique métier. Périmètre resserré à ce qu'un
 * enseignant fait au quotidien (Section 6.2 du plan) : Notes, Présences, Cahier de texte,
 * demande de rattrapage — pas de gestion de programme/bulletins/emploi du temps (formulaires
 * structurés, hors chat, même logique que le catalogue Admin).
 *
 * Chaque action porte `allowedRoles: ['TEACHER']` — visible UNIQUEMENT à ce rôle, y compris
 * pas à l'ADMIN (ces actions sont scopées à « mes classes / mes notes », sans sens hors du
 * contexte personnel d'un enseignant connecté — voir catalogShared.ts pour le mécanisme).
 */
import { z } from 'zod';
import type { SaisirNoteUseCase } from '@application/grade/SaisirNoteUseCase';
import type { SoumettreNoteUseCase } from '@application/grade/SoumettreNoteUseCase';
import type { EnregistrerPresenceUseCase } from '@application/attendance/EnregistrerPresenceUseCase';
import type { DemanderRattrapageUseCase } from '@application/timetable/DemanderRattrapageUseCase';
import {
  type ActionContext,
  type ActionDefinition,
  resolveClass,
  resolveSubject,
  resolveStudent,
  resolveCurrentAcademicYear,
  resolveCurrentPeriod,
  resolveCurrentSequence,
} from '@application/assistant/catalogShared';

export interface TeacherActionDeps {
  saisirNote: SaisirNoteUseCase;
  soumettreNote: SoumettreNoteUseCase;
  enregistrerPresence: EnregistrerPresenceUseCase;
  demanderRattrapage: DemanderRattrapageUseCase;
}

async function verifierAssignation(ctx: ActionContext, classId: string, subjectId: string, classeName: string, subjectName: string): Promise<void> {
  const assignation = await ctx.prisma.teachingAssignment.findFirst({
    where: { teacherId: ctx.userId, classId, subjectId },
  });
  if (!assignation) throw new Error(`Vous n'êtes pas assigné à l'enseignement de ${subjectName} pour ${classeName}.`);
}

export function buildTeacherActionCatalog(deps: TeacherActionDeps): ActionDefinition[] {
  return [
    // ═══ Notes ═══

    // 1. Saisir la note d'un élève — NON destructif (réversible tant que la note reste en brouillon)
    {
      name: 'saisir_note',
      description: "Saisit la note d'un élève dans une matière que vous enseignez, pour la séquence courante. La note est enregistrée en brouillon — elle doit ensuite être soumise pour validation.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().min(1).describe("Classe de l'élève"),
        subjectName: z.string().min(1),
        score: z.number().min(0).describe('Note obtenue'),
        maxValue: z.number().optional().describe('Note maximale — 20 par défaut'),
        coefficient: z.number().optional(),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const year = await resolveCurrentAcademicYear(ctx);
        const sequence = await resolveCurrentSequence(ctx);
        const r = await deps.saisirNote.execute({
          schoolId: ctx.schoolId,
          studentId: student.id,
          subjectId: subject.id,
          classId: classe.id,
          academicYearId: year.id,
          sequenceId: sequence.id,
          recordedById: ctx.userId,
          sequenceScore: input.score,
          maxValue: input.maxValue,
          coefficient: input.coefficient,
        });
        return {
          resultLabel: `Note de ${input.score}${input.maxValue ? `/${input.maxValue}` : ''} saisie pour ${student.name} en ${subject.name} (${sequence.name})`,
          undoData: { noteId: r.noteId },
          section: 'grades',
          entity: 'grade',
        };
      },
      async undo(_params, undoData, ctx) {
        await ctx.prisma.grade.delete({ where: { id: String(undoData.noteId) } });
      },
    },

    // 2. Soumettre mes notes d'une classe/matière pour validation — NON annulable
    {
      name: 'soumettre_mes_notes_classe',
      description: "Soumet pour validation toutes vos notes en brouillon (ou rejetées) d'une classe et d'une matière que vous enseignez, pour la séquence courante.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({ className: z.string().min(1), subjectName: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        const sequence = await resolveCurrentSequence(ctx);
        const r = await ctx.prisma.grade.updateMany({
          where: {
            schoolId: ctx.schoolId,
            classId: classe.id,
            subjectId: subject.id,
            sequenceId: sequence.id,
            recordedById: ctx.userId,
            validationStatus: { in: ['DRAFT', 'REJECTED'] },
          },
          data: { validationStatus: 'SUBMITTED' },
        });
        return {
          resultLabel: `${r.count} note(s) soumise(s) pour validation — ${classe.name}, ${subject.name} (${sequence.name})`,
          section: 'grades',
          entity: 'grade',
        };
      },
      async undo() {
        throw new Error('La soumission de notes ne peut pas être annulée depuis le copilot — utilisez l\'écran Notes.');
      },
    },

    // 3. Mes notes en attente — LECTURE SEULE
    {
      name: 'mes_notes_en_attente',
      description: "Indique où vous en êtes dans la saisie des notes d'une classe et d'une matière que vous enseignez, pour la séquence courante (combien saisies, combien encore en brouillon).",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({ className: z.string().min(1), subjectName: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        const sequence = await resolveCurrentSequence(ctx);
        const [total, draft, saisies] = await Promise.all([
          ctx.prisma.studentProfile.count({ where: { classId: classe.id } }),
          ctx.prisma.grade.count({ where: { schoolId: ctx.schoolId, classId: classe.id, subjectId: subject.id, sequenceId: sequence.id, recordedById: ctx.userId, validationStatus: 'DRAFT' } }),
          ctx.prisma.grade.count({ where: { schoolId: ctx.schoolId, classId: classe.id, subjectId: subject.id, sequenceId: sequence.id, recordedById: ctx.userId } }),
        ]);
        return {
          resultLabel: `${classe.name}, ${subject.name} (${sequence.name}) : ${saisies}/${total} élève(s) noté(s), dont ${draft} en brouillon (non soumis).`,
          section: 'grades',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 4. Moyenne de ma classe dans ma matière — LECTURE SEULE
    {
      name: 'moyenne_ma_classe_matiere',
      description: "Donne la moyenne de classe dans une matière que vous enseignez, pour la séquence courante.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({ className: z.string().min(1), subjectName: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        await verifierAssignation(ctx, classe.id, subject.id, classe.name, subject.name);
        const sequence = await resolveCurrentSequence(ctx);
        const grades = await ctx.prisma.grade.findMany({
          where: { schoolId: ctx.schoolId, classId: classe.id, subjectId: subject.id, sequenceId: sequence.id, sequenceAverage: { not: null } },
          select: { sequenceAverage: true },
        });
        if (grades.length === 0) {
          return { resultLabel: `Aucune note calculée pour ${subject.name} en ${classe.name} (séquence ${sequence.name}).`, section: 'grades' };
        }
        const moyenne = Math.round((grades.reduce((s, g) => s + (g.sequenceAverage as number), 0) / grades.length) * 100) / 100;
        return {
          resultLabel: `Moyenne de ${classe.name} en ${subject.name} (séquence ${sequence.name}) : ${moyenne}/20 (${grades.length} note(s)).`,
          section: 'grades',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Présences ═══

    // 5. Marquer la présence d'un élève — NON destructif (réversible)
    {
      name: 'marquer_absence_eleve',
      description: "Enregistre le statut de présence (présent, absent, ou en retard) d'UN élève pour votre cours, à la date du jour ou une date précisée.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().min(1),
        subjectName: z.string().optional(),
        statut: z.enum(['PRESENT', 'ABSENT', 'LATE']),
        period: z.enum(['MORNING', 'AFTERNOON']).optional().describe('Créneau — matin par défaut'),
        date: z.string().optional().describe('Date au format YYYY-MM-DD — aujourd\'hui par défaut'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const subject = input.subjectName ? await resolveSubject(ctx, input.subjectName) : undefined;
        const academicPeriod = await resolveCurrentPeriod(ctx);
        const date = input.date ? new Date(input.date) : new Date();
        const attendancePeriod = input.period ?? 'MORNING';

        await deps.enregistrerPresence.execute({
          schoolId: ctx.schoolId,
          classId: classe.id,
          academicPeriodId: academicPeriod.id,
          subjectId: subject?.id,
          teacherId: ctx.userId,
          recordedById: ctx.userId,
          date,
          period: attendancePeriod,
          presences: [{ studentId: student.id, statut: input.statut }],
        });
        const record = await ctx.prisma.attendance.findFirst({
          where: { schoolId: ctx.schoolId, studentId: student.id, classId: classe.id, date, period: attendancePeriod },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        const labelStatut = input.statut === 'PRESENT' ? 'présent' : input.statut === 'ABSENT' ? 'absent' : 'en retard';
        return {
          resultLabel: `${student.name} marqué ${labelStatut} le ${date.toLocaleDateString('fr-FR')} (${classe.name}).`,
          undoData: record ? { attendanceId: record.id } : undefined,
          section: 'attendance',
          entity: 'attendance',
        };
      },
      async undo(_params, undoData, ctx) {
        if (!undoData.attendanceId) throw new Error('Annulation impossible — enregistrement introuvable.');
        await ctx.prisma.attendance.delete({ where: { id: String(undoData.attendanceId) } });
      },
    },

    // 6. Taux de présence d'une classe — LECTURE SEULE
    {
      name: 'mes_stats_presence_classe',
      description: "Donne le taux de présence d'une classe que vous encadrez, depuis une date donnée (ce mois-ci par défaut).",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({
        className: z.string().min(1),
        depuis: z.string().optional().describe('Date de début au format YYYY-MM-DD — début du mois courant par défaut'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const now = new Date();
        const depuis = input.depuis ? new Date(input.depuis) : new Date(now.getFullYear(), now.getMonth(), 1);
        const records = await ctx.prisma.attendance.findMany({
          where: { schoolId: ctx.schoolId, classId: classe.id, teacherId: ctx.userId, date: { gte: depuis } },
          select: { status: true },
        });
        if (records.length === 0) {
          return { resultLabel: `Aucun enregistrement de présence pour ${classe.name} depuis le ${depuis.toLocaleDateString('fr-FR')}.`, section: 'attendance' };
        }
        const present = records.filter((r) => r.status === 'PRESENT').length;
        const taux = Math.round((present / records.length) * 10000) / 100;
        return {
          resultLabel: `${classe.name} : taux de présence de ${taux}% depuis le ${depuis.toLocaleDateString('fr-FR')} (${records.length} enregistrement(s)).`,
          section: 'attendance',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Cahier de texte ═══

    // 7. Ajouter une entrée au cahier de texte — NON destructif (réversible)
    {
      name: 'ajouter_cahier_texte',
      description: "Ajoute une entrée au cahier de texte pour une classe et une matière que vous enseignez : ce qui a été fait en cours, et les devoirs donnés le cas échéant.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({
        className: z.string().min(1),
        subjectName: z.string().min(1),
        contenu: z.string().min(1).describe('Ce qui a été enseigné pendant le cours'),
        devoirs: z.string().optional().describe('Devoirs donnés aux élèves, si applicable'),
        date: z.string().optional().describe('Date au format YYYY-MM-DD — aujourd\'hui par défaut'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        const year = await resolveCurrentAcademicYear(ctx);
        const entry = await ctx.prisma.cahierDeTexte.create({
          data: {
            schoolId: ctx.schoolId,
            teacherId: ctx.userId,
            classId: classe.id,
            subjectId: subject.id,
            academicYearId: year.id,
            date: input.date ? new Date(input.date) : new Date(),
            contenuLibre: input.contenu,
            devoirsDonnes: input.devoirs,
          },
          select: { id: true },
        });
        return {
          resultLabel: `Entrée ajoutée au cahier de texte — ${classe.name}, ${subject.name}`,
          undoData: { entryId: entry.id },
          section: 'cahier-de-texte',
          entity: 'cahierDeTexte',
        };
      },
      async undo(_params, undoData, ctx) {
        await ctx.prisma.cahierDeTexte.delete({ where: { id: String(undoData.entryId) } });
      },
    },

    // ═══ Emploi du temps ═══

    // 8. Demander un rattrapage — NON annulable (notification déjà envoyée aux censeurs)
    {
      name: 'demander_rattrapage',
      description: "Demande une session de rattrapage pour un cours manqué, envoyée pour validation aux censeurs/surveillants généraux de l'établissement.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({
        className: z.string().min(1),
        subjectName: z.string().optional(),
        proposedDate: z.string().describe('Date proposée au format YYYY-MM-DD'),
        proposedStartTime: z.string().optional().describe('Heure de début, ex. "14:00"'),
        proposedEndTime: z.string().optional(),
        reason: z.string().optional(),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = input.subjectName ? await resolveSubject(ctx, input.subjectName) : undefined;
        await deps.demanderRattrapage.execute({
          schoolId: ctx.schoolId,
          classId: classe.id,
          subjectId: subject?.id,
          teacherId: ctx.userId,
          proposedDate: new Date(input.proposedDate),
          proposedStartTime: input.proposedStartTime,
          proposedEndTime: input.proposedEndTime,
          reason: input.reason,
        });
        return {
          resultLabel: `Demande de rattrapage envoyée pour ${classe.name} le ${input.proposedDate}`,
          section: 'timetable',
          entity: 'catchupRequest',
        };
      },
      async undo() {
        throw new Error('Une demande de rattrapage déjà envoyée ne peut pas être annulée depuis le copilot.');
      },
    },

    // ═══ Mes classes ═══

    // 9. Mes classes et matières — LECTURE SEULE
    {
      name: 'mes_classes',
      description: "Liste les classes et matières que vous enseignez.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const assignments = await ctx.prisma.teachingAssignment.findMany({
          where: { teacherId: ctx.userId, schoolId: ctx.schoolId },
          select: { class: { select: { name: true } }, subject: { select: { name: true } } },
        });
        const resultLabel = assignments.length === 0
          ? "Vous n'avez aucune classe assignée actuellement."
          : `Vos classes : ${assignments.map((a) => `${a.subject.name} en ${a.class.name}`).join(', ')}.`;
        return { resultLabel, section: 'classes' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 10. Élèves d'une de mes classes — LECTURE SEULE
    {
      name: 'mes_eleves_classe',
      description: "Liste les élèves d'une classe que vous enseignez.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const assignation = await ctx.prisma.teachingAssignment.findFirst({ where: { teacherId: ctx.userId, classId: classe.id } });
        if (!assignation) throw new Error(`Vous n'enseignez pas dans ${classe.name}.`);
        const eleves = await ctx.prisma.user.findMany({
          where: { schoolId: ctx.schoolId, role: 'STUDENT', studentProfile: { classId: classe.id } },
          select: { firstName: true, lastName: true },
          orderBy: { lastName: 'asc' },
        });
        const resultLabel = eleves.length === 0
          ? `Aucun élève inscrit dans ${classe.name}.`
          : `${classe.name} (${eleves.length} élève(s)) : ${eleves.map((e) => `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim()).join(', ')}`;
        return { resultLabel, section: 'classes' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },
  ];
}
