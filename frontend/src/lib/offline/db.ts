import Dexie, { type Table } from 'dexie'

export interface PendingAction {
  id?: number
  type: 'ATTENDANCE' | 'GRADE' | 'CAHIER_DE_TEXTE_CREATE' | 'APPRECIATION_PP' | 'DISCIPLINE_SANCTION' | 'DISCIPLINE_SANCTION_LIFT' | 'APEE_TRANSACTION' | 'LIBRARY_BOOK_CREATE' | 'LIBRARY_BOOK_UPDATE' | 'TEACHER_ASSIGNMENT' | 'TIMETABLE_GRID_CONFIG' | 'PEDAGOGY_PROGRAM' | 'ORIENTATION_RECORD'
  payload: unknown
  endpoint: string
  method: 'POST' | 'PATCH'
  createdAt: number
  status: 'PENDING' | 'SYNCING' | 'FAILED'
  /**
   * Clé d'idempotence générée côté client (UUID v4) — Plan offline-first V1 §4 (pattern
   * Outbox). Envoyée au serveur dans l'en-tête `Idempotency-Key` à la synchronisation ;
   * permet au serveur de détecter une action déjà traitée (synchronisation interrompue puis
   * retentée) sans la ré-exécuter une seconde fois. Générée une fois à la création de
   * l'entrée, jamais régénérée sur retry — c'est précisément ce qui rend le retry sûr.
   */
  idempotencyKey: string
}

export interface CachedData {
  key: string
  data: unknown
  cachedAt: number
}

class ZekoulABiaDB extends Dexie {
  pendingActions!: Table<PendingAction>
  cachedData!: Table<CachedData>

  constructor() {
    super('ZekoulABiaDB')
    this.version(1).stores({
      pendingActions: '++id, type, status, createdAt',
      cachedData: 'key, cachedAt',
    })
  }
}

export const db = new ZekoulABiaDB()
