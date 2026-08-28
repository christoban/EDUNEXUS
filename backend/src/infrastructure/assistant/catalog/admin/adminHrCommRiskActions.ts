import { z } from 'zod';
import {
  type ActionDefinition,
  resolveClass,
  resolveStudent,
} from '../catalogShared';
import { whereProfilesParClasse } from '@application/shared/studentEnrollment';
import { resolveEmployee } from './adminHelpers';
import type { AdminActionDeps } from '../adminActionCatalog';

export function buildAdminHrCommRiskActions(deps: AdminActionDeps): ActionDefinition[] {
  return [
    // 48. Traiter (approuver/rejeter) une demande de congé — NON annulable
    {
      name: 'traiter_demande_conge',
      domain: 'enseignants_rh',
      description:
        "Approuve ou rejette la demande de congé la plus récente en attente d'un employé (enseignant ou staff). Déduit le solde de congé si approuvée.",
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
        await deps.traiterDemandeConge(ctx.schoolId, demande.id, input.decision, ctx.userId);
        const label = input.decision === 'APPROVED' ? 'approuvée' : 'rejetée';
        return { resultLabel: `Demande de congé de ${employee.name} ${label}`, section: 'rh', entity: 'leaveRequest' };
      },
      async undo() {
        throw new Error(
          "Le traitement d'une demande de congé ne peut pas être annulé depuis le copilot — utilisez l'écran Ressources Humaines.",
        );
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
        const resultLabel =
          sansDiplome.length === 0
            ? 'Tous les enseignants ont au moins un diplôme renseigné.'
            : `${sansDiplome.length} enseignant(s) sans diplôme renseigné : ` +
              sansDiplome.map((e) => `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim()).join(', ');
        return { resultLabel, section: 'rh', entity: 'employeeFile' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    },

    // 51. Alertes de retard sur les programmes — LECTURE SEULE
    {
      name: 'alertes_retard_programme',
      domain: 'enseignants_rh',
      description:
        "Liste les classes/matières en retard sur leur programme pédagogique par rapport à l'avancement attendu de l'année scolaire courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        seuil: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Seuil de retard en % à partir duquel une alerte est levée — 15% par défaut"),
      }),
      async execute(input, ctx) {
        const alertes = await deps.alertesRetardProgramme(ctx.schoolId, undefined, input.seuil ?? 15);
        const resultLabel =
          alertes.length === 0
            ? 'Aucune classe/matière en retard significatif sur son programme.'
            : `${alertes.length} alerte(s) de retard programme : ` +
              alertes
                .map(
                  (a) =>
                    `${a.subjectName} en ${a.className} (${a.progressionPct}% fait, ${a.attenduPct}% attendu — retard ${a.retardPct}%, ${a.niveau})`,
                )
                .join(' ; ');
        return { resultLabel, section: 'pedagogie', entity: 'programme' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    },

    // 52. Diffuser un message SMS/email à un groupe ciblé — NON annulable
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
          throw new Error(
            'Précisez au moins un critère de ciblage (rôle, classe, niveau, ou statut de paiement) — un message ne peut pas être diffusé sans destinataires définis.',
          );
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
        const resultLabel =
          r.total === 0
            ? 'Aucun destinataire trouvé pour ce ciblage.'
            : `Message diffusé (${input.channel}) : ${r.sent}/${r.total} envoyé(s) avec succès${r.failed > 0 ? `, ${r.failed} échec(s)` : ''}.`;
        return { resultLabel, section: 'communications', entity: 'broadcastLog' };
      },
      async undo() {
        throw new Error(
          "Une diffusion de message ne peut pas être annulée depuis le copilot — les messages sont déjà partis.",
        );
      },
    },

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
        className: z.string().optional().describe("Limiter à une classe précise — omettre pour tout l'établissement"),
      }),
      async execute(input, ctx) {
        const classe = input.className ? await resolveClass(ctx, input.className) : null;
        const config = await ctx.prisma.schoolConfig
          .findUnique({ where: { schoolId: ctx.schoolId }, select: { aiRiskThreshold: true, aiRiskThresholdCritical: true } })
          .catch(() => null);
        const warningThreshold = config?.aiRiskThreshold ?? 50;
        const criticalThreshold = config?.aiRiskThresholdCritical ?? 30;

        const eleves = await ctx.prisma.studentProfile.findMany({
          where: {
            user: { schoolId: ctx.schoolId },
            ...(classe ? whereProfilesParClasse(classe.id) : {}),
            healthScore: { lte: warningThreshold },
          },
          select: {
            healthScore: true,
            user: { select: { firstName: true, lastName: true } },
            enrollmentsYearScoped: {
              where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
              select: { class: { select: { name: true } } },
              take: 1,
            },
          },
          orderBy: { healthScore: 'asc' },
        });

        if (eleves.length === 0) {
          return {
            resultLabel: classe
              ? `Aucun élève à risque dans ${classe.name}.`
              : "Aucun élève à risque dans l'établissement actuellement.",
            section: 'ai',
            entity: 'studentProfile',
          };
        }
        const resultLabel =
          `${eleves.length} élève(s) à risque${classe ? ` dans ${classe.name}` : ''} : ` +
          eleves
            .map((e) => {
              const score = e.healthScore ?? 75;
              const niveau = score <= criticalThreshold ? 'CRITIQUE' : 'à surveiller';
              const className = e.enrollmentsYearScoped[0]?.class?.name ?? 'N/A';
              return `${e.user.firstName ?? ''} ${e.user.lastName ?? ''}`.trim() + ` (${className}, ${score}/100, ${niveau})`;
            })
            .join(', ');
        return { resultLabel, section: 'ai', entity: 'studentProfile' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
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

        const conseil = await ctx.prisma.studentRecommendation.findFirst({
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
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    },
  ];
}
