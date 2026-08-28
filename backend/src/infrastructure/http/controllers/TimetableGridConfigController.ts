import type { Request, Response, NextFunction } from 'express';
import type { TimetableRepository, GridConfig } from '@domain/ports/repositories/TimetableRepository';

export interface PeriodeGrille {
  ordre: number
  debut: string
  fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'
  duree: number
}

export function calculerSqelette(cfg: {
  heureDebut: string
  dureePeriode: number
  periodesAvantP1: number
  dureePetitePause: number
  periodesAvantP2: number
  dureeGrandePause: number
  periodesApresP2: number
}): PeriodeGrille[] {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m ?? 0)
  }
  const toTime = (mins: number) => {
    const h = Math.floor(mins / 60) % 24
    const m = mins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const result: PeriodeGrille[] = []
  let cursor = toMinutes(cfg.heureDebut)
  let ordre = 1

  const ajouterCours = (n: number) => {
    for (let i = 0; i < n; i++) {
      const debut = toTime(cursor)
      cursor += cfg.dureePeriode
      result.push({ ordre: ordre++, debut, fin: toTime(cursor), type: 'COURS', duree: cfg.dureePeriode })
    }
  }

  ajouterCours(cfg.periodesAvantP1)

  if (cfg.dureePetitePause > 0 && cfg.periodesAvantP1 > 0) {
    const debut = toTime(cursor)
    cursor += cfg.dureePetitePause
    result.push({ ordre: 0, debut, fin: toTime(cursor), type: 'PETITE_PAUSE', duree: cfg.dureePetitePause })
  }

  ajouterCours(cfg.periodesAvantP2)

  if (cfg.dureeGrandePause > 0 && cfg.periodesAvantP2 > 0) {
    const debut = toTime(cursor)
    cursor += cfg.dureeGrandePause
    result.push({ ordre: 0, debut, fin: toTime(cursor), type: 'GRANDE_PAUSE', duree: cfg.dureeGrandePause })
  }

  ajouterCours(cfg.periodesApresP2)

  return result
}

export class TimetableGridConfigController {
  constructor(private readonly timetableRepository: TimetableRepository) {}

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId
      const config = await this.timetableRepository.getGridConfig(schoolId)
      if (!config) {
        res.json({ success: true, data: null })
        return
      }
      const squelette = calculerSqelette(config)
      res.json({ success: true, data: { config, squelette } })
    } catch (error) {
      next(error)
    }
  }

  save = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId
      const {
        heureDebut, dureePeriode, periodesAvantP1, dureePetitePause,
        periodesAvantP2, dureeGrandePause, periodesApresP2, joursActifs,
      } = req.body as {
        heureDebut: string; dureePeriode: number; periodesAvantP1: number
        dureePetitePause: number; periodesAvantP2: number; dureeGrandePause: number
        periodesApresP2: number; joursActifs: string[]
      }

      // Validation
      if (!heureDebut || !/^\d{2}:\d{2}$/.test(heureDebut)) {
        res.status(400).json({ success: false, message: 'heureDebut invalide (format HH:MM)' }); return
      }
      if (!Array.isArray(joursActifs) || joursActifs.length === 0) {
        res.status(400).json({ success: false, message: 'joursActifs requis' }); return
      }
      const totalPeriodes = (periodesAvantP1 ?? 0) + (periodesAvantP2 ?? 0) + (periodesApresP2 ?? 0)
      if (totalPeriodes < 1 || totalPeriodes > 12) {
        res.status(400).json({ success: false, message: 'Total de périodes doit être entre 1 et 12' }); return
      }

      const data: GridConfig = {
        heureDebut, dureePeriode, periodesAvantP1, dureePetitePause,
        periodesAvantP2, dureeGrandePause, periodesApresP2, joursActifs,
      }

      const config = await this.timetableRepository.saveGridConfig(schoolId, data)

      // Vérifier si des EDT existent (pour afficher l'avertissement côté frontend)
      const timetableCount = await this.timetableRepository.countTimetablesBySchool(schoolId)

      const squelette = calculerSqelette(config)
      res.json({ success: true, data: { config, squelette, timetableCount } })
    } catch (error) {
      next(error)
    }
  }
}
