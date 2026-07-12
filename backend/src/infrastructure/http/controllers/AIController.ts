import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { generateWithGroq } from '../../../services/groq';
import { resolveLanguage, instructionLangue, type Language } from '../../../utils/languageHelper';

export class AIController {
  constructor(private readonly prisma: PrismaClient) {}

  /** Résout la langue de l'école courante (via son sous-système) pour les prompts Groq. */
  private async langueEcole(schoolId: string): Promise<Language> {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { subsystem: true } });
    return resolveLanguage(school?.subsystem);
  }

  generateInsight = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const schoolId = user.schoolId;
      let prompt = '';
      let insight = '';

      if (user.role === 'ADMIN') {
        const [students, grades, attendance] = await Promise.all([
          this.prisma.studentProfile.count({ where: { user: { schoolId } } }),
          this.prisma.grade.findMany({ where: { schoolId, validationStatus: { in: ['VALIDATED', 'LOCKED'] } }, select: { sequenceAverage: true }, take: 100 }),
          this.prisma.attendance.groupBy({ by: ['status'], where: { schoolId, date: { gte: new Date(Date.now() - 7 * 86400000) } }, _count: true }),
        ]);
        const avgGrade = grades.length ? (grades.reduce((s, g) => s + (g.sequenceAverage ?? 0), 0) / grades.length).toFixed(1) : 'N/A';
        const present = attendance.find((a) => a.status === 'PRESENT')?._count ?? 0;
        const total = attendance.reduce((s, a) => s + a._count, 0);
        const attendanceRate = total ? ((present / total) * 100).toFixed(1) : 'N/A';
        prompt = `Tu es conseiller pédagogique pour un établissement scolaire camerounais.\nDonnées : ${students} élèves, moyenne ${avgGrade}/20, présence ${attendanceRate}% (7j).\nGénère un insight pédagogique concis (2-3 phrases) avec une recommandation actionnable.`;

      } else if (user.role === 'TEACHER') {
        const profile = await this.prisma.teacherProfile.findUnique({ where: { userId: user.userId }, include: { teacherSubjects: { include: { subject: true } } } });
        const subjects = profile?.teacherSubjects.map((ts) => ts.subject.name).join(', ') || 'non spécifié';
        prompt = `Tu es conseiller pédagogique. Un enseignant de ${subjects} dans un lycée camerounais demande un conseil pédagogique. Donne 2-3 recommandations concrètes adaptées au contexte camerounais.`;

      } else if (user.role === 'STUDENT') {
        const grades = await this.prisma.grade.findMany({ where: { schoolId, studentId: user.userId, validationStatus: { in: ['VALIDATED', 'LOCKED'] } }, include: { subject: true }, orderBy: { createdAt: 'desc' }, take: 5 });
        const summary = grades.map((g) => `${g.subject.name}: ${g.sequenceAverage ?? 0}/20`).join(', ');
        prompt = `Tu es un tuteur bienveillant pour un lycéen camerounais. Ses dernières notes : ${summary || 'pas encore de notes'}. Donne un encouragement et un conseil pratique (2-3 phrases).`;

      } else {
        insight = "Les insights IA ne sont pas disponibles pour ce rôle.";
      }

      if (prompt) {
        const lang = await this.langueEcole(schoolId);
        insight = await generateWithGroq(prompt, instructionLangue(lang));
      }
      res.json({ success: true, insight, timestamp: new Date() });
    } catch (error) {
      next(error);
    }
  };

  getStudentsHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;

      const students = await this.prisma.studentProfile.findMany({
        where: { user: { schoolId }, ...(classId ? { classId } : {}) },
        include: { user: { select: { id: true, firstName: true, lastName: true } }, class: { select: { id: true, name: true } } },
        orderBy: { healthScore: 'asc' },
      }) as any[];

      const categorized = students.map((s) => {
        const score = s.healthScore ?? 75;
        const alertLevel =
          score <= 30 ? 'critical' : score <= 50 ? 'warning' : score <= 70 ? 'recommendation' : score <= 85 ? 'good' : 'excellent';
        return { studentId: s.user.id, name: `${s.user.firstName} ${s.user.lastName}`, className: s.class?.name ?? '—', healthScore: score, alertLevel };
      });

      res.json({
        students: categorized,
        summary: {
          critical: categorized.filter((s) => s.alertLevel === 'critical').length,
          warning: categorized.filter((s) => s.alertLevel === 'warning').length,
          recommendation: categorized.filter((s) => s.alertLevel === 'recommendation').length,
          good: categorized.filter((s) => s.alertLevel === 'good').length,
          excellent: categorized.filter((s) => s.alertLevel === 'excellent').length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  generateBulletinComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { studentName, average, mention, subjectLines, className } = req.body;
      if (!studentName || average === undefined) {
        res.status(400).json({ message: 'studentName et average requis' });
        return;
      }
      const weakSubjects = (subjectLines || []).filter((s: any) => (s.subjectAverage ?? 0) < 10).map((s: any) => s.subjectName).slice(0, 3);
      const strongSubjects = (subjectLines || []).filter((s: any) => (s.subjectAverage ?? 0) >= 14).map((s: any) => s.subjectName).slice(0, 3);
      // Le commentaire doit être dans la langue DU BULLETIN. Si l'appelant (frontend) connaît la
      // langue du template, il peut la passer en `language` ; sinon on la déduit du sous-système.
      const bodyLang = req.body.language;
      const lang: Language = bodyLang === 'fr' || bodyLang === 'en' ? bodyLang : await this.langueEcole(req.user!.schoolId);
      const clauseLangue = lang === 'fr' ? 'En français' : 'In English';
      const prompt = `Tu es un professeur principal dans un lycée camerounais.\nGénère un commentaire de bulletin bienveillant pour :\n- Élève : ${studentName}, Classe : ${className || 'N/A'}\n- Moyenne : ${average}/20, Mention : ${mention || 'N/A'}\n- Points forts : ${strongSubjects.join(', ') || 'aucun'}\n- À améliorer : ${weakSubjects.join(', ') || 'aucun'}\n${clauseLangue}, 2-4 phrases, encourageant, adapté au contexte camerounais.`;
      const comment = await generateWithGroq(prompt, instructionLangue(lang));
      res.json({ comment });
    } catch (error) {
      next(error);
    }
  };

  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { message } = req.body;
      if (!message?.trim()) {
        res.status(400).json({ message: 'Message requis' });
        return;
      }
      const lang = await this.langueEcole(req.user!.schoolId);
      const systemPrompt = `Tu es l'assistant pédagogique d'ZekoulABia pour les établissements scolaires camerounais (système MINESEC). Réponds de façon concise et pratique. Pour les questions simples, 1 à 4 phrases. Pour les procédures, 3 à 5 étapes maximum. ${instructionLangue(lang)}`;
      const response = await generateWithGroq(message, systemPrompt);
      res.json({ success: true, response, timestamp: new Date() });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/assistant/chat — Assistant ZekoulABia contextualisé (dashboard admin)
  // Injecte la structure réelle de l'établissement dans le prompt pour des réponses pertinentes.
  assistantChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { message } = req.body as { message?: string };
      if (!message?.trim()) {
        res.status(400).json({ success: false, message: 'Message requis' });
        return;
      }

      const [school, classes, subjects, departments, periods] = await Promise.all([
        this.prisma.school.findUnique({
          where: { id: schoolId },
          select: { name: true, subsystem: true, educationType: true, templateCode: true },
        }),
        this.prisma.class.findMany({ where: { schoolId }, select: { name: true, level: true, serie: true }, orderBy: { name: 'asc' }, take: 60 }),
        this.prisma.subject.findMany({ where: { schoolId }, select: { name: true, coefficient: true }, orderBy: { name: 'asc' }, take: 80 }),
        this.prisma.department.findMany({ where: { schoolId }, select: { name: true } }),
        this.prisma.academicPeriod.findMany({ where: { academicYear: { schoolId, isCurrent: true } }, select: { name: true }, orderBy: { orderIndex: 'asc' } }),
      ]);

      const classList = classes.map((c) => c.name).join(', ') || 'aucune classe';
      const subjectList = subjects.map((s) => `${s.name} (coeff ${s.coefficient})`).join(', ') || 'aucune matière';
      const deptList = departments.map((d) => d.name).join(', ') || 'aucun département';
      const periodList = periods.map((p) => p.name).join(', ') || 'non configurées';

      const contexte =
        `Établissement : ${school?.name ?? 'N/A'} (sous-système ${school?.subsystem ?? 'N/A'}, type ${school?.educationType ?? 'N/A'}, template ${school?.templateCode ?? 'N/A'}).\n` +
        `Classes (${classes.length}) : ${classList}.\n` +
        `Matières (${subjects.length}) : ${subjectList}.\n` +
        `Départements : ${deptList}.\n` +
        `Périodes de l'année en cours : ${periodList}.`;

      const systemPrompt =
        `Tu es l'Assistant ZekoulABia, intégré au tableau de bord d'un administrateur scolaire camerounais (système MINESEC). ` +
        `Tu connais la configuration réelle de SON établissement (ci-dessous) et tu t'appuies dessus pour répondre de façon précise et contextualisée. ` +
        `Aide-le à utiliser la plateforme, à affiner sa configuration (ajouter une classe, une matière…), et à démarrer ses premières opérations. ` +
        `${instructionLangue(resolveLanguage(school?.subsystem))} Réponds de façon concise et pratique (1 à 5 phrases, ou 3 à 5 étapes pour une procédure). ` +
        `Ne fabrique jamais de données : si une information n'est pas dans le contexte, dis-le.\n\n` +
        `── Contexte de l'établissement ──\n${contexte}`;

      const response = await generateWithGroq(message, systemPrompt);
      res.json({ success: true, response, timestamp: new Date() });
    } catch (error) {
      next(error);
    }
  };

  detectRisk = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const studentId = req.params.studentId as string;
      const since30d = new Date(Date.now() - 30 * 86400000);

      const [grades, attendance, studentProfile] = await Promise.all([
        this.prisma.grade.findMany({ where: { schoolId, studentId, validationStatus: { in: ['VALIDATED', 'LOCKED'] } }, include: { subject: true }, orderBy: { createdAt: 'desc' }, take: 20 }) as Promise<any[]>,
        this.prisma.attendance.findMany({ where: { schoolId, studentId, date: { gte: since30d } }, select: { status: true } }),
        this.prisma.studentProfile.findFirst({ where: { userId: studentId, user: { schoolId } }, include: { user: { select: { firstName: true, lastName: true } } } }) as Promise<any>,
      ]);

      if (!studentProfile) { res.status(404).json({ message: 'Élève introuvable' }); return; }

      const avgGrade = grades.length ? grades.reduce((s, g) => s + (g.sequenceAverage ?? 0), 0) / grades.length : 0;
      const absentCount = attendance.filter((a) => a.status === 'ABSENT').length;
      const attendanceRate = attendance.length ? ((attendance.length - absentCount) / attendance.length) * 100 : 100;
      const weakSubjects = grades.filter((g) => (g.sequenceAverage ?? 0) < 10).map((g) => g.subject.name);

      let riskScore = 0;
      if (avgGrade < 10) riskScore += 40; else if (avgGrade < 12) riskScore += 20;
      if (attendanceRate < 70) riskScore += 35; else if (attendanceRate < 85) riskScore += 15;
      riskScore += Math.min(25, weakSubjects.length * 5);

      const prompt = `Élève : ${studentProfile.user.firstName} ${studentProfile.user.lastName}\nMoyenne : ${avgGrade.toFixed(1)}/20\nPrésence : ${attendanceRate.toFixed(1)}%\nMatières difficiles : ${weakSubjects.slice(0, 3).join(', ') || 'aucune'}\nScore risque : ${riskScore}/100\n\nAnalyse en 3 parties : 1. Diagnostic (1 phrase) 2. Facteurs de risque (2-3 points) 3. Recommandations concrètes (2-3 actions)`;
      const lang = await this.langueEcole(schoolId);
      const analysis = await generateWithGroq(prompt, `Tu es un expert en psychologie scolaire pour lycées camerounais. Sois bienveillant mais honnête. ${instructionLangue(lang)}`);

      res.json({
        studentName: `${studentProfile.user.firstName} ${studentProfile.user.lastName}`,
        riskScore,
        riskLevel: riskScore >= 60 ? 'high' : riskScore >= 35 ? 'medium' : 'low',
        avgGrade: avgGrade.toFixed(1),
        attendanceRate: attendanceRate.toFixed(1),
        weakSubjects: weakSubjects.slice(0, 5),
        analysis,
      });
    } catch (error) {
      next(error);
    }
  };
}
