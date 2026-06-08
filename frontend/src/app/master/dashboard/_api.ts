// URL relative → les appels passent par le proxy Next.js (next.config.ts rewrites)
// Fonctionne en local ET via ngrok sans aucune configuration supplémentaire
const API_BASE = ''

interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  pagination?: { page: number; limit: number; total: number; pages: number }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data: ApiResponse<T> = await res.json()
  if (!data.success) throw new Error(data.message || 'Erreur serveur')
  return data
}

export interface MasterUserDto {
  id: string
  email: string
  name: string
  role: string
}

export interface SchoolDto {
  id: string
  name: string
  subdomain: string
  type: string
  plan: string
  status: string
  city?: string | null
  region?: string | null
  email?: string | null
  phone?: string | null
  logoUrl?: string | null
  createdAt: string
  invites?: { id: string; email: string; status: string; expiresAt: string; createdAt: string }[]
  _count?: { users: number; classes: number; subjects?: number; feePlans?: number }
  schoolConfig?: Record<string, unknown> | null
  schoolSettings?: Record<string, unknown> | null
}

export interface AuditLogDto {
  id: string
  masterUserId?: string | null
  action: string
  targetId?: string | null
  description?: string | null
  ipAddress?: string | null
  createdAt: string
  masterUser?: { id: string; email: string; name: string } | null
}

export interface SchoolDetailDto extends SchoolDto {
  invites?: {
    id: string
    email: string
    schoolName: string
    token: string
    plan: string
    status: string
    expiresAt: string
    createdAt: string
  }[]
  schoolConfig?: Record<string, unknown> | null
  schoolSettings?: Record<string, unknown> | null
}

export async function fetchMe(): Promise<MasterUserDto> {
  const res = await apiFetch<MasterUserDto>('/api/v2/master/auth/me')
  if (!res.data) throw new Error('Données utilisateur introuvables')
  return res.data
}

export async function fetchSchools(params?: {
  status?: string
  search?: string
  page?: number
  limit?: number
}): Promise<{ data: SchoolDto[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.search) query.set('search', params.search)
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  const res = await apiFetch<SchoolDto[]>(`/api/v2/master/schools${qs ? `?${qs}` : ''}`)
  return { data: res.data ?? [], pagination: res.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 } }
}

export async function fetchSchoolDetail(id: string): Promise<SchoolDetailDto> {
  const res = await apiFetch<SchoolDetailDto>(`/api/v2/master/schools/${id}`)
  if (!res.data) throw new Error('École introuvable')
  return res.data
}

export async function inviteSchool(body: {
  email: string
  schoolName: string
  plan: string
  notes?: string
  sensitiveAuth: { password: string; code?: string }
}): Promise<void> {
  await apiFetch('/api/v2/master/schools/invite', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchMasterMfaStatus(): Promise<{ mfaEnabled: boolean }> {
  const res = await apiFetch<{ mfaEnabled: boolean }>('/api/v2/master/auth/mfa-status')
  return res.data ?? { mfaEnabled: false }
}

export async function suspendSchool(id: string, reason?: string): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || undefined }),
  })
}

export async function changePassword(body: {
  currentPassword: string
  mfaCode?: string
  newPassword: string
}): Promise<void> {
  await apiFetch('/api/v2/master/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      sensitiveAuth: { password: body.currentPassword, ...(body.mfaCode ? { code: body.mfaCode } : {}) },
      newPassword: body.newPassword,
    }),
  })
}

export async function reactivateSchool(id: string): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/reactivate`, { method: 'POST' })
}

export async function rejectSchool(id: string, motif: string): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ motif }),
  })
}

export async function approveSchool(id: string): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/approve`, { method: 'POST' })
}

export async function changeSchoolPlan(id: string, plan: string): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/plan`, {
    method: 'PATCH',
    body: JSON.stringify({ plan }),
  })
}

export async function reexamineSchool(id: string): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/reexamine`, { method: 'POST' })
}

export async function resendInvite(id: string): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/resend-invite`, { method: 'POST' })
}

export async function deleteSchool(id: string): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}`, { method: 'DELETE' })
}

export async function fetchLogs(params?: {
  action?: string
  page?: number
  limit?: number
}): Promise<{ data: AuditLogDto[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  const query = new URLSearchParams()
  if (params?.action) query.set('action', params.action)
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  const res = await apiFetch<AuditLogDto[]>(`/api/v2/master/auth/logs${qs ? `?${qs}` : ''}`)
  return { data: res.data ?? [], pagination: res.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 } }
}

export async function logout(): Promise<void> {
  await apiFetch('/api/v2/master/auth/logout', { method: 'POST' })
}
