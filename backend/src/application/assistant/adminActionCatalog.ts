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
import type { StaffPermissionType } from '@domain/types/enums';
import {
  type ActionContext,
  type ActionExecuteResult,
  type ActionDefinition,
  norm,
  resolveClass,
  resolveTeacher,
  resolveSubject,
  resolveStudent,
  resolveCurrentAcademicYear,
  resolveCurrentPeriod,
  resolveCurrentSequence,
  calculerMoyennesClasseSequence,
} from '@application/assistant/catalogShared';

import type { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
import type { SupprimerClasseUseCase } from '@application/class/SupprimerClasseUseCase';
import type { AssignerProfesseurPrincipalUseCase } from '@application/class/AssignerProfesseurPrincipalUseCase';
import type { CreerMatiereUseCase } from '@application/subject/CreerMatiereUseCase';
import type { AssignerEnseignantMatiereUseCase } from '@application/subject/AssignerEnseignantMatiereUseCase';
import type { SupprimerMatiereUseCase } from '@application/subject/SupprimerMatiereUseCase';
import type { CreerSessionConcoursUseCase } from '@application/entranceExam/CreerSessionConcoursUseCase';
import type { CreerSessionPebsUseCase } from '@application/pebsExam/CreerSessionPebsUseCase';
import type { OuvrirFenetreChoixLV2UseCase } from '@application/lv2Choice/OuvrirFenetreChoixLV2UseCase';
import type { InscrireUtilisateurUseCase } from '@application/user/InscrireUtilisateurUseCase';
import type { ModifierUtilisateurUseCase } from '@application/user/ModifierUtilisateurUseCase';
import type { SupprimerUtilisateurUseCase } from '@application/user/SupprimerUtilisateurUseCase';
import type { TransfererEleveUseCase } from '@application/user/TransfererEleveUseCase';
import type { ModifierMatiereUseCase } from '@application/subject/ModifierMatiereUseCase';
import type { AffecterLV2EleveUseCase } from '@application/student/AffecterLV2EleveUseCase';
import type { AffecterLV2EnMasseUseCase } from '@application/student/AffecterLV2EnMasseUseCase';
import type { AffecterPEBSEleveUseCase } from '@application/student/AffecterPEBSEleveUseCase';
import type { AffecterPEBSEnMasseUseCase } from '@application/student/AffecterPEBSEnMasseUseCase';
import type { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import type { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import type { ValiderEnBlocUseCase } from '@application/grade/ValiderEnBlocUseCase';
import type { PublierEmploiDuTempsUseCase } from '@application/timetable/PublierEmploiDuTempsUseCase';
import type { TenirConseilClasseUseCase } from '@application/classCouncil/TenirConseilClasseUseCase';
import type { DefinirPeriodeCouranteUseCase } from '@application/academicYear/DefinirPeriodeCouranteUseCase';
import type { VerifierPrerequisClotureUseCase } from '@application/academicYear/VerifierPrerequisClotureUseCase';
import type { CreerPlanFraisUseCase } from '@application/finance/CreerPlanFraisUseCase';
import type { GenererFacturesEnMasseUseCase } from '@application/finance/GenererFacturesEnMasseUseCase';
import type { EnregistrerPaiementCashUseCase } from '@application/finance/EnregistrerPaiementCashUseCase';
import type { ResumeSessionConcoursUseCase } from '@application/entranceExam/ResumeSessionConcoursUseCase';
import type { CalculerAdmissionConcoursUseCase } from '@application/entranceExam/CalculerAdmissionConcoursUseCase';
import type { ResumeSessionPebsUseCase } from '@application/pebsExam/ResumeSessionPebsUseCase';
import type { CalculerSelectionPebsUseCase } from '@application/pebsExam/CalculerSelectionPebsUseCase';
import type { VerifierMatriculeUseCase } from '@application/matricule/VerifierMatriculeUseCase';
import { resolveLanguage } from '@utils/languageHelper';
import { getEffectiveSchoolSettings } from '@utils/schoolSettings';

// ─── Contexte & contrats ─────────────────────────────────────────────────────
// (ActionContext / ActionExecuteResult / ActionDefinition : voir catalogShared.ts —
// moteur générique partagé entre tous les catalogues de rôles depuis la Section 6.2)

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
  inscrireEleve: InscrireUtilisateurUseCase;
  modifierUtilisateur: ModifierUtilisateurUseCase;
  supprimerUtilisateur: SupprimerUtilisateurUseCase;
  transfererEleve: TransfererEleveUseCase;
  modifierMatiere: ModifierMatiereUseCase;
  affecterLV2Eleve: AffecterLV2EleveUseCase;
  affecterLV2Masse: AffecterLV2EnMasseUseCase;
  affecterPEBSEleve: AffecterPEBSEleveUseCase;
  affecterPEBSMasse: AffecterPEBSEnMasseUseCase;
  genererBulletins: GenererBulletinUseCase;
  envoyerBulletins: EnvoyerBulletinsUseCase;
  validerNotesEnBloc: ValiderEnBlocUseCase;
  publierEDT: PublierEmploiDuTempsUseCase;
  ouvrirConseilClasse: TenirConseilClasseUseCase;
  definirPeriodeCourante: DefinirPeriodeCouranteUseCase;
  verifierPrerequisCloture: VerifierPrerequisClotureUseCase;
  creerPlanFrais: CreerPlanFraisUseCase;
  genererFacturesMasse: GenererFacturesEnMasseUseCase;
  enregistrerPaiementCash: EnregistrerPaiementCashUseCase;
  resumeSessionConcours: ResumeSessionConcoursUseCase;
  calculerAdmissionConcours: CalculerAdmissionConcoursUseCase;
  resumeSessionPebs: ResumeSessionPebsUseCase;
  calculerSelectionPebs: CalculerSelectionPebsUseCase;
  verifierMatricule: VerifierMatriculeUseCase;
  /** Approuve/rejette une demande de congé (déduit le solde si approuvée) — logique extraite de HRController. */
  traiterDemandeConge: (
    schoolId: string,
    requestId: string,
    statut: 'APPROVED' | 'REJECTED',
    validatedById: string | undefined,
  ) => Promise<{ id: string; statut: string }>;
  /** Diffuse un message SMS/email à un groupe ciblé — logique extraite de CommunicationsController. */
  diffuserMessage: (
    schoolId: string,
    createdById: string | undefined,
    target: { role?: string; classId?: string; level?: string; paymentStatus?: string },
    channel: 'SMS' | 'EMAIL' | 'BOTH',
    message: string,
  ) => Promise<{ total: number; sent: number; failed: number }>;
  /** Classes/matières en retard sur leur programme — logique extraite de PedagogieController. */
  alertesRetardProgramme: (schoolId: string, academicYearId?: string, seuilPct?: number) => Promise<{
    subjectName: string;
    className: string;
    progressionPct: number;
    attenduPct: number;
    retardPct: number;
    niveau: 'CRITIQUE' | 'MODERE';
  }[]>;
}

// ─── Helpers de résolution spécifiques au domaine Admin (RH/Finance/Concours) ─
// (les helpers génériques — resolveClass, resolveStudent, etc. — viennent de catalogShared.ts)

/** Résolution nom → employé (enseignant OU staff), pour le domaine RH. */
async function resolveEmployee(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
  const employees = await ctx.prisma.user.findMany({
    where: { schoolId: ctx.schoolId, role: { in: ['TEACHER', 'STAFF'] } },
    select: { id: true, firstName: true, lastName: true },
  });
  const full = (e: { firstName: string | null; lastName: string | null }) => `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
  const target = norm(name);
  let matches = employees.filter((e) => norm(full(e)) === target);
  if (matches.length === 0) matches = employees.filter((e) => norm(e.lastName ?? '') === target || norm(full(e)).includes(target));
  if (matches.length === 0) throw new Error(`Aucun employé nommé « ${name} » n'a été trouvé.`);
  if (matches.length > 1) throw new Error(`Plusieurs employés correspondent à « ${name} ». Précisez le nom complet.`);
  const m = matches[0];
  return { id: m.id, name: full(m) };
}

async function resolvePlanFrais(ctx: ActionContext, name: string): Promise<{ id: string; name: string; amount: number }> {
  const plans = await ctx.prisma.feePlan.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true, amount: true },
  });
  const target = norm(name);
  let matches = plans.filter((p) => norm(p.name) === target);
  if (matches.length === 0) matches = plans.filter((p) => norm(p.name).includes(target));
  if (matches.length === 0) throw new Error(`Aucun plan de frais nommé « ${name} » n'existe dans votre établissement.`);
  if (matches.length > 1) throw new Error(`Plusieurs plans de frais correspondent à « ${name} ». Précisez le nom exact.`);
  return matches[0];
}

async function resolveEntranceExamSession(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
  const sessions = await (ctx.prisma as any).entranceExamSession.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  const target = norm(name);
  let matches = sessions.filter((s: any) => norm(s.name) === target);
  if (matches.length === 0) matches = sessions.filter((s: any) => norm(s.name).includes(target));
  if (matches.length === 0) throw new Error(`Aucune session de concours nommée « ${name} » n'existe dans votre établissement.`);
  if (matches.length > 1) throw new Error(`Plusieurs sessions de concours correspondent à « ${name} ». Précisez le nom exact.`);
  return matches[0];
}

async function resolvePebsSession(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
  const sessions = await (ctx.prisma as any).pebsExamSession.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  const target = norm(name);
  let matches = sessions.filter((s: any) => norm(s.name) === target);
  if (matches.length === 0) matches = sessions.filter((s: any) => norm(s.name).includes(target));
  if (matches.length === 0) throw new Error(`Aucune session PEBS nommée « ${name} » n'existe dans votre établissement.`);
  if (matches.length > 1) throw new Error(`Plusieurs sessions PEBS correspondent à « ${name} ». Précisez le nom exact.`);
  return matches[0];
}

// ─── Construction du catalogue ───────────────────────────────────────────────

export function buildAdminActionCatalog(deps: AdminActionDeps): ActionDefinition[] {
  return [
    // 1. Créer une classe — NON destructif
    {
      name: 'creer_classe',
      domain: 'classes',
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
        await deps.supprimerClasse.execute({ classeId: String(undoData.classeId), schoolId: ctx.schoolId, demandeurId: ctx.userId });
      },
    },

    // 2. Créer une matière — NON destructif
    {
      name: 'creer_matiere',
      domain: 'matieres',
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
          demandeurId: ctx.userId,
        });
      },
    },

    // 3. Assigner un enseignant à une matière — NON destructif
    {
      name: 'assigner_enseignant_matiere',
      domain: 'matieres',
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
      domain: 'classes',
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

    // 5. Supprimer une classe — DESTRUCTIF (confirmation obligatoire — élément structurel isolé,
    // pas de ré-authentification complète requise, voir PLAN_IMPLEMENTATION_BACKUP.md §1.5)
    {
      name: 'supprimer_classe',
      domain: 'classes',
      description: 'Met une classe à la corbeille (récupérable pendant 30 jours).',
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
          `Cette action va mettre à la corbeille la classe « ${classe.name} » — restent rattachés : ` +
          `${parts.join(', ')}. Récupérable depuis la Corbeille pendant 30 jours, purgée définitivement ensuite.`
        );
      },
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        await deps.supprimerClasse.execute({ classeId: classe.id, schoolId: ctx.schoolId, demandeurId: ctx.userId });
        return { resultLabel: `Classe « ${classe.name} » mise à la corbeille`, section: 'classes', entity: 'class' };
      },
      async undo() {
        throw new Error('Restaurez cette classe depuis l\'écran Corbeille plutôt que depuis cette conversation.');
      },
    },

    // 6. Supprimer une matière — DESTRUCTIF (confirmation obligatoire — élément structurel isolé,
    // pas de ré-authentification complète requise, voir PLAN_IMPLEMENTATION_BACKUP.md §1.5)
    {
      name: 'supprimer_matiere',
      domain: 'matieres',
      description: 'Met une matière à la corbeille (récupérable pendant 30 jours).',
      destructive: true,
      requiredPermission: null,
      inputSchema: z.object({
        subjectName: z.string().min(1).describe('Nom de la matière à supprimer'),
      }),
      async summarizeDestructive(input, ctx) {
        const subject = await resolveSubject(ctx, input.subjectName);
        const grades = await ctx.prisma.grade.count({ where: { subjectId: subject.id } });
        const suffix = grades > 0 ? ` — ${grades} note(s) rattachée(s) restent intactes` : '';
        return (
          `Cette action va mettre à la corbeille la matière « ${subject.name} »${suffix}. ` +
          `Récupérable depuis la Corbeille pendant 30 jours, purgée définitivement ensuite.`
        );
      },
      async execute(input, ctx) {
        const subject = await resolveSubject(ctx, input.subjectName);
        await deps.supprimerMatiere.execute({ matiereId: subject.id, schoolId: ctx.schoolId, demandeurRole: ctx.role, demandeurId: ctx.userId });
        return { resultLabel: `Matière « ${subject.name} » mise à la corbeille`, section: 'subjects', entity: 'subject' };
      },
      async undo() {
        throw new Error('Restaurez cette matière depuis l\'écran Corbeille plutôt que depuis cette conversation.');
      },
    },

    // 7. Créer une session de concours d'entrée en 6e — NON destructif
    {
      name: 'creer_session_concours_entree',
      domain: 'concours',
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
      domain: 'lv2_pebs',
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
      domain: 'lv2_pebs',
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
      domain: 'concours',
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

    // ═══ Section 4.1 (Scolarité + LV2/PEBS) — chantier Copilot Unifié ═══

    // 11. Inscrire un élève — NON destructif
    {
      name: 'creer_eleve',
      domain: 'eleves',
      description: "Inscrit un nouvel élève dans une classe existante de l'établissement.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        firstName: z.string().min(1).describe("Prénom de l'élève"),
        lastName: z.string().min(1).describe("Nom de l'élève"),
        className: z.string().min(1).describe("Classe où inscrire l'élève"),
        gender: z.enum(['M', 'F']).optional(),
        dateOfBirth: z.string().optional().describe('Date de naissance au format YYYY-MM-DD, si connue'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        // Même mécanisme que l'inscription manuelle en production : hash aléatoire,
        // l'élève/parent crée son mot de passe via le lien d'invitation (UserController.register).
        const bcrypt = await import('bcryptjs');
        const nodeCrypto = await import('crypto');
        const passwordHash = await bcrypt.hash(nodeCrypto.randomBytes(32).toString('hex'), 10);
        const r = await deps.inscrireEleve.execute({
          schoolId: ctx.schoolId,
          role: 'STUDENT',
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash,
          classeId: classe.id,
          gender: input.gender,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        });
        return {
          resultLabel: `Élève ${r.nomComplet} inscrit en ${classe.name}`,
          undoData: { userId: r.userId },
          section: 'users',
          entity: 'user',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.supprimerUtilisateur.execute({
          userId: String(undoData.userId),
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          demandeurId: ctx.userId,
        });
      },
    },

    // 12. Modifier un élève — NON destructif
    {
      name: 'modifier_eleve',
      domain: 'eleves',
      description: "Modifie les informations d'un élève déjà inscrit (prénom, nom, téléphone).",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        studentName: z.string().min(1).describe("Nom complet de l'élève"),
        className: z.string().optional().describe("Classe actuelle de l'élève — précisez si plusieurs élèves portent ce nom"),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const before = await ctx.prisma.user.findUnique({
          where: { id: student.id },
          select: { firstName: true, lastName: true, phone: true },
        });
        await deps.modifierUtilisateur.execute({
          cibleUserId: student.id,
          demandeurId: ctx.userId,
          demandeurRole: ctx.role,
          schoolId: ctx.schoolId,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
        });
        return {
          resultLabel: `Élève ${student.name} modifié`,
          undoData: { userId: student.id, firstName: before?.firstName, lastName: before?.lastName, phone: before?.phone },
          section: 'users',
          entity: 'user',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.modifierUtilisateur.execute({
          cibleUserId: String(undoData.userId),
          demandeurId: ctx.userId,
          demandeurRole: ctx.role,
          schoolId: ctx.schoolId,
          firstName: (undoData.firstName as string | null) ?? undefined,
          lastName: (undoData.lastName as string | null) ?? undefined,
          phone: (undoData.phone as string | null) ?? undefined,
        });
      },
    },

    // 13. Transférer un élève vers une autre classe — NON destructif (réversible)
    {
      name: 'transferer_eleve',
      domain: 'eleves',
      description: "Transfère un élève de sa classe actuelle vers une autre classe.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        studentName: z.string().min(1).describe("Nom complet de l'élève"),
        fromClassName: z.string().min(1).describe("Classe actuelle de l'élève"),
        toClassName: z.string().min(1).describe('Classe de destination'),
      }),
      async execute(input, ctx) {
        const fromClasse = await resolveClass(ctx, input.fromClassName);
        const toClasse = await resolveClass(ctx, input.toClassName);
        const student = await resolveStudent(ctx, input.studentName, input.fromClassName);
        await deps.transfererEleve.execute({
          studentId: student.id,
          fromClasseId: fromClasse.id,
          toClasseId: toClasse.id,
          schoolId: ctx.schoolId,
          demandeurId: ctx.userId,
        });
        return {
          resultLabel: `${student.name} transféré(e) de ${fromClasse.name} vers ${toClasse.name}`,
          undoData: { studentId: student.id, fromClasseId: toClasse.id, toClasseId: fromClasse.id },
          section: 'users',
          entity: 'user',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.transfererEleve.execute({
          studentId: String(undoData.studentId),
          fromClasseId: String(undoData.fromClasseId),
          toClasseId: String(undoData.toClasseId),
          schoolId: ctx.schoolId,
          demandeurId: ctx.userId,
        });
      },
    },

    // 14. Modifier une matière — NON destructif
    {
      name: 'modifier_matiere',
      domain: 'matieres',
      description: "Modifie une matière existante (nom, coefficient, heures par semaine).",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        subjectName: z.string().min(1),
        newName: z.string().optional(),
        coefficient: z.number().positive().optional(),
        hoursPerWeek: z.number().positive().optional(),
      }),
      async execute(input, ctx) {
        const subject = await resolveSubject(ctx, input.subjectName);
        const before = await ctx.prisma.subject.findUnique({
          where: { id: subject.id },
          select: { name: true, coefficient: true, hoursPerWeek: true },
        });
        await deps.modifierMatiere.execute({
          matiereId: subject.id,
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          name: input.newName,
          coefficient: input.coefficient,
          hoursPerWeek: input.hoursPerWeek,
        });
        return {
          resultLabel: `Matière « ${subject.name} » modifiée`,
          undoData: { matiereId: subject.id, name: before?.name, coefficient: before?.coefficient, hoursPerWeek: before?.hoursPerWeek },
          section: 'subjects',
          entity: 'subject',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.modifierMatiere.execute({
          matiereId: String(undoData.matiereId),
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          name: undoData.name as string | undefined,
          coefficient: undoData.coefficient as number | undefined,
          hoursPerWeek: undoData.hoursPerWeek as number | undefined,
        });
      },
    },

    // 15. Affecter la LV2 d'un élève — NON destructif (réversible)
    {
      name: 'affecter_lv2_eleve',
      domain: 'lv2_pebs',
      description: "Affecte (ou retire, si subjectName omis) la LV2 (deuxième langue vivante) d'UN élève précis.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().optional().describe('Précisez si plusieurs élèves portent ce nom'),
        subjectName: z.string().optional().describe('Nom de la LV2 à affecter — omettre pour retirer la LV2 actuelle'),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const subject = input.subjectName ? await resolveSubject(ctx, input.subjectName) : null;
        const before = await ctx.prisma.studentProfile.findFirst({ where: { userId: student.id }, select: { lv2SubjectId: true } });
        await deps.affecterLV2Eleve.execute({ studentUserId: student.id, schoolId: ctx.schoolId, lv2SubjectId: subject?.id ?? null });
        return {
          resultLabel: subject ? `LV2 ${subject.name} affectée à ${student.name}` : `LV2 retirée à ${student.name}`,
          undoData: { studentUserId: student.id, previousLv2SubjectId: before?.lv2SubjectId ?? null },
          section: 'lv2-choice',
          entity: 'studentProfile',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.affecterLV2Eleve.execute({
          studentUserId: String(undoData.studentUserId),
          schoolId: ctx.schoolId,
          lv2SubjectId: (undoData.previousLv2SubjectId as string | null) ?? null,
        });
      },
    },

    // 16. Affecter la LV2 en masse à toute une classe — NON destructif (réversible)
    {
      name: 'affecter_lv2_masse',
      domain: 'lv2_pebs',
      description: "Affecte (ou retire, si subjectName omis) la même LV2 à TOUS les élèves d'une classe en une fois.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        className: z.string().min(1),
        subjectName: z.string().optional().describe('Nom de la LV2 à affecter — omettre pour retirer la LV2 de toute la classe'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = input.subjectName ? await resolveSubject(ctx, input.subjectName) : null;
        const profiles = await ctx.prisma.studentProfile.findMany({ where: { classId: classe.id }, select: { userId: true, lv2SubjectId: true } });
        const r = await deps.affecterLV2Masse.execute({
          studentUserIds: profiles.map((p) => p.userId),
          schoolId: ctx.schoolId,
          lv2SubjectId: subject?.id ?? null,
        });
        return {
          resultLabel: `LV2 ${subject ? subject.name : '(retirée)'} affectée à ${r.modifies} élève(s) de ${classe.name}`,
          undoData: { previous: profiles.map((p) => ({ userId: p.userId, lv2SubjectId: p.lv2SubjectId })) },
          section: 'lv2-choice',
          entity: 'studentProfile',
        };
      },
      async undo(_params, undoData, ctx) {
        const previous = undoData.previous as { userId: string; lv2SubjectId: string | null }[];
        for (const p of previous) {
          await deps.affecterLV2Eleve.execute({ studentUserId: p.userId, schoolId: ctx.schoolId, lv2SubjectId: p.lv2SubjectId });
        }
      },
    },

    // 17. Affecter la filière PEBS d'un élève — NON destructif (réversible)
    {
      name: 'affecter_pebs_eleve',
      domain: 'lv2_pebs',
      description: "Affecte (ou retire, si filiere omis) la filière PEBS (Programme Spécial Bilingue) d'UN élève précis.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().optional().describe('Précisez si plusieurs élèves portent ce nom'),
        filiere: z.enum(['FR_PEBS', 'EN_PEBS']).optional().describe('Filière PEBS à affecter — omettre pour retirer'),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const before = await ctx.prisma.studentProfile.findFirst({ where: { userId: student.id }, select: { pebsFiliere: true } });
        await deps.affecterPEBSEleve.execute({ studentUserId: student.id, schoolId: ctx.schoolId, pebsFiliere: input.filiere ?? null });
        return {
          resultLabel: input.filiere ? `Filière ${input.filiere} affectée à ${student.name}` : `Filière PEBS retirée à ${student.name}`,
          undoData: { studentUserId: student.id, previousPebsFiliere: before?.pebsFiliere ?? null },
          section: 'pebs-exams',
          entity: 'studentProfile',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.affecterPEBSEleve.execute({
          studentUserId: String(undoData.studentUserId),
          schoolId: ctx.schoolId,
          pebsFiliere: (undoData.previousPebsFiliere as string | null) ?? null,
        });
      },
    },

    // 18. Affecter la filière PEBS en masse à toute une classe — NON destructif (réversible)
    {
      name: 'affecter_pebs_masse',
      domain: 'lv2_pebs',
      description: "Affecte (ou retire, si filiere omis) la même filière PEBS à TOUS les élèves d'une classe en une fois.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        className: z.string().min(1),
        filiere: z.enum(['FR_PEBS', 'EN_PEBS']).optional().describe('Filière PEBS à affecter — omettre pour retirer de toute la classe'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const profiles = await ctx.prisma.studentProfile.findMany({ where: { classId: classe.id }, select: { userId: true, pebsFiliere: true } });
        const r = await deps.affecterPEBSMasse.execute({
          studentUserIds: profiles.map((p) => p.userId),
          schoolId: ctx.schoolId,
          pebsFiliere: input.filiere ?? null,
        });
        return {
          resultLabel: `Filière ${input.filiere ?? '(retirée)'} affectée à ${r.modifies} élève(s) de ${classe.name}`,
          undoData: { previous: profiles.map((p) => ({ userId: p.userId, pebsFiliere: p.pebsFiliere })) },
          section: 'pebs-exams',
          entity: 'studentProfile',
        };
      },
      async undo(_params, undoData, ctx) {
        const previous = undoData.previous as { userId: string; pebsFiliere: string | null }[];
        for (const p of previous) {
          await deps.affecterPEBSEleve.execute({ studentUserId: p.userId, schoolId: ctx.schoolId, pebsFiliere: p.pebsFiliere });
        }
      },
    },

    // 19. Compter les élèves d'une classe par LV2 — LECTURE SEULE
    {
      name: 'compter_eleves_par_lv2',
      domain: 'lv2_pebs',
      description: "Compte combien d'élèves d'une classe ont chaque LV2 affectée, et combien n'en ont aucune.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const profiles = await ctx.prisma.studentProfile.findMany({
          where: { classId: classe.id },
          select: { lv2Subject: { select: { name: true } } },
        });
        const counts = new Map<string, number>();
        for (const p of profiles) {
          const key = p.lv2Subject?.name ?? 'Aucune LV2';
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const resultLabel = `${classe.name} (${profiles.length} élève(s)) : ` +
          [...counts.entries()].map(([k, v]) => `${k} : ${v}`).join(', ');
        return { resultLabel, section: 'lv2-choice', entity: 'studentProfile' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 20. Lister les élèves sans LV2 dans une classe — LECTURE SEULE
    {
      name: 'lister_eleves_sans_lv2',
      domain: 'lv2_pebs',
      description: "Liste les élèves d'une classe qui n'ont pas encore de LV2 affectée.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const profiles = await ctx.prisma.studentProfile.findMany({
          where: { classId: classe.id, lv2SubjectId: null },
          select: { user: { select: { firstName: true, lastName: true } } },
        });
        const resultLabel = profiles.length === 0
          ? `Tous les élèves de ${classe.name} ont une LV2 affectée.`
          : `${profiles.length} élève(s) de ${classe.name} sans LV2 : ` +
            profiles.map((p) => `${p.user.firstName ?? ''} ${p.user.lastName ?? ''}`.trim()).join(', ');
        return { resultLabel, section: 'lv2-choice', entity: 'studentProfile' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 21. Répartition PEBS d'une classe — LECTURE SEULE
    {
      name: 'repartition_pebs_classe',
      domain: 'lv2_pebs',
      description: "Donne la répartition des élèves d'une classe entre filière PEBS francophone, anglophone, et non-PEBS.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const profiles = await ctx.prisma.studentProfile.findMany({ where: { classId: classe.id }, select: { pebsFiliere: true } });
        const frPebs = profiles.filter((p) => p.pebsFiliere === 'FR_PEBS').length;
        const enPebs = profiles.filter((p) => p.pebsFiliere === 'EN_PEBS').length;
        const nonPebs = profiles.length - frPebs - enPebs;
        return {
          resultLabel: `${classe.name} (${profiles.length} élève(s)) : PEBS francophone ${frPebs}, PEBS anglophone ${enPebs}, non-PEBS ${nonPebs}`,
          section: 'pebs-exams',
          entity: 'studentProfile',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Section 4.2 (Notes & Bulletins) — chantier Copilot Unifié ═══

    // 22. Générer les bulletins d'une classe — NON destructif (mais non annulable via le copilot)
    {
      name: 'generer_bulletins_classe',
      domain: 'notes_bulletins',
      description:
        "Déclenche la génération des bulletins pour une classe, sur la période académique courante. " +
        "Échoue si les notes ne sont pas toutes validées ou si le conseil de classe n'est pas verrouillé — " +
        "dans ce cas, oriente l'utilisateur vers l'écran Bulletins pour voir le détail des blocages.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const period = await resolveCurrentPeriod(ctx);
        const year = await resolveCurrentAcademicYear(ctx);
        const settings = await getEffectiveSchoolSettings(ctx.schoolId);
        const school = await ctx.prisma.school.findUnique({ where: { id: ctx.schoolId }, select: { name: true } });
        const r = await deps.genererBulletins.execute({
          schoolId: ctx.schoolId,
          classId: classe.id,
          academicPeriodId: period.id,
          academicYearId: year.id,
          template: (settings as any)?.bulletinTemplate ?? 'FR_SECONDARY',
          nomEtablissement: school?.name ?? 'Établissement',
          demandeurId: ctx.userId,
        });
        return {
          resultLabel: `Bulletins générés pour ${classe.name} (${(r as any).bulletinsGeneres ?? '—'} bulletin(s)), période ${period.name}`,
          section: 'bulletins',
          entity: 'reportCard',
        };
      },
      async undo() {
        throw new Error('La génération de bulletins ne peut pas être annulée depuis le copilot — utilisez l\'écran Bulletins.');
      },
    },

    // 23. Envoyer les bulletins aux parents — NON destructif (mais non annulable — des emails partent réellement)
    {
      name: 'envoyer_bulletins_parents',
      domain: 'notes_bulletins',
      description: "Envoie par email les bulletins déjà générés d'une classe aux parents, pour la période courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const period = await resolveCurrentPeriod(ctx);
        const school = await ctx.prisma.school.findUnique({ where: { id: ctx.schoolId }, select: { name: true, subsystem: true } });
        const langue = resolveLanguage(school?.subsystem);
        await deps.envoyerBulletins.execute({
          schoolId: ctx.schoolId,
          classId: classe.id,
          academicPeriodId: period.id,
          nomEtablissement: school?.name ?? 'Établissement',
          nomPeriode: period.name,
          langue,
        });
        return {
          resultLabel: `Bulletins de ${classe.name} envoyés aux parents (période ${period.name})`,
          section: 'bulletins',
          entity: 'reportCard',
        };
      },
      async undo() {
        throw new Error('L\'envoi de bulletins ne peut pas être annulé — les emails sont déjà partis.');
      },
    },

    // 24. Valider toutes les notes en attente d'une classe — NON destructif
    {
      name: 'valider_notes_en_masse',
      domain: 'notes_bulletins',
      description:
        "Valide en une fois toutes les notes au statut « Soumis » d'une classe, pour la séquence courante " +
        "(ou la matière si précisée). Équivalent au bouton « Valider tout » de l'écran Notes.",
      destructive: false,
      requiredPermission: 'VALIDATE_GRADES',
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const sequence = await resolveCurrentSequence(ctx);
        const r = await deps.validerNotesEnBloc.execute({
          classId: classe.id,
          sequenceId: sequence.id,
          validateurId: ctx.userId,
        });
        return {
          resultLabel: `${classe.name} (séquence ${sequence.name}) : ${r.message}`,
          section: 'grades',
          entity: 'grade',
        };
      },
      async undo() {
        throw new Error('La validation en masse de notes ne peut pas être annulée depuis le copilot.');
      },
    },

    // 25. Orienter vers l'import Excel de notes — LECTURE (navigation uniquement, aucune exécution à l'aveugle)
    {
      name: 'guider_import_excel_notes',
      domain: 'notes_bulletins',
      description:
        "L'utilisateur veut importer des notes depuis un fichier Excel. Le copilot n'exécute PAS l'import " +
        "à l'aveugle (aucun fichier n'est fourni dans la conversation) — cette action navigue simplement " +
        "vers l'écran Notes où se trouve le bouton d'import.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute() {
        return {
          resultLabel: "Rendez-vous sur l'écran Notes — le bouton d'import Excel s'y trouve, un fichier est nécessaire.",
          section: 'grades',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple navigation, il n\'y a rien à annuler.');
      },
    },

    // 26. Moyenne d'une classe dans une matière — LECTURE SEULE
    {
      name: 'moyenne_classe_matiere',
      domain: 'notes_bulletins',
      description: "Donne la moyenne d'une classe dans une matière donnée, pour la séquence courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1), subjectName: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        const sequence = await resolveCurrentSequence(ctx);
        const grades = await ctx.prisma.grade.findMany({
          where: { classId: classe.id, subjectId: subject.id, sequenceId: sequence.id, sequenceAverage: { not: null } },
          select: { sequenceAverage: true },
        });
        if (grades.length === 0) {
          return { resultLabel: `Aucune note de ${subject.name} enregistrée pour ${classe.name} (séquence ${sequence.name}).`, section: 'grades', entity: 'grade' };
        }
        const moyenne = grades.reduce((s, g) => s + (g.sequenceAverage ?? 0), 0) / grades.length;
        return {
          resultLabel: `Moyenne de ${classe.name} en ${subject.name} (séquence ${sequence.name}) : ${moyenne.toFixed(2)}/20 (${grades.length} note(s))`,
          section: 'grades',
          entity: 'grade',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 27. Élèves sous la moyenne dans une classe — LECTURE SEULE
    {
      name: 'compter_eleves_sous_moyenne',
      domain: 'notes_bulletins',
      description: "Compte combien d'élèves d'une classe ont une moyenne générale inférieure à 10/20, pour la séquence courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const sequence = await resolveCurrentSequence(ctx);
        const moyennes = await calculerMoyennesClasseSequence(ctx, classe.id, sequence.id);
        const sousLaMoyenne = [...moyennes.values()].filter((m) => m < 10).length;
        return {
          resultLabel: `${classe.name} (séquence ${sequence.name}) : ${sousLaMoyenne}/${moyennes.size} élève(s) sous la moyenne générale (10/20)`,
          section: 'grades',
          entity: 'grade',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 28. Le conseil de classe d'une classe a-t-il déjà eu lieu ? — LECTURE SEULE
    {
      name: 'conseil_classe_tenu',
      domain: 'conseil_classe',
      description: "Indique si le conseil de classe d'une classe a déjà été tenu (et verrouillé) pour la période courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const period = await resolveCurrentPeriod(ctx);
        const session = await (ctx.prisma as any).classCouncilSession.findFirst({
          where: { classId: classe.id, academicPeriodId: period.id },
          select: { status: true },
        });
        const resultLabel = !session
          ? `Aucun conseil de classe n'a été créé pour ${classe.name} (période ${period.name}).`
          : session.status === 'LOCKED'
            ? `Le conseil de classe de ${classe.name} a été tenu et verrouillé (période ${period.name}).`
            : `Un conseil de classe existe pour ${classe.name} mais n'est pas encore verrouillé (statut : ${session.status}).`;
        return { resultLabel, section: 'council', entity: 'classCouncilSession' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Section 4.3 (Emploi du temps & Conseil de classe) — chantier Copilot Unifié ═══

    // 29. Publier l'emploi du temps d'une classe — NON destructif (réversible)
    {
      name: 'publier_emploi_du_temps',
      domain: 'classes',
      description: "Publie l'emploi du temps d'une classe (le rend visible aux enseignants et élèves), pour l'année scolaire courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const year = await resolveCurrentAcademicYear(ctx);
        const timetable = await ctx.prisma.timetable.findFirst({
          where: { classId: classe.id, academicYearId: year.id, schoolId: ctx.schoolId },
          select: { id: true, status: true },
        });
        if (!timetable) throw new Error(`Aucun emploi du temps n'existe pour ${classe.name} sur l'année courante.`);
        if (timetable.status === 'PUBLISHED') {
          return { resultLabel: `L'emploi du temps de ${classe.name} est déjà publié.`, section: 'timetable', entity: 'timetable' };
        }
        await deps.publierEDT.execute({ timetableId: timetable.id, schoolId: ctx.schoolId });
        return {
          resultLabel: `Emploi du temps de ${classe.name} publié`,
          undoData: { timetableId: timetable.id },
          section: 'timetable',
          entity: 'timetable',
        };
      },
      async undo(_params, undoData, ctx) {
        await ctx.prisma.timetable.update({ where: { id: String(undoData.timetableId) }, data: { status: 'DRAFT' } });
      },
    },

    // 30. Ouvrir un conseil de classe — NON destructif (n'ajoute pas de décisions, ne verrouille pas)
    {
      name: 'ouvrir_conseil_classe',
      domain: 'conseil_classe',
      description:
        "Ouvre une session de Conseil de Classe pour une classe, sur la période courante. Bloque si des notes " +
        "ne sont pas encore validées (Loi MINESEC). N'ajoute PAS les décisions individuelles ni ne verrouille " +
        "la session — cela reste à faire depuis l'écran Conseil de Classe.",
      destructive: false,
      requiredPermission: 'VALIDATE_GRADES',
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const period = await resolveCurrentPeriod(ctx);
        const r = await deps.ouvrirConseilClasse.execute({
          schoolId: ctx.schoolId,
          classId: classe.id,
          academicPeriodId: period.id,
          presidedById: ctx.userId,
        });
        return { resultLabel: r.message, section: 'council', entity: 'classCouncilSession' };
      },
      async undo() {
        throw new Error("L'ouverture d'un conseil de classe ne peut pas être annulée depuis le copilot — utilisez l'écran Conseil de Classe.");
      },
    },

    // 31. Classes sans emploi du temps publié — LECTURE SEULE
    {
      name: 'classes_sans_edt_publie',
      domain: 'classes',
      description: "Liste les classes qui n'ont pas encore d'emploi du temps publié, pour l'année scolaire courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const classes = await ctx.prisma.class.findMany({ where: { schoolId: ctx.schoolId }, select: { id: true, name: true } });
        const timetables = await ctx.prisma.timetable.findMany({
          where: { schoolId: ctx.schoolId, academicYearId: year.id, status: 'PUBLISHED' },
          select: { classId: true },
        });
        const publishedIds = new Set(timetables.map((t) => t.classId));
        const sansEdt = classes.filter((c) => !publishedIds.has(c.id));
        const resultLabel = sansEdt.length === 0
          ? 'Toutes les classes ont un emploi du temps publié.'
          : `${sansEdt.length} classe(s) sans emploi du temps publié : ${sansEdt.map((c) => c.name).join(', ')}`;
        return { resultLabel, section: 'timetable', entity: 'timetable' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 32. Classes sans conseil de classe verrouillé — LECTURE SEULE
    {
      name: 'classes_sans_conseil_tenu',
      domain: 'conseil_classe',
      description: "Liste les classes qui n'ont pas encore tenu (ni verrouillé) leur conseil de classe pour la période courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const period = await resolveCurrentPeriod(ctx);
        const classes = await ctx.prisma.class.findMany({ where: { schoolId: ctx.schoolId }, select: { id: true, name: true } });
        const sessions = await (ctx.prisma as any).classCouncilSession.findMany({
          where: { schoolId: ctx.schoolId, academicPeriodId: period.id, status: 'LOCKED' },
          select: { classId: true },
        });
        const lockedIds = new Set(sessions.map((s: any) => s.classId));
        const sansConseil = classes.filter((c) => !lockedIds.has(c.id));
        const resultLabel = sansConseil.length === 0
          ? 'Toutes les classes ont tenu et verrouillé leur conseil de classe.'
          : `${sansConseil.length} classe(s) sans conseil de classe verrouillé : ${sansConseil.map((c) => c.name).join(', ')}`;
        return { resultLabel, section: 'council', entity: 'classCouncilSession' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Section 4.4 (Année scolaire) — chantier Copilot Unifié ═══

    // 33. Définir la période académique courante — NON destructif (réversible)
    {
      name: 'definir_periode_courante',
      domain: 'periode_annee',
      description: "Change la période académique courante de l'établissement (ex. passer du Trimestre 1 au Trimestre 2). Affecte toute la saisie de notes en cours.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ periodName: z.string().min(1).describe('Nom de la période à activer, ex. "Trimestre 2"') }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const previous = await resolveCurrentPeriod(ctx).catch(() => null);
        const period = await ctx.prisma.academicPeriod.findFirst({
          where: { academicYearId: year.id, name: { equals: input.periodName, mode: 'insensitive' } },
          select: { id: true, name: true },
        });
        if (!period) throw new Error(`Aucune période nommée « ${input.periodName} » n'existe pour l'année courante.`);
        await deps.definirPeriodeCourante.definirPeriode(period.id);
        return {
          resultLabel: `Période courante définie sur « ${period.name} »`,
          undoData: { previousPeriodId: previous?.id ?? null },
          section: 'academic-year',
          entity: 'academicPeriod',
        };
      },
      async undo(_params, undoData, ctx) {
        const previousId = undoData.previousPeriodId as string | null;
        if (previousId) await deps.definirPeriodeCourante.definirPeriode(previousId);
      },
    },

    // 34. Vérifier si l'année scolaire peut être clôturée — LECTURE SEULE
    {
      name: 'verifier_cloture_annee',
      domain: 'periode_annee',
      description:
        "Vérifie si l'année scolaire courante peut être clôturée et liste les blocages éventuels. " +
        "N'exécute JAMAIS la clôture elle-même — action trop sensible (promotions, archivage) pour être " +
        "déclenchée depuis le copilot, à faire uniquement depuis l'écran Année scolaire.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const r = await deps.verifierPrerequisCloture.execute(year.id);
        const resultLabel = r.peutCloturer
          ? `L'année ${year.name} peut être clôturée — tous les prérequis sont remplis.`
          : `L'année ${year.name} ne peut pas encore être clôturée : ${r.bloqueurs.map((b) => b.message).join(' ; ')}`;
        return { resultLabel, section: 'academic-year', entity: 'academicYear' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Section 4.5 (Finance) — chantier Copilot Unifié ═══
    // Note de périmètre : l'APEE (collectes/dépenses) est volontairement EXCLUE de cette phase
    // Admin, par le même principe que Discipline/Bibliothèque en Section 4.1 — son seul écran
    // vit dans le dashboard Staff (SectionAPEEStaff.tsx), le critère de visibilité en direct
    // (Section 5) ne peut donc pas être rempli ici. Elle sera traitée dans le chantier Staff
    // (Section 6.2), où elle a son vrai contexte d'écran.

    // 35. Créer un plan de frais — NON destructif (réversible tant qu'aucune facture n'est émise)
    {
      name: 'creer_plan_frais',
      domain: 'paiements',
      description:
        "Crée un plan de frais (ex. scolarité, examen, tenue) pour l'établissement. Vérifie le seuil légal " +
        "MINESEC (Art. 48) si le type est TUITION — bloque si le montant le dépasse.",
      destructive: false,
      requiredPermission: 'MANAGE_FINANCE',
      inputSchema: z.object({
        name: z.string().min(1),
        amount: z.number().positive(),
        feeType: z.enum(['TUITION', 'APEE_PTA', 'EXAM', 'UNIFORM', 'CAUTION', 'WORKSHOP', 'INSCRIPTION', 'DEVELOPMENT_LEVY', 'SPORTS_LEVY']).default('TUITION'),
        level: z.string().optional().describe('Niveau ciblé, ex. "4e" — laisser vide si applicable à tous les niveaux'),
        isRefundable: z.boolean().optional(),
        description: z.string().optional(),
      }),
      async execute(input, ctx) {
        const r = await deps.creerPlanFrais.execute({
          schoolId: ctx.schoolId,
          name: input.name,
          amount: input.amount,
          feeType: input.feeType,
          level: input.level,
          isRefundable: input.isRefundable,
          description: input.description,
          demandeurRole: ctx.role,
        });
        return {
          resultLabel: `Plan de frais « ${r.name} » créé (${r.amount} FCFA)`,
          undoData: { planId: r.planId },
          section: 'finance',
          entity: 'feePlan',
        };
      },
      async undo(_params, undoData, ctx) {
        await ctx.prisma.feePlan.delete({ where: { id: String(undoData.planId) } });
      },
    },

    // 36. Générer les factures d'une classe pour un plan de frais — NON annulable (factures réelles émises)
    {
      name: 'generer_factures_masse',
      domain: 'paiements',
      description: "Génère les factures d'un plan de frais pour tous les élèves d'une classe (ignore les élèves déjà facturés pour ce plan).",
      destructive: false,
      requiredPermission: 'MANAGE_FINANCE',
      inputSchema: z.object({ className: z.string().min(1), planName: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const plan = await resolvePlanFrais(ctx, input.planName);
        const profiles = await ctx.prisma.studentProfile.findMany({ where: { classId: classe.id }, select: { userId: true } });
        if (profiles.length === 0) throw new Error(`Aucun élève inscrit dans ${classe.name}.`);
        const r = await deps.genererFacturesMasse.execute({
          schoolId: ctx.schoolId,
          feePlanId: plan.id,
          studentIds: profiles.map((p) => p.userId),
        });
        return {
          resultLabel: `${classe.name} — plan « ${plan.name} » : ${r.crees} facture(s) créée(s), ${r.ignores} déjà facturé(s)${r.erreurs.length > 0 ? `, ${r.erreurs.length} erreur(s)` : ''}`,
          section: 'finance',
          entity: 'invoice',
        };
      },
      async undo() {
        throw new Error('La génération de factures ne peut pas être annulée depuis le copilot — utilisez l\'écran Finance.');
      },
    },

    // 37. Enregistrer un paiement en espèces — NON annulable (encaissement réel)
    {
      name: 'enregistrer_paiement_cash',
      domain: 'paiements',
      description: "Enregistre un paiement en espèces (guichet) reçu d'un élève, contre une facture impayée ou partiellement payée.",
      destructive: false,
      requiredPermission: 'MANAGE_FINANCE',
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().optional(),
        montant: z.number().positive(),
        planName: z.string().optional().describe('Nom du plan de frais concerné, à préciser si plusieurs factures impayées existent'),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const factures = await ctx.prisma.invoice.findMany({
          where: { schoolId: ctx.schoolId, studentId: student.id, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
          select: { id: true, amount: true, feePlan: { select: { name: true } } },
        });
        let candidates = factures;
        if (input.planName) {
          const target = norm(input.planName);
          candidates = factures.filter((f) => f.feePlan?.name && norm(f.feePlan.name).includes(target));
        }
        if (candidates.length === 0) throw new Error(`Aucune facture impayée trouvée pour ${student.name}${input.planName ? ` (plan « ${input.planName} »)` : ''}.`);
        if (candidates.length > 1) {
          const list = candidates.map((f) => f.feePlan?.name ?? 'facture sans plan').join(', ');
          throw new Error(`Plusieurs factures impayées existent pour ${student.name} : ${list}. Précisez le plan de frais concerné.`);
        }
        const facture = candidates[0];
        const r = await deps.enregistrerPaiementCash.execute({
          schoolId: ctx.schoolId,
          factureId: facture.id,
          studentId: student.id,
          montant: input.montant,
          enregistreurId: ctx.userId,
        });
        return {
          resultLabel: `Paiement de ${input.montant} FCFA enregistré pour ${student.name} — statut facture : ${r.nouveauStatutFacture}, reste à régler : ${r.resteARegler} FCFA`,
          section: 'finance',
          entity: 'payment',
        };
      },
      async undo() {
        throw new Error('Un paiement encaissé ne peut pas être annulé depuis le copilot — utilisez l\'écran Finance pour un remboursement.');
      },
    },

    // 38. Élèves avec factures impayées — LECTURE SEULE
    {
      name: 'eleves_factures_impayees',
      domain: 'paiements',
      description: "Liste les factures impayées ou partiellement payées (toute une classe, ou tout l'établissement si aucune classe n'est précisée) et le total restant dû.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().optional() }),
      async execute(input, ctx) {
        let studentIds: string[] | undefined;
        let label = "l'établissement";
        if (input.className) {
          const classe = await resolveClass(ctx, input.className);
          const profiles = await ctx.prisma.studentProfile.findMany({ where: { classId: classe.id }, select: { userId: true } });
          studentIds = profiles.map((p) => p.userId);
          label = classe.name;
        }
        const factures = await ctx.prisma.invoice.findMany({
          where: {
            schoolId: ctx.schoolId,
            status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
            ...(studentIds ? { studentId: { in: studentIds } } : {}),
          },
          select: {
            amount: true,
            payments: { where: { status: 'SUCCESS' }, select: { amount: true } },
          },
        });
        const resteTotal = factures.reduce((somme, f) => {
          const paye = f.payments.reduce((s, p) => s + p.amount, 0);
          return somme + Math.max(0, f.amount - paye);
        }, 0);
        const resultLabel = factures.length === 0
          ? `Aucune facture impayée pour ${label}.`
          : `${factures.length} facture(s) impayée(s) pour ${label} — total restant dû : ${resteTotal} FCFA`;
        return { resultLabel, section: 'finance', entity: 'invoice' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Section 4.6 (Matricules & Concours) — chantier Copilot Unifié ═══

    // 39. Résumé d'une session de concours d'entrée — LECTURE SEULE
    {
      name: 'resume_session_concours',
      domain: 'concours',
      description: "Affiche le résumé d'une session de concours d'entrée en 6e : nombre de candidats, admis provisoires, confirmés, en attente de CEP.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ sessionName: z.string().min(1) }),
      async execute(input, ctx) {
        const session = await resolveEntranceExamSession(ctx, input.sessionName);
        const r = await deps.resumeSessionConcours.execute(ctx.schoolId, session.id);
        const resultLabel =
          `Session « ${r.session.name} » : ${r.total} candidat(s) — ${r.pending} en attente, ` +
          `${r.admisProvisoire} admis provisoire(s), ${r.confirms} confirmé(s), ${r.annules} annulé(s), ` +
          `${r.cepPending} en attente de résultat CEP.`;
        return { resultLabel, section: 'entrance-exams', entity: 'entranceExamSession' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 40. Calculer l'admission d'une session de concours — NON annulable (statuts réels appliqués)
    {
      name: 'calculer_admission_concours',
      domain: 'concours',
      description:
        "Calcule l'admission des candidats d'une session de concours d'entrée, selon le seuil de notes et " +
        "le nombre de places disponibles configurés sur la session. Met à jour le statut de chaque candidat.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ sessionName: z.string().min(1) }),
      async execute(input, ctx) {
        const session = await resolveEntranceExamSession(ctx, input.sessionName);
        const r = await deps.calculerAdmissionConcours.execute({ schoolId: ctx.schoolId, sessionId: session.id });
        return {
          resultLabel: `Session « ${session.name} » : ${r.admis} candidat(s) admis provisoire(s), ${r.nonAdmis} non admis.`,
          section: 'entrance-exams',
          entity: 'entranceExamCandidate',
        };
      },
      async undo() {
        throw new Error("Le calcul d'admission ne peut pas être annulé depuis le copilot — utilisez l'écran Concours pour ajuster manuellement.");
      },
    },

    // 41. Résumé d'une session PEBS — LECTURE SEULE
    {
      name: 'resume_session_pebs',
      domain: 'lv2_pebs',
      description: "Affiche le résumé d'une session de sélection PEBS : nombre de candidats, en attente, sélectionnés, non sélectionnés.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ sessionName: z.string().min(1) }),
      async execute(input, ctx) {
        const session = await resolvePebsSession(ctx, input.sessionName);
        const r = await deps.resumeSessionPebs.execute(ctx.schoolId, session.id);
        const resultLabel =
          `Session « ${r.session.name} » (${r.session.level}) : ${r.total} candidat(s) — ${r.pending} en attente, ` +
          `${r.selectionnes} sélectionné(s), ${r.nonSelectionnes} non sélectionné(s).`;
        return { resultLabel, section: 'pebs-exams', entity: 'pebsExamSession' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 42. Calculer la sélection d'une session PEBS — NON annulable (résultats réels appliqués)
    {
      name: 'calculer_selection_pebs',
      domain: 'lv2_pebs',
      description:
        "Calcule la sélection des candidats d'une session PEBS, selon le seuil de notes et le nombre de places " +
        "disponibles configurés sur la session. Ne transfère PAS encore les élèves sélectionnés vers la classe cible.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ sessionName: z.string().min(1) }),
      async execute(input, ctx) {
        const session = await resolvePebsSession(ctx, input.sessionName);
        const r = await deps.calculerSelectionPebs.execute({ schoolId: ctx.schoolId, sessionId: session.id });
        return {
          resultLabel: `Session « ${session.name} » : ${r.selectionnes} candidat(s) sélectionné(s), ${r.nonSelectionnes} non sélectionné(s). Le transfert vers la classe cible reste à faire depuis l'écran PEBS.`,
          section: 'pebs-exams',
          entity: 'pebsExamCandidate',
        };
      },
      async undo() {
        throw new Error('Le calcul de sélection ne peut pas être annulé depuis le copilot — utilisez l\'écran PEBS pour ajuster manuellement.');
      },
    },

    // 43. Vérifier le matricule d'un élève sur cartescolaire.cm — LECTURE SEULE (ne modifie jamais le profil)
    {
      name: 'verifier_matricule_eleve',
      domain: 'eleves',
      description:
        "Recherche le matricule officiel d'un élève sur cartescolaire.cm (MINESEC). N'associe JAMAIS le " +
        "résultat automatiquement au profil — l'admin doit confirmer manuellement depuis l'écran Matricules.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ studentName: z.string().min(1), className: z.string().optional() }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const profile = await ctx.prisma.studentProfile.findUnique({ where: { userId: student.id }, select: { id: true } });
        if (!profile) throw new Error(`${student.name} n'a pas de profil élève associé.`);
        const r = await deps.verifierMatricule.execute(ctx.schoolId, profile.id);
        return { resultLabel: `${student.name} — ${r.message}`, section: 'matricules', entity: 'studentProfile' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Section 4.7 (Présences) — chantier Copilot Unifié ═══
    // Note de périmètre : la Discipline (sanctions) reste EXCLUE — même raison que l'APEE
    // en Section 4.5, aucun écran Admin (`SectionDiscipline.tsx` n'existe que côté Staff).
    // Les Présences, elles, ont un vrai écran Admin (`SectionAdminAttendance.tsx`) et sont
    // donc légitimement dans ce périmètre.

    // 44. Justifier une absence — NON destructif (réversible)
    {
      name: 'justifier_absence',
      domain: 'absences',
      description: "Marque comme justifiée la dernière absence enregistrée d'un élève (ou celle d'une date précise si fournie).",
      destructive: false,
      requiredPermission: 'MANAGE_ATTENDANCE',
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().optional().describe('Précisez si plusieurs élèves portent ce nom'),
        date: z.string().optional().describe('Date de l\'absence au format YYYY-MM-DD — sinon la plus récente absence non justifiée est utilisée'),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const record = await ctx.prisma.attendance.findFirst({
          where: {
            schoolId: ctx.schoolId,
            studentId: student.id,
            status: 'ABSENT',
            ...(input.date ? { date: new Date(input.date) } : {}),
          },
          orderBy: { date: 'desc' },
          select: { id: true, date: true },
        });
        if (!record) throw new Error(`Aucune absence non justifiée trouvée pour ${student.name}${input.date ? ` le ${input.date}` : ''}.`);
        await ctx.prisma.attendance.update({ where: { id: record.id }, data: { status: 'ABSENT_JUSTIFIED' } });
        return {
          resultLabel: `Absence du ${record.date.toLocaleDateString('fr-FR')} justifiée pour ${student.name}`,
          undoData: { attendanceId: record.id },
          section: 'attendance',
          entity: 'attendance',
        };
      },
      async undo(_params, undoData, ctx) {
        await ctx.prisma.attendance.update({ where: { id: String(undoData.attendanceId) }, data: { status: 'ABSENT' } });
      },
    },

    // 45. Élèves avec absences non justifiées au-delà d'un seuil — LECTURE SEULE
    {
      name: 'eleves_absences_non_justifiees',
      domain: 'absences',
      description: "Liste les élèves ayant plus d'un certain nombre d'absences non justifiées depuis une date donnée (ce mois-ci par défaut).",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        className: z.string().optional(),
        seuil: z.number().int().positive().optional().describe('Nombre minimum d\'absences non justifiées à partir duquel un élève est listé — 3 par défaut'),
        depuis: z.string().optional().describe('Date de début au format YYYY-MM-DD — début du mois courant par défaut'),
      }),
      async execute(input, ctx) {
        const seuil = input.seuil ?? 3;
        const now = new Date();
        const depuis = input.depuis ? new Date(input.depuis) : new Date(now.getFullYear(), now.getMonth(), 1);
        let studentIds: string[] | undefined;
        let label = "l'établissement";
        if (input.className) {
          const classe = await resolveClass(ctx, input.className);
          const profiles = await ctx.prisma.studentProfile.findMany({ where: { classId: classe.id }, select: { userId: true } });
          studentIds = profiles.map((p) => p.userId);
          label = classe.name;
        }
        const absences = await ctx.prisma.attendance.findMany({
          where: {
            schoolId: ctx.schoolId,
            status: 'ABSENT',
            date: { gte: depuis },
            ...(studentIds ? { studentId: { in: studentIds } } : {}),
          },
          select: { studentId: true, student: { select: { firstName: true, lastName: true } } },
        });
        const parEleve = new Map<string, { nom: string; count: number }>();
        for (const a of absences) {
          const cur = parEleve.get(a.studentId) ?? { nom: `${a.student.firstName ?? ''} ${a.student.lastName ?? ''}`.trim(), count: 0 };
          cur.count++;
          parEleve.set(a.studentId, cur);
        }
        const eleves = [...parEleve.values()].filter((e) => e.count >= seuil).sort((a, b) => b.count - a.count);
        const resultLabel = eleves.length === 0
          ? `Aucun élève avec ${seuil} absences non justifiées ou plus, pour ${label} depuis le ${depuis.toLocaleDateString('fr-FR')}.`
          : `${eleves.length} élève(s) avec ${seuil} absences non justifiées ou plus, pour ${label} depuis le ${depuis.toLocaleDateString('fr-FR')} : ` +
            eleves.map((e) => `${e.nom} (${e.count})`).join(', ');
        return { resultLabel, section: 'attendance', entity: 'attendance' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Section 4.8 (Statistiques & Rapports) — chantier Copilot Unifié ═══
    // Domaine presque exclusivement en LECTURE — peu d'actions destructives selon le plan.

    // 46. Évolution de la moyenne générale sur l'année courante — LECTURE SEULE
    {
      name: 'evolution_moyenne_generale',
      domain: 'notes_bulletins',
      description: "Affiche l'évolution de la moyenne générale sur les séquences déjà passées de l'année scolaire courante, pour toute l'école ou une classe précise.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().optional() }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        let classId: string | undefined;
        let label = "l'établissement";
        if (input.className) {
          const classe = await resolveClass(ctx, input.className);
          classId = classe.id;
          label = classe.name;
        }
        const grades = await ctx.prisma.grade.findMany({
          where: {
            schoolId: ctx.schoolId,
            academicYearId: year.id,
            validationStatus: { in: ['VALIDATED', 'LOCKED'] },
            sequenceAverage: { not: null },
            ...(classId ? { classId } : {}),
          },
          select: {
            sequenceAverage: true,
            sequence: { select: { id: true, name: true, orderIndex: true } },
          },
        });
        const parSequence = new Map<string, { name: string; orderIndex: number; valeurs: number[] }>();
        for (const g of grades) {
          const cur = parSequence.get(g.sequence.id) ?? { name: g.sequence.name, orderIndex: g.sequence.orderIndex, valeurs: [] };
          cur.valeurs.push(g.sequenceAverage as number);
          parSequence.set(g.sequence.id, cur);
        }
        const sequences = [...parSequence.values()].sort((a, b) => a.orderIndex - b.orderIndex);
        if (sequences.length === 0) {
          return { resultLabel: `Aucune note validée pour ${label} sur l'année ${year.name}.`, section: 'statistics', entity: 'grade' };
        }
        const resultLabel = `Évolution de la moyenne générale pour ${label} (${year.name}) : ` +
          sequences.map((s) => `${s.name} : ${Math.round((s.valeurs.reduce((a, b) => a + b, 0) / s.valeurs.length) * 100) / 100}/20`).join(', ');
        return { resultLabel, section: 'statistics', entity: 'grade' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 47. Classement des classes par moyenne générale — LECTURE SEULE
    {
      name: 'classement_classes',
      domain: 'notes_bulletins',
      description: "Classe les classes de l'établissement par moyenne générale (notes validées, année scolaire courante), du meilleur au moins bon résultat.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ level: z.string().optional().describe('Limiter au niveau, ex. "4e"') }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const classes = await ctx.prisma.class.findMany({
          where: { schoolId: ctx.schoolId, ...(input.level ? { level: input.level } : {}) },
          select: { id: true, name: true },
        });
        if (classes.length === 0) throw new Error(input.level ? `Aucune classe de niveau « ${input.level} ».` : 'Aucune classe dans cet établissement.');
        const grades = await ctx.prisma.grade.findMany({
          where: {
            schoolId: ctx.schoolId,
            academicYearId: year.id,
            classId: { in: classes.map((c) => c.id) },
            validationStatus: { in: ['VALIDATED', 'LOCKED'] },
            sequenceAverage: { not: null },
          },
          select: { classId: true, sequenceAverage: true },
        });
        const parClasse = new Map<string, number[]>();
        for (const g of grades) {
          const cur = parClasse.get(g.classId) ?? [];
          cur.push(g.sequenceAverage as number);
          parClasse.set(g.classId, cur);
        }
        const classement = classes
          .map((c) => {
            const valeurs = parClasse.get(c.id) ?? [];
            const moyenne = valeurs.length > 0 ? Math.round((valeurs.reduce((a, b) => a + b, 0) / valeurs.length) * 100) / 100 : null;
            return { name: c.name, moyenne };
          })
          .filter((c) => c.moyenne !== null)
          .sort((a, b) => (b.moyenne as number) - (a.moyenne as number));
        if (classement.length === 0) {
          return { resultLabel: 'Aucune note validée disponible pour établir un classement.', section: 'statistics', entity: 'grade' };
        }
        const resultLabel = `Classement par moyenne générale : ` +
          classement.map((c, i) => `${i + 1}. ${c.name} (${c.moyenne}/20)`).join(', ');
        return { resultLabel, section: 'statistics', entity: 'grade' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Section 4.9 (Ressources Humaines) — chantier Copilot Unifié ═══
    // Périmètre volontairement resserré à ce que les use cases/logiques existants permettent
    // (Principe 7) : traiter une demande de congé et deux lectures explicitement citées par le
    // plan. Le reste du module RH (dossier employé, attestations/certificats PDF, ordres de
    // mission) reste hors périmètre — trop orienté génération de documents structurés pour une
    // commande en langage naturel, même logique que l'import Excel de notes.

    // 48. Traiter (approuver/rejeter) une demande de congé — NON annulable (déduit le solde si approuvée)
    {
      name: 'traiter_demande_conge',
      domain: 'enseignants_rh',
      description: "Approuve ou rejette la demande de congé la plus récente en attente d'un employé (enseignant ou staff). Déduit le solde de congé si approuvée.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        employeeName: z.string().min(1),
        decision: z.enum(['APPROVED', 'REJECTED']),
      }),
      async execute(input, ctx) {
        const employee = await resolveEmployee(ctx, input.employeeName);
        const demande = await ctx.prisma.leaveRequest.findFirst({
          where: { schoolId: ctx.schoolId, userId: employee.id, statut: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (!demande) throw new Error(`Aucune demande de congé en attente pour ${employee.name}.`);
        const r = await deps.traiterDemandeConge(ctx.schoolId, demande.id, input.decision, ctx.userId);
        const label = input.decision === 'APPROVED' ? 'approuvée' : 'rejetée';
        return { resultLabel: `Demande de congé de ${employee.name} ${label}`, section: 'rh', entity: 'leaveRequest' };
      },
      async undo() {
        throw new Error('Le traitement d\'une demande de congé ne peut pas être annulé depuis le copilot — utilisez l\'écran Ressources Humaines.');
      },
    },

    // 49. Enseignants sans diplôme renseigné — LECTURE SEULE
    {
      name: 'enseignants_sans_diplome',
      domain: 'enseignants_rh',
      description: "Liste les enseignants dont aucun diplôme n'est renseigné dans leur dossier RH.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const enseignants = await ctx.prisma.user.findMany({
          where: { schoolId: ctx.schoolId, role: 'TEACHER' },
          select: { firstName: true, lastName: true, employeeFile: { select: { diplomes: true } } },
        });
        const sansDiplome = enseignants.filter((e) => {
          const diplomes = e.employeeFile?.diplomes;
          return !Array.isArray(diplomes) || diplomes.length === 0;
        });
        const resultLabel = sansDiplome.length === 0
          ? 'Tous les enseignants ont au moins un diplôme renseigné.'
          : `${sansDiplome.length} enseignant(s) sans diplôme renseigné : ` +
            sansDiplome.map((e) => `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim()).join(', ');
        return { resultLabel, section: 'rh', entity: 'employeeFile' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 50. Professeur principal d'une classe — LECTURE SEULE
    {
      name: 'professeur_principal_classe',
      domain: 'classes',
      description: "Indique qui est le professeur principal d'une classe donnée.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const c = await ctx.prisma.class.findUnique({
          where: { id: classe.id },
          select: { professorPrincipal: { select: { firstName: true, lastName: true } } },
        });
        const resultLabel = c?.professorPrincipal
          ? `Le professeur principal de ${classe.name} est ${c.professorPrincipal.firstName ?? ''} ${c.professorPrincipal.lastName ?? ''}`.trim()
          : `${classe.name} n'a pas encore de professeur principal assigné.`;
        return { resultLabel, section: 'classes', entity: 'class' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Section 4.10 (Pédagogie) — chantier Copilot Unifié ═══
    // Périmètre resserré à une lecture à forte valeur (Principe 7) : les actions d'écriture
    // (créer/modifier programme, chapitre, cahier de texte) restent des formulaires structurés,
    // pas des commandes naturelles — même logique que Notes/Bulletins et Attendance.

    // 51. Alertes de retard sur les programmes — LECTURE SEULE
    {
      name: 'alertes_retard_programme',
      domain: 'enseignants_rh',
      description: "Liste les classes/matières en retard sur leur programme pédagogique par rapport à l'avancement attendu de l'année scolaire courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ seuil: z.number().int().positive().optional().describe('Seuil de retard en % à partir duquel une alerte est levée — 15% par défaut') }),
      async execute(input, ctx) {
        const alertes = await deps.alertesRetardProgramme(ctx.schoolId, undefined, input.seuil ?? 15);
        const resultLabel = alertes.length === 0
          ? "Aucune classe/matière en retard significatif sur son programme."
          : `${alertes.length} alerte(s) de retard programme : ` +
            alertes.map((a) => `${a.subjectName} en ${a.className} (${a.progressionPct}% fait, ${a.attenduPct}% attendu — retard ${a.retardPct}%, ${a.niveau})`).join(' ; ');
        return { resultLabel, section: 'pedagogie', entity: 'programme' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // ═══ Section 4.11 (Communications) — chantier Copilot Unifié ═══

    // 52. Diffuser un message SMS/email à un groupe ciblé — NON annulable (messages réels envoyés)
    {
      name: 'diffuser_message',
      domain: 'communication',
      description:
        "Envoie un message (SMS, email, ou les deux) à un groupe ciblé — par rôle, par classe, par niveau, " +
        "et/ou par statut de paiement. Au moins un critère de ciblage est obligatoire — aucune diffusion à " +
        "l'aveugle sur tout l'établissement sans filtre explicite.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        targetRole: z.enum(['STUDENT', 'PARENT', 'TEACHER', 'STAFF']).optional(),
        className: z.string().optional(),
        level: z.string().optional(),
        paymentStatus: z.enum(['OVERDUE', 'PENDING', 'PARTIAL', 'PAID']).optional(),
        channel: z.enum(['SMS', 'EMAIL', 'BOTH']),
        message: z.string().min(1),
      }),
      async execute(input, ctx) {
        if (!input.targetRole && !input.className && !input.level && !input.paymentStatus) {
          throw new Error("Précisez au moins un critère de ciblage (rôle, classe, niveau, ou statut de paiement) — un message ne peut pas être diffusé sans destinataires définis.");
        }
        let classId: string | undefined;
        if (input.className) {
          const classe = await resolveClass(ctx, input.className);
          classId = classe.id;
        }
        const r = await deps.diffuserMessage(
          ctx.schoolId,
          ctx.userId,
          { role: input.targetRole, classId, level: input.level, paymentStatus: input.paymentStatus },
          input.channel,
          input.message,
        );
        const resultLabel = r.total === 0
          ? 'Aucun destinataire trouvé pour ce ciblage.'
          : `Message diffusé (${input.channel}) : ${r.sent}/${r.total} envoyé(s) avec succès${r.failed > 0 ? `, ${r.failed} échec(s)` : ''}.`;
        return { resultLabel, section: 'communications', entity: 'broadcastLog' };
      },
      async undo() {
        throw new Error('Une diffusion de message ne peut pas être annulée depuis le copilot — les messages sont déjà partis.');
      },
    },

    // ═══ Section 4.12 (Détection élèves à risque) — chantier Early Warning System ═══
    // Lecture seule sur des données déjà calculées (job nocturne + détection de chute par
    // matière) — le copilot ne déclenche jamais de nouveau calcul ni de nouvel appel Groq ici.

    // 53. Lister les élèves à risque — LECTURE SEULE
    {
      name: 'lister_eleves_a_risque',
      domain: 'sante_risque',
      description:
        "Liste les élèves dont l'indice de santé scolaire est en zone critique ou d'avertissement, " +
        "sur tout l'établissement ou une classe précise si indiquée.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        className: z.string().optional().describe('Limiter à une classe précise — omettre pour tout l\'établissement'),
      }),
      async execute(input, ctx) {
        const classe = input.className ? await resolveClass(ctx, input.className) : null;
        const config = await (ctx.prisma as any).schoolConfig
          .findUnique({ where: { schoolId: ctx.schoolId }, select: { aiRiskThreshold: true, aiRiskThresholdCritical: true } })
          .catch(() => null);
        const warningThreshold = config?.aiRiskThreshold ?? 50;
        const criticalThreshold = config?.aiRiskThresholdCritical ?? 30;

        const eleves = await ctx.prisma.studentProfile.findMany({
          where: {
            user: { schoolId: ctx.schoolId },
            ...(classe ? { classId: classe.id } : {}),
            healthScore: { lte: warningThreshold },
          },
          select: {
            healthScore: true,
            user: { select: { firstName: true, lastName: true } },
            class: { select: { name: true } },
          },
          orderBy: { healthScore: 'asc' },
        });

        if (eleves.length === 0) {
          return {
            resultLabel: classe ? `Aucun élève à risque dans ${classe.name}.` : "Aucun élève à risque dans l'établissement actuellement.",
            section: 'ai',
            entity: 'studentProfile',
          };
        }
        const resultLabel = `${eleves.length} élève(s) à risque${classe ? ` dans ${classe.name}` : ''} : ` +
          eleves.map((e) => {
            const score = e.healthScore ?? 75;
            const niveau = score <= criticalThreshold ? 'CRITIQUE' : 'à surveiller';
            return `${e.user.firstName ?? ''} ${e.user.lastName ?? ''}`.trim() + ` (${e.class?.name ?? 'N/A'}, ${score}/100, ${niveau})`;
          }).join(', ');
        return { resultLabel, section: 'ai', entity: 'studentProfile' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 54. Résumé du risque d'un élève précis — LECTURE SEULE
    {
      name: 'resume_risque_eleve',
      domain: 'sante_risque',
      description:
        "Donne l'indice de santé scolaire d'un élève précis et le dernier conseil personnalisé " +
        "déjà généré par l'IA à son sujet, si disponible.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        studentName: z.string().min(1).describe("Nom complet de l'élève"),
        className: z.string().optional().describe('Précisez si plusieurs élèves portent ce nom'),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const profile = await ctx.prisma.studentProfile.findFirst({
          where: { userId: student.id },
          select: { healthScore: true },
        });
        const score = profile?.healthScore ?? 75;

        const conseil = await (ctx.prisma as any).studentRecommendation.findFirst({
          where: { studentId: student.id, recipientRole: 'TEACHER' },
          orderBy: { createdAt: 'desc' },
          select: { content: true, contextType: true, createdAt: true },
        });

        let resultLabel = `${student.name} (${student.className ?? 'N/A'}) : indice de santé scolaire ${score}/100.`;
        if (conseil) {
          resultLabel += ` Dernier conseil IA (${new Date(conseil.createdAt).toLocaleDateString('fr-FR')}) : ${conseil.content}`;
        } else {
          resultLabel += ' Aucun conseil IA généré pour le moment.';
        }
        return { resultLabel, section: 'ai', entity: 'studentProfile' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },
  ];
}
