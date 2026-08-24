/**
 * APPLICATION LAYER — Catalogue d'actions de l'assistant IA (copilot), rôle STUDENT.
 *
 * Périmètre du plan (Section 6.2) : « consultation uniquement, pas d'actions ». Toutes
 * les entrées ci-dessous sont des QUERY en lecture seule, strictement scopées aux
 * données du connecté (`ctx.userId` EST l'élève — jamais de recherche par nom parmi
 * d'autres élèves, contrairement aux catalogues Admin/Staff/Teacher). Aucune dépendance
 * externe n'est nécessaire (aucun use case n'est invoqué, uniquement des lectures Prisma
 * directes déjà scopées par construction), d'où l'absence de `Deps` en paramètre.
 */
import { z } from 'zod';
import { type ActionDefinition, resolveCurrentSequence } from '@application/assistant/catalog/catalogShared';

export function buildStudentActionCatalog(): ActionDefinition[] {
  return [
    // 1. Mes notes récentes — LECTURE SEULE
    {
      name: 'mes_notes',
      description: 'Donne vos notes les plus récentes, toutes matières confondues.',
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['STUDENT'],
      inputSchema: z.object({ subjectName: z.string().optional().describe('Limiter à une matière précise') }),
      async execute(input, ctx) {
        const grades = await ctx.prisma.grade.findMany({
          where: {
            schoolId: ctx.schoolId,
            studentId: ctx.userId,
            sequenceAverage: { not: null },
            ...(input.subjectName ? { subject: { name: { contains: input.subjectName, mode: 'insensitive' } } } : {}),
          },
          orderBy: { id: 'desc' },
          take: 10,
          select: { sequenceAverage: true, subject: { select: { name: true } }, sequence: { select: { name: true } } },
        });
        const resultLabel = grades.length === 0
          ? "Aucune note disponible pour le moment."
          : `Vos notes récentes : ` + grades.map((g) => `${g.subject.name} (${g.sequence.name}) : ${g.sequenceAverage}/20`).join(', ');
        return { resultLabel, section: 'grades' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 2. Ma moyenne de la séquence courante — LECTURE SEULE
    {
      name: 'ma_moyenne_sequence',
      description: 'Donne votre moyenne générale pour la séquence courante.',
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['STUDENT'],
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const sequence = await resolveCurrentSequence(ctx);
        const grades = await ctx.prisma.grade.findMany({
          where: { schoolId: ctx.schoolId, studentId: ctx.userId, sequenceId: sequence.id, sequenceAverage: { not: null } },
          select: { sequenceAverage: true, coefficient: true },
        });
        if (grades.length === 0) {
          return { resultLabel: `Aucune note calculée pour la séquence ${sequence.name} pour le moment.`, section: 'grades' };
        }
        const poidsTotal = grades.reduce((s, g) => s + g.coefficient, 0);
        const moyenne = poidsTotal > 0
          ? Math.round((grades.reduce((s, g) => s + (g.sequenceAverage as number) * g.coefficient, 0) / poidsTotal) * 100) / 100
          : null;
        return {
          resultLabel: moyenne !== null
            ? `Votre moyenne pour la séquence ${sequence.name} : ${moyenne}/20 (${grades.length} matière(s) notée(s)).`
            : `Aucune moyenne calculable pour la séquence ${sequence.name} pour le moment.`,
          section: 'grades',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 3. Ma présence — LECTURE SEULE
    {
      name: 'ma_presence',
      description: 'Donne votre taux de présence depuis une date donnée (ce mois-ci par défaut).',
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['STUDENT'],
      inputSchema: z.object({ depuis: z.string().optional().describe('Date de début au format YYYY-MM-DD — début du mois courant par défaut') }),
      async execute(input, ctx) {
        const now = new Date();
        const depuis = input.depuis ? new Date(input.depuis) : new Date(now.getFullYear(), now.getMonth(), 1);
        const records = await ctx.prisma.attendance.findMany({
          where: { schoolId: ctx.schoolId, studentId: ctx.userId, date: { gte: depuis } },
          select: { status: true },
        });
        if (records.length === 0) {
          return { resultLabel: `Aucun enregistrement de présence depuis le ${depuis.toLocaleDateString('fr-FR')}.`, section: 'attendance' };
        }
        const present = records.filter((r) => r.status === 'PRESENT').length;
        const absences = records.filter((r) => r.status === 'ABSENT').length;
        const taux = Math.round((present / records.length) * 10000) / 100;
        return {
          resultLabel: `Votre taux de présence depuis le ${depuis.toLocaleDateString('fr-FR')} : ${taux}% (${absences} absence(s) sur ${records.length} enregistrement(s)).`,
          section: 'attendance',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 4. Mes livres empruntés — LECTURE SEULE
    {
      name: 'mes_livres_empruntes',
      description: 'Liste les livres que vous avez actuellement empruntés à la bibliothèque, avec leur date de retour.',
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['STUDENT'],
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const emprunts = await ctx.prisma.bookLoan.findMany({
          where: { schoolId: ctx.schoolId, studentId: ctx.userId, status: { in: ['ACTIVE', 'OVERDUE'] } },
          select: { dueDate: true, status: true, book: { select: { title: true } } },
        });
        const resultLabel = emprunts.length === 0
          ? "Vous n'avez aucun livre emprunté actuellement."
          : `Vos emprunts : ` + emprunts.map((e) => `« ${e.book.title} »${e.dueDate ? ` (retour prévu le ${e.dueDate.toLocaleDateString('fr-FR')})` : ''}${e.status === 'OVERDUE' ? ' — EN RETARD' : ''}`).join(', ');
        return { resultLabel, section: 'library' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },
  ];
}
