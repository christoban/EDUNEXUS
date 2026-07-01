import Dexie, { type Table } from 'dexie'

export interface PendingAction {
  id?: number
  type: 'ATTENDANCE' | 'GRADE' | 'CAHIER_DE_TEXTE_CREATE'
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

class EduNexusDB extends Dexie {
  pendingActions!: Table<PendingAction>
  cachedData!: Table<CachedData>

  constructor() {
    super('EduNexusDB')
    this.version(1).stores({
      pendingActions: '++id, type, status, createdAt',
      cachedData: 'key, cachedAt',
    })
  }
}

export const db = new EduNexusDB()
