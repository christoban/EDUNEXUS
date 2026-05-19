import { type Request, type Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";

const getSchoolId = (req: Request): string => (req as any).user?.schoolId as string;
const getUserId = (req: Request): string => (req as any).user?.userId as string;
const getRole = (req: Request): string => (req as any).user?.role as string;
const getPermissions = (req: Request): string[] => (req as any).user?.permissions ?? [];

const hasPermission = (req: Request, permission: string): boolean =>
  getRole(req) === "ADMIN" || getPermissions(req).includes(permission);

export const createCouncilSession = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const { classId, academicPeriodId } = req.body;

    if (!classId || !academicPeriodId) {
      return res.status(400).json({ message: "classId et academicPeriodId sont requis" });
    }

    if (!hasPermission(req, "VALIDATE_GRADES")) {
      return res.status(403).json({ message: "Permission VALIDATE_GRADES requise" });
    }

    const schoolClass = await prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, name: true },
    });
    if (!schoolClass) {
      return res.status(404).json({ message: "Classe introuvable" });
    }

    const unvalidated = await prisma.grade.count({
      where: {
        schoolId,
        classId,
        sequence: { academicPeriodId: academicPeriodId },
        validationStatus: { notIn: ["VALIDATED", "LOCKED"] },
      },
    });

    if (unvalidated > 0) {
      return res.status(409).json({
        message: `${unvalidated} note(s) non encore validée(s). Validez toutes les notes avant de tenir le Conseil de Classe.`,
        unvalidatedCount: unvalidated,
        blocked: true,
      });
    }

    const existing = await prisma.classCouncilSession.findFirst({
      where: { classId, academicPeriodId },
    });
    if (existing) {
      return res.status(409).json({
        message: "Une session de Conseil de Classe existe déjà pour cette classe et cette période",
        session: existing,
      });
    }

    const session = await prisma.classCouncilSession.create({
      data: {
        schoolId,
        classId,
        academicPeriodId,
        presidedById: userId,
        status: "OPEN",
      },
      include: {
        class: { select: { id: true, name: true } },
        academicPeriod: { select: { id: true, name: true } },
        presidedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logActivity({
      userId,
      schoolId,
      action: "Class council session created",
      details: `Classe ${schoolClass.name} — période ${academicPeriodId}`,
    });

    return res.status(201).json({ session });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

export const addDecision = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const sessionId = String(req.params.id);
    const { studentId, decision, observations } = req.body;

    if (!studentId || !decision) {
      return res.status(400).json({ message: "studentId et decision sont requis" });
    }

    const validDecisions = ["PASS", "REPEAT", "DELIBERATION"];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ message: `decision doit être : ${validDecisions.join(", ")}` });
    }

    if (!hasPermission(req, "VALIDATE_GRADES")) {
      return res.status(403).json({ message: "Permission VALIDATE_GRADES requise" });
    }

    const session = await prisma.classCouncilSession.findFirst({
      where: { id: sessionId, schoolId },
    });
    if (!session) {
      return res.status(404).json({ message: "Session introuvable" });
    }

    if (session.status === "LOCKED") {
      return res.status(409).json({ message: "Cette session est verrouillée. Aucune modification possible." });
    }

    const studentProfile = await prisma.studentProfile.findFirst({
      where: { userId: studentId, classId: session.classId },
    });
    if (!studentProfile) {
      return res.status(404).json({ message: "Cet élève n'appartient pas à cette classe" });
    }

    const councilDecision = await prisma.classCouncilDecision.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      create: { sessionId, studentId, decision: decision as any, observations: observations ?? null },
      update: { decision: decision as any, observations: observations ?? null },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return res.json({ decision: councilDecision });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

export const addDecisionsBulk = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const sessionId = String(req.params.id);
    const decisions: { studentId: string; decision: string; observations?: string }[] =
      Array.isArray(req.body.decisions) ? req.body.decisions : [];

    if (!decisions.length) {
      return res.status(400).json({ message: "decisions (tableau) est requis" });
    }

    if (!hasPermission(req, "VALIDATE_GRADES")) {
      return res.status(403).json({ message: "Permission VALIDATE_GRADES requise" });
    }

    const session = await prisma.classCouncilSession.findFirst({ where: { id: sessionId, schoolId } });
    if (!session) return res.status(404).json({ message: "Session introuvable" });
    if (session.status === "LOCKED") {
      return res.status(409).json({ message: "Session verrouillée" });
    }

    const results = await Promise.all(
      decisions.map((d) =>
        prisma.classCouncilDecision.upsert({
          where: { sessionId_studentId: { sessionId, studentId: d.studentId } },
          create: { sessionId, studentId: d.studentId, decision: d.decision as any, observations: d.observations ?? null },
          update: { decision: d.decision as any, observations: d.observations ?? null },
        })
      )
    );

    return res.json({ message: `${results.length} décision(s) enregistrée(s)`, count: results.length });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

export const getCouncilSession = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const sessionId = String(req.params.id);
    const role = getRole(req);
    const userId = getUserId(req);

    const session = await prisma.classCouncilSession.findFirst({
      where: { id: sessionId, schoolId },
      include: {
        class: { select: { id: true, name: true } },
        academicPeriod: { select: { id: true, name: true } },
        presidedBy: { select: { id: true, firstName: true, lastName: true } },
        decisions: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!session) return res.status(404).json({ message: "Session introuvable" });

    if (role === "STUDENT" || role === "student") {
      const myDecision = session.decisions.find((d) => d.studentId === userId);
      return res.json({ session: { ...session, decisions: myDecision ? [myDecision] : [] } });
    }

    if (role === "PARENT" || role === "parent") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId },
        include: { children: { include: { studentProfile: true } } },
      });
      const childIds = parentProfile?.children.map((c) => c.studentProfile?.userId).filter(Boolean) as string[] ?? [];
      return res.json({
        session: { ...session, decisions: session.decisions.filter((d) => childIds.includes(d.studentId)) },
      });
    }

    return res.json({ session });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

export const getCouncilSessions = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { classId, academicPeriodId } = req.query as Record<string, string>;

    const sessions = await prisma.classCouncilSession.findMany({
      where: {
        schoolId,
        ...(classId ? { classId } : {}),
        ...(academicPeriodId ? { academicPeriodId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        academicPeriod: { select: { id: true, name: true } },
        _count: { select: { decisions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ sessions, total: sessions.length });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

export const lockCouncilSession = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const sessionId = String(req.params.id);

    if (!hasPermission(req, "VALIDATE_GRADES")) {
      return res.status(403).json({ message: "Permission VALIDATE_GRADES requise" });
    }

    const session = await prisma.classCouncilSession.findFirst({
      where: { id: sessionId, schoolId },
      include: {
        class: { select: { id: true, name: true } },
        decisions: true,
      },
    });
    if (!session) return res.status(404).json({ message: "Session introuvable" });
    if (session.status === "LOCKED") {
      return res.status(409).json({ message: "Session déjà verrouillée" });
    }

    if (!session.decisions.length) {
      return res.status(400).json({ message: "Impossible de verrouiller une session sans décisions" });
    }

    const updated = await prisma.classCouncilSession.update({
      where: { id: sessionId },
      data: { status: "LOCKED", validatedAt: new Date() },
    });

    await logActivity({
      userId,
      schoolId,
      action: "Class council session locked",
      details: `Classe ${session.class?.name} — ${session.decisions.length} décision(s)`,
    });

    return res.json({ session: updated, message: "Session verrouillée" });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

export const generateCouncilReport = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const sessionId = String(req.params.id);

    if (!hasPermission(req, "VALIDATE_GRADES")) {
      return res.status(403).json({ message: "Permission VALIDATE_GRADES requise" });
    }

    const session = await prisma.classCouncilSession.findFirst({
      where: { id: sessionId, schoolId },
      include: {
        class: { select: { id: true, name: true, level: true } },
        academicPeriod: {
          select: { id: true, name: true, academicYear: { select: { name: true } } },
        },
        presidedBy: { select: { id: true, firstName: true, lastName: true } },
        decisions: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { student: { lastName: "asc" } },
        },
        school: { select: { name: true } },
      },
    });

    if (!session) return res.status(404).json({ message: "Session introuvable" });

    const grades = await prisma.grade.findMany({
      where: {
        schoolId,
        classId: session.classId,
        validationStatus: { in: ["VALIDATED", "LOCKED"] },
      },
      select: { studentId: true, sequenceAverage: true, coefficient: true },
    });

    const averageByStudent = new Map<string, number>();
    const gradesByStudent = new Map<string, typeof grades>();
    for (const g of grades) {
      const list = gradesByStudent.get(g.studentId) ?? [];
      list.push(g);
      gradesByStudent.set(g.studentId, list);
    }
    for (const [studentId, studentGrades] of gradesByStudent) {
      const weighted = studentGrades.reduce((sum, g) => sum + (g.sequenceAverage ?? 0) * (g.coefficient ?? 1), 0);
      const totalCoeff = studentGrades.reduce((sum, g) => sum + (g.coefficient ?? 1), 0);
      averageByStudent.set(studentId, totalCoeff > 0 ? weighted / totalCoeff : 0);
    }

    const totalStudents = session.decisions.length;
    const passCount = session.decisions.filter((d) => d.decision === "PASS").length;
    const repeatCount = session.decisions.filter((d) => d.decision === "REPEAT").length;
    const deliberationCount = session.decisions.filter((d) => d.decision === "DELIBERATION").length;
    const averages = Array.from(averageByStudent.values());
    const classAverage = averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : 0;
    const highestAverage = averages.length > 0 ? Math.max(...averages) : 0;
    const lowestAverage = averages.length > 0 ? Math.min(...averages) : 0;
    const successRate = totalStudents > 0 ? Math.round(((passCount + deliberationCount) / totalStudents) * 100) : 0;

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));

    const schoolName = (session as any).school?.name ?? "Établissement";
    const yearName = session.academicPeriod?.academicYear?.name ?? "—";
    const periodName = session.academicPeriod?.name ?? "—";
    const className = session.class?.name ?? "—";
    const presidedBy = session.presidedBy
      ? `${session.presidedBy.firstName} ${session.presidedBy.lastName}`
      : "—";

    doc.fontSize(16).font("Helvetica-Bold").text("RAPPORT DE CONSEIL DE CLASSE", { align: "center" });
    doc.fontSize(11).font("Helvetica").text(`${schoolName}  —  Année scolaire ${yearName}`, { align: "center" });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#334155").lineWidth(0.5).stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).font("Helvetica-Bold").text("INFORMATIONS GÉNÉRALES");
    doc.moveDown(0.2);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Classe : ${className}`);
    doc.text(`Période : ${periodName}`);
    doc.text(`Date du conseil : ${session.validatedAt ? new Date(session.validatedAt).toLocaleDateString("fr-FR") : new Date(session.createdAt).toLocaleDateString("fr-FR")}`);
    doc.text(`Présidé par : ${presidedBy}`);
    doc.text(`Statut : ${session.status}`);
    doc.moveDown(0.5);

    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#334155").lineWidth(0.5).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica-Bold").text("SITUATION PÉDAGOGIQUE");
    doc.moveDown(0.2);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Effectif total : ${totalStudents} élève(s)`);
    doc.text(`Admis (Passage) : ${passCount} élève(s)`);
    doc.text(`En délibération : ${deliberationCount} élève(s)`);
    doc.text(`Redoublants : ${repeatCount} élève(s)`);
    doc.text(`Taux de réussite : ${successRate}%`);
    doc.moveDown(0.3);
    doc.text(`Moyenne de classe : ${classAverage.toFixed(2)} / 20`);
    doc.text(`Plus haute moyenne : ${highestAverage.toFixed(2)} / 20`);
    doc.text(`Plus basse moyenne : ${lowestAverage.toFixed(2)} / 20`);
    doc.moveDown(0.5);

    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#334155").lineWidth(0.5).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica-Bold").text("DÉCISIONS PAR ÉLÈVE");
    doc.moveDown(0.3);

    const tableY = doc.y;
    doc.rect(40, tableY, 515, 16).fill("#1e293b");
    doc.fontSize(9).font("Helvetica-Bold").fillColor("white");
    doc.text("NOM ET PRÉNOM", 44, tableY + 4, { width: 200 });
    doc.text("MOYENNE", 244, tableY + 4, { width: 70, align: "center" });
    doc.text("DÉCISION", 314, tableY + 4, { width: 100, align: "center" });
    doc.text("OBSERVATIONS", 414, tableY + 4, { width: 141 });
    doc.fillColor("black");
    doc.y = tableY + 18;

    session.decisions.forEach((d, i) => {
      const rowY = doc.y;
      const avg = averageByStudent.get(d.studentId);
      const avgText = avg !== undefined ? avg.toFixed(2) : "—";
      const decisionColor = d.decision === "PASS" ? "#16a34a" : d.decision === "REPEAT" ? "#dc2626" : "#d97706";

      if (i % 2 === 0) doc.rect(40, rowY, 515, 15).fill("#f8fafc").stroke("#e2e8f0");
      else doc.rect(40, rowY, 515, 15).stroke("#e2e8f0");

      doc.fillColor("black").fontSize(9).font("Helvetica");
      doc.text(`${d.student.lastName} ${d.student.firstName}`, 44, rowY + 3, { width: 196, ellipsis: true });
      doc.text(avgText, 244, rowY + 3, { width: 70, align: "center" });
      doc.fillColor(decisionColor).font("Helvetica-Bold");
      doc.text(d.decision, 314, rowY + 3, { width: 100, align: "center" });
      doc.fillColor("black").font("Helvetica");
      doc.text(d.observations ?? "", 414, rowY + 3, { width: 137, ellipsis: true });
      doc.y = rowY + 16;
    });

    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#334155").lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica-Bold").text("SIGNATURES");
    doc.moveDown(0.5);

    const sigY = doc.y;
    const sigCols = [40, 210, 390];
    const sigLabels = ["Professeur Principal", "Censeur / VP", "Proviseur / Principal"];
    sigLabels.forEach((label, i) => {
      const x = sigCols[i] ?? 40;
      doc.fontSize(9).font("Helvetica").text(label, x, sigY, { width: 140, align: "center" });
      doc.moveTo(x, sigY + 35).lineTo(x + 140, sigY + 35).strokeColor("#94a3b8").lineWidth(0.5).stroke();
    });

    doc.end();
    const pdfBuffer = Buffer.concat(buffers);

    const filename = `conseil-classe-${className.replace(/\s+/g, "-")}-${periodName.replace(/\s+/g, "-")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};