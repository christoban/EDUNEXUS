import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { extraireDocument } from '@infrastructure/services/DocumentAiOrchestrator';
import { estRattacheALaClasse } from '@application/shared/verifierRattachementClasse';
import { journaliserActionIA } from '@infrastructure/services/AIActionAuditLogger';

// ─── Alertes de retard programme (extrait pour être réutilisable hors HTTP —
// ex. catalogue copilot) ────────────────────────────────────────────────────

export interface AlerteRetardProgramme {
  programmeId: string;
  programmeTitre: string;
  subjectName: string;
  className: string;
  classId: string;
  chapitresTotal: number;
  chapitresRealises: number;
  progressionPct: number;
  attenduPct: number;
  retardPct: number;
  niveau: 'CRITIQUE' | 'MODERE';
}

export async function calculerAlertesRetardProgramme(
  prisma: PrismaClient,
  schoolId: string,
  academicYearId?: string,
  seuilPct = 15,
): Promise<AlerteRetardProgramme[]> {
  const anneeId = academicYearId ?? (
    await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } })
  )?.id;
  if (!anneeId) return [];

  const annee = await prisma.academicYear.findUnique({
    where: { id: anneeId },
    select: { startDate: true, endDate: true },
  });

  const today = new Date();
  let attenduPct = 0;
  if (annee) {
    const totalJours = (annee.endDate.getTime() - annee.startDate.getTime()) / 86400000;
    const ecoulees = (today.getTime() - annee.startDate.getTime()) / 86400000;
    attenduPct = totalJours > 0 ? Math.min(100, Math.round((ecoulees / totalJours) * 100)) : 0;
  }

  const programmes = await prisma.programme.findMany({
    where: { schoolId, academicYearId: anneeId },
    include: {
      subject: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      chapitres: true,
    },
  });

  const alertes: AlerteRetardProgramme[] = [];

  for (const prog of programmes) {
    const chapitresTotal = prog.chapitres.length;
    if (chapitresTotal === 0) continue;

    const classIds: string[] = prog.classId ? [prog.classId] : (
      await prisma.class.findMany({
        where: { schoolId, level: prog.level ?? undefined },
        select: { id: true, name: true },
      })
    ).map((c: any) => c.id);

    for (const cid of classIds) {
      const entries = await prisma.cahierDeTexte.findMany({
        where: { schoolId, classId: cid, subjectId: prog.subjectId, academicYearId: anneeId },
        select: { chapitreId: true },
      });

      const chapitresAbordees = new Set(entries.map((e: any) => e.chapitreId).filter(Boolean));
      const chapitresRealises = prog.chapitres.filter((c: any) => chapitresAbordees.has(c.id)).length;
      const progressionPct = Math.round((chapitresRealises / chapitresTotal) * 100);
      const retardPct = attenduPct - progressionPct;

      if (retardPct > seuilPct) {
        const classe = prog.class ?? await prisma.class.findFirst({ where: { id: cid }, select: { id: true, name: true } });
        alertes.push({
          programmeId: prog.id,
          programmeTitre: prog.titre,
          subjectName: prog.subject.name,
          className: classe?.name ?? cid,
          classId: cid,
          chapitresTotal,
          chapitresRealises,
          progressionPct,
          attenduPct,
          retardPct,
          niveau: retardPct > 30 ? 'CRITIQUE' : 'MODERE',
        });
      }
    }
  }

  alertes.sort((a, b) => b.retardPct - a.retardPct);
  return alertes;
}

export class PedagogieController {
  constructor(private readonly prisma: PrismaClient) {}

  // ─── Programmes ────────────────────────────────────────────────────────────

  listProgrammes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { subjectId, classId, level, academicYearId } = req.query as Record<string, string>;

      const annee = academicYearId
        ? { id: academicYearId }
        : await this.prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isCurrent: true } });

      if (!annee) { res.json({ success: true, data: [] }); return; }

      const programmes = await this.prisma.programme.findMany({
        where: {
          schoolId: user.schoolId,
          academicYearId: annee.id,
          ...(subjectId ? { subjectId } : {}),
          ...(classId ? { classId } : {}),
          ...(level ? { level } : {}),
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true } },
          chapitres: { orderBy: { ordre: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({ success: true, data: programmes });
    } catch (e) { next(e); }
  };

  createProgramme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { titre, subjectId, classId, level, academicYearId } = req.body as {
        titre?: string; subjectId?: string; classId?: string; level?: string; academicYearId?: string;
      };

      if (!titre?.trim() || !subjectId) {
        res.status(400).json({ success: false, message: 'titre et subjectId sont requis' });
        return;
      }

      const anneeId = academicYearId ?? (
        await this.prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isCurrent: true }, select: { id: true } })
      )?.id;

      if (!anneeId) {
        res.status(400).json({ success: false, message: 'Aucune année académique active' });
        return;
      }

      const programme = await this.prisma.programme.create({
        data: {
          schoolId: user.schoolId,
          subjectId,
          classId: classId ?? null,
          level: level ?? null,
          academicYearId: anneeId,
          titre: titre.trim(),
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true } },
          chapitres: true,
        },
      });

      res.status(201).json({ success: true, data: programme });
    } catch (e) { next(e); }
  };

  updateProgramme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const id = String(req.params.id);
      const { titre, classId, level } = req.body as { titre?: string; classId?: string | null; level?: string | null };

      const existing = await this.prisma.programme.findFirst({ where: { id, schoolId: user.schoolId } });
      if (!existing) { res.status(404).json({ success: false, message: 'Programme introuvable' }); return; }

      const data: any = {};
      if (titre?.trim()) data.titre = titre.trim();
      if (classId !== undefined) data.classId = classId ?? null;
      if (level !== undefined) data.level = level ?? null;

      const updated = await this.prisma.programme.update({
        where: { id },
        data,
        include: {
          subject: { select: { id: true, name: true } },
          class: { select: { id: true, name: true } },
          chapitres: { orderBy: { ordre: 'asc' } },
        },
      });

      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  };

  deleteProgramme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const id = String(req.params.id);

      const existing = await this.prisma.programme.findFirst({ where: { id, schoolId: user.schoolId } });
      if (!existing) { res.status(404).json({ success: false, message: 'Programme introuvable' }); return; }

      await this.prisma.programme.delete({ where: { id } });
      res.json({ success: true, message: 'Programme supprimé' });
    } catch (e) { next(e); }
  };

  // ─── Chapitres ─────────────────────────────────────────────────────────────

  addChapitre = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const programmeId = String(req.params.programmeId);
      const { titre, ordre, volumeHeuresPrevu, sequenceCibleFin } = req.body as {
        titre?: string; ordre?: number; volumeHeuresPrevu?: number; sequenceCibleFin?: number;
      };

      if (!titre?.trim()) {
        res.status(400).json({ success: false, message: 'Le titre du chapitre est requis' });
        return;
      }

      const programme = await this.prisma.programme.findFirst({ where: { id: programmeId, schoolId: user.schoolId } });
      if (!programme) { res.status(404).json({ success: false, message: 'Programme introuvable' }); return; }

      const maxOrdre = await this.prisma.chapitre.aggregate({
        where: { programmeId },
        _max: { ordre: true },
      });
      const nextOrdre = (maxOrdre._max?.ordre ?? 0) + 1;

      const chapitre = await this.prisma.chapitre.create({
        data: {
          programmeId,
          titre: titre.trim(),
          ordre: ordre ?? nextOrdre,
          volumeHeuresPrevu: volumeHeuresPrevu ?? 2,
          sequenceCibleFin: sequenceCibleFin ?? null,
        },
      });

      res.status(201).json({ success: true, data: chapitre });
    } catch (e) { next(e); }
  };

  updateChapitre = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const id = String(req.params.id);
      const { titre, ordre, volumeHeuresPrevu, sequenceCibleFin } = req.body as {
        titre?: string; ordre?: number; volumeHeuresPrevu?: number; sequenceCibleFin?: number | null;
      };

      const chapitre = await this.prisma.chapitre.findUnique({
        where: { id },
        include: { programme: { select: { schoolId: true } } },
      });
      if (!chapitre || chapitre.programme.schoolId !== user.schoolId) {
        res.status(404).json({ success: false, message: 'Chapitre introuvable' }); return;
      }

      const data: any = {};
      if (titre?.trim()) data.titre = titre.trim();
      if (ordre !== undefined) data.ordre = ordre;
      if (volumeHeuresPrevu !== undefined) data.volumeHeuresPrevu = volumeHeuresPrevu;
      if (sequenceCibleFin !== undefined) data.sequenceCibleFin = sequenceCibleFin;

      const updated = await this.prisma.chapitre.update({ where: { id }, data });
      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  };

  deleteChapitre = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const id = String(req.params.id);

      const chapitre = await this.prisma.chapitre.findUnique({
        where: { id },
        include: { programme: { select: { schoolId: true } } },
      });
      if (!chapitre || chapitre.programme.schoolId !== user.schoolId) {
        res.status(404).json({ success: false, message: 'Chapitre introuvable' }); return;
      }

      await this.prisma.chapitre.delete({ where: { id } });
      res.json({ success: true, message: 'Chapitre supprimé' });
    } catch (e) { next(e); }
  };

  // ─── Cahier de texte ───────────────────────────────────────────────────────

  createCahierDeTexte = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, chapitreId, date, contenuRealise, contenuLibre, devoirsDonnes, academicYearId } = req.body as {
        classId?: string; subjectId?: string; chapitreId?: string; date?: string;
        contenuRealise?: string; contenuLibre?: string; devoirsDonnes?: string; academicYearId?: string;
      };

      if (!classId || !subjectId || (!contenuRealise?.trim() && !contenuLibre?.trim())) {
        res.status(400).json({ success: false, message: 'classId, subjectId et au moins un contenu (contenuRealise ou contenuLibre) sont requis' });
        return;
      }

      if (user.role === 'TEACHER') {
        const rattache = await estRattacheALaClasse(
          this.prisma, user.userId, classId, subjectId,
          { autoriserProfesseurPrincipal: false },
        );
        if (!rattache) {
          res.status(403).json({ success: false, message: "Vous n'êtes pas assigné à l'enseignement de cette matière pour cette classe" });
          return;
        }
      }

      const anneeId = academicYearId ?? (
        await this.prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isCurrent: true }, select: { id: true } })
      )?.id;

      if (!anneeId) {
        res.status(400).json({ success: false, message: 'Aucune année académique active' });
        return;
      }

      const entry = await this.prisma.cahierDeTexte.create({
        data: {
          schoolId: user.schoolId,
          teacherId: user.userId,
          classId,
          subjectId,
          academicYearId: anneeId,
          chapitreId: chapitreId ?? null,
          date: date ? new Date(date) : new Date(),
          contenuRealise: contenuRealise?.trim() ?? null,
          contenuLibre: contenuLibre?.trim() ?? null,
          devoirsDonnes: devoirsDonnes?.trim() ?? null,
        },
        include: {
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
          chapitre: { select: { id: true, titre: true, ordre: true } },
        },
      });

      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'ajouter_cahier_texte', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: entry });
    } catch (e) {
      const user = req.user;
      journaliserActionIA(this.prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'ajouter_cahier_texte', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: e instanceof Error ? e.message : undefined, parametersSummary: req.body,
      });
      next(e);
    }
  };

  listCahierDeTexte = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, teacherId, academicYearId, limit } = req.query as Record<string, string>;

      const anneeId = academicYearId ?? (
        await this.prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isCurrent: true }, select: { id: true } })
      )?.id;

      const entries = await this.prisma.cahierDeTexte.findMany({
        where: {
          schoolId: user.schoolId,
          ...(anneeId ? { academicYearId: anneeId } : {}),
          ...(classId ? { classId } : {}),
          ...(subjectId ? { subjectId } : {}),
          ...(teacherId ? { teacherId } : (user.role === 'TEACHER' ? { teacherId: user.userId } : {})),
        },
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
          chapitre: { select: { id: true, titre: true, ordre: true } },
        },
        orderBy: { date: 'desc' },
        take: limit ? parseInt(limit, 10) : 100,
      });

      res.json({ success: true, data: entries });
    } catch (e) { next(e); }
  };

  // ─── Progression ───────────────────────────────────────────────────────────

  getProgression = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, academicYearId } = req.query as Record<string, string>;

      if (!classId || !subjectId) {
        res.status(400).json({ success: false, message: 'classId et subjectId sont requis' });
        return;
      }

      const anneeId = academicYearId ?? (
        await this.prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isCurrent: true }, select: { id: true } })
      )?.id;

      if (!anneeId) { res.json({ success: true, data: null }); return; }

      // Trouver le programme pour cette classe/matière/année
      const classe = await this.prisma.class.findFirst({ where: { id: classId, schoolId: user.schoolId }, select: { id: true, level: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const programme = await this.prisma.programme.findFirst({
        where: {
          schoolId: user.schoolId,
          subjectId,
          academicYearId: anneeId,
          OR: [{ classId }, { level: classe.level ?? undefined, classId: null }],
        },
        include: { chapitres: { orderBy: { ordre: 'asc' } } },
      });

      if (!programme) {
        res.json({ success: true, data: { programme: null, chapitresTotal: 0, chapitresRealises: 0, progressionPct: null, entries: [] } });
        return;
      }

      // Compter les chapitres traités dans le cahier de texte
      const entries = await this.prisma.cahierDeTexte.findMany({
        where: { schoolId: user.schoolId, classId, subjectId, academicYearId: anneeId },
        select: { chapitreId: true, date: true },
        orderBy: { date: 'asc' },
      });

      const chapitresAbordees = new Set(entries.map((e: any) => e.chapitreId).filter(Boolean));
      const chapitresTotal = programme.chapitres.length;
      const chapitresRealises = programme.chapitres.filter((c: any) => chapitresAbordees.has(c.id)).length;
      const totalHeuresPrevu = programme.chapitres.reduce((s: number, c: any) => s + c.volumeHeuresPrevu, 0);
      const heuresRealisees = programme.chapitres
        .filter((c: any) => chapitresAbordees.has(c.id))
        .reduce((s: number, c: any) => s + c.volumeHeuresPrevu, 0);
      const progressionPct = chapitresTotal > 0 ? Math.round((chapitresRealises / chapitresTotal) * 100) : null;

      // Calculer progression attendue à date (en fonction de la séquence courante)
      const today = new Date();
      const annee = await this.prisma.academicYear.findUnique({
        where: { id: anneeId },
        select: { startDate: true, endDate: true },
      });
      let attenduPct: number | null = null;
      if (annee) {
        const totalJours = (annee.endDate.getTime() - annee.startDate.getTime()) / 86400000;
        const ecoulees = (today.getTime() - annee.startDate.getTime()) / 86400000;
        attenduPct = totalJours > 0 ? Math.min(100, Math.round((ecoulees / totalJours) * 100)) : null;
      }

      res.json({
        success: true,
        data: {
          programme: { id: programme.id, titre: programme.titre },
          chapitresTotal,
          chapitresRealises,
          totalHeuresPrevu,
          heuresRealisees,
          progressionPct,
          attenduPct,
          retardPct: attenduPct !== null && progressionPct !== null ? attenduPct - progressionPct : null,
          chapitres: programme.chapitres.map((c: any) => ({
            ...c,
            realise: chapitresAbordees.has(c.id),
          })),
        },
      });
    } catch (e) { next(e); }
  };

  getAlertesRetard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { academicYearId, seuilPct } = req.query as Record<string, string>;
      const seuil = seuilPct ? parseInt(seuilPct, 10) : 15;
      const alertes = await calculerAlertesRetardProgramme(this.prisma, user.schoolId, academicYearId, seuil);
      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'alertes_retard_programme', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { academicYearId, seuilPct: seuil },
      });
      res.json({ success: true, data: alertes });
    } catch (e) {
      const user = req.user;
      journaliserActionIA(this.prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'alertes_retard_programme', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: e instanceof Error ? e.message : undefined, parametersSummary: req.query,
      });
      next(e);
    }
  };

  // ─── Vérification programme par matière ────────────────────────────────────

  getSubjectHasProgramme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const subjectId = String(req.params.subjectId);
      const { classId } = req.query as { classId?: string };

      const annee = await this.prisma.academicYear.findFirst({
        where: { schoolId: user.schoolId, isCurrent: true },
        select: { id: true },
      });
      const anneeId = annee?.id;

      let programme: any = null;

      if (classId) {
        const classe = await this.prisma.class.findFirst({
          where: { id: classId, schoolId: user.schoolId },
          select: { level: true },
        });
        programme = await this.prisma.programme.findFirst({
          where: {
            schoolId: user.schoolId,
            subjectId,
            ...(anneeId ? { academicYearId: anneeId } : {}),
            OR: [{ classId }, { level: classe?.level ?? undefined, classId: null }],
          },
          include: { chapitres: { orderBy: { ordre: 'asc' } } },
        });
      } else {
        programme = await this.prisma.programme.findFirst({
          where: { schoolId: user.schoolId, subjectId, ...(anneeId ? { academicYearId: anneeId } : {}) },
          include: { chapitres: { orderBy: { ordre: 'asc' } } },
        });
      }

      const hasProgramme = !!programme && Array.isArray(programme.chapitres) && programme.chapitres.length > 0;

      res.json({
        success: true,
        data: { hasProgramme, chapitres: programme?.chapitres ?? [] },
      });
    } catch (e) { next(e); }
  };

  // ─── Slot du jour (pré-remplissage formulaire enseignant) ─────────────────

  getTodaySlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon … 6=Sat
      const currentTime = new Date().toTimeString().slice(0, 5); // "HH:MM"

      const annee = await this.prisma.academicYear.findFirst({
        where: { schoolId: user.schoolId, isCurrent: true },
        select: { id: true },
      });

      const slots = await this.prisma.timetableSlot.findMany({
        where: {
          teacherId: user.userId,
          dayOfWeek,
          kind: 'CLASS',
          timetable: {
            schoolId: user.schoolId,
            ...(annee ? { academicYearId: annee.id } : {}),
          },
        },
        include: {
          subject: { select: { id: true, name: true } },
          timetable: {
            select: { classId: true, class: { select: { id: true, name: true } } },
          },
        },
        orderBy: { startTime: 'asc' },
      });

      if (!slots.length) { res.json({ success: true, data: null }); return; }

      // Slot le plus récent déjà passé, sinon le premier à venir
      const past = slots.filter(s => s.startTime <= currentTime);
      const slot: any = past.length > 0 ? past[past.length - 1] : slots[0];

      if (!slot?.subjectId || !slot?.timetable) { res.json({ success: true, data: null }); return; }

      res.json({
        success: true,
        data: {
          classId: slot.timetable.classId,
          className: slot.timetable.class?.name,
          subjectId: slot.subjectId,
          subjectName: slot.subject?.name,
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      });
    } catch (e) { next(e); }
  };

  // ─── Scan photo du cahier — orchestrateur OCR-d'abord (DocumentAiOrchestrator) ─────────────
  // Un cahier de textes est un document texte : PaddleOCR suffit dans la grande majorité des cas ;
  // le modèle vision Groq ne sert que si l'OCR échoue à lire correctement (écriture manuscrite
  // peu lisible, photo floue).

  scanCahier = async (req: Request, res: Response): Promise<void> => {
    const FALLBACK = {
      chapitreDetecte: null, contenuRealise: null, devoirsDonnes: null,
      confidence: 0, error: 'Analyse impossible, veuillez saisir manuellement',
    };
    try {
      const file = req.file as (Express.Multer.File | undefined);
      if (!file) { res.status(400).json({ success: false, message: 'Image manquante' }); return; }

      const base64 = file.buffer.toString('base64');
      const mimeType = file.mimetype || 'image/jpeg';
      const consignes = `Retourne UNIQUEMENT un JSON valide sans markdown avec ces champs :
{"chapitreDetecte":"titre du chapitre ou leçon visible, null si non détecté","contenuRealise":"résumé court de ce qui a été fait, null si non détecté","devoirsDonnes":"devoirs mentionnés, null si aucun","confidence":0.8}
Si le document n'est manifestement pas un cahier de textes scolaire, retourne confidence: 0 et null pour tous les autres champs.`;

      const resultat = await extraireDocument({
        imageBase64: base64,
        mimeType,
        maxTokens: 512,
        promptOcrTexte: (texte) => `Tu es un assistant qui extrait des informations d'un cahier de textes scolaire. Voici le texte extrait par OCR de la photo :

"""
${texte}
"""

${consignes}`,
        promptVision: `Tu es un assistant qui extrait des informations d'une photo de cahier de textes scolaire. Analyse l'image.

${consignes}`,
      });

      if (resultat.source === 'ECHEC' || !resultat.reponseTexte) { res.json({ success: true, data: FALLBACK }); return; }

      const cleanJson = resultat.reponseTexte.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      let parsed: any;
      try { parsed = JSON.parse(cleanJson); } catch { res.json({ success: true, data: FALLBACK }); return; }

      res.json({
        success: true,
        data: {
          chapitreDetecte: typeof parsed.chapitreDetecte === 'string' ? parsed.chapitreDetecte : null,
          contenuRealise:  typeof parsed.contenuRealise  === 'string' ? parsed.contenuRealise  : null,
          devoirsDonnes:   typeof parsed.devoirsDonnes   === 'string' ? parsed.devoirsDonnes   : null,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        },
      });
    } catch {
      res.json({ success: true, data: FALLBACK });
    }
  };

  getRapport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { teacherId, departmentId, classId, academicYearId } = req.query as Record<string, string>;

      const anneeId = academicYearId ?? (
        await this.prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isCurrent: true }, select: { id: true } })
      )?.id;

      // Résoudre les subjectIds si departmentId est fourni
      let subjectIds: string[] | undefined;
      if (departmentId) {
        const dept = await this.prisma.department.findFirst({
          where: { id: departmentId, schoolId: user.schoolId },
          include: { subjects: { select: { id: true } } },
        });
        subjectIds = dept?.subjects.map(s => s.id) ?? [];
      }

      const where: any = {
        schoolId: user.schoolId,
        ...(anneeId ? { academicYearId: anneeId } : {}),
        ...(teacherId ? { teacherId } : user.role === 'TEACHER' ? { teacherId: user.userId } : {}),
        ...(classId ? { classId } : {}),
        ...(subjectIds ? { subjectId: { in: subjectIds } } : {}),
      };

      const entries = await this.prisma.cahierDeTexte.findMany({
        where,
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
          chapitre: { select: { id: true, titre: true, ordre: true } },
        },
        orderBy: [{ teacherId: 'asc' }, { classId: 'asc' }, { date: 'desc' }],
      });

      // Grouper par enseignant → classe → matière
      const groupes: Record<string, any> = {};
      for (const e of entries) {
        const teacherKey = e.teacherId;
        if (!groupes[teacherKey]) {
          groupes[teacherKey] = {
            teacher: e.teacher,
            totalSeances: 0,
            classes: {} as Record<string, any>,
          };
        }
        groupes[teacherKey].totalSeances++;
        const classeKey = e.classId;
        if (!groupes[teacherKey].classes[classeKey]) {
          groupes[teacherKey].classes[classeKey] = {
            class: e.class,
            subjects: {} as Record<string, any>,
          };
        }
        const subjectKey = e.subjectId;
        if (!groupes[teacherKey].classes[classeKey].subjects[subjectKey]) {
          groupes[teacherKey].classes[classeKey].subjects[subjectKey] = {
            subject: e.subject,
            seances: 0,
            chapitresAbordees: new Set<string>(),
          };
        }
        groupes[teacherKey].classes[classeKey].subjects[subjectKey].seances++;
        if (e.chapitreId) groupes[teacherKey].classes[classeKey].subjects[subjectKey].chapitresAbordees.add(e.chapitreId);
      }

      const rapport = Object.values(groupes).map((g: any) => ({
        teacher: g.teacher,
        totalSeances: g.totalSeances,
        classes: Object.values(g.classes).map((c: any) => ({
          class: c.class,
          subjects: Object.values(c.subjects).map((s: any) => ({
            subject: s.subject,
            seances: s.seances,
            chapitresAbordees: s.chapitresAbordees.size,
          })),
        })),
      }));

      res.json({ success: true, data: rapport, total: entries.length });
    } catch (e) { next(e); }
  };
}
