import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { generateWithGemini } from "../services/gemini.ts";
import { logActivity } from "../utils/activitieslog.ts";

const getSchoolId = (req: Request): string => (req as any).user?.schoolId;
const getUserId = (req: Request): string => (req as any).user?.userId;
const getRole = (req: Request): string => (req as any).user?.role;

const getSchoolContext = async (schoolId: string) => {
  const [students, grades, attendance] = await Promise.all([
    prisma.studentProfile.count({ where: { user: { schoolId } } }),
    prisma.grade.findMany({
      where: { schoolId, validationStatus: { in: ["VALIDATED", "LOCKED"] } },
      select: { sequenceAverage: true },
      take: 100,
    }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: { schoolId, date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      _count: true,
    }),
  ]);

  const avgGrade = grades.length > 0
    ? (grades.reduce((s, g) => s + (g.sequenceAverage ?? 0), 0) / grades.length).toFixed(1)
    : "N/A";

  const presentCount = attendance.find((a) => a.status === "PRESENT")?._count ?? 0;
  const absentCount = attendance.find((a) => a.status === "ABSENT")?._count ?? 0;
  const total = presentCount + absentCount;
  const attendanceRate = total > 0 ? ((presentCount / total) * 100).toFixed(1) : "N/A";

  return { students, avgGrade, attendanceRate };
};

// @route   POST /api/ai/generate-insight
export const generateAIInsight = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const role = getRole(req);

    let prompt = "";
    let insight = "";

    if (role === "admin" || role === "ADMIN") {
      const ctx = await getSchoolContext(schoolId);
      prompt = `Tu es conseiller pédagogique pour un établissement scolaire camerounais.
Données actuelles :
- Nombre d'élèves : ${ctx.students}
- Moyenne générale : ${ctx.avgGrade}/20
- Taux de présence (7 derniers jours) : ${ctx.attendanceRate}%

Génère un insight pédagogique concis (2-3 phrases maximum) avec une recommandation actionnable.`;
    } else if (role === "teacher" || role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId },
        include: { teacherSubjects: { include: { subject: true } } },
      });
      const subjects = teacherProfile?.teacherSubjects.map((ts) => ts.subject.name).join(", ") || "non spécifié";
      prompt = `Tu es conseiller pédagogique. Un enseignant de ${subjects} dans un lycée camerounais demande un conseil pédagogique pour améliorer les résultats de ses élèves. Donne 2-3 recommandations concrètes et adaptées au contexte camerounais.`;
    } else if (role === "student" || role === "STUDENT") {
      const grades = await prisma.grade.findMany({
        where: { schoolId, studentId: userId, validationStatus: { in: ["VALIDATED", "LOCKED"] } },
        include: { subject: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      const gradesSummary = grades.map((g) => `${g.subject.name}: ${g.sequenceAverage ?? 0}/20`).join(", ");
      prompt = `Tu es un tuteur bienveillant pour un lycéen camerounais. Ses dernières notes : ${gradesSummary || "pas encore de notes"}. Donne-lui un encouragement personnalisé et un conseil pratique pour progresser (2-3 phrases).`;
    } else {
      insight = "Les insights IA ne sont pas disponibles pour ce rôle.";
    }

    if (prompt) {
      insight = await generateWithGemini(prompt);
    }

    return res.json({ success: true, insight, timestamp: new Date() });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Erreur IA" });
  }
};

// @route   GET /api/ai/students-health
export const getStudentsHealthDashboard = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { classId } = req.query as { classId?: string };

    const students = await prisma.studentProfile.findMany({
      where: {
        user: { schoolId },
        ...(classId ? { classId } : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: { healthScore: "asc" },
    });

    const categorized = students.map((s) => {
      const score = s.healthScore ?? 75;
      let alertLevel: "critical" | "warning" | "recommendation" | "good" | "excellent";
      if (score <= 30) alertLevel = "critical";
      else if (score <= 50) alertLevel = "warning";
      else if (score <= 70) alertLevel = "recommendation";
      else if (score <= 85) alertLevel = "good";
      else alertLevel = "excellent";

      return {
        studentId: s.user.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        className: s.class?.name ?? "—",
        healthScore: score,
        alertLevel,
      };
    });

    return res.json({
      students: categorized,
      summary: {
        critical: categorized.filter((s) => s.alertLevel === "critical").length,
        warning: categorized.filter((s) => s.alertLevel === "warning").length,
        recommendation: categorized.filter((s) => s.alertLevel === "recommendation").length,
        good: categorized.filter((s) => s.alertLevel === "good").length,
        excellent: categorized.filter((s) => s.alertLevel === "excellent").length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// @route   POST /api/ai/bulletin-comment
export const generateBulletinComment = async (req: Request, res: Response) => {
  try {
    const { studentName, average, mention, subjectLines, className } = req.body;

    if (!studentName || average === undefined) {
      return res.status(400).json({ message: "studentName et average requis" });
    }

    const weakSubjects = (subjectLines || [])
      .filter((s: any) => (s.subjectAverage ?? 0) < 10)
      .map((s: any) => s.subjectName)
      .slice(0, 3);

    const strongSubjects = (subjectLines || [])
      .filter((s: any) => (s.subjectAverage ?? 0) >= 14)
      .map((s: any) => s.subjectName)
      .slice(0, 3);

    const prompt = `Tu es un professeur principal dans un lycée camerounais.
Génère un commentaire de bulletin scolaire bienveillant et professionnel pour :
- Élève : ${studentName}
- Classe : ${className || "non spécifiée"}
- Moyenne générale : ${average}/20
- Mention : ${mention || "non précisée"}
- Points forts : ${strongSubjects.length > 0 ? strongSubjects.join(", ") : "aucun identifié"}
- Points à améliorer : ${weakSubjects.length > 0 ? weakSubjects.join(", ") : "aucun identifié"}

Le commentaire doit être :
- En français
- Entre 2 et 4 phrases
- Encourageant mais honnête
- Adapté au contexte scolaire camerounais
- Sans mentionner les noms de matières de façon répétitive`;

    const comment = await generateWithGemini(prompt);
    return res.json({ comment });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erreur génération commentaire" });
  }
};

// @route   POST /api/ai/chat
export const aiChat = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const role = getRole(req);
    const { message, history } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: "Message requis" });
    }

    const responseStyleGuide = `
RÈGLES DE RÉPONSE:
- Réponds d'abord directement à la question.
- Si la question est simple, reste en 1 à 4 phrases.
- Si c'est une procédure, donne au maximum 3 à 5 étapes claires et concrètes.
- Si la question est ambiguë, pose une seule question de clarification au lieu d'inventer.
- Utilise un français naturel, simple et professionnel.
- N'utilise pas de Markdown, pas d'astérisques, pas de dièses, pas de listes décorées, pas de blocs de code.
- N'inclus pas de préambule du type "Voici" si la réponse peut aller droit au but.

EXEMPLES DE STYLE ATTENDU:
- Question: Comment ajoute-t-on une classe ?
  Réponse: Pour ajouter une classe dans EduNexus, ouvre le menu Classes, clique sur Ajouter une classe, renseigne le nom, le niveau et la série, puis enregistre.
- Question: Mon élève a des mauvaises notes, que faire ?
  Réponse: Commence par vérifier les matières faibles, puis prévois un temps de révision court mais régulier. Si besoin, je peux te proposer un plan simple.
- Question: Je ne comprends pas.
  Réponse: Peux-tu préciser ce que tu veux faire exactement : ajouter, modifier, supprimer ou consulter ?
`;

    const systemPrompts: Record<string, string> = {
      admin: `Tu es un assistant administratif expert pour les établissements scolaires camerounais. Tu aides avec la gestion académique, les règlements MINESEC, la finance scolaire et l'organisation. Réponds en français, de façon concise, claire et pratique. ${responseStyleGuide}`,
      ADMIN: `Tu es un assistant administratif expert pour les établissements scolaires camerounais. Tu aides avec la gestion académique, les règlements MINESEC, la finance scolaire et l'organisation. Réponds en français, de façon concise, claire et pratique. ${responseStyleGuide}`,
      teacher: `Tu es un assistant pédagogique pour enseignants de lycées camerounais. Tu aides avec les méthodes d'enseignement, la gestion de classe, la préparation de cours et l'évaluation des élèves. Réponds en français, de façon claire et naturelle. ${responseStyleGuide}`,
      TEACHER: `Tu es un assistant pédagogique pour enseignants de lycées camerounais. Tu aides avec les méthodes d'enseignement, la gestion de classe, la préparation de cours et l'évaluation des élèves. Réponds en français, de façon claire et naturelle. ${responseStyleGuide}`,
      student: `Tu es un tuteur bienveillant pour lycéens camerounais. Tu aides avec les révisions, les méthodes de travail et la motivation. Sois encourageant, simple et pratique. ${responseStyleGuide}`,
      STUDENT: `Tu es un tuteur bienveillant pour lycéens camerounais. Tu aides avec les révisions, les méthodes de travail et la motivation. Sois encourageant, simple et pratique. ${responseStyleGuide}`,
      parent: `Tu es un conseiller pour parents d'élèves de lycées camerounais. Tu aides à comprendre le système scolaire, les bulletins et comment soutenir les enfants. Réponds en français, avec un ton clair et rassurant. ${responseStyleGuide}`,
      PARENT: `Tu es un conseiller pour parents d'élèves de lycées camerounais. Tu aides à comprendre le système scolaire, les bulletins et comment soutenir les enfants. Réponds en français, avec un ton clair et rassurant. ${responseStyleGuide}`,
    };

    const systemPrompt = systemPrompts[role] || systemPrompts["admin"];

    const historyText = (history || [])
      .slice(-6)
      .map((h: { role: string; content: string }) =>
        `${h.role === "user" ? "Utilisateur" : "Assistant"}: ${h.content}`
      )
      .join("\n");

    const fullPrompt = historyText
      ? `Historique de la conversation:\n${historyText}\n\nUtilisateur: ${message}`
      : message;

    const response = await generateWithGemini(fullPrompt, systemPrompt);

    await logActivity({
      userId: getUserId(req),
      schoolId,
      action: "AI chat",
      details: `Role: ${role} - Message: ${String(message).slice(0, 50)}`,
    });

    return res.json({ response, timestamp: new Date() });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erreur chat IA" });
  }
};

// @route   GET /api/ai/risk-detection/:studentId
export const detectStudentRisk = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const studentId = String(req.params.studentId);

    const [grades, attendance, studentProfile] = await Promise.all([
      prisma.grade.findMany({
        where: { schoolId, studentId, validationStatus: { in: ["VALIDATED", "LOCKED"] } },
        include: { subject: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.attendance.findMany({
        where: { schoolId, studentId, date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { status: true },
      }),
      prisma.studentProfile.findFirst({
        where: { userId: studentId },
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    if (!studentProfile) {
      return res.status(404).json({ message: "Élève introuvable" });
    }

    const avgGrade = grades.length > 0
      ? grades.reduce((s, g) => s + (g.sequenceAverage ?? 0), 0) / grades.length
      : 0;

    const absentCount = attendance.filter((a) => a.status === "ABSENT").length;
    const attendanceRate = attendance.length > 0
      ? ((attendance.length - absentCount) / attendance.length) * 100
      : 100;

    const weakSubjects = grades
      .filter((g) => (g.sequenceAverage ?? 0) < 10)
      .map((g) => g.subject.name);

    let riskScore = 0;
    if (avgGrade < 10) riskScore += 40;
    else if (avgGrade < 12) riskScore += 20;
    if (attendanceRate < 70) riskScore += 35;
    else if (attendanceRate < 85) riskScore += 15;
    riskScore += Math.min(25, weakSubjects.length * 5);

    const prompt = `Élève : ${studentProfile.user.firstName} ${studentProfile.user.lastName}
Moyenne générale : ${avgGrade.toFixed(1)}/20
Taux de présence : ${attendanceRate.toFixed(1)}%
Matières en difficulté : ${weakSubjects.slice(0, 3).join(", ") || "aucune"}
Score de risque d'échec : ${riskScore}/100

Génère une analyse de risque en 3 parties :
1. Diagnostic (1 phrase)
2. Facteurs de risque identifiés (liste de 2-3 points)
3. Recommandations concrètes pour l'enseignant et les parents (2-3 actions)`;

    const analysis = await generateWithGemini(
      prompt,
      "Tu es un expert en psychologie scolaire et pédagogie pour lycées camerounais. Sois bienveillant mais honnête."
    );

    return res.json({
      studentName: `${studentProfile.user.firstName} ${studentProfile.user.lastName}`,
      riskScore,
      riskLevel: riskScore >= 60 ? "high" : riskScore >= 35 ? "medium" : "low",
      avgGrade: avgGrade.toFixed(1),
      attendanceRate: attendanceRate.toFixed(1),
      weakSubjects: weakSubjects.slice(0, 5),
      analysis,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erreur détection risque" });
  }
};
