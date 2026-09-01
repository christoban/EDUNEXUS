/**
 * APPLICATION LAYER — Catalogue d'actions de l'assistant IA (copilot), rôle PARENT.
 *
 * Même principe que les autres catalogues de rôle. Périmètre volontairement resserré
 * (Section 6.2 du plan : « informations sur son enfant, paiement — volet informatif
 * d'abord, actions limitées ») : essentiellement des QUERY sur les enfants du parent
 * connecté, et UNE SEULE action réelle (initier un paiement Mobile Money).
 *
 * Sécurité critique et spécifique à ce rôle : un parent ne doit JAMAIS pouvoir consulter
 * les données d'un enfant qui n'est pas le sien — `resolveMyChild` ci-dessous filtre
 * strictement par la relation `ParentStudent` du parent connecté, jamais par une
 * recherche libre sur tous les élèves de l'école (contrairement à `resolveStudent` du
 * catalogue Admin/Staff, qui cherche parmi TOUS les élèves — usage volontairement exclu
 * ici).
 */
import { z } from 'zod';
import type { InitierPaiementMobileMoneyUseCase } from '@application/finance/InitierPaiementMobileMoneyUseCase';
import { type ActionContext, type ActionDefinition, norm } from '@infrastructure/assistant/catalog/catalogShared';

export interface ParentActionDeps {
  initierPaiement: InitierPaiementMobileMoneyUseCase;
}

interface MonEnfant {
  studentUserId: string;
  studentProfileId: string;
  name: string;
  className: string | null;
}

/** Résout un enfant du parent connecté par son prénom/nom — jamais parmi tous les élèves de l'école. */
async function resolveMyChild(ctx: ActionContext, name: string): Promise<MonEnfant> {
  const enfants = await mesEnfants(ctx);
  const target = norm(name);
  let matches = enfants.filter((e) => norm(e.name) === target);
  if (matches.length === 0) matches = enfants.filter((e) => norm(e.name).includes(target));
  if (matches.length === 0) throw new Error(`Aucun de vos enfants ne s'appelle « ${name} ».`);
  if (matches.length > 1) throw new Error(`Plusieurs de vos enfants correspondent à « ${name} ». Précisez le nom complet.`);
  return matches[0];
}

async function mesEnfants(ctx: ActionContext): Promise<MonEnfant[]> {
  const parentProfile = await ctx.prisma.parentProfile.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
  if (!parentProfile) throw new Error('Profil parent introuvable.');
  const liens = await ctx.prisma.parentStudent.findMany({
    where: { parentProfileId: parentProfile.id },
    select: {
      studentProfile: {
        select: {
          id: true,
          userId: true,
          enrollmentsYearScoped: {
            where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
            select: { class: { select: { name: true } } },
            take: 1,
          },
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  return liens.map((l) => ({
    studentUserId: l.studentProfile.userId,
    studentProfileId: l.studentProfile.id,
    name: `${l.studentProfile.user.firstName ?? ''} ${l.studentProfile.user.lastName ?? ''}`.trim(),
    className: l.studentProfile.enrollmentsYearScoped[0]?.class?.name ?? null,
  }));
}

export function buildParentActionCatalog(deps: ParentActionDeps): ActionDefinition[] {
  return [
    // 1. Mes enfants — LECTURE SEULE
    {
      name: 'mes_enfants',
      description: 'Liste vos enfants inscrits dans cet établissement, avec leur classe.',
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['PARENT'],
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const enfants = await mesEnfants(ctx);
        const resultLabel = enfants.length === 0
          ? "Aucun enfant n'est actuellement rattaché à votre compte."
          : `Vos enfants : ${enfants.map((e) => `${e.name}${e.className ? ` (${e.className})` : ''}`).join(', ')}.`;
        return { resultLabel, section: 'children' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 2. Notes récentes d'un enfant — LECTURE SEULE
    {
      name: 'notes_mon_enfant',
      description: 'Donne les notes les plus récentes de votre enfant.',
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['PARENT'],
      inputSchema: z.object({ childName: z.string().min(1).describe('Prénom (et nom si besoin) de votre enfant') }),
      async execute(input, ctx) {
        const enfant = await resolveMyChild(ctx, input.childName);
        const grades = await ctx.prisma.grade.findMany({
          where: { schoolId: ctx.schoolId, studentId: enfant.studentUserId, sequenceAverage: { not: null } },
          orderBy: { id: 'desc' },
          take: 8,
          select: { sequenceAverage: true, subject: { select: { name: true } }, sequence: { select: { name: true } } },
        });
        const resultLabel = grades.length === 0
          ? `Aucune note disponible pour ${enfant.name} pour le moment.`
          : `Notes récentes de ${enfant.name} : ` + grades.map((g) => `${g.subject.name} (${g.sequence.name}) : ${g.sequenceAverage}/20`).join(', ');
        return { resultLabel, section: 'grades' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 3. Présence d'un enfant — LECTURE SEULE
    {
      name: 'presence_mon_enfant',
      description: "Donne le taux de présence de votre enfant depuis une date donnée (ce mois-ci par défaut).",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['PARENT'],
      inputSchema: z.object({
        childName: z.string().min(1),
        depuis: z.string().optional().describe('Date de début au format YYYY-MM-DD — début du mois courant par défaut'),
      }),
      async execute(input, ctx) {
        const enfant = await resolveMyChild(ctx, input.childName);
        const now = new Date();
        const depuis = input.depuis ? new Date(input.depuis) : new Date(now.getFullYear(), now.getMonth(), 1);
        const records = await ctx.prisma.attendance.findMany({
          where: { schoolId: ctx.schoolId, studentId: enfant.studentUserId, date: { gte: depuis } },
          select: { status: true },
        });
        if (records.length === 0) {
          return { resultLabel: `Aucun enregistrement de présence pour ${enfant.name} depuis le ${depuis.toLocaleDateString('fr-FR')}.`, section: 'attendance' };
        }
        const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
        const absences = records.filter((r) => r.status === 'ABSENT' || r.status === 'ABSENT_JUSTIFIED').length;
        const taux = Math.round((present / records.length) * 10000) / 100;
        return {
          resultLabel: `${enfant.name} : taux de présence de ${taux}% depuis le ${depuis.toLocaleDateString('fr-FR')} (${absences} absence(s) sur ${records.length} enregistrement(s)).`,
          section: 'attendance',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 4. Solde / factures impayées d'un enfant — LECTURE SEULE
    {
      name: 'solde_mon_enfant',
      description: "Donne les factures impayées ou partiellement payées de votre enfant et le montant restant dû.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['PARENT'],
      inputSchema: z.object({ childName: z.string().min(1) }),
      async execute(input, ctx) {
        const enfant = await resolveMyChild(ctx, input.childName);
        const factures = await ctx.prisma.invoice.findMany({
          where: { schoolId: ctx.schoolId, studentId: enfant.studentUserId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
          select: {
            id: true,
            amount: true,
            feePlan: { select: { name: true } },
            payments: { where: { status: 'SUCCESS' }, select: { amount: true } },
          },
        });
        if (factures.length === 0) {
          return { resultLabel: `${enfant.name} n'a aucune facture impayée actuellement.`, section: 'payments' };
        }
        const detail = factures.map((f) => {
          const paye = f.payments.reduce((s, p) => s + p.amount, 0);
          const reste = Math.max(0, f.amount - paye);
          return `${f.feePlan?.name ?? 'Facture'} : ${reste} FCFA restant`;
        });
        return { resultLabel: `Factures impayées de ${enfant.name} : ${detail.join(', ')}.`, section: 'payments' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    },

    // 5. Initier un paiement Mobile Money — NON annulable (transaction réelle déclenchée)
    {
      name: 'initier_paiement_enfant',
      description:
        "Déclenche une demande de paiement Mobile Money (MTN ou Orange) pour une facture impayée de votre enfant. " +
        "Le paiement doit ensuite être confirmé par vous sur votre téléphone — le copilot ne fait qu'initier la demande.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['PARENT'],
      inputSchema: z.object({
        childName: z.string().min(1),
        feePlanName: z.string().optional().describe('Nom du plan de frais concerné, à préciser si plusieurs factures impayées existent'),
        phoneNumber: z.string().min(9).describe('Numéro Mobile Money à débiter, au format 6XXXXXXXX'),
        method: z.enum(['MTN_MOMO', 'ORANGE_MONEY']),
      }),
      async execute(input, ctx) {
        const enfant = await resolveMyChild(ctx, input.childName);
        const factures = await ctx.prisma.invoice.findMany({
          where: { schoolId: ctx.schoolId, studentId: enfant.studentUserId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
          select: { id: true, amount: true, feePlan: { select: { name: true } } },
        });
        let candidats = factures;
        if (input.feePlanName) {
          const target = norm(input.feePlanName);
          candidats = factures.filter((f) => f.feePlan?.name && norm(f.feePlan.name).includes(target));
        }
        if (candidats.length === 0) throw new Error(`Aucune facture impayée trouvée pour ${enfant.name}${input.feePlanName ? ` (plan « ${input.feePlanName} »)` : ''}.`);
        if (candidats.length > 1) {
          throw new Error(`Plusieurs factures impayées existent pour ${enfant.name} : ${candidats.map((f) => f.feePlan?.name ?? 'facture').join(', ')}. Précisez le plan de frais.`);
        }
        const facture = candidats[0];
        const r = await deps.initierPaiement.execute({
          schoolId: ctx.schoolId,
          factureId: facture.id,
          studentId: enfant.studentUserId,
          phoneNumber: input.phoneNumber,
          method: input.method,
        });
        return {
          resultLabel: `Demande de paiement de ${facture.amount} FCFA envoyée sur ${input.phoneNumber} — confirmez sur votre téléphone pour finaliser (réf. ${r.campayRef}).`,
          section: 'payments',
          entity: 'payment',
        };
      },
      async undo() {
        throw new Error('Une demande de paiement déjà envoyée ne peut pas être annulée depuis le copilot.');
      },
    },
  ];
}
