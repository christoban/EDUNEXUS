import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { calculerSqelette } from './TimetableGridConfigController';
import { generateWithGemini } from '../../../services/gemini';
import { resolveLanguage, instructionLangue } from '../../../utils/languageHelper';

// ─── Types internes ───────────────────────────────────────────────────────────

interface GridSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isMorning: boolean;
}

interface ItemToPlace {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  isScience: boolean;
  constraintScore: number;
}

interface UnplacedItem extends ItemToPlace {
  reason: string;
  explication?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

const SCIENCE_KEYWORDS = ['math', 'physique', 'chimie', 'sciences physiques', 'svt', 'sciences naturelles', 'informatique', 'mécanique'];

function isScienceSubject(name: string): boolean {
  const lower = name.toLowerCase();
  return SCIENCE_KEYWORDS.some(k => lower.includes(k));
}

function wouldCreate3Consecutive(
  classSubjectDaySlots: Map<string, Map<string, Map<number, number[]>>>,
  classId: string,
  subjectId: string,
  dayOfWeek: number,
  startTime: string,
  dureePeriode: number,
): boolean {
  const existingMins = classSubjectDaySlots.get(classId)?.get(subjectId)?.get(dayOfWeek) ?? [];
  if (existingMins.length < 2) return false;
  const newMin = timeToMinutes(startTime);
  const allMins = [...existingMins, newMin].sort((a, b) => a - b);
  for (let i = 0; i <= allMins.length - 3; i++) {
    const gap1 = allMins[i + 1]! - allMins[i]!;
    const gap2 = allMins[i + 2]! - allMins[i + 1]!;
    // Tolérance de 5 min pour tenir compte des arrondi
    if (Math.abs(gap1 - dureePeriode) < 6 && Math.abs(gap2 - dureePeriode) < 6) return true;
  }
  return false;
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  if (!map.has(key)) map.set(key, factory());
  return map.get(key)!;
}

const DAY_NAMES: Record<number, string> = { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' };

// ─── Contrôleur ───────────────────────────────────────────────────────────────

export class TimetableAutoController {
  constructor(private readonly prisma: PrismaClient) {}

  autoGenerate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = (req as any).user.schoolId as string;
      const { classIds } = req.body as { classIds?: string[] };

      // 1. Grille horaire
      const gridConfig = await this.prisma.timetableGridConfig.findUnique({ where: { schoolId } });
      if (!gridConfig) {
        res.status(422).json({ success: false, message: "Grille horaire non configurée. Allez dans Paramètres → Grille horaire." });
        return;
      }

      // 2. Année scolaire courante
      const annee = await this.prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
      if (!annee) {
        res.status(422).json({ success: false, message: "Aucune année scolaire courante configurée." });
        return;
      }

      // 3. Classes à traiter
      const classes = await this.prisma.class.findMany({
        where: { schoolId, ...(classIds?.length ? { id: { in: classIds } } : {}) },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      if (!classes.length) {
        res.status(404).json({ success: false, message: "Aucune classe trouvée." });
        return;
      }

      const classIdSet = new Set(classes.map(c => c.id));

      // 4. Affectations enseignants pour toutes les classes sélectionnées
      const assignments = await this.prisma.teachingAssignment.findMany({
        where: { schoolId, classId: { in: [...classIdSet] } },
        include: {
          subject: { select: { id: true, name: true, hoursPerWeek: true } },
          class: { select: { id: true, name: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!assignments.length) {
        res.status(422).json({ success: false, message: "Aucune affectation enseignant-matière-classe trouvée. Configurez d'abord les affectations dans la gestion des classes." });
        return;
      }

      // 5. Créneaux de la grille — ordre distribué (période d'abord, jour ensuite)
      const squelette = calculerSqelette(gridConfig);
      const periodesCours = squelette.filter(p => p.type === 'COURS');
      const DAY_MAP: Record<string, number> = { LUNDI: 1, MARDI: 2, MERCREDI: 3, JEUDI: 4, VENDREDI: 5, SAMEDI: 6 };
      const joursNumeriques = gridConfig.joursActifs.map(j => DAY_MAP[j]).filter(Boolean) as number[];

      // Calculer l'heure de la grande pause pour savoir si matin/après-midi
      let grandePauseMin = Infinity;
      {
        let cursor = timeToMinutes(gridConfig.heureDebut);
        cursor += gridConfig.periodesAvantP1 * gridConfig.dureePeriode;
        cursor += gridConfig.dureePetitePause;
        cursor += gridConfig.periodesAvantP2 * gridConfig.dureePeriode;
        grandePauseMin = cursor;
      }

      // Ordre : (période × jour) — distribue les matières sur tous les jours
      const allGridSlots: GridSlot[] = periodesCours.flatMap(p =>
        joursNumeriques.map(day => ({
          dayOfWeek: day,
          startTime: p.debut,
          endTime: p.fin,
          isMorning: timeToMinutes(p.debut) < grandePauseMin,
        }))
      );

      // Pour les matières scientifiques : matin en premier, ensuite après-midi
      const slotsScience = [
        ...allGridSlots.filter(s => s.isMorning),
        ...allGridSlots.filter(s => !s.isMorning),
      ];
      // Pour les autres : ordre naturel (distribué par période)
      const slotsDefault = allGridSlots;

      // 6. Score de contrainte par enseignant (plus de classes = plus contraint)
      const teacherClassCount = new Map<string, number>();
      for (const a of assignments) {
        teacherClassCount.set(a.teacherId, (teacherClassCount.get(a.teacherId) ?? 0) + 1);
      }

      // 7. Items à placer
      const items: ItemToPlace[] = [];
      for (const a of assignments) {
        const periodsNeeded = Math.max(1, Math.round(a.subject.hoursPerWeek * 60 / gridConfig.dureePeriode));
        const science = isScienceSubject(a.subject.name);
        const constraintScore = (teacherClassCount.get(a.teacherId) ?? 1) * 10 + a.subject.hoursPerWeek;
        for (let i = 0; i < periodsNeeded; i++) {
          items.push({
            classId: a.classId, className: a.class.name,
            subjectId: a.subject.id, subjectName: a.subject.name,
            teacherId: a.teacherId, teacherName: `${a.teacher.firstName} ${a.teacher.lastName}`,
            isScience: science, constraintScore,
          });
        }
      }

      // 8. Tri : plus contraints en premier
      items.sort((a, b) => b.constraintScore - a.constraintScore);

      // 9. Pré-charger l'occupation des enseignants dans les timetables déjà publiés
      // (pour les classes hors sélection ET les timetables PUBLISHED dans la sélection)
      const publishedSlots = await this.prisma.timetableSlot.findMany({
        where: {
          teacherId: { not: null },
          timetable: {
            is: {
              schoolId,
              status: 'PUBLISHED',
            },
          },
        },
        select: { teacherId: true, dayOfWeek: true, startTime: true },
      });

      const teacherOccupied = new Map<string, Set<string>>();
      const classOccupied = new Map<string, Set<string>>();
      const classSubjectDaySlots = new Map<string, Map<string, Map<number, number[]>>>();

      for (const s of publishedSlots) {
        if (!s.teacherId) continue;
        getOrCreate(teacherOccupied, s.teacherId, () => new Set()).add(`${s.dayOfWeek}-${s.startTime}`);
      }

      // 10. Algorithme greedy + contraintes
      const placed: (ItemToPlace & { slot: GridSlot })[] = [];
      const unplacedMap = new Map<string, UnplacedItem>(); // classId+subjectId → item

      for (const item of items) {
        const preferredSlots = item.isScience ? slotsScience : slotsDefault;
        let assigned = false;

        // Équilibrage : compter les slots de cet enseignant par jour pour préférer les jours moins chargés
        const teacherDayCount = new Map<number, number>();
        for (const key of teacherOccupied.get(item.teacherId) ?? []) {
          const day = parseInt(key.split('-')[0]!);
          teacherDayCount.set(day, (teacherDayCount.get(day) ?? 0) + 1);
        }
        // Trier les créneaux : même logique de préférence mais favorise les jours avec moins de charge
        const sortedSlots = [...preferredSlots].sort((a, b) => {
          const loadA = teacherDayCount.get(a.dayOfWeek) ?? 0;
          const loadB = teacherDayCount.get(b.dayOfWeek) ?? 0;
          if (loadA !== loadB) return loadA - loadB;
          // Matin avant après-midi pour sciences (déjà dans la liste mais re-tri sûr)
          if (item.isScience) return (a.isMorning ? 0 : 1) - (b.isMorning ? 0 : 1);
          return 0;
        });

        for (const slot of sortedSlots) {
          const key = `${slot.dayOfWeek}-${slot.startTime}`;
          if (teacherOccupied.get(item.teacherId)?.has(key)) continue;
          if (classOccupied.get(item.classId)?.has(key)) continue;
          if (wouldCreate3Consecutive(classSubjectDaySlots, item.classId, item.subjectId, slot.dayOfWeek, slot.startTime, gridConfig.dureePeriode)) continue;

          // Placer
          getOrCreate(teacherOccupied, item.teacherId, () => new Set()).add(key);
          getOrCreate(classOccupied, item.classId, () => new Set()).add(key);
          const subjectDayMap = getOrCreate(getOrCreate(classSubjectDaySlots, item.classId, () => new Map()), item.subjectId, () => new Map());
          const dayList = subjectDayMap.get(slot.dayOfWeek) ?? [];
          dayList.push(timeToMinutes(slot.startTime));
          subjectDayMap.set(slot.dayOfWeek, dayList);
          placed.push({ ...item, slot });
          assigned = true;
          break;
        }

        if (!assigned) {
          const key = `${item.classId}|${item.subjectId}`;
          if (!unplacedMap.has(key)) {
            const allSlotsPerWeek = allGridSlots.length;
            const teacherOccupiedCount = teacherOccupied.get(item.teacherId)?.size ?? 0;
            const reason = teacherOccupiedCount >= allSlotsPerWeek
              ? `${item.teacherName} enseigne dans trop de classes — aucun créneau disponible`
              : classOccupied.get(item.classId)?.size === allGridSlots.length / joursNumeriques.length
                ? `La classe ${item.className} n'a plus de créneaux libres`
                : `Conflit impossible à résoudre entre ${item.teacherName} et la grille de ${item.className}`;
            unplacedMap.set(key, { ...item, reason });
          }
        }
      }

      // 11. Sauvegarder en base — par classe
      const classMap = new Map<string, (ItemToPlace & { slot: GridSlot })[]>();
      for (const p of placed) {
        getOrCreate(classMap, p.classId, () => []).push(p);
      }

      const results: Array<{ classId: string; className: string; timetableId: string; slotsCreated: number; isNew: boolean }> = [];
      const skipped: Array<{ classId: string; className: string; reason: string }> = [];

      for (const cls of classes) {
        const classPlaced = classMap.get(cls.id) ?? [];
        if (!classPlaced.length) {
          skipped.push({ classId: cls.id, className: cls.name, reason: 'Aucune affectation ou aucun créneau placé' });
          continue;
        }

        const existingTimetable = await this.prisma.timetable.findFirst({
          where: { schoolId, classId: cls.id, academicYearId: annee.id },
        });

        if (existingTimetable?.status === 'PUBLISHED') {
          skipped.push({ classId: cls.id, className: cls.name, reason: 'Emploi du temps déjà publié — non modifié' });
          continue;
        }

        let timetableId: string;
        let isNew = false;

        if (existingTimetable) {
          // Supprimer les anciens créneaux CLASS (conserver éventuels BREAK manuels)
          await this.prisma.timetableSlot.deleteMany({
            where: { timetableId: existingTimetable.id, kind: 'CLASS' },
          });
          await this.prisma.timetable.update({
            where: { id: existingTimetable.id },
            data: { generatedByAI: true, status: 'DRAFT' },
          });
          timetableId = existingTimetable.id;
        } else {
          const timetable = await this.prisma.timetable.create({
            data: { schoolId, classId: cls.id, academicYearId: annee.id, status: 'DRAFT', generatedByAI: true },
          });
          timetableId = timetable.id;
          isNew = true;
        }

        await this.prisma.timetableSlot.createMany({
          data: classPlaced.map(p => ({
            timetableId,
            subjectId: p.subjectId,
            teacherId: p.teacherId,
            dayOfWeek: p.slot.dayOfWeek,
            startTime: p.slot.startTime,
            endTime: p.slot.endTime,
            kind: 'CLASS',
          })),
        });

        results.push({ classId: cls.id, className: cls.name, timetableId, slotsCreated: classPlaced.length, isNew });
      }

      // 12. Groq pour expliquer les cours non placés (en parallèle)
      const ecole = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { subsystem: true } });
      const langueEcole = resolveLanguage(ecole?.subsystem);
      const unplaced = [...unplacedMap.values()];
      await Promise.all(
        unplaced.map(async u => {
          try {
            const prompt = `Dans un lycée camerounais, la génération automatique de l'emploi du temps n'a pas pu placer tous les cours de "${u.subjectName}" pour la classe ${u.className} avec l'enseignant ${u.teacherName}. Raison technique : ${u.reason}. Explique en 2 phrases claires pour le responsable pédagogique et propose une solution concrète.`;
            u.explication = await generateWithGemini(prompt, `Tu es assistant pour la gestion des emplois du temps camerounais, sans Markdown. ${instructionLangue(langueEcole)}`);
          } catch {
            u.explication = u.reason;
          }
        })
      );

      res.json({
        success: true,
        data: {
          results,
          skipped,
          unplaced: unplaced.map(u => ({
            classId: u.classId, className: u.className,
            subjectId: u.subjectId, subjectName: u.subjectName,
            teacherName: u.teacherName, explication: u.explication ?? u.reason,
          })),
          stats: {
            classesTraitees: results.length,
            classesIgnorees: skipped.length,
            slotsTotal: placed.length,
            coursNonPlaces: unplaced.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  adjust = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = (req as any).user.schoolId as string;
      const timetableId = req.params['id'] as string;
      const { instruction } = req.body as { instruction?: string };

      if (!instruction?.trim()) {
        res.status(400).json({ success: false, message: 'instruction requise' });
        return;
      }

      const timetable = await this.prisma.timetable.findFirst({
        where: { id: timetableId, schoolId },
        include: {
          class: { select: { name: true } },
          slots: {
            where: { kind: 'CLASS', subjectId: { not: null } },
            include: {
              subject: { select: { id: true, name: true } },
              teacher: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          },
        },
      });

      if (!timetable) {
        res.status(404).json({ success: false, message: 'Emploi du temps introuvable.' });
        return;
      }
      if (timetable.status === 'PUBLISHED') {
        res.status(422).json({ success: false, message: 'Impossible de modifier un emploi du temps publié.' });
        return;
      }

      const slotsContext = timetable.slots
        .filter(s => s.subject && s.teacher)
        .map(s => `ID:${s.id} | ${DAY_NAMES[s.dayOfWeek] ?? s.dayOfWeek} ${s.startTime}-${s.endTime} | ${s.subject!.name} | ${s.teacher!.firstName} ${s.teacher!.lastName}`)
        .join('\n');

      const prompt = `Tu gères l'emploi du temps de la classe ${timetable.class.name}.\n\nCréneaux actuels :\n${slotsContext || '(aucun créneau)'}\n\nInstruction : "${instruction}"\n\nRetourne UNIQUEMENT un JSON array des modifications, format strict :\n[{"slotId":"...","newDayOfWeek":1,"newStartTime":"HH:MM","newEndTime":"HH:MM"}]\nSi impossible ou ambigu, retourne []. Ne retourne QUE le JSON.`;

      const response = await generateWithGemini(
        prompt,
        'Tu es assistant emploi du temps. Réponds uniquement en JSON valide, sans explication ni Markdown.',
      );

      let changes: Array<{ slotId: string; newDayOfWeek: number; newStartTime: string; newEndTime: string }> = [];
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) changes = JSON.parse(jsonMatch[0]) as typeof changes;
      } catch {
        res.status(422).json({ success: false, message: "L'IA n'a pas pu interpréter cette instruction. Reformulez-la." });
        return;
      }

      if (!changes.length) {
        res.json({ success: true, data: { applied: [], errors: [], message: 'Aucune modification applicable pour cette instruction.' } });
        return;
      }

      const applied: string[] = [];
      const errors: string[] = [];

      for (const change of changes) {
        const slot = timetable.slots.find(s => s.id === change.slotId);
        if (!slot) { errors.push(`Créneau ${change.slotId} introuvable`); continue; }

        if (slot.teacher) {
          const conflit = await this.prisma.timetableSlot.findFirst({
            where: {
              teacherId: slot.teacher.id,
              dayOfWeek: change.newDayOfWeek,
              startTime: change.newStartTime,
              id: { not: slot.id },
              timetable: { is: { schoolId } },
            },
          });
          if (conflit) {
            const conflitEdt = await this.prisma.timetable.findUnique({ where: { id: conflit.timetableId }, include: { class: { select: { name: true } } } });
            errors.push(`Conflit : ${slot.teacher.firstName} ${slot.teacher.lastName} est déjà en ${conflitEdt?.class.name ?? '?'} le ${DAY_NAMES[change.newDayOfWeek]} à ${change.newStartTime}`);
            continue;
          }
        }

        await this.prisma.timetableSlot.update({
          where: { id: slot.id },
          data: { dayOfWeek: change.newDayOfWeek, startTime: change.newStartTime, endTime: change.newEndTime },
        });
        applied.push(`${slot.subject?.name ?? '?'} → ${DAY_NAMES[change.newDayOfWeek]} ${change.newStartTime}`);
      }

      res.json({
        success: true,
        data: {
          applied,
          errors,
          message: applied.length
            ? `${applied.length} modification(s) appliquée(s).`
            : 'Aucune modification appliquée (conflits ou erreurs).',
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
