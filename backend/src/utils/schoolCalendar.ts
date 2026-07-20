/**
 * Calendrier scolaire d'un établissement — pas de calendrier national à maintenir séparément :
 * les vacances se déduisent des intervalles ENTRE deux AcademicPeriod déjà définies pour
 * l'année scolaire courante (avant la première période, entre deux périodes, après la
 * dernière). Seules les exceptions locales (SchoolCalendarException) s'ajoutent à ce socle,
 * conformément au principe « l'établissement n'hérite jamais tout un calendrier depuis zéro,
 * il ne fait qu'ajouter ses écarts au national ».
 */
import type { PrismaClient } from '@prisma/client';

export async function estJourOuvreScolaire(
  prisma: PrismaClient,
  schoolId: string,
  date: Date,
): Promise<boolean> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { saturdaySchedule: true } });
  const jourSemaine = date.getDay(); // 0 = dimanche, 6 = samedi
  if (jourSemaine === 0) return false;
  if (jourSemaine === 6 && !(school?.saturdaySchedule ?? true)) return false;

  const exception = await prisma.schoolCalendarException.findFirst({
    where: { schoolId, date: { gte: new Date(date.toDateString()), lt: new Date(new Date(date.toDateString()).getTime() + 86400000) }, type: 'FERMETURE' },
    select: { id: true },
  });
  if (exception) return false;

  const periodes = await prisma.academicPeriod.findMany({
    where: { academicYear: { schoolId, isCurrent: true } },
    select: { startDate: true, endDate: true },
    orderBy: { orderIndex: 'asc' },
  });
  if (periodes.length === 0) return true; // pas de découpage configuré — on ne bloque rien par défaut

  return periodes.some((p) => date >= p.startDate && date <= p.endDate);
}

/**
 * Avance `date` du nombre de jours ouvrés scolaires demandé — utilisé pour les rappels
 * ("3 jours ouvrés avant la clôture") et pour la prolongation automatique d'une fenêtre
 * glissante (Type 3) qui chevauche des vacances.
 */
export async function ajouterJoursOuvresScolaires(
  prisma: PrismaClient,
  schoolId: string,
  date: Date,
  joursOuvres: number,
): Promise<Date> {
  const resultat = new Date(date);
  let restants = joursOuvres;
  let garde = 0;
  while (restants > 0 && garde < 400) {
    resultat.setDate(resultat.getDate() + 1);
    garde++;
    if (await estJourOuvreScolaire(prisma, schoolId, resultat)) restants--;
  }
  return resultat;
}

/**
 * Pour la prolongation Type 3 : compte combien de jours de fermeture scolaire sont compris
 * entre `debut` et `fin` (bornes incluses), pour prolonger d'autant la fenêtre.
 */
export async function compterJoursFermeture(
  prisma: PrismaClient,
  schoolId: string,
  debut: Date,
  fin: Date,
): Promise<number> {
  let compte = 0;
  const curseur = new Date(debut);
  while (curseur <= fin) {
    if (!(await estJourOuvreScolaire(prisma, schoolId, curseur))) compte++;
    curseur.setDate(curseur.getDate() + 1);
  }
  return compte;
}
