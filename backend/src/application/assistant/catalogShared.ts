/**
 * APPLICATION LAYER — Moteur générique du catalogue d'actions de l'assistant IA (copilot).
 *
 * Extrait de `adminActionCatalog.ts` lors de l'extension du copilot aux rôles non-Admin
 * (chantier Copilot Unifié, Section 6.2) — un seul copilot, un seul catalogue combiné
 * (Principe 0.1 : « un seul copilot, pas deux systèmes parallèles »), chaque rôle apporte
 * ses propres entrées via son propre fichier `<role>ActionCatalog.ts`, toutes assemblées
 * en un seul tableau `ActionDefinition[]` passé à un unique `AssistantController`.
 *
 * Helpers de résolution nom → entité partagés ici parce qu'utiles à plusieurs rôles
 * (ex. resolveClass/resolveStudent servent aussi bien au catalogue Admin qu'Enseignant).
 * Les helpers propres à un domaine précis (ex. resolvePlanFrais, Finance) restent dans le
 * fichier de catalogue du rôle qui les utilise plutôt que d'être partagés ici.
 */
import { z } from 'zod';
import { tool, type Tool } from 'ai';
import type { PrismaClient } from '@prisma/client';
import type { StaffPermissionType } from '@domain/types/enums';

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
   * Ignoré si `allowedRoles` est renseigné (voir ce champ).
   */
  requiredPermission: StaffPermissionType | null;
  /**
   * Rôles autorisés à voir cette action. Omis = comportement historique du catalogue
   * Admin (ADMIN voit tout ; STAFF voit uniquement si `requiredPermission` correspond
   * à ses permissions). Renseigné = action scopée à CES rôles précisément, y compris
   * potentiellement à l'exclusion d'ADMIN — pertinent pour une action « mes classes »,
   * « mes notes », etc. qui n'a pas de sens hors du contexte personnel d'un enseignant,
   * parent ou élève connecté (`ctx.userId` désigne alors CE rôle, pas un administrateur
   * consultant les données de quelqu'un d'autre).
   */
  allowedRoles?: string[];
  inputSchema: z.ZodTypeAny;
  /** Résumé de ce qui sera perdu — obligatoire pour toute action destructive. */
  summarizeDestructive?: (input: any, ctx: ActionContext) => Promise<string>;
  execute: (input: any, ctx: ActionContext) => Promise<ActionExecuteResult>;
  /** Annulation d'une action non-destructive. Lève une erreur si non annulable. */
  undo: (params: any, undoData: any, ctx: ActionContext) => Promise<void>;
}

// ─── Helpers de résolution nom → entité, partagés entre catalogues de rôles ──

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export async function resolveClass(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
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

export async function resolveTeacher(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
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

export async function resolveSubject(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
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

/**
 * Résolution nom → élève. Les homonymes sont fréquents dans une école — si plusieurs
 * élèves correspondent, on ne devine JAMAIS (Principe 4) : on liste les candidats avec
 * leur classe et on demande de préciser, plutôt que d'agir sur le premier trouvé.
 * `className` (si fourni, ex. via le contexte de la commande) filtre la recherche.
 */
export async function resolveStudent(
  ctx: ActionContext,
  name: string,
  className?: string,
): Promise<{ id: string; name: string; className: string | null }> {
  const students = await ctx.prisma.user.findMany({
    where: { schoolId: ctx.schoolId, role: 'STUDENT' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentProfile: { select: { class: { select: { name: true } } } },
    },
  });
  const full = (s: { firstName: string | null; lastName: string | null }) =>
    `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
  const target = norm(name);
  let matches = students.filter((s) => norm(full(s)) === target);
  if (matches.length === 0) matches = students.filter((s) => norm(full(s)).includes(target));

  if (matches.length > 1 && className) {
    const classTarget = norm(className);
    const narrowed = matches.filter((s) => s.studentProfile?.class?.name && norm(s.studentProfile.class.name) === classTarget);
    if (narrowed.length > 0) matches = narrowed;
  }

  if (matches.length === 0) throw new Error(`Aucun élève nommé « ${name} » n'a été trouvé.`);
  if (matches.length > 1) {
    const list = matches
      .slice(0, 6)
      .map((s) => `${full(s)} (${s.studentProfile?.class?.name ?? 'sans classe'})`)
      .join(', ');
    throw new Error(`Plusieurs élèves nommés « ${name} » existent : ${list}. Précisez la classe.`);
  }
  const m = matches[0];
  return { id: m.id, name: full(m), className: m.studentProfile?.class?.name ?? null };
}

export async function resolveCurrentAcademicYear(ctx: ActionContext): Promise<{ id: string; name: string }> {
  const year = await ctx.prisma.academicYear.findFirst({
    where: { schoolId: ctx.schoolId, isCurrent: true },
    select: { id: true, name: true },
  });
  if (!year) throw new Error("Aucune année scolaire courante n'est configurée pour cet établissement.");
  return year;
}

export async function resolveCurrentPeriod(ctx: ActionContext): Promise<{ id: string; name: string }> {
  const period = await ctx.prisma.academicPeriod.findFirst({
    where: { academicYear: { schoolId: ctx.schoolId, isCurrent: true }, isCurrent: true },
    select: { id: true, name: true },
  });
  if (!period) throw new Error("Aucune période courante n'est configurée pour cet établissement.");
  return period;
}

export async function resolveCurrentSequence(ctx: ActionContext): Promise<{ id: string; name: string }> {
  const sequence = await ctx.prisma.academicSequence.findFirst({
    where: { schoolId: ctx.schoolId, isCurrent: true },
    select: { id: true, name: true },
  });
  if (!sequence) throw new Error("Aucune séquence courante n'est configurée pour cet établissement.");
  return sequence;
}

/** Moyenne pondérée par coefficient, par élève, pour une classe et une séquence données. */
export async function calculerMoyennesClasseSequence(
  ctx: ActionContext,
  classId: string,
  sequenceId: string,
): Promise<Map<string, number>> {
  const grades = await ctx.prisma.grade.findMany({
    where: { classId, sequenceId, schoolId: ctx.schoolId, sequenceAverage: { not: null } },
    select: { studentId: true, sequenceAverage: true, coefficient: true },
  });
  const parStudent = new Map<string, { somme: number; poids: number }>();
  for (const g of grades) {
    const cur = parStudent.get(g.studentId) ?? { somme: 0, poids: 0 };
    cur.somme += (g.sequenceAverage ?? 0) * g.coefficient;
    cur.poids += g.coefficient;
    parStudent.set(g.studentId, cur);
  }
  const moyennes = new Map<string, number>();
  for (const [studentId, { somme, poids }] of parStudent) {
    if (poids > 0) moyennes.set(studentId, somme / poids);
  }
  return moyennes;
}

// ─── Filtrage RBAC ───────────────────────────────────────────────────────────

/**
 * Filtre le catalogue combiné (tous rôles) selon le rôle/les permissions réels de
 * l'utilisateur connecté. Utilisé À LA FOIS pour construire les tools exposés au modèle
 * ET pour la double-vérification serveur avant exécution (on ne fait jamais confiance
 * au prompt).
 *
 * Deux régimes selon que `allowedRoles` est renseigné sur l'action :
 * - Renseigné (action pensée pour un ou plusieurs rôles précis, ex. TEACHER, STAFF) :
 *   visible uniquement pour ces rôles (ADMIN exclu sauf s'il y figure explicitement —
 *   une action « mes classes » n'a pas de sens pour un administrateur). Si l'action
 *   porte AUSSI un `requiredPermission` (ex. une action STAFF qui exige MANAGE_DISCIPLINE
 *   précisément, pas n'importe quel STAFF), cette permission est revérifiée en plus —
 *   sauf pour ADMIN, qui n'est jamais bloqué par un `requiredPermission`.
 * - Omis (comportement historique du catalogue Admin) : ADMIN voit tout ; STAFF voit
 *   uniquement les actions dont `requiredPermission` figure dans ses `permissions`.
 */
export function filterCatalogForUser(
  catalog: ActionDefinition[],
  user: { role: string; permissions?: string[] },
): ActionDefinition[] {
  const role = user.role.toUpperCase();
  const perms = new Set(user.permissions ?? []);
  return catalog.filter((a) => {
    if (a.allowedRoles) {
      if (!a.allowedRoles.includes(role)) return false;
      if (role === 'ADMIN') return true;
      return a.requiredPermission === null || perms.has(a.requiredPermission);
    }
    if (role === 'ADMIN') return true;
    return a.requiredPermission !== null && perms.has(a.requiredPermission);
  });
}

/** Construit les tools AI SDK (inputSchema uniquement, SANS execute → le modèle propose, le serveur décide). */
/**
 * Groq (et les modèles de function-calling en général) envoie très souvent `null` pour un champ
 * optionnel qu'il ne renseigne pas, plutôt que d'omettre la clé — comportement observé
 * concrètement (`lister_eleves_a_risque` sans classe précisée → `{className: null}`), alors que
 * `z.string().optional()` n'accepte QUE `undefined`, jamais `null`. Résultat sans ce correctif :
 * échec de validation AVANT même que `execute()` ne soit atteint, tout le tour de conversation
 * s'effondre sur le message générique "service momentanément indisponible" — pour une question
 * parfaitement légitime et courante ("quels sont les élèves à risque ?", sans filtre de classe).
 *
 * Corrigé une seule fois ici plutôt que sur chacun des ~75 champs `.optional()` à travers les 5
 * catalogues : chaque champ optionnel de premier niveau devient aussi tolérant à `null`. Aucun
 * changement de comportement côté `execute()` — tous les sites d'utilisation traitent déjà
 * `input.champ` par test de vérité (`input.x ? ... : ...`) ou `??`, qui traitent `null` et
 * `undefined` de façon identique.
 */
function rendreOptionnelsNullTolerants(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (!(schema instanceof z.ZodObject)) return schema;
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const nouveauShape: Record<string, z.ZodTypeAny> = {};
  for (const [cle, champ] of Object.entries(shape)) {
    nouveauShape[cle] = champ instanceof z.ZodOptional ? champ.unwrap().nullable().optional() : champ;
  }
  return z.object(nouveauShape);
}

export function buildTools(catalog: ActionDefinition[]): Record<string, Tool> {
  const tools: Record<string, Tool> = {};
  for (const action of catalog) {
    tools[action.name] = tool({
      description: action.description,
      inputSchema: rendreOptionnelsNullTolerants(action.inputSchema),
    });
  }
  return tools;
}
