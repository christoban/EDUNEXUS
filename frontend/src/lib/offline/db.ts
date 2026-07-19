import Dexie, { type Table } from 'dexie'

export interface PendingAction {
  id?: number
  type: 'ATTENDANCE' | 'GRADE' | 'CAHIER_DE_TEXTE_CREATE' | 'APPRECIATION_PP' | 'DISCIPLINE_SANCTION' | 'APEE_TRANSACTION' | 'LIBRARY_BOOK_CREATE'
  payload: unknown
  endpoint: string
  method: 'POST' | 'PATCH'
  createdAt: number
  status: 'PENDING' | 'SYNCING' | 'FAILED'
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
