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
