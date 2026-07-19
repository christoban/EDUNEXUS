import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateText, tool } from 'ai';
import { groqModel } from '../../../services/groq';
import {
  buildTools,
  filterCatalogForUser,
  type ActionContext,
  type ActionDefinition,
} from '@application/assistant/adminActionCatalog';
import { resolveLanguage, instructionLangue } from '../../../utils/languageHelper';

/** Fenêtre pendant laquelle une action non-destructive reste annulable (5 minutes). */
const UNDO_WINDOW_MS = 5 * 60 * 1000;

/** Contact support affiché lors d'une escalade — placeholder configurable, jamais en dur. */
const SUPPORT_CONTACT = process.env.ASSISTANT_SUPPORT_CONTACT || 'le support ZekoulABia (contact à configurer)';

const ESCALATE_TOOL_NAME = 'escalate_to_support';

/**
 * INFRASTRUCTURE — Assistant IA exécutant (copilot) pour le rôle ADMIN.
 *
 * POST /api/v2/assistant/execute        → comprend la demande, exécute (non-destructif)
 *                                          ou renvoie une demande de confirmation (destructif)
 * POST /api/v2/assistant/confirm-action → exécute (ou annule) une action destructive en attente
 * POST /api/v2/assistant/undo-action    → annule une action non-destructive récente
 *
 * La double-vérification RBAC est systématique : le catalogue exposé au modèle est
 * filtré selon le rôle réel, et l'autorisation est RE-vérifiée côté serveur avant
 * toute exécution — on ne fait jamais confiance au prompt.
 */
export class AssistantController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly catalog: ActionDefinition[],
  ) {}

  private get logRepo() {
    return (this.prisma as any).assistantActionLog;
  }

  private get helpArticleRepo() {
    return (this.prisma as any).helpArticle;
  }

  private get helpQueryLogRepo() {
    return (this.prisma as any).assistantHelpQueryLog;
  }

  private ctx(req: Request): ActionContext {
    const user = req.user!;
    return { schoolId: user.schoolId, userId: user.userId, role: user.role, prisma: this.prisma };
  }

  /**
   * Construit le contexte établissement + aide contextuelle injectés dans le prompt
   * système. `screenKey` identifie l'écran actif côté frontend (ex. "admin.grades") —
   * les fiches HelpArticle correspondantes sont injectées pour que l'assistant fonde
   * ses réponses dessus plutôt que d'inventer une explication sur le fonctionnement
   * de ZekoulABia.
   */
  private async buildSystemPrompt(
    schoolId: string,
    role: string,
    screenKey: string | null,
  ): Promise<{ system: string; helpArticles: { title: string; content: string; relatedSelectors: unknown }[] }> {
    const [school, classes, subjects, teachers, periods] = await Promise.all([
      this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, subsystem: true, educationType: true, templateCode: true },
      }),
      this.prisma.class.findMany({
        where: { schoolId },
        select: { name: true, _count: { select: { students: true } } },
        orderBy: { name: 'asc' },
        take: 80,
      }),
      this.prisma.subject.findMany({ where: { schoolId }, select: { name: true, coefficient: true }, orderBy: { name: 'asc' }, take: 100 }),
      this.prisma.user.findMany({ where: { schoolId, role: 'TEACHER' }, select: { firstName: true, lastName: true }, take: 100 }),
      this.prisma.academicPeriod.findMany({ where: { academicYear: { schoolId, isCurrent: true } }, select: { name: true }, orderBy: { orderIndex: 'asc' } }),
    ]);

    const classList = classes.map((c) => `${c.name} (${c._count.students} élèves)`).join(', ') || 'aucune classe';
    const subjectList = subjects.map((s) => `${s.name} (coeff ${s.coefficient})`).join(', ') || 'aucune matière';
    const teacherList = teachers.map((t) => `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim()).filter(Boolean).join(', ') || 'aucun enseignant';
    const periodList = periods.map((p) => p.name).join(', ') || 'non configurées';
    const langue = resolveLanguage(school?.subsystem);

    const helpArticles = screenKey
      ? await this.helpArticleRepo.findMany({
          where: { screenKey, locale: langue, role: { has: role.toUpperCase() } },
        })
      : [];

    const helpSection = helpArticles.length > 0
      ? `\n\n── Aide contextuelle pour l'écran actuel (${screenKey}) ──\n` +
        `Ces fiches décrivent le fonctionnement réel de cet écran. Fonde ta réponse dessus en priorité pour toute question sur « comment faire X ici » plutôt que d'inventer une explication.\n` +
        helpArticles.map((a: any) => `• ${a.title} : ${a.content}`).join('\n')
      : screenKey
        ? `\n\n── Aide contextuelle ──\nAucune fiche d'aide n'existe pour l'écran actuel (${screenKey}). Si la question porte sur le fonctionnement précis de ZekoulABia et que tu n'es pas certain de la réponse, utilise l'outil ${ESCALATE_TOOL_NAME} plutôt que d'inventer.`
        : '';

    const system =
      `Tu es l'Assistant ZekoulABia, un copilot intégré au tableau de bord d'un administrateur scolaire camerounais (système MINESEC). ` +
      `Tu peux EXÉCUTER des actions dans l'interface via les outils (tools) qui te sont fournis, ou simplement RÉPONDRE aux questions.\n\n` +
      `Règles :\n` +
      `- Si la demande correspond à une action disponible (créer/supprimer une classe ou une matière, assigner un enseignant, nommer un professeur principal), appelle le ou les tools appropriés. Pour une demande composée, appelle plusieurs tools dans l'ordre logique.\n` +
      `- Si c'est une simple question, réponds en texte à partir du contexte ci-dessous, sans appeler de tool.\n` +
      `- Utilise les NOMS exacts des classes, matières et enseignants tels qu'ils apparaissent dans le contexte.\n` +
      `- Ne fabrique jamais de données. Si une information manque, dis-le.\n` +
      `- ${instructionLangue(langue)} Sois concis.\n\n` +
      `── Contexte de l'établissement ──\n` +
      `Établissement : ${school?.name ?? 'N/A'} (${school?.subsystem ?? 'N/A'}, ${school?.educationType ?? 'N/A'}, template ${school?.templateCode ?? 'N/A'}).\n` +
      `Classes (${classes.length}) : ${classList}.\n` +
      `Matières (${subjects.length}) : ${subjectList}.\n` +
      `Enseignants (${teachers.length}) : ${teacherList}.\n` +
      `Périodes de l'année en cours : ${periodList}.` +
      helpSection;

    return { system, helpArticles };
  }

  // ── POST /api/v2/assistant/execute ──────────────────────────────────────────
  execute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const message = (req.body?.message as string | undefined)?.trim();
      const screenKey = (req.body?.screenKey as string | undefined)?.trim() || null;
      if (!message) {
        res.status(400).json({ success: false, message: 'Message requis' });
        return;
      }

      // Catalogue filtré selon les permissions réelles — jamais plus que le rôle n'autorise.
      const allowed = filterCatalogForUser(this.catalog, user);
      const tools = buildTools(allowed);
      const { system, helpArticles } = await this.buildSystemPrompt(user.schoolId, user.role, screenKey);
      const ctx = this.ctx(req);

      // Le tool d'escalade n'est proposé au modèle que si aucune fiche d'aide ne couvre
      // déjà l'écran actuel — on privilégie la réponse fondée quand elle existe.
      if (helpArticles.length === 0) {
        tools[ESCALATE_TOOL_NAME] = tool({
          description: "À utiliser UNIQUEMENT si la question porte sur le fonctionnement précis de ZekoulABia et que tu n'es pas certain de la réponse. N'invente jamais une explication sur le fonctionnement de l'application.",
          inputSchema: z.object({ reason: z.string().describe('Brève reformulation de la question à laquelle tu ne peux pas répondre avec certitude') }),
        });
      }

      const highlightSelectors = Array.from(
        new Set(helpArticles.flatMap((a) => (Array.isArray(a.relatedSelectors) ? (a.relatedSelectors as string[]) : []))),
      );

      const logQuery = (responseType: 'MESSAGE' | 'ACTION' | 'ESCALATE') => {
        this.helpQueryLogRepo
          .create({
            data: {
              schoolId: user.schoolId,
              userId: user.userId,
              role: user.role,
              screenKey,
              question: message,
              responseType,
              articleFound: helpArticles.length > 0,
            },
          })
          .catch((e: any) => console.error('[AssistantHelpQueryLog]', e?.message));
      };

      let result;
      try {
        result = await generateText({ model: groqModel, system, prompt: message, tools, toolChoice: 'auto' });
      } catch (e: any) {
        console.error('Assistant Groq error:', e?.message);
        res.json({ success: true, type: 'message', response: "Le service IA est momentanément indisponible. Réessayez dans un instant." });
        return;
      }

      const toolCalls = result.toolCalls ?? [];

      // Escalade explicite vers le support humain — pas d'exécution, pas d'invention.
      const escalateCall = toolCalls.find((tc) => tc.toolName === ESCALATE_TOOL_NAME);
      if (escalateCall) {
        logQuery('ESCALATE');
        res.json({
          success: true,
          type: 'escalate',
          response: "Je ne peux pas répondre avec certitude à cette question sur le fonctionnement de ZekoulABia.",
          supportContact: SUPPORT_CONTACT,
        });
        return;
      }

      if (toolCalls.length === 0) {
        logQuery('MESSAGE');
        res.json({
          success: true,
          type: 'message',
          response: result.text || 'Je n\'ai pas compris la demande.',
          highlightSelectors: highlightSelectors.length > 0 ? highlightSelectors : undefined,
        });
        return;
      }

      logQuery('ACTION');
      const executed: any[] = [];
      const pending: any[] = [];

      for (const tc of toolCalls) {
        // DOUBLE-VÉRIFICATION SERVEUR : l'action doit figurer dans le catalogue autorisé.
        const action = allowed.find((a) => a.name === tc.toolName);
        if (!action) {
          executed.push({ error: `Action « ${tc.toolName} » non autorisée pour votre rôle.`, actionType: tc.toolName });
          continue;
        }
        const input = tc.input as any;

        if (action.destructive) {
          let summary = 'Cette action est irréversible.';
          try {
            if (action.summarizeDestructive) summary = await action.summarizeDestructive(input, ctx);
          } catch (e: any) {
            executed.push({ error: e?.message ?? 'Impossible de préparer l\'action.', actionType: action.name });
            continue;
          }
          const log = await this.logRepo.create({
            data: {
              schoolId: user.schoolId,
              userId: user.userId,
              actionType: action.name,
              parameters: input,
              destructive: true,
              status: 'PENDING_CONFIRMATION',
              undoable: false,
            },
          });
          pending.push({ pendingActionId: log.id, actionType: action.name, summary });
        } else {
          try {
            const r = await action.execute(input, ctx);
            const undoData = { ...(r.undoData ?? {}), __section: r.section ?? null, __entity: r.entity ?? null };
            const log = await this.logRepo.create({
              data: {
                schoolId: user.schoolId,
                userId: user.userId,
                actionType: action.name,
                parameters: input,
                destructive: false,
                status: 'EXECUTED',
                undoable: true,
                undoData,
                resultLabel: r.resultLabel,
              },
            });
            executed.push({
              actionLogId: log.id,
              actionType: action.name,
              label: r.resultLabel,
              section: r.section ?? null,
              entity: r.entity ?? null,
              undoable: true,
            });
          } catch (e: any) {
            executed.push({ error: e?.message ?? 'Échec de l\'action.', actionType: action.name });
          }
        }
      }

      res.json({
        success: true,
        type: pending.length > 0 ? 'confirm' : 'executed',
        response: result.text || null,
        executed,
        pending,
      });
    } catch (error) {
      next(error);
    }
  };

  // ── POST /api/v2/assistant/confirm-action ───────────────────────────────────
  confirmAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { pendingActionId, confirmed } = req.body as { pendingActionId?: string; confirmed?: boolean };
      if (!pendingActionId) {
        res.status(400).json({ success: false, message: 'pendingActionId requis' });
        return;
      }

      const log = await this.logRepo.findUnique({ where: { id: pendingActionId } });
      if (!log || log.schoolId !== user.schoolId) {
        res.status(404).json({ success: false, message: 'Action introuvable' });
        return;
      }
      if (log.status !== 'PENDING_CONFIRMATION') {
        res.status(409).json({ success: false, message: 'Cette action n\'est plus en attente de confirmation.' });
        return;
      }

      if (!confirmed) {
        await this.logRepo.update({ where: { id: log.id }, data: { status: 'CANCELLED' } });
        res.json({ success: true, cancelled: true });
        return;
      }

      // Re-vérification RBAC au moment de la confirmation (on ne fait jamais confiance à l'appel client).
      const allowed = filterCatalogForUser(this.catalog, user);
      const action = allowed.find((a) => a.name === log.actionType);
      if (!action || !action.destructive) {
        res.status(403).json({ success: false, message: 'Action non autorisée.' });
        return;
      }

      try {
        const r = await action.execute(log.parameters, this.ctx(req));
        await this.logRepo.update({
          where: { id: log.id },
          data: { status: 'EXECUTED', resultLabel: r.resultLabel, executedAt: new Date() },
        });
        res.json({
          success: true,
          executed: { actionLogId: log.id, label: r.resultLabel, section: r.section ?? null, entity: r.entity ?? null },
        });
      } catch (e: any) {
        res.status(400).json({ success: false, message: e?.message ?? 'Échec de la suppression.' });
      }
    } catch (error) {
      next(error);
    }
  };

  // ── POST /api/v2/assistant/undo-action ──────────────────────────────────────
  undoAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { actionLogId } = req.body as { actionLogId?: string };
      if (!actionLogId) {
        res.status(400).json({ success: false, message: 'actionLogId requis' });
        return;
      }

      const log = await this.logRepo.findUnique({ where: { id: actionLogId } });
      if (!log || log.schoolId !== user.schoolId) {
        res.status(404).json({ success: false, message: 'Action introuvable' });
        return;
      }
      if (log.status !== 'EXECUTED' || !log.undoable || log.destructive) {
        res.status(409).json({ success: false, message: 'Cette action ne peut pas être annulée.' });
        return;
      }
      if (Date.now() - new Date(log.executedAt).getTime() > UNDO_WINDOW_MS) {
        res.status(409).json({ success: false, message: 'La fenêtre d\'annulation (5 minutes) est dépassée.' });
        return;
      }

      const allowed = filterCatalogForUser(this.catalog, user);
      const action = allowed.find((a) => a.name === log.actionType);
      if (!action) {
        res.status(403).json({ success: false, message: 'Action non autorisée.' });
        return;
      }

      const undoData = (log.undoData ?? {}) as any;
      try {
        await action.undo(log.parameters, undoData, this.ctx(req));
        await this.logRepo.update({ where: { id: log.id }, data: { status: 'UNDONE', undoneAt: new Date() } });
        res.json({ success: true, undone: true, section: undoData.__section ?? null, entity: undoData.__entity ?? null });
      } catch (e: any) {
        res.status(400).json({ success: false, message: e?.message ?? 'Échec de l\'annulation.' });
      }
    } catch (error) {
      next(error);
    }
  };
}
