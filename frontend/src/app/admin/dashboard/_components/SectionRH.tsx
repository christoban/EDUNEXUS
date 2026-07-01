'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface OnToast { (msg: string, type?: 'success' | 'error' | 'info' | 'warning'): void }

type EmployeeRole = 'TEACHER' | 'STAFF'
type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
type AttendanceStatut = 'PRESENT' | 'ABSENT' | 'RETARD'

interface EmployeeFile {
  dateNaissance?: string | null
  diplomes?: unknown[]
  numeroCNPS?: string | null
  typeContrat?: string | null
  dateEmbauche?: string | null
  echelonActuel?: string | null
}

interface EmployeeItem {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  role: EmployeeRole
  fullName: string
  teacherProfile?: { specialization?: string[]; supervisedSubjectIds?: string[] } | null
  staffProfile?: { title?: string | null; sectionId?: string | null } | null
  file?: EmployeeFile | null
}

interface EmployeeDetail {
  employee: EmployeeItem
  file: EmployeeFile | null
  careerEvents: Array<{ id: string; type: string; date: string; observation?: string | null }>
  leaveRequests: Array<{ id: string; type: string; dateDebut: string; dateFin: string; statut: LeaveStatus; motif?: string | null }>
  leaveBalance: { current: { soldeRestant: number; soldeInitial: number; annee: number } | null; balances: Array<{ annee: number; soldeRestant: number; soldeInitial: number }> }
}

interface LeaveRequestItem {
  id: string
  type: string
  dateDebut: string
  dateFin: string
  motif?: string | null
  statut: LeaveStatus
  user: { id: string; firstName: string; lastName: string; role: EmployeeRole }
  validator?: { id: string; firstName: string; lastName: string } | null
}

interface AttendanceItem {
  id: string
  userId: string
  statut: AttendanceStatut
  note?: string | null
  user: { id: string; firstName: string; lastName: string; role: EmployeeRole }
}

type Tab = 'personnel' | 'conges' | 'pointage' | 'documents'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 11,
  border: '1.5px solid #d9cdbd',
  background: '#fffdf9',
  color: '#1a1209',
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 600,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
  fontWeight: 800,
  color: '#a89478',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const chipStyle = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  background: bg,
  color,
  fontSize: 12,
  fontWeight: 800,
})

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'personnel', label: 'Personnel', icon: '👥' },
  { key: 'conges', label: 'Congés', icon: '🏖️' },
  { key: 'pointage', label: 'Pointage', icon: '✅' },
  { key: 'documents', label: 'Documents', icon: '📄' },
]

function fmtDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-CM', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function fmtDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-CM', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function SectionRH({ onToast }: { onToast: OnToast }) {
  const [tab, setTab] = useState<Tab>('personnel')
  const [employees, setEmployees] = useState<EmployeeItem[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<EmployeeDetail | null>(null)
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([])
  const [loadingLeaves, setLoadingLeaves] = useState(false)

  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [attendanceRows, setAttendanceRows] = useState<Record<string, { statut: AttendanceStatut; note: string }>>({})
  const [attendanceSaved, setAttendanceSaved] = useState(false)

  const [docEmployeeId, setDocEmployeeId] = useState('')
  const [docType, setDocType] = useState<'attestation' | 'certificat' | 'mission'>('attestation')
  const [docForm, setDocForm] = useState({ motif: '', lieu: '', dateDebut: '', dateFin: '', signataire: '' })

  const currentEmployee = useMemo(() => employees.find(e => e.id === selectedEmployeeId) ?? null, [employees, selectedEmployeeId])

  const loadEmployees = async () => {
    setLoadingEmployees(true)
    try {
      const r = await fetchApi('/api/v2/hr/employees', { credentials: 'include' })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? 'Erreur chargement personnel')
      setEmployees(d.data ?? [])
      if (!selectedEmployeeId && (d.data ?? []).length > 0) setSelectedEmployeeId((d.data ?? [])[0].id)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Erreur chargement personnel', 'error')
    } finally {
      setLoadingEmployees(false)
    }
  }

  const loadDetail = async (employeeId: string) => {
    setLoadingDetail(true)
    try {
      const r = await fetchApi(`/api/v2/hr/employees/${employeeId}`, { credentials: 'include' })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? 'Erreur chargement dossier')
      setSelectedDetail(d.data)
      setSelectedEmployeeId(employeeId)
      setDocEmployeeId(employeeId)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Erreur chargement dossier', 'error')
    } finally {
      setLoadingDetail(false)
    }
  }

  const loadLeaves = async () => {
    setLoadingLeaves(true)
    try {
      const r = await fetchApi('/api/v2/hr/leave-requests', { credentials: 'include' })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? 'Erreur congés')
      setLeaveRequests(d.data ?? [])
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Erreur congés', 'error')
    } finally {
      setLoadingLeaves(false)
    }
  }

  useEffect(() => {
    if (tab === 'personnel' && employees.length === 0 && !loadingEmployees) loadEmployees()
  }, [tab])

  useEffect(() => {
    if (selectedEmployeeId && !selectedDetail) loadDetail(selectedEmployeeId)
  }, [selectedEmployeeId])

  useEffect(() => {
    if (tab === 'conges' && leaveRequests.length === 0 && !loadingLeaves) loadLeaves()
  }, [tab])

  useEffect(() => {
    if (tab !== 'pointage' || employees.length > 0 || loadingEmployees) return
    loadEmployees()
  }, [tab])

  useEffect(() => {
    if (tab !== 'documents' && employees.length === 0 && !loadingEmployees) loadEmployees()
  }, [tab])

  useEffect(() => {
    if (!selectedEmployeeId && employees[0]) {
      setSelectedEmployeeId(employees[0].id)
      setDocEmployeeId(employees[0].id)
    }
  }, [employees, selectedEmployeeId])

  useEffect(() => {
    if (!employees.length) return
    setAttendanceRows(prev => {
      const next = { ...prev }
      for (const emp of employees) {
        if (!next[emp.id]) next[emp.id] = { statut: 'PRESENT', note: '' }
      }
      return next
    })
  }, [employees])

  const saveEmployeeFile = async (employeeId: string, payload: Record<string, unknown>) => {
    const r = await fetchApi(`/api/v2/hr/employees/${employeeId}/file`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await r.json()
    if (!d.success) throw new Error(d.message ?? 'Erreur dossier')
    onToast('Dossier sauvegardé', 'success')
    await loadDetail(employeeId)
    await loadEmployees()
  }

  const handleApproveLeave = async (leaveId: string, statut: Exclude<LeaveStatus, 'PENDING'>) => {
    try {
      const r = await fetchApi(`/api/v2/hr/leave-requests/${leaveId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? 'Erreur congé')
      onToast(statut === 'APPROVED' ? 'Congé approuvé' : 'Congé rejeté', 'success')
      loadLeaves()
      if (selectedEmployeeId) loadDetail(selectedEmployeeId)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Erreur congé', 'error')
    }
  }

  const saveAttendance = async () => {
    try {
      const attendances = employees.map(emp => ({
        userId: emp.id,
        statut: attendanceRows[emp.id]?.statut ?? 'PRESENT',
        note: attendanceRows[emp.id]?.note?.trim() || undefined,
      }))
      const r = await fetchApi('/api/v2/hr/attendance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: attendanceDate, attendances }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? 'Erreur pointage')
      setAttendanceSaved(true)
      onToast('Pointage enregistré', 'success')
      setTimeout(() => setAttendanceSaved(false), 1500)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Erreur pointage', 'error')
    }
  }

  const generateDoc = async () => {
    if (!docEmployeeId) {
      onToast('Sélectionnez un employé', 'error')
      return
    }

    try {
      let url = ''
      let method: 'GET' | 'POST' = 'GET'
      let body: string | undefined
      if (docType === 'attestation') {
        url = `/api/v2/hr/employees/${docEmployeeId}/attestation-travail`
      } else if (docType === 'certificat') {
        url = `/api/v2/hr/employees/${docEmployeeId}/certificat-travail`
      } else {
        url = '/api/v2/hr/mission-orders'
        method = 'POST'
        body = JSON.stringify({
          userId: docEmployeeId,
          motif: docForm.motif,
          lieu: docForm.lieu,
          dateDebut: docForm.dateDebut,
          dateFin: docForm.dateFin,
          signataire: docForm.signataire,
        })
      }

      const res = await fetchApi(url, {
        method,
        credentials: 'include',
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })

      if (docType === 'mission') {
        const d = await res.json()
        if (!d.success) throw new Error(d.message ?? 'Erreur ordre de mission')
        onToast('Ordre de mission créé', 'success')
        return
      }

      if (!res.ok) throw new Error('Erreur génération PDF')
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${docType}-${docEmployeeId}.pdf`
      link.click()
      URL.revokeObjectURL(link.href)
      onToast('Document téléchargé', 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Erreur document', 'error')
    }
  }

  const tabButton = (key: Tab, label: string, icon: string) => (
    <button
      onClick={() => setTab(key)}
      style={{
        padding: '9px 18px',
        borderRadius: 11,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 800,
        background: tab === key ? '#1a2e1e' : '#f0ebe3',
        color: tab === key ? 'white' : '#6b5c45',
      }}
    >
      {icon} {label}
    </button>
  )

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: '#1a1209' }}>Ressources Humaines</div>
        <div style={{ fontSize: 14, color: '#a89478', fontWeight: 500, marginTop: 4 }}>Personnel, congés, pointage et documents administratifs</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {TABS.map(t => tabButton(t.key, t.label, t.icon))}
      </div>

      {tab === 'personnel' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18 }}>
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e0d4', fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Liste du personnel</div>
            {loadingEmployees ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#a89478' }}>Chargement...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {employees.map(emp => {
                  const active = selectedEmployeeId === emp.id
                  return (
                    <button
                      key={emp.id}
                      onClick={() => loadDetail(emp.id)}
                      style={{
                        textAlign: 'left',
                        border: 'none',
                        background: active ? '#f6f1e8' : 'white',
                        padding: '14px 18px',
                        borderBottom: '1px solid #f3ece3',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1209' }}>{emp.fullName}</div>
                          <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={chipStyle(emp.role === 'TEACHER' ? '#dbeafe' : '#ffedd5', emp.role === 'TEACHER' ? '#1e40af' : '#9a3412')}>
                              {emp.role === 'TEACHER' ? 'Enseignant' : 'Staff'}
                            </span>
                            {emp.staffProfile?.title && <span style={chipStyle('#eef2ff', '#4338ca')}>{emp.staffProfile.title}</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#a89478', fontWeight: 700 }}>{emp.email ?? '—'}</div>
                      </div>
                    </button>
                  )
                })}
                {employees.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#a89478' }}>Aucun employé trouvé</div>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Fiche détaillée</div>
                <button style={{ ...chipStyle('#f0ebe3', '#6b5c45'), border: 'none', cursor: 'pointer' }} onClick={() => selectedEmployeeId && loadDetail(selectedEmployeeId)}>↻ Actualiser</button>
              </div>
              {loadingDetail || !selectedDetail ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#a89478' }}>Sélectionnez un employé</div>
              ) : (
                <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <div style={labelStyle}>Nom complet</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1209' }}>{selectedDetail.employee.fullName}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Rôle</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.employee.role}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Email</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.employee.email ?? '—'}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Téléphone</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.employee.phone ?? '—'}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Date d’embauche</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtDate(selectedDetail.file?.dateEmbauche ?? null)}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>CNPS</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.file?.numeroCNPS ?? '—'}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Type de contrat</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.file?.typeContrat ?? '—'}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Échelon</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.file?.echelonActuel ?? '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                    <button style={{ ...chipStyle('#dbeafe', '#1e40af'), border: 'none', cursor: 'pointer' }} onClick={() => saveEmployeeFile(selectedDetail.employee.id, (selectedDetail.file ?? {}) as Record<string, unknown>)}>💾 Sauver dossier</button>
                    <button style={{ ...chipStyle('#e0f2fe', '#075985'), border: 'none', cursor: 'pointer' }} onClick={async () => {
                      const type = prompt('Type d\'événement (PROMOTION, MUTATION, AVANCEMENT_ECHELON, SANCTION)')
                      if (!type) return
                      const date = prompt('Date (YYYY-MM-DD)')
                      if (!date) return
                      const observation = prompt('Observation (optionnel)') ?? ''
                      try {
                        const r = await fetchApi(`/api/v2/hr/employees/${selectedDetail.employee.id}/career-events`, {
                          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, date, observation }),
                        })
                        const d = await r.json()
                        if (!d.success) throw new Error(d.message ?? 'Erreur événement')
                        onToast('Événement de carrière ajouté', 'success')
                        loadDetail(selectedDetail.employee.id)
                      } catch (error) {
                        onToast(error instanceof Error ? error.message : 'Erreur événement', 'error')
                      }
                    }}>➕ Ajouter carrière</button>
                    <button style={{ ...chipStyle('#f3e8ff', '#7c3aed'), border: 'none', cursor: 'pointer' }} onClick={async () => {
                      try {
                        const r = await fetchApi(`/api/v2/hr/employees/${selectedDetail.employee.id}/attestation-travail`, { credentials: 'include' })
                        if (!r.ok) throw new Error('Impossible de générer l’attestation')
                        const blob = await r.blob()
                        const link = document.createElement('a')
                        link.href = URL.createObjectURL(blob)
                        link.download = `attestation-${selectedDetail.employee.id}.pdf`
                        link.click()
                        URL.revokeObjectURL(link.href)
                      } catch (error) {
                        onToast(error instanceof Error ? error.message : 'Erreur PDF', 'error')
                      }
                    }}>📄 Attestation</button>
                    <button style={{ ...chipStyle('#fef3c7', '#92400e'), border: 'none', cursor: 'pointer' }} onClick={async () => {
                      try {
                        const r = await fetchApi(`/api/v2/hr/employees/${selectedDetail.employee.id}/certificat-travail`, { credentials: 'include' })
                        if (!r.ok) throw new Error('Impossible de générer le certificat')
                        const blob = await r.blob()
                        const link = document.createElement('a')
                        link.href = URL.createObjectURL(blob)
                        link.download = `certificat-${selectedDetail.employee.id}.pdf`
                        link.click()
                        URL.revokeObjectURL(link.href)
                      } catch (error) {
                        onToast(error instanceof Error ? error.message : 'Erreur PDF', 'error')
                      }
                    }}>📄 Certificat</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e0d4', fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Historique carrière et congés</div>
              {!selectedDetail ? (
                <div style={{ padding: 24, color: '#a89478' }}>Sélectionnez un employé pour voir l’historique.</div>
              ) : (
                <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 10 }}>Événements carrière</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selectedDetail.careerEvents.length === 0 && <div style={{ color: '#a89478' }}>Aucun événement enregistré</div>}
                      {selectedDetail.careerEvents.map(ev => (
                        <div key={ev.id} style={{ border: '1px solid #efe7db', borderRadius: 12, padding: '10px 12px', background: '#faf8f4' }}>
                          <div style={{ fontWeight: 800, color: '#1a1209' }}>{ev.type}</div>
                          <div style={{ fontSize: 13, color: '#6b5c45', marginTop: 4 }}>{fmtDate(ev.date)}</div>
                          <div style={{ fontSize: 13, color: '#a89478', marginTop: 4 }}>{ev.observation ?? '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 10 }}>Solde congés</div>
                    <div style={{ border: '1px solid #efe7db', borderRadius: 12, padding: 14, background: '#faf8f4', marginBottom: 12 }}>
                      <div style={{ fontWeight: 800, color: '#1a1209' }}>{selectedDetail.leaveBalance.current ? `${selectedDetail.leaveBalance.current.soldeRestant} jours restants` : '—'}</div>
                      <div style={{ fontSize: 13, color: '#a89478', marginTop: 4 }}>Année {selectedDetail.leaveBalance.current?.annee ?? new Date().getFullYear()}</div>
                    </div>
                    <div style={{ ...labelStyle, marginBottom: 10 }}>Demandes de congé</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selectedDetail.leaveRequests.length === 0 && <div style={{ color: '#a89478' }}>Aucune demande</div>}
                      {selectedDetail.leaveRequests.map(req => (
                        <div key={req.id} style={{ border: '1px solid #efe7db', borderRadius: 12, padding: '10px 12px', background: '#faf8f4' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontWeight: 800, color: '#1a1209' }}>{req.type}</div>
                            <span style={chipStyle(req.statut === 'APPROVED' ? '#dcfce7' : req.statut === 'REJECTED' ? '#fee2e2' : '#fef3c7', req.statut === 'APPROVED' ? '#166534' : req.statut === 'REJECTED' ? '#991b1b' : '#92400e')}>{req.statut}</span>
                          </div>
                          <div style={{ fontSize: 13, color: '#6b5c45', marginTop: 4 }}>{fmtDate(req.dateDebut)} → {fmtDate(req.dateFin)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'conges' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Demandes en attente</div>
              <button style={{ ...chipStyle('#f0ebe3', '#6b5c45'), border: 'none', cursor: 'pointer' }} onClick={loadLeaves}>↻ Actualiser</button>
            </div>
            {loadingLeaves ? <div style={{ padding: 28, textAlign: 'center', color: '#a89478' }}>Chargement...</div> : (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {leaveRequests.filter(l => l.statut === 'PENDING').map(req => (
                  <div key={req.id} style={{ border: '1px solid #efe7db', borderRadius: 12, padding: 14, background: '#faf8f4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, color: '#1a1209' }}>{req.user.firstName} {req.user.lastName}</div>
                        <div style={{ fontSize: 13, color: '#6b5c45', marginTop: 4 }}>{req.type} · {fmtDate(req.dateDebut)} → {fmtDate(req.dateFin)}</div>
                      </div>
                      <span style={chipStyle('#fef3c7', '#92400e')}>{req.statut}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#a89478', marginTop: 8 }}>{req.motif ?? '—'}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button style={{ ...chipStyle('#dcfce7', '#166534'), border: 'none', cursor: 'pointer' }} onClick={() => handleApproveLeave(req.id, 'APPROVED')}>Approuver</button>
                      <button style={{ ...chipStyle('#fee2e2', '#991b1b'), border: 'none', cursor: 'pointer' }} onClick={() => handleApproveLeave(req.id, 'REJECTED')}>Rejeter</button>
                    </div>
                  </div>
                ))}
                {leaveRequests.filter(l => l.statut === 'PENDING').length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#a89478' }}>Aucune demande en attente</div>}
              </div>
            )}
          </div>
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e0d4', fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Historique des congés</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {leaveRequests.filter(l => l.statut !== 'PENDING').map(req => (
                <div key={req.id} style={{ border: '1px solid #efe7db', borderRadius: 12, padding: 14, background: '#faf8f4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#1a1209' }}>{req.user.firstName} {req.user.lastName}</div>
                      <div style={{ fontSize: 13, color: '#6b5c45', marginTop: 4 }}>{req.type} · {fmtDate(req.dateDebut)} → {fmtDate(req.dateFin)}</div>
                    </div>
                    <span style={chipStyle(req.statut === 'APPROVED' ? '#dcfce7' : '#fee2e2', req.statut === 'APPROVED' ? '#166534' : '#991b1b')}>{req.statut}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#a89478', marginTop: 8 }}>Validé par {req.validator ? `${req.validator.firstName} ${req.validator.lastName}` : '—'}</div>
                </div>
              ))}
              {leaveRequests.filter(l => l.statut !== 'PENDING').length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#a89478' }}>Aucun historique</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'pointage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Pointage journalier</div>
              <button style={{ ...chipStyle('#dbeafe', '#1e40af'), border: 'none', cursor: 'pointer' }} onClick={saveAttendance}>💾 Enregistrer le pointage</button>
            </div>
            <div style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={labelStyle}>Date</div>
                <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} style={{ ...inputStyle, width: 200 }} />
              </div>
              <div style={{ color: attendanceSaved ? '#166534' : '#a89478', fontWeight: 700 }}>{attendanceSaved ? 'Pointage enregistré' : 'Aucun enregistrement récent'}</div>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e0d4', fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Statut par employé</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {employees.map(emp => (
                <div key={emp.id} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 1.4fr', gap: 10, alignItems: 'center', border: '1px solid #efe7db', borderRadius: 12, padding: 12, background: '#faf8f4' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#1a1209' }}>{emp.fullName}</div>
                    <div style={{ fontSize: 12, color: '#a89478', marginTop: 3 }}>{emp.role}</div>
                  </div>
                  <select value={attendanceRows[emp.id]?.statut ?? 'PRESENT'} onChange={e => setAttendanceRows(prev => ({ ...prev, [emp.id]: { ...(prev[emp.id] ?? { note: '' }), statut: e.target.value as AttendanceStatut } }))} style={inputStyle}>
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="RETARD">RETARD</option>
                  </select>
                  <input value={attendanceRows[emp.id]?.note ?? ''} onChange={e => setAttendanceRows(prev => ({ ...prev, [emp.id]: { ...(prev[emp.id] ?? { statut: 'PRESENT' }), note: e.target.value } }))} placeholder="Note optionnelle" style={inputStyle} />
                </div>
              ))}
              {employees.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#a89478' }}>Chargez d’abord la liste du personnel.</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e0d4', fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Générer un document</div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={labelStyle}>Employé</div>
                <select value={docEmployeeId} onChange={e => setDocEmployeeId(e.target.value)} style={inputStyle}>
                  <option value="">— Choisir —</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
                </select>
              </div>
              <div>
                <div style={labelStyle}>Document</div>
                <select value={docType} onChange={e => setDocType(e.target.value as typeof docType)} style={inputStyle}>
                  <option value="attestation">Attestation de travail</option>
                  <option value="certificat">Certificat de travail</option>
                  <option value="mission">Ordre de mission</option>
                </select>
              </div>
              {docType === 'mission' && (
                <>
                  <div>
                    <div style={labelStyle}>Motif</div>
                    <input value={docForm.motif} onChange={e => setDocForm(prev => ({ ...prev, motif: e.target.value }))} style={inputStyle} placeholder="Mission administrative..." />
                  </div>
                  <div>
                    <div style={labelStyle}>Lieu</div>
                    <input value={docForm.lieu} onChange={e => setDocForm(prev => ({ ...prev, lieu: e.target.value }))} style={inputStyle} placeholder="Ville / lieu" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={labelStyle}>Date de début</div>
                      <input type="date" value={docForm.dateDebut} onChange={e => setDocForm(prev => ({ ...prev, dateDebut: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <div style={labelStyle}>Date de fin</div>
                      <input type="date" value={docForm.dateFin} onChange={e => setDocForm(prev => ({ ...prev, dateFin: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>Signataire</div>
                    <input value={docForm.signataire} onChange={e => setDocForm(prev => ({ ...prev, signataire: e.target.value }))} style={inputStyle} placeholder="Proviseur" />
                  </div>
                </>
              )}
              <button onClick={generateDoc} style={{ ...chipStyle('#1a2e1e', 'white'), border: 'none', cursor: 'pointer', justifyContent: 'center' }}>Générer</button>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e0d4', fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Prévisualisation</div>
            <div style={{ padding: 18, color: '#6b5c45', lineHeight: 1.7 }}>
              {docType === 'attestation' && 'Produit une attestation de travail basée sur le dossier de l’employé sélectionné.'}
              {docType === 'certificat' && 'Produit un certificat de travail avec les données administratives disponibles.'}
              {docType === 'mission' && 'Crée un ordre de mission puis permet de télécharger le PDF via le backend.'}
              <div style={{ marginTop: 16, fontSize: 13, color: '#a89478' }}>
                Employé sélectionné : <strong>{currentEmployee?.fullName ?? '—'}</strong>
                <br />Dernière mise à jour dossier : <strong>{selectedDetail ? fmtDateTime(selectedDetail.employee.file ? (selectedDetail.employee.file.dateEmbauche ?? null) : null) : '—'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
