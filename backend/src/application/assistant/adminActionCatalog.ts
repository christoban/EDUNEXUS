/**
 * APPLICATION LAYER — Catalogue d'actions de l'assistant IA (copilot), rôle ADMIN.
 *
 * Chaque entrée mappe UNE intention en langage naturel vers UN use case existant.
 * L'assistant ne réécrit jamais la logique métier : il se contente d'appeler ces
 * use cases (qui revérifient déjà `demandeurRole === 'ADMIN'` et le `schoolId`).
 *
 * Principe de conception : les paramètres exposés au modèle sont des NOMS humains
 * (className, teacherName, subjectName). La résolution nom → id se fait côté serveur,
 * au moment de l'exécution, contre la base à jour — ce qui rend naturel le dialogue
 * ET résout les dépendances multi-étapes (la classe créée à l'étape 1 existe en base
 * à l'étape 2).
 *
 * Le flag `destructive` détermine si une confirmation explicite est requise avant
 * exécution (protection des données, aucune exception).
 */
import { z } from 'zod';
import { tool, type Tool } from 'ai';
import type { PrismaClient } from '@prisma/client';
import type { StaffPermissionType } from '@domain/types/enums';

import type { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
import type { SupprimerClasseUseCase } from '@application/class/SupprimerClasseUseCase';
import type { AssignerProfesseurPrincipalUseCase } from '@application/class/AssignerProfesseurPrincipalUseCase';
import type { CreerMatiereUseCase } from '@application/subject/CreerMatiereUseCase';
import type { AssignerEnseignantMatiereUseCase } from '@application/subject/AssignerEnseignantMatiereUseCase';
import type { SupprimerMatiereUseCase } from '@application/subject/SupprimerMatiereUseCase';
import type { CreerSessionConcoursUseCase } from '@application/entranceExam/CreerSessionConcoursUseCase';
import type { CreerSessionPebsUseCase } from '@application/pebsExam/CreerSessionPebsUseCase';
import type { OuvrirFenetreChoixLV2UseCase } from '@application/lv2Choice/OuvrirFenetreChoixLV2UseCase';

// ─── Contexte & contrats ─────────────────────────────────────────────────────

export interface ActionContext {
  schoolId: string;
  userId: string;
  role: string;
  prisma: PrismaClient;
}

export interface ActionExecuteResult {
  /** Résumé lisible affiché dans le chat, ex. « Classe "4e D" créée ». */
  resultLabel: string;
  /** Instantané nécessaire à une éventuelle annulation. */
  undoData?: Record<string, unknown>;
  /** Section du dashboard où le changement est visible (navigation auto + refresh). */
  section?: string;
  /** Entité touchée — sert au bus d'événements temps réel côté frontend. */
  entity?: string;
}

export interface ActionDefinition {
  name: string;
  description: string;
  destructive: boolean;
  /**
   * Permission STAFF requise, ou `null` pour une action inhérente au rôle ADMIN.
   * Sert au filtrage RBAC : un rôle non-ADMIN ne verra que les actions dont la
   * permission figure dans ses `permissions`.
   */
  requiredPermission: StaffPermissionType | null;
  inputSchema: z.ZodTypeAny;
  /** Résumé de ce qui sera perdu — obligatoire pour toute action destructive. */
  summarizeDestructive?: (input: any, ctx: ActionContext) => Promise<string>;
  execute: (input: any, ctx: ActionContext) => Promise<ActionExecuteResult>;
  /** Annulation d'une action non-destructive. Lève une erreur si non annulable. */
  undo: (params: any, undoData: any, ctx: ActionContext) => Promise<void>;
}

export interface AdminActionDeps {
  creerClasse: CreerClasseUseCase;
  supprimerClasse: SupprimerClasseUseCase;
  assignerProfesseur: AssignerProfesseurPrincipalUseCase;
  creerMatiere: CreerMatiereUseCase;
  assignerEnseignant: AssignerEnseignantMatiereUseCase;
  supprimerMatiere: SupprimerMatiereUseCase;
  creerSessionConcours: CreerSessionConcoursUseCase;
  creerSessionPebs: CreerSessionPebsUseCase;
  ouvrirFenetreLV2: OuvrirFenetreChoixLV2UseCase;
}

// ─── Helpers de résolution nom → entité ──────────────────────────────────────

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

async function resolveClass(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
  const classes = await ctx.prisma.class.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  const target = norm(name);
  let matches = classes.filter((c) => norm(c.name) === target);
  if (matches.length === 0) {
    // tolérance : « 4eD » vs « 4e D »
    const compact = target.replace(/\s+/g, '');
    matches = classes.filter((c) => norm(c.name).replace(/\s+/g, '') === compact);
  }
  if (matches.length === 0) throw new Error(`Aucune classe nommée « ${name} » n'existe dans votre établissement.`);
  if (matches.length > 1) throw new Error(`Plusieurs classes correspondent à « ${name} ». Précisez le nom exact.`);
  return matches[0];
}

async function resolveTeacher(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
  const teachers = await ctx.prisma.user.findMany({
    where: { schoolId: ctx.schoolId, role: 'TEACHER' },
    select: { id: true, firstName: true, lastName: true },
  });
  const full = (t: { firstName: string | null; lastName: string | null }) =>
    `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim();
  const target = norm(name);
  let matches = teachers.filter((t) => norm(full(t)) === target);
  if (matches.length === 0) {
    // recherche partielle : nom de famille ou inclusion
    matches = teachers.filter(
      (t) => norm(t.lastName ?? '') === target || norm(full(t)).includes(target),
    );
  }
  if (matches.length === 0) throw new Error(`Aucun enseignant nommé « ${name} » n'a été trouvé.`);
  if (matches.length > 1) throw new Error(`Plusieurs enseignants correspondent à « ${name} ». Précisez le nom complet.`);
  const m = matches[0];
  return { id: m.id, name: full(m) };
}

async function resolveSubject(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
  const subjects = await ctx.prisma.subject.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  const target = norm(name);
  let matches = subjects.filter((s) => norm(s.name) === target);
  if (matches.length === 0) matches = subjects.filter((s) => norm(s.name).includes(target));
  if (matches.length === 0) throw new Error(`Aucune matière nommée « ${name} » n'existe dans votre établissement.`);
  if (matches.length > 1) throw new Error(`Plusieurs matières correspondent à « ${name} ». Précisez le nom exact.`);
  return matches[0];
}

async function resolveCurrentAcademicYear(ctx: ActionContext): Promise<{ id: string; name: string }> {
  const year = await ctx.prisma.academicYear.findFirst({
    where: { schoolId: ctx.schoolId, isCurrent: true },
    select: { id: true, name: true },
  });
  if (!year) throw new Error("Aucune année scolaire courante n'est configurée pour cet établissement.");
  return year;
}

// ─── Construction du catalogue ───────────────────────────────────────────────

export function buildAdminActionCatalog(deps: AdminActionDeps): ActionDefinition[] {
  return [
    // 1. Créer une classe — NON destructif
    {
      name: 'creer_classe',
      description:
        "Crée une nouvelle classe dans l'établissement. Utilise le nom complet tel que dit par l'utilisateur (ex. « 4e D », « Terminale C »).",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        name: z.string().min(1).describe('Nom complet de la classe, ex. "4e D", "Terminale C"'),
        level: z.string().optional().describe('Niveau, ex. "4e", "Terminale"'),
        serie: z.string().optional().describe('Série le cas échéant, ex. "C", "A4"'),
        capacity: z.number().int().positive().optional().describe('Effectif maximum'),
      }),
      async execute(input, ctx) {
        const r = await deps.creerClasse.execute({
          schoolId: ctx.schoolId,
          name: input.name,
          level: input.level,
          serie: input.serie,
          capacity: input.capacity,
        });
        return {
          resultLabel: `Classe « ${r.name} » créée`,
          undoData: { classeId: r.classeId },
          section: 'classes',
          entity: 'class',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.supprimerClasse.execute({ classeId: String(undoData.classeId), schoolId: ctx.schoolId });
      },
    },

    // 2. Créer une matière — NON destructif
    {
      name: 'creer_matiere',
      description: "Crée une nouvelle matière dans l'établissement.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        name: z.string().min(1).describe('Nom de la matière, ex. "Physique", "Espagnol"'),
        coefficient: z.number().positive().optional().describe('Coefficient (défaut 1)'),
        hoursPerWeek: z.number().positive().optional().describe('Heures par semaine (défaut 2)'),
      }),
      async execute(input, ctx) {
        const r = await deps.creerMatiere.execute({
          schoolId: ctx.schoolId,
          name: input.name,
          coefficient: input.coefficient,
          hoursPerWeek: input.hoursPerWeek,
          demandeurRole: ctx.role,
        });
        return {
          resultLabel: `Matière « ${r.name} » créée`,
          undoData: { matiereId: r.matiereId },
          section: 'subjects',
          entity: 'subject',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.supprimerMatiere.execute({
          matiereId: String(undoData.matiereId),
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
        });
      },
    },

    // 3. Assigner un enseignant à une matière — NON destructif
    {
      name: 'assigner_enseignant_matiere',
      description: "Assigne un enseignant à une matière (l'enseignant pourra y saisir des notes).",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        teacherName: z.string().min(1).describe("Nom de l'enseignant"),
        subjectName: z.string().min(1).describe('Nom de la matière'),
      }),
      async execute(input, ctx) {
        const teacher = await resolveTeacher(ctx, input.teacherName);
        const subject = await resolveSubject(ctx, input.subjectName);
        await deps.assignerEnseignant.execute({
          teacherUserId: teacher.id,
          matiereId: subject.id,
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          action: 'ASSIGNER',
        });
        return {
          resultLabel: `${teacher.name} assigné(e) à ${subject.name}`,
          undoData: { teacherUserId: teacher.id, matiereId: subject.id },
          section: 'subjects',
          entity: 'subject',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.assignerEnseignant.execute({
          teacherUserId: String(undoData.teacherUserId),
          matiereId: String(undoData.matiereId),
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          action: 'RETIRER',
        });
      },
    },

    // 4. Nommer un professeur principal — NON destructif (réversible)
    {
      name: 'assigner_professeur_principal',
      description: "Nomme un enseignant professeur principal d'une classe.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        className: z.string().min(1).describe('Nom de la classe'),
        teacherName: z.string().min(1).describe("Nom de l'enseignant à nommer professeur principal"),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const teacher = await resolveTeacher(ctx, input.teacherName);
        // Instantané de l'ancien PP pour permettre l'annulation.
        const before = await ctx.prisma.class.findUnique({
          where: { id: classe.id },
          select: { professorPrincipalId: true },
        });
        await deps.assignerProfesseur.execute({
          classeId: classe.id,
          teacherUserId: teacher.id,
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
        });
        return {
          resultLabel: `${teacher.name} nommé(e) professeur principal de ${classe.name}`,
          undoData: { classeId: classe.id, previousTeacherUserId: before?.professorPrincipalId ?? null },
          section: 'classes',
          entity: 'class',
        };
      },
      async undo(_params, undoData, ctx) {
        const classeId = String(undoData.classeId);
        const previous = undoData.previousTeacherUserId as string | null;
        if (previous) {
          await deps.assignerProfesseur.execute({
            classeId,
            teacherUserId: previous,
            schoolId: ctx.schoolId,
            demandeurRole: ctx.role,
          });
        } else {
          // Aucun PP auparavant : on retire simplement l'assignation.
          await ctx.prisma.class.update({ where: { id: classeId }, data: { professorPrincipalId: null } });
        }
      },
    },

    // 5. Supprimer une classe — DESTRUCTIF (confirmation obligatoire)
    {
      name: 'supprimer_classe',
      description: 'Supprime définitivement une classe et toutes ses données associées.',
      destructive: true,
      requiredPermission: null,
      inputSchema: z.object({
        className: z.string().min(1).describe('Nom de la classe à supprimer'),
      }),
      async summarizeDestructive(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const [students, grades] = await Promise.all([
          ctx.prisma.studentProfile.count({ where: { classId: classe.id } }),
          ctx.prisma.grade.count({ where: { classId: classe.id } }),
        ]);
        const parts = [`${students} élève(s)`];
        if (grades > 0) parts.push(`${grades} note(s)`);
        parts.push('leur historique de présence et de paiement');
        return (
          `Cette action va supprimer définitivement la classe « ${classe.name} » et TOUTES les données associées : ` +
          `${parts.join(', ')}. Cette action est irréversible.`
        );
      },
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        await deps.supprimerClasse.execute({ classeId: classe.id, schoolId: ctx.schoolId });
        return { resultLabel: `Classe « ${classe.name} » supprimée`, section: 'classes', entity: 'class' };
      },
      async undo() {
        throw new Error('La suppression de classe est irréversible et ne peut pas être annulée.');
      },
    },

    // 6. Supprimer une matière — DESTRUCTIF (confirmation obligatoire)
    {
      name: 'supprimer_matiere',
      description: 'Supprime définitivement une matière et ses données associées.',
      destructive: true,
      requiredPermission: null,
      inputSchema: z.object({
        subjectName: z.string().min(1).describe('Nom de la matière à supprimer'),
      }),
      async summarizeDestructive(input, ctx) {
        const subject = await resolveSubject(ctx, input.subjectName);
        const grades = await ctx.prisma.grade.count({ where: { subjectId: subject.id } });
        const suffix = grades > 0 ? ` ainsi que ${grades} note(s) rattachée(s)` : '';
        return (
          `Cette action va supprimer définitivement la matière « ${subject.name} »${suffix}, ` +
          `ses coefficients et ses assignations enseignant. Cette action est irréversible.`
        );
      },
      async execute(input, ctx) {
        const subject = await resolveSubject(ctx, input.subjectName);
        await deps.supprimerMatiere.execute({ matiereId: subject.id, schoolId: ctx.schoolId, demandeurRole: ctx.role });
        return { resultLabel: `Matière « ${subject.name} » supprimée`, section: 'subjects', entity: 'subject' };
      },
      async undo() {
        throw new Error('La suppression de matière est irréversible et ne peut pas être annulée.');
      },
    },

    // 7. Créer une session de concours d'entrée en 6e — NON destructif
    {
      name: 'creer_session_concours_entree',
      description:
        "Crée une nouvelle session de concours d'entrée en 6e, pour l'année scolaire courante. " +
        "Ne calcule PAS l'admission — cela reste une action volontaire distincte de l'admin.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        name: z.string().min(1).describe('Nom de la session, ex. "Concours d\'entrée 6e 2026-2027"'),
        examDate: z.string().describe('Date du concours au format YYYY-MM-DD'),
        admissionThreshold: z.number().optional().describe('Seuil de notes pour être admis, si connu'),
        availableSeats: z.number().int().positive().optional().describe('Nombre de places disponibles, si connu'),
      }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const r = await deps.creerSessionConcours.execute({
          schoolId: ctx.schoolId,
          name: input.name,
          examDate: new Date(input.examDate),
          academicYearId: year.id,
          admissionThreshold: input.admissionThreshold,
          availableSeats: input.availableSeats,
        });
        return {
          resultLabel: `Session de concours d'entrée « ${input.name} » créée`,
          undoData: { sessionId: r.sessionId },
          section: 'entrance-exams',
          entity: 'entranceExamSession',
        };
      },
      async undo(_params, undoData, ctx) {
        await (ctx.prisma as any).entranceExamSession.delete({ where: { id: String(undoData.sessionId) } });
      },
    },

    // 8. Créer une session de sélection PEBS — NON destructif
    {
      name: 'creer_session_selection_pebs',
      description:
        "Crée une nouvelle session de sélection PEBS pour un niveau donné, avec la classe cible où " +
        "seront transférés les élèves sélectionnés. Ne calcule PAS la sélection ni le transfert.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        name: z.string().min(1).describe('Nom de la session, ex. "Sélection PEBS 6e 2026-2027"'),
        examDate: z.string().describe("Date de l'examen au format YYYY-MM-DD"),
        level: z.string().min(1).describe('Niveau concerné, ex. "6e"'),
        targetClassName: z.string().min(1).describe('Nom de la classe cible où seront transférés les élèves sélectionnés'),
        selectionThreshold: z.number().optional().describe('Seuil de notes pour être sélectionné, si connu'),
        availableSeats: z.number().int().positive().optional().describe('Nombre de places disponibles, si connu'),
      }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const targetClass = await resolveClass(ctx, input.targetClassName);
        const r = await deps.creerSessionPebs.execute({
          schoolId: ctx.schoolId,
          name: input.name,
          examDate: new Date(input.examDate),
          level: input.level,
          academicYearId: year.id,
          selectionThreshold: input.selectionThreshold,
          availableSeats: input.availableSeats,
          targetClassId: targetClass.id,
        });
        return {
          resultLabel: `Session de sélection PEBS « ${input.name} » créée (classe cible : ${targetClass.name})`,
          undoData: { sessionId: r.sessionId },
          section: 'pebs-exams',
          entity: 'pebsExamSession',
        };
      },
      async undo(_params, undoData, ctx) {
        await (ctx.prisma as any).pebsExamSession.delete({ where: { id: String(undoData.sessionId) } });
      },
    },

    // 9. Ouvrir une fenêtre de choix LV2 — NON destructif (envoie un SMS aux parents concernés)
    {
      name: 'ouvrir_fenetre_choix_lv2',
      description:
        "Ouvre une fenêtre de choix de LV2 pour un niveau, pendant laquelle les élèves peuvent choisir " +
        "leur langue depuis leur compte. Envoie automatiquement un SMS aux parents des élèves concernés.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        level: z.string().min(1).describe('Niveau concerné, ex. "5e"'),
        openDate: z.string().describe('Date d\'ouverture au format YYYY-MM-DD'),
        closeDate: z.string().describe('Date de clôture au format YYYY-MM-DD'),
      }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const r = await deps.ouvrirFenetreLV2.execute({
          schoolId: ctx.schoolId,
          level: input.level,
          academicYearId: year.id,
          openDate: new Date(input.openDate),
          closeDate: new Date(input.closeDate),
        });
        return {
          resultLabel: `Fenêtre de choix LV2 ouverte pour ${input.level} jusqu'au ${input.closeDate} (${r.eleves.length} élève(s) notifié(s) par SMS)`,
          undoData: { windowId: r.windowId },
          section: 'lv2-choice',
          entity: 'lv2ChoiceWindow',
        };
      },
      async undo(_params, undoData, ctx) {
        await (ctx.prisma as any).lv2ChoiceWindow.update({ where: { id: String(undoData.windowId) }, data: { status: 'CLOSED' } });
      },
    },

    // 10. Lister les candidats en attente de résultat CEP — LECTURE SEULE
    {
      name: 'lister_candidats_cep_en_attente',
      description:
        "Affiche la liste des candidats admis provisoirement au concours d'entrée, en attente de leur résultat CEP.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const candidats = await (ctx.prisma as any).entranceExamCandidate.findMany({
          where: { admissionStatus: 'ADMIS_PROVISOIRE', session: { schoolId: ctx.schoolId } },
          select: { firstName: true, lastName: true, session: { select: { name: true } } },
        });
        const resultLabel = candidats.length === 0
          ? "Aucun candidat en attente de résultat CEP actuellement."
          : `${candidats.length} candidat(s) en attente de résultat CEP : ` +
            candidats.map((c) => `${c.firstName} ${c.lastName} (${c.session.name})`).join(', ');
        return { resultLabel, section: 'entrance-exams', entity: 'entranceExamCandidate' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },
  ];
}

// ─── Filtrage RBAC ───────────────────────────────────────────────────────────

/**
 * Filtre le catalogue selon le rôle/les permissions réels de l'utilisateur.
 * L'ADMIN dispose de toutes les actions inhérentes à son rôle. Un rôle STAFF ne
 * verra que les actions dont la permission requise figure dans ses `permissions`.
 * Utilisé À LA FOIS pour construire les tools exposés au modèle ET pour la
 * double-vérification serveur avant exécution (on ne fait jamais confiance au prompt).
 */
export function filterCatalogForUser(
  catalog: ActionDefinition[],
  user: { role: string; permissions?: string[] },
): ActionDefinition[] {
  if (user.role.toUpperCase() === 'ADMIN') return catalog;
  const perms = new Set(user.permissions ?? []);
  return catalog.filter((a) => a.requiredPermission !== null && perms.has(a.requiredPermission));
}

/** Construit les tools AI SDK (inputSchema uniquement, SANS execute → le modèle propose, le serveur décide). */
export function buildTools(catalog: ActionDefinition[]): Record<string, Tool> {
  const tools: Record<string, Tool> = {};
  for (const action of catalog) {
    tools[action.name] = tool({
      description: action.description,
      inputSchema: action.inputSchema,
    });
  }
  return tools;
}
