'use client'
import { useState, useEffect, useCallback } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string; level: string | null }
interface ClassSubjectItem {
  id: string; subjectId: string; name: string; code: string | null
  coefficient: number; serieCode: string | null; classOnly: boolean
}

interface SubjectItem {
  id: string; name: string; code: string | null; coefficient: number
  hoursPerWeek: number; subjectType: string
  teacherSubjects: { teacherProfile: { user: { id: string; firstName: string; lastName: string } } }[]
}

interface Teacher { id: string; firstName: string; lastName: string }

interface TeacherWithSubjects extends Teacher {
  teacherProfile?: {
    supervisedSubjectIds?: string[]
    teacherSubjects?: { subjectId: string; subject: { name: string } }[]
  }
  subjects?: { id: string; name: string }[]
}

interface Department {
  id: string; name: string; color: string
  head: { id: string; firstName: string; lastName: string } | null
  subjects: { id: string; name: string; avgCoeff?: number }[]
}

const TYPE_LABEL: Record<string, string> = {
  THEORETICAL: 'Cours magistral', PRACTICAL: 'TP + Cours', MIXED: 'Mixte',
}

const COEFF_SERIES = ['A4', 'A', 'C', 'D', 'TI']
const COEFF_LEVELS = ['2nde', '1ère', 'Tle']

const EMPTY_CREATE = { name: '', code: '', coefficient: '1', hoursPerWeek: '2', subjectType: 'THEORETICAL', loading: false, error: '' }
const EMPTY_MOD    = { open: false, subjectId: '', name: '', code: '', coefficient: '', hoursPerWeek: '', subjectType: '', loading: false, error: '' }
const EMPTY_ASSIGN = { open: false, subjectId: '', subjectName: '', teacherSearch: '', teachers: [] as Teacher[], selected: null as Teacher | null, loading: false, error: '' }
const EMPTY_COEFF = { open: false, subjectId: '', subjectName: '', loading: false, error: '' }

export default function SectionSubjects({ onToast }: Props) {
  const [subjects, setSubjects]         = useState<SubjectItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [openDD, setOpenDD]             = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [createOpen, setCreateOpen]     = useState(false)
  const [form, setForm]                 = useState(EMPTY_CREATE)
  const [modForm, setModForm]           = useState(EMPTY_MOD)
  const [assignForm, setAssignForm]     = useState(EMPTY_ASSIGN)
  const [coeffForm, setCoeffForm]       = useState(EMPTY_COEFF)
  const [coeffValues, setCoeffValues]   = useState<Record<string, string>>({})
  const [deletingId, setDeletingId]     = useState<string | null>(null)

  // ── Vue par Classe ────────────────────────────────────────────────────────
  const [view, setView]                 = useState<'catalogue' | 'par-classe' | 'departements' | 'par-enseignant'>('catalogue')
  const [classList, setClassList]       = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [classSubjects, setClassSubjects] = useState<ClassSubjectItem[]>([])
  const [loadingCV, setLoadingCV]       = useState(false)
  const [classViewError, setClassViewError] = useState<string | null>(null)
  const [syncing, setSyncing]           = useState(false)

  // ── Ajout / Suppression / Édition par classe ──────────────────────────────
  const [addSubjectOpen, setAddSubjectOpen] = useState(false)
  const [addSubjectId, setAddSubjectId]     = useState('')
  const [addCoefficient, setAddCoefficient] = useState('')
  const [addClassOnly, setAddClassOnly]     = useState(false)
  const [addLoading, setAddLoading]         = useState(false)
  const [addError, setAddError]             = useState('')
  const [deletingSubjId, setDeletingSubjId] = useState<string | null>(null)
  const [editingCoeffId, setEditingCoeffId] = useState<string | null>(null)
  const [editingCoeffValue, setEditingCoeffValue] = useState('')

  // ── Départements ───────────────────────────────────────────────────────────
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptLoading, setDeptLoading] = useState(false)
  const [deptError, setDeptError] = useState<string | null>(null)
  const [deptSearch, setDeptSearch] = useState('')
  const [openDeptMenu, setOpenDeptMenu] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [allTeachers, setAllTeachers] = useState<TeacherWithSubjects[]>([])
  const [deptEditForm, setDeptEditForm] = useState<{ open: boolean; id: string; name: string; color: string; headId: string; teacherSearch: string; teachers: TeacherWithSubjects[]; loading: boolean; error: string }>({ open: false, id: '', name: '', color: '#6b7280', headId: '', teacherSearch: '', teachers: [], loading: false, error: '' })
  const [deptCreateForm, setDeptCreateForm] = useState<{ open: boolean; name: string; color: string; loading: boolean; error: string }>({ open: false, name: '', color: '#6b7280', loading: false, error: '' })

  // ── Vue par Enseignant ──────────────────────────────────────────────────────
  const [teacherViewTeachers, setTeacherViewTeachers] = useState<TeacherWithSubjects[]>([])
  const [teacherViewSearch, setTeacherViewSearch] = useState('')
  const [teacherViewLoading, setTeacherViewLoading] = useState(false)
  const [teacherViewAdding, setTeacherViewAdding] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const fetchTeacherView = useCallback(async () => {
    setTeacherViewLoading(true)
    try {
      const [teacherRes] = await Promise.all([
        fetchApi('/api/v2/users?role=TEACHER&limit=200', { credentials: 'include' }),
      ])
      const tData = await teacherRes.json()
      if (teacherRes.ok) setTeacherViewTeachers(tData.data || [])
    } catch { /* silencieux */ }
    finally { setTeacherViewLoading(false) }
  }, [])

  useEffect(() => { if (view === 'par-enseignant') fetchTeacherView() }, [view, fetchTeacherView])

  const fetchSubjects = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/subjects', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setSubjects(data.data || [])
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSubjects() }, [fetchSubjects])

  const fetchDepartments = useCallback(async () => {
    try {
      setDeptLoading(true); setDeptError(null)
      const [deptRes, subjRes, teacherRes] = await Promise.all([
        fetchApi('/api/v2/departments', { credentials: 'include' }),
        fetchApi('/api/v2/subjects', { credentials: 'include' }),
        fetchApi('/api/v2/users?role=TEACHER&limit=200', { credentials: 'include' }),
      ])
      const deptData = await deptRes.json()
      const subjData = await subjRes.json()
      const teacherData = await teacherRes.json()
      if (!deptRes.ok) throw new Error(deptData.message || 'Erreur')
      setDepartments(deptData.data || [])
      if (teacherRes.ok) setAllTeachers(teacherData.data || [])
      // subjects cached in state are used by "Non classé" computation
      if (subjRes.ok && subjData.data) setSubjects(subjData.data)
    } catch (err) { setDeptError(err instanceof Error ? err.message : 'Erreur') }
    finally { setDeptLoading(false) }
  }, [])

  useEffect(() => { if (view === 'departements') fetchDepartments() }, [view, fetchDepartments])

  // Charger les classes quand on bascule en vue par classe
  useEffect(() => {
    if (view !== 'par-classe' || classList.length > 0) return
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setClassList(d.data.map((c: any) => ({ id: c.id, name: c.name, level: c.level }))) })
      .catch(() => {})
  }, [view, classList.length])

  const handleSelectClass = async (cid: string) => {
    setSelectedClass(cid)
    setClassSubjects([])
    setClassViewError(null)
    if (!cid) return
    setLoadingCV(true)
    try {
      const res = await fetchApi(`/api/v2/subjects?classId=${cid}`, { credentials: 'include' })
      const d   = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      setClassSubjects(d.data || [])
    } catch (err) {
      setClassViewError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoadingCV(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const schoolRes = await fetchApi('/api/v2/school/me', { credentials: 'include' }).then(r => r.json())
      const schoolId  = schoolRes.data?.id
      if (!schoolId) throw new Error('École introuvable')
      const res = await fetchApi(`/api/v2/schools/${schoolId}/sync-subjects`, {
        method: 'POST', credentials: 'include',
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(
        `Sync terminé : ${d.data.classesTraitees} classe(s) traitée(s), ` +
        `${d.data.subjectsCreated} matière(s) créée(s), ${d.data.coefficientsCreated} coefficient(s) ajouté(s)`,
        'success',
      )
      fetchSubjects()
      setSelectedClass('')
      setClassSubjects([])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur sync', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // ── Ajouter une matière à la classe ──────────────────────────────────────
  const handleAddSubject = async () => {
    if (!addSubjectId || !addCoefficient) { setAddError('Sélectionnez une matière et un coefficient'); return }
    setAddLoading(true); setAddError('')
    try {
      const res = await fetchApi(`/api/v2/classes/${selectedClass}/subjects`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: addSubjectId, coefficient: parseFloat(addCoefficient), classOnly: addClassOnly }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(addClassOnly ? 'Matière ajoutée uniquement à cette classe' : 'Matière ajoutée à toutes les classes du même niveau', 'success')
      setAddSubjectOpen(false); setAddSubjectId(''); setAddCoefficient(''); setAddClassOnly(false)
      handleSelectClass(selectedClass)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Erreur')
    } finally { setAddLoading(false) }
  }

  // ── Supprimer une matière de la classe ────────────────────────────────────
  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (!window.confirm(`Retirer "${subjectName}" de cette classe ?`)) return
    setDeletingSubjId(subjectId)
    try {
      const res = await fetchApi(`/api/v2/classes/${selectedClass}/subjects/${subjectId}`, {
        method: 'DELETE', credentials: 'include',
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(`"${subjectName}" retiré`, 'success')
      handleSelectClass(selectedClass)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setDeletingSubjId(null) }
  }

  // ── Modifier le coefficient inline ────────────────────────────────────────
  const handleUpdateCoefficient = async (subjectId: string) => {
    const val = parseFloat(editingCoeffValue)
    if (isNaN(val) || val <= 0) { onToast('Coefficient invalide', 'error'); return }
    try {
      const res = await fetchApi(`/api/v2/classes/${selectedClass}/subjects`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, coefficient: val }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast('Coefficient mis à jour', 'success')
      setEditingCoeffId(null)
      handleSelectClass(selectedClass)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    }
  }

  // ── Sujets déjà dans la classe (pour filtre dropdown ajout) ───────────────
  const classSubjectIds = new Set(classSubjects.map(s => s.subjectId))

  const filtered = subjects.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.code?.toLowerCase().includes(search.toLowerCase()))
  )

  // ── Créer ─────────────────────────────────────────────────────────────────
  const submitCreate = async () => {
    if (!form.name.trim()) { setForm(f => ({ ...f, error: 'Nom obligatoire' })); return }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/subjects', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          coefficient: parseFloat(form.coefficient) || 1,
          hoursPerWeek: parseInt(form.hoursPerWeek) || 2,
          type: form.subjectType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Matière "${form.name}" créée`, 'success')
      setCreateOpen(false); setForm(EMPTY_CREATE); fetchSubjects()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Modifier ──────────────────────────────────────────────────────────────
  const openMod = (sub: SubjectItem) => {
    setOpenDD(null)
    setModForm({ open: true, subjectId: sub.id, name: sub.name, code: sub.code ?? '', coefficient: String(sub.coefficient), hoursPerWeek: String(sub.hoursPerWeek), subjectType: sub.subjectType, loading: false, error: '' })
  }

  const submitMod = async () => {
    if (!modForm.name.trim()) { setModForm(f => ({ ...f, error: 'Nom obligatoire' })); return }
    setModForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/subjects/${modForm.subjectId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modForm.name.trim(),
          code: modForm.code.trim() || undefined,
          coefficient: parseFloat(modForm.coefficient) || 1,
          hoursPerWeek: parseInt(modForm.hoursPerWeek) || 2,
          type: modForm.subjectType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Matière modifiée', 'success')
      setModForm(EMPTY_MOD); fetchSubjects()
    } catch (err) {
      setModForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Supprimer ────────────────────────────────────────────────────────────
  const handleDelete = async (sub: SubjectItem) => {
    if (!window.confirm(`Supprimer la matière "${sub.name}" ? Cette action est irréversible.`)) return
    setDeletingId(sub.id)
    setOpenDD(null)
    try {
      const res = await fetchApi(`/api/v2/subjects/${sub.id}`, {
        method: 'DELETE', credentials: 'include',
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur')
      onToast(`"${sub.name}" supprimée`, 'success')
      fetchSubjects()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Assigner enseignant ───────────────────────────────────────────────────
  const openAssign = async (sub: SubjectItem) => {
    setOpenDD(null)
    setAssignForm({ open: true, subjectId: sub.id, subjectName: sub.name, teacherSearch: '', teachers: [], selected: null, loading: false, error: '' })
    try {
      const res = await fetchApi('/api/v2/users?role=TEACHER&limit=100', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setAssignForm(f => ({ ...f, teachers: data.data || [] }))
    } catch { /* silencieux */ }
  }

  const openCoeff = (sub: SubjectItem) => {
    setOpenDD(null)
    const values: Record<string, string> = {}
    for (const lvl of COEFF_LEVELS) {
      for (const serie of COEFF_SERIES) {
        values[`${lvl}_${serie}`] = ''
      }
    }
    setCoeffValues(values)
    setCoeffForm({ open: true, subjectId: sub.id, subjectName: sub.name, loading: false, error: '' })
  }

  const submitCoeff = async () => {
    const coefficients: { classLevel: string; serieCode: string; coefficient: number }[] = []
    for (const lvl of COEFF_LEVELS) {
      for (const serie of COEFF_SERIES) {
        const val = coeffValues[`${lvl}_${serie}`]
        if (val && parseFloat(val) > 0) {
          coefficients.push({ classLevel: lvl, serieCode: serie, coefficient: parseFloat(val) })
        }
      }
    }
    if (coefficients.length === 0) {
      setCoeffForm(f => ({ ...f, error: 'Ajoutez au moins un coefficient' })); return
    }
    setCoeffForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/subjects/${coeffForm.subjectId}/coefficients`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coefficients }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Coefficients enregistrés pour ${coeffForm.subjectName}`, 'success')
      setCoeffForm(EMPTY_COEFF)
    } catch (err) {
      setCoeffForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const submitAssign = async () => {
    if (!assignForm.selected) { setAssignForm(f => ({ ...f, error: 'Sélectionnez un enseignant' })); return }
    setAssignForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/subjects/teachers/${assignForm.selected.id}/assign`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: assignForm.subjectId, action: 'ASSIGNER' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Enseignant assigné à ${assignForm.subjectName}`, 'success')
      setAssignForm(EMPTY_ASSIGN); fetchSubjects()
    } catch (err) {
      setAssignForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── "Non classé" virtuel ──────────────────────────────────────────────────
  const unassignedSubjectIds = new Set(departments.flatMap(d => d.subjects.map(s => s.id)))
  const unassignedSubjects = subjects.filter(s => !unassignedSubjectIds.has(s.id))
  const allDepartments: (Department & { _virtual?: boolean })[] = [
    ...departments.filter(d => d.name !== 'Non classé' && d.name !== 'Others' && d.name !== 'Autres').sort((a, b) => a.name.localeCompare(b.name)),
    ...departments.filter(d => d.name === 'Non classé' || d.name === 'Others' || d.name === 'Autres'),
  ]
  if (unassignedSubjects.length > 0) {
    allDepartments.push({
      id: '__unassigned__', name: 'Non classé', color: '#9ca3af',
      head: null, subjects: unassignedSubjects.map(s => ({ id: s.id, name: s.name })),
      _virtual: true,
    })
  }

  const depsWithoutAp = allDepartments.filter(d => !d.head && d.name !== 'Non classé')

  // ── Départements : déplacer une matière via PATCH subject ──────────────────
  const moveSubjectToDept = async (subjectId: string, subjectName: string, targetDeptId: string, targetDeptName: string) => {
    const sourceDept = departments.find(d => d.subjects.some(s => s.id === subjectId))
    const sourceDeptId = sourceDept?.id
    const prev = [...departments]
    setDepartments(deps => deps.map(d => ({
      ...d,
      subjects: targetDeptId !== '__unassigned__' && d.id === targetDeptId
        ? [...d.subjects, { id: subjectId, name: subjectName }]
        : d.id !== targetDeptId
          ? d.subjects.filter(s => s.id !== subjectId)
          : d.subjects,
    })))
    try {
      if (targetDeptId !== '__unassigned__') {
        const existingIds = departments.find(d => d.id === targetDeptId)?.subjects.map(s => s.id) ?? []
        const res = await fetchApi(`/api/v2/departments/${targetDeptId}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectIds: [...existingIds, subjectId] }),
        })
        if (!res.ok) throw new Error('Erreur')
      }
      if (sourceDeptId && sourceDeptId !== '__unassigned__') {
        const remainingIds = sourceDept.subjects.filter(s => s.id !== subjectId).map(s => s.id)
        const res = await fetchApi(`/api/v2/departments/${sourceDeptId}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectIds: remainingIds }),
        })
        if (!res.ok) throw new Error('Erreur')
      }
      onToast(`✅ ${subjectName} déplacé vers ${targetDeptName}`, 'success')
      fetchDepartments()
    } catch {
      setDepartments(prev)
      onToast(`Erreur lors du déplacement`, 'error')
    }
  }

  // ── Départements : Drag & Drop ──────────────────────────────────────────────
  const handleDragEnd = (event: any) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const subjectId = active.id as string
    const targetDeptId = over.id as string
    const subjectName = subjects.find(s => s.id === subjectId)?.name ?? subjectId
    const targetDept = allDepartments.find(d => d.id === targetDeptId)
    if (!targetDept) return
    moveSubjectToDept(subjectId, subjectName, targetDeptId, targetDept.name)
  }

  // ── Départements : Créer ───────────────────────────────────────────────────
  const submitCreateDept = async () => {
    if (!deptCreateForm.name.trim()) { setDeptCreateForm(f => ({ ...f, error: 'Nom obligatoire' })); return }
    setDeptCreateForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/departments', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deptCreateForm.name.trim(), color: deptCreateForm.color }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setDeptCreateForm({ open: false, name: '', color: '#6b7280', loading: false, error: '' })
      fetchDepartments()
    } catch (err) {
      setDeptCreateForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Départements : Ouvrir édition ──────────────────────────────────────────
  const openEditDept = async (dept: Department) => {
    const deptSubjectIds = new Set(dept.subjects.map(s => s.id))
    const eligibleTeachers = dept.subjects.length === 0
      ? []
      : allTeachers.filter(t =>
          t.teacherProfile?.teacherSubjects?.some(ts => deptSubjectIds.has(ts.subjectId)) ?? false
        )
    setDeptEditForm({
      open: true, id: dept.id, name: dept.name, color: dept.color,
      headId: dept.head?.id ?? '',
      teachers: eligibleTeachers, teacherSearch: '', loading: false, error: '',
    })
  }

  // ── Départements : Modifier ────────────────────────────────────────────────
  const submitEditDept = async () => {
    if (!deptEditForm.name.trim()) { setDeptEditForm(f => ({ ...f, error: 'Nom obligatoire' })); return }
    setDeptEditForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/departments/${deptEditForm.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deptEditForm.name.trim(),
          color: deptEditForm.color,
          headId: deptEditForm.headId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setDeptEditForm(f => ({ ...f, open: false, loading: false }))
      fetchDepartments()
    } catch (err) {
      setDeptEditForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Départements : Supprimer ────────────────────────────────────────────────
  const handleDeleteDept = async (dept: { id: string; name: string }) => {
    if (!window.confirm(`Supprimer le département "${dept.name}" ?`)) return
    try {
      const res = await fetchApi(`/api/v2/departments/${dept.id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      fetchDepartments()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    }
  }

  // ── Départements : recherche ──────────────────────────────────────────────
  const deptSearchLower = deptSearch.toLowerCase()
  const searchMatchCount = deptSearch
    ? allDepartments.reduce((sum, d) => sum + d.subjects.filter(s => s.name.toLowerCase().includes(deptSearchLower)).length, 0)
    : 0

  const filteredTeachers = assignForm.teacherSearch
    ? assignForm.teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(assignForm.teacherSearch.toLowerCase()))
    : assignForm.teachers

  const selectedClassName = classList.find(c => c.id === selectedClass)?.name

  const departmentHasSubjects = (deptId: string): boolean =>
    (departments.find(d => d.id === deptId)?.subjects.length ?? 0) > 0

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={sTitle}>Matières</div>
          <div style={sSub}>{loading ? '…' : `${subjects.length} matière${subjects.length > 1 ? 's' : ''} configurée${subjects.length > 1 ? 's' : ''}`}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Toggle Vue */}
          <div style={{ display: 'flex', background: '#f0ebe3', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['catalogue', 'par-classe', 'departements', 'par-enseignant'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: view === v ? 'white' : 'transparent',
                  color:      view === v ? '#1a1209' : '#a89478',
                  boxShadow:  view === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                {v === 'catalogue' ? 'Vue Catalogue' : v === 'par-classe' ? 'Vue par Classe' : v === 'departements' ? 'Départements' : 'Par enseignant'}
              </button>
            ))}
          </div>
          <button style={{ ...btnPrim, opacity: syncing ? 0.7 : 1, fontSize: 14, padding: '8px 14px' }}
            onClick={handleSync} disabled={syncing} title="Créer rétroactivement les coefficients manquants">
            {syncing ? '⏳ Sync…' : '🔄 Sync Matières'}
          </button>
          {view === 'catalogue' && (
            <button style={btnPrim} onClick={() => setCreateOpen(true)}>+ Créer une matière</button>
          )}
          {view === 'departements' && (
            <button style={btnPrim} onClick={() => setDeptCreateForm({ open: true, name: '', color: '#6b7280', loading: false, error: '' })}>+ Créer un département</button>
          )}
        </div>
      </div>

      {/* ── Vue par Classe ─────────────────────────────────────────────────────── */}
      {view === 'par-classe' && (
        <div>
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '20px 24px', marginBottom: 20, maxWidth: 480 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6b5c45', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Choisir une classe</div>
            <select
              value={selectedClass}
              onChange={e => handleSelectClass(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e8e0d4', fontSize: 15, color: '#1a1209', background: 'white', fontFamily: 'inherit', cursor: 'pointer' }}>
              <option value="">— Sélectionner une classe —</option>
              {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {loadingCV && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} /></div>}

          {classViewError && (
            <div style={{ background: '#fee2e2', borderRadius: 14, padding: '14px 18px', color: '#dc2626', fontWeight: 700, fontSize: 14 }}>⚠️ {classViewError}</div>
          )}

          {!loadingCV && selectedClass && classSubjects.length === 0 && !classViewError && (
            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
              <div style={{ fontSize: 16, color: '#a89478', marginBottom: 16 }}>
                Aucune matière configurée pour <strong>{selectedClassName}</strong>.
              </div>
              <div style={{ fontSize: 14, color: '#a89478' }}>
                Cliquez sur <strong>🔄 Sync Matières</strong> pour créer automatiquement les coefficients.
              </div>
            </div>
          )}

          {!loadingCV && classSubjects.length > 0 && (
            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
              <div style={{ padding: '14px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1209' }}>
                  Programme de <strong>{selectedClassName}</strong>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>
                    {classSubjects.length} matière{classSubjects.length > 1 ? 's' : ''}
                  </span>
                  <button onClick={() => { setAddSubjectOpen(true); setAddError(''); setAddSubjectId(''); setAddCoefficient(''); setAddClassOnly(false) }}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: '1.5px solid #059669', background: '#d1fae5', color: '#065f46', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    + Ajouter
                  </button>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Matière', 'Code', 'Coefficient', 'Série', 'Actions'].map(h => (
                      <th key={h} style={{ ...thStyle, textAlign: h === 'Actions' ? 'center' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classSubjects.map(s => (
                    <tr key={s.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209', fontSize: 16 }}>
                        {s.name}
                        {s.classOnly && (
                          <span title="Matière spécifique à cette classe uniquement"
                            style={{ marginLeft: 6, background: '#ede9fe', color: '#6d28d9', padding: '2px 7px', borderRadius: 12, fontSize: 11, fontWeight: 800, verticalAlign: 'middle' }}>
                            📌 cette classe
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {s.code ? <code style={{ background: '#f0ebe3', padding: '3px 8px', borderRadius: 6, fontSize: 13 }}>{s.code}</code> : <span style={{ color: '#a89478' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        {editingCoeffId === s.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" min="0.5" step="0.5" value={editingCoeffValue}
                              onChange={e => setEditingCoeffValue(e.target.value)}
                              style={{ width: 64, padding: '4px 8px', borderRadius: 6, fontSize: 14, border: '1.5px solid #059669', background: 'white', color: '#1a1209', fontFamily: 'inherit', textAlign: 'center', outline: 'none' }} />
                            <button onClick={() => handleUpdateCoefficient(s.subjectId)}
                              style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>OK</button>
                            <button onClick={() => setEditingCoeffId(null)}
                              style={{ background: '#f0ebe3', color: '#6b5c45', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>✕</button>
                          </div>
                        ) : (
                          <span onClick={() => { setEditingCoeffId(s.id); setEditingCoeffValue(String(s.coefficient)) }}
                            style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 900, cursor: 'pointer' }}
                            title="Cliquer pour modifier">×{s.coefficient}</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {s.serieCode
                          ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>{s.serieCode}</span>
                          : <span style={{ color: '#a89478', fontSize: 14 }}>1er cycle</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button onClick={() => handleDeleteSubject(s.subjectId, s.name)}
                          style={{ background: 'none', border: '1.5px solid #fecaca', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 16, color: deletingSubjId === s.subjectId ? '#a89478' : '#dc2626', opacity: deletingSubjId === s.subjectId ? 0.5 : 1 }}
                          disabled={deletingSubjId === s.subjectId}
                          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: '#fee2e2' })}
                          onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'none' })}>
                          {deletingSubjId === s.subjectId ? '⏳' : '🗑'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!selectedClass && !loadingCV && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#a89478' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
              <div style={{ fontSize: 17 }}>Sélectionnez une classe pour voir son programme.</div>
            </div>
          )}
        </div>
      )}

      {/* ── Vue Catalogue ──────────────────────────────────────────────────────── */}
      {view === 'catalogue' && loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div style={{ width: 36, height: 36, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} /></div>}

      {view === 'catalogue' && !loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span><span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={fetchSubjects} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {view === 'catalogue' && !loading && !error && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 14px' }}>
              <span>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une matière…"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#a89478', fontSize: 17 }}>
              {subjects.length === 0 ? 'Aucune matière configurée' : 'Aucun résultat'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Matière', 'Code', 'Coeff.', 'H/sem.', 'Type', 'Enseignants', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(sub => (
                  <tr key={sub.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209', fontSize: 17 }}>{sub.name}</td>
                    <td style={tdStyle}>
                      {sub.code ? <code style={{ background: '#f0ebe3', padding: '3px 9px', borderRadius: 7, fontSize: 14 }}>{sub.code}</code> : <span style={{ color: '#a89478' }}>—</span>}
                    </td>
                    <td style={tdStyle}><span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 900 }}>×{sub.coefficient}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209' }}>{sub.hoursPerWeek}h</td>
                    <td style={tdStyle}>{TYPE_LABEL[sub.subjectType] ?? sub.subjectType}</td>
                    <td style={tdStyle}>
                      <span style={{ background: sub.teacherSubjects.length > 0 ? '#d1fae5' : '#f1f5f9', color: sub.teacherSubjects.length > 0 ? '#065f46' : '#475569', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>
                        {sub.teacherSubjects.length > 0 ? `${sub.teacherSubjects.length} assigné${sub.teacherSubjects.length > 1 ? 's' : ''}` : 'Non assigné'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button onClick={() => setOpenDD(openDD === sub.id ? null : sub.id)}
                          style={{ background: 'none', border: '1.5px solid #d4c8b8', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 16, color: '#a89478' }}
                          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669', background: '#d1fae5' })}
                          onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#a89478', background: 'none' })}>
                          {deletingId === sub.id ? '⏳' : '⋯'}
                        </button>
                        {openDD === sub.id && (
                          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 210, zIndex: 100, overflow: 'hidden' }}>
                            {[
                              { icon: '👥', label: 'Assigner enseignant', action: () => openAssign(sub), danger: false },
                              { icon: '✏️', label: 'Modifier',            action: () => openMod(sub),    danger: false },
                              { icon: '📊', label: 'Coefficients BAC',    action: () => openCoeff(sub),  danger: false },
                              { icon: '🗑', label: 'Supprimer',            action: () => handleDelete(sub), danger: false },
                            ].map((item, j) => (
                              <div key={j} onClick={item.action}
                                style={{ padding: '11px 16px', fontSize: 16, fontWeight: 600, color: item.danger ? '#dc2626' : '#6b5c45', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = item.danger ? '#fee2e2' : '#f0ebe3'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                                {item.icon} {item.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Vue Départements ───────────────────────────────────────────────────── */}
      {view === 'departements' && (
        <DndContext sensors={sensors} onDragStart={e => setActiveDragId(e.active.id as string)} onDragEnd={handleDragEnd}>
          {/* Barre d'outils */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 14px', minWidth: 200, maxWidth: 400 }}>
              <span>🔍</span>
              <input value={deptSearch} onChange={e => setDeptSearch(e.target.value)}
                placeholder="Rechercher une matière…"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
              {deptSearch && <span onClick={() => setDeptSearch('')} style={{ cursor: 'pointer', color: '#a89478', fontSize: 14 }}>✕</span>}
            </div>
            {deptSearch && searchMatchCount > 0 && (
              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>
                {searchMatchCount} résultat{searchMatchCount > 1 ? 's' : ''}
              </span>
            )}
            {depsWithoutAp.length > 0 && (
              <span style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                ⚠️ AP non désignés : {depsWithoutAp.length}
              </span>
            )}
            <button style={btnPrim} onClick={() => setDeptCreateForm({ open: true, name: '', color: '#6b7280', loading: false, error: '' })}>
              + Créer un département
            </button>
          </div>

          {deptLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div style={{ width: 36, height: 36, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} /></div>}

          {!deptLoading && deptError && (
            <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>⚠️</span><span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{deptError}</span>
              <button onClick={fetchDepartments} style={btnRetry}>Réessayer</button>
            </div>
          )}

          {!deptLoading && !deptError && allDepartments.length === 0 && (
            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
              <div style={{ fontSize: 17, color: '#a89478', marginBottom: 16 }}>
                Aucun département pédagogique configuré.
              </div>
              <button style={btnPrim} onClick={() => setDeptCreateForm({ open: true, name: '', color: '#6b7280', loading: false, error: '' })}>
                + Créer un département
              </button>
            </div>
          )}

          {!deptLoading && !deptError && allDepartments.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {allDepartments.map(dept => {
                const isVirtual = dept._virtual
                const hasSearch = deptSearch.length > 0
                const matchingSubjectIds = new Set(
                  dept.subjects.filter(s => s.name.toLowerCase().includes(deptSearchLower)).map(s => s.id)
                )
                const hasAnyMatch = !hasSearch || matchingSubjectIds.size > 0

                return (
                  <DeptDroppable key={dept.id} deptId={dept.id}>
                    <div style={{
                      background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4',
                      opacity: hasSearch && !hasAnyMatch ? 0.4 : 1,
                      transition: 'opacity 0.2s',
                    }}>
                      <div style={{ height: 6, background: isVirtual ? '#d1d5db' : dept.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white' }} />
                      <div style={{ padding: '16px 18px' }}>
                        {/* En-tête */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: isVirtual ? '#d1d5db' : dept.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>{dept.name}</span>
                            <span style={{ fontSize: 13, color: '#a89478', fontWeight: 700 }}>({dept.subjects.length})</span>
                          </div>
                          {!isVirtual && (
                            <button onClick={() => openEditDept(dept)}
                              style={{ background: '#f0ebe3', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 14, color: '#6b5c45', fontFamily: 'inherit' }}
                              title="Modifier le département">
                              ✏️
                            </button>
                          )}
                        </div>

                        {/* AP */}
                        <div style={{ marginBottom: 10 }}>
                          {dept.head
                            ? <span style={{ background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                                AP : {dept.head.firstName} {dept.head.lastName}
                              </span>
                            : !isVirtual
                              ? <span style={{ color: '#dc2626', fontSize: 13, fontWeight: 600 }}>⚠️ AP non désigné</span>
                              : <span style={{ color: '#a89478', fontSize: 13, fontStyle: 'italic' }}>Aucun département</span>
                          }
                        </div>

                        {/* Matières */}
                        {dept.subjects.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {dept.subjects
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(s => {
                                const isMatch = !hasSearch || matchingSubjectIds.has(s.id)
                                return (
                                  <DraggableSubject key={s.id} subjectId={s.id} deptId={dept.id}>
                                    <div style={{
                                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8,
                                      background: isMatch && activeDragId === s.id ? '#d1fae5' : 'transparent',
                                      opacity: hasSearch && !isMatch ? 0.3 : 1,
                                      transition: 'opacity 0.2s, background 0.15s',
                                      cursor: 'grab', userSelect: 'none',
                                    }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isMatch && activeDragId === s.id ? '#d1fae5' : 'transparent'}>
                                      <span style={{ fontSize: 14, color: '#a89478', cursor: 'grab', opacity: activeDragId === s.id ? 1 : 0.3 }}>⠿</span>
                                      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: isMatch ? '#1a1209' : '#a89478' }}>
                                        {hasSearch && isMatch ? highlightMatch(s.name, deptSearch) : s.name}
                                      </span>
                                      <span style={{ position: 'relative' }}>
                                        <button onClick={(e) => { e.stopPropagation(); setOpenDeptMenu(openDeptMenu === s.id ? null : s.id) }}
                                          style={{ background: 'none', border: 'none', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontSize: 16, color: '#a89478', fontFamily: 'inherit' }}>⋯</button>
                                        {openDeptMenu === s.id && (
                                          <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 200, zIndex: 200, overflow: 'hidden' }}>
                                            <div style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #f0ebe3' }}>
                                              Déplacer vers :
                                            </div>
                                            {allDepartments.filter(other => other.id !== dept.id).map(other => (
                                              <div key={other.id} onClick={() => { setOpenDeptMenu(null); moveSubjectToDept(s.id, s.name, other.id, other.name) }}
                                                style={{ padding: '9px 14px', fontSize: 14, fontWeight: 600, color: '#6b5c45', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0ebe3'}
                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: other.color, flexShrink: 0 }} />
                                                {other.name}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </span>
                                    </div>
                                  </DraggableSubject>
                                )
                              })}
                          </div>
                        ) : (
                          <div style={{ color: '#a89478', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                            {isVirtual ? 'Glissez des matières ici' : 'Aucune matière'}
                          </div>
                        )}

                        {/* Pied */}
                        {isVirtual && (
                          <div style={{ marginTop: 8, background: '#fef2f2', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>⚠️</span>
                            <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>Ces matières n'ont pas de département assigné</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </DeptDroppable>
                )
              })}
            </div>
          )}

          <DragOverlay>
            {activeDragId ? (
              <div style={{ padding: '8px 14px', background: 'white', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', fontWeight: 700, fontSize: 14, color: '#1a1209', border: '2px solid #059669' }}>
                {subjects.find(s => s.id === activeDragId)?.name ?? activeDragId}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Vue Par enseignant ──────────────────────────────────────────────────── */}
      {view === 'par-enseignant' && (
        <div>
          {/* Barre outils */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 14px', maxWidth: 400 }}>
              <span>🔍</span>
              <input value={teacherViewSearch} onChange={e => setTeacherViewSearch(e.target.value)}
                placeholder="Rechercher un enseignant…"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
              {teacherViewSearch && <span onClick={() => setTeacherViewSearch('')} style={{ cursor: 'pointer', color: '#a89478', fontSize: 14 }}>✕</span>}
            </div>
            <span style={{ fontSize: 14, color: '#a89478', fontWeight: 600 }}>{teacherViewTeachers.length} enseignant{teacherViewTeachers.length > 1 ? 's' : ''}</span>
          </div>

          {teacherViewLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
            </div>
          )}

          {!teacherViewLoading && teacherViewTeachers.length === 0 && (
            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👨‍🏫</div>
              <div style={{ fontSize: 17, color: '#a89478' }}>Aucun enseignant trouvé</div>
            </div>
          )}

          {!teacherViewLoading && teacherViewTeachers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {teacherViewTeachers
                .filter(t => !teacherViewSearch || `${t.firstName} ${t.lastName}`.toLowerCase().includes(teacherViewSearch.toLowerCase()))
                .map(teacher => {
                  const teacherSubjects = teacher.teacherProfile?.teacherSubjects ?? []
                  const unassignedSubjects = subjects.filter(
                    s => !teacherSubjects.some(ts => ts.subjectId === s.id)
                  )
                  return (
                    <div key={teacher.id} style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4' }}>
                      <div style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>{teacher.firstName} {teacher.lastName}</div>
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                            {teacherSubjects.length} matière{teacherSubjects.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {teacherSubjects.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {teacherSubjects.map(ts => (
                              <span key={ts.subjectId} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: 20,
                                fontSize: 13, fontWeight: 700,
                              }}>
                                {ts.subject?.name ?? ts.subjectId}
                                <span onClick={async () => {
                                  if (!window.confirm(`Retirer "${ts.subject?.name ?? ts.subjectId}" de ${teacher.firstName} ${teacher.lastName} ?`)) return
                                  try {
                                    const res = await fetchApi(`/api/v2/subjects/teachers/${teacher.id}/assign`, {
                                      method: 'POST', credentials: 'include',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ subjectId: ts.subjectId, action: 'RETIRER' }),
                                    })
                                    if (!res.ok) throw new Error()
                                    onToast(`"${ts.subject?.name}" retiré`, 'success')
                                    fetchTeacherView()
                                  } catch { onToast('Erreur lors du retrait', 'error') }
                                }}
                                  style={{ cursor: 'pointer', marginLeft: 2, fontSize: 14, lineHeight: 1 }} title="Retirer">
                                  ✕
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                        {teacherSubjects.length === 0 && (
                          <div style={{ color: '#a89478', fontSize: 13, fontStyle: 'italic', marginBottom: 10 }}>Aucune matière assignée</div>
                        )}

                        <div style={{ position: 'relative' }}>
                          <button onClick={() => setTeacherViewAdding(teacherViewAdding === teacher.id ? null : teacher.id)}
                            style={{
                              padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                              background: teacherViewAdding === teacher.id ? '#059669' : '#d1fae5',
                              color: teacherViewAdding === teacher.id ? 'white' : '#065f46',
                              border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}>
                            + Ajouter une matière
                          </button>

                          {teacherViewAdding === teacher.id && unassignedSubjects.length > 0 && (
                            <div style={{
                              position: 'absolute', left: 0, top: 'calc(100% + 4px)', background: 'white',
                              border: '1.5px solid #d4c8b8', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                              minWidth: 250, maxHeight: 240, overflowY: 'auto', zIndex: 200,
                            }}>
                              <div style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #f0ebe3' }}>
                                Choisir une matière
                              </div>
                              {unassignedSubjects.map(sub => (
                                <div key={sub.id} onClick={async () => {
                                  try {
                                    const res = await fetchApi(`/api/v2/subjects/teachers/${teacher.id}/assign`, {
                                      method: 'POST', credentials: 'include',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ subjectId: sub.id, action: 'ASSIGNER' }),
                                    })
                                    if (!res.ok) throw new Error()
                                    onToast(`"${sub.name}" assigné à ${teacher.firstName} ${teacher.lastName}`, 'success')
                                    setTeacherViewAdding(null)
                                    fetchTeacherView()
                                  } catch { onToast('Erreur lors de l\'assignation', 'error') }
                                }}
                                  style={{ padding: '9px 14px', fontSize: 14, fontWeight: 600, color: '#6b5c45', cursor: 'pointer', borderBottom: '1px solid #f0ebe3' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0ebe3'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                                  {sub.name}
                                </div>
                              ))}
                            </div>
                          )}
                          {teacherViewAdding === teacher.id && unassignedSubjects.length === 0 && (
                            <div style={{
                              position: 'absolute', left: 0, top: 'calc(100% + 4px)', background: 'white',
                              border: '1.5px solid #d4c8b8', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                              minWidth: 250, zIndex: 200,
                            }}>
                              <div style={{ padding: '14px', textAlign: 'center', color: '#a89478', fontSize: 14 }}>Toutes les matières sont déjà assignées</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}

          {/* ── Matières sans enseignant ── */}
          {!teacherViewLoading && subjects.length > 0 && (
            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden', marginTop: 18 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⚠️</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1209' }}>Matières sans enseignant</span>
              </div>
              {(() => {
                const assignedSubjectIds = new Set(
                  teacherViewTeachers.flatMap(t => t.teacherProfile?.teacherSubjects?.map(ts => ts.subjectId) ?? [])
                )
                const unassignedSubjs = subjects.filter(s => !assignedSubjectIds.has(s.id))
                if (unassignedSubjs.length === 0) return (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#a89478', fontSize: 15 }}>
                    ✅ Toutes les matières ont au moins un enseignant
                  </div>
                )
                return (
                  <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {unassignedSubjs.map(s => (
                      <span key={s.id} style={{
                        background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: 20,
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── Modal créer ── */}
      {createOpen && (
        <ModalOverlay onClose={() => { setCreateOpen(false); setForm(EMPTY_CREATE) }}>
          <div style={sModalTitle}>Créer une matière</div>
          <div style={sLabel}>Nom *</div>
          <input style={sInput} placeholder="Ex: Mathématiques, Français…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={sLabel}>Code</div>
              <input style={sInput} placeholder="Ex: MATH, FR" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Coefficient</div>
              <input style={sInput} type="number" min="0.5" step="0.5" value={form.coefficient} onChange={e => setForm(f => ({ ...f, coefficient: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Heures / semaine</div>
              <input style={sInput} type="number" min="1" value={form.hoursPerWeek} onChange={e => setForm(f => ({ ...f, hoursPerWeek: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Type</div>
              <select style={sInput} value={form.subjectType} onChange={e => setForm(f => ({ ...f, subjectType: e.target.value }))}>
                <option value="THEORETICAL">Cours magistral</option>
                <option value="PRACTICAL">TP + Cours</option>
                <option value="MIXED">Mixte</option>
              </select>
            </div>
          </div>
          {form.error && <div style={sError}>{form.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => { setCreateOpen(false); setForm(EMPTY_CREATE) }}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={submitCreate} disabled={form.loading}>
              {form.loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal modifier ── */}
      {modForm.open && (
        <ModalOverlay onClose={() => setModForm(EMPTY_MOD)}>
          <div style={sModalTitle}>Modifier la matière</div>
          <div style={sLabel}>Nom *</div>
          <input style={sInput} value={modForm.name} onChange={e => setModForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={sLabel}>Code</div>
              <input style={sInput} value={modForm.code} onChange={e => setModForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Coefficient</div>
              <input style={sInput} type="number" min="0.5" step="0.5" value={modForm.coefficient} onChange={e => setModForm(f => ({ ...f, coefficient: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Heures / semaine</div>
              <input style={sInput} type="number" min="1" value={modForm.hoursPerWeek} onChange={e => setModForm(f => ({ ...f, hoursPerWeek: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Type</div>
              <select style={sInput} value={modForm.subjectType} onChange={e => setModForm(f => ({ ...f, subjectType: e.target.value }))}>
                <option value="THEORETICAL">Cours magistral</option>
                <option value="PRACTICAL">TP + Cours</option>
                <option value="MIXED">Mixte</option>
              </select>
            </div>
          </div>
          {modForm.error && <div style={sError}>{modForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setModForm(EMPTY_MOD)}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: modForm.loading ? 0.7 : 1 }} onClick={submitMod} disabled={modForm.loading}>
              {modForm.loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal coefficients BAC ── */}
      {coeffForm.open && (
        <ModalOverlay onClose={() => setCoeffForm(EMPTY_COEFF)}>
          <div style={sModalTitle}>Configurer les coefficients BAC</div>
          <div style={{ fontSize: 15, color: '#a89478', marginBottom: 18 }}>{coeffForm.subjectName}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Niveau</th>
                  {COEFF_SERIES.map(s => (
                    <th key={s} style={{ ...thStyle, textAlign: 'center', minWidth: 70 }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COEFF_LEVELS.map(lvl => (
                  <tr key={lvl}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209' }}>{lvl}</td>
                    {COEFF_SERIES.map(serie => (
                      <td key={serie} style={{ ...tdStyle, textAlign: 'center', padding: '8px 6px' }}>
                        <input type="number" min="0" step="0.5"
                          value={coeffValues[`${lvl}_${serie}`] ?? ''}
                          onChange={e => setCoeffValues(v => ({ ...v, [`${lvl}_${serie}`]: e.target.value }))}
                          placeholder="—"
                          style={{ width: 64, padding: '6px 8px', borderRadius: 8, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', textAlign: 'center', outline: 'none' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {coeffForm.error && <div style={sError}>{coeffForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setCoeffForm(EMPTY_COEFF)}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: coeffForm.loading ? 0.7 : 1 }} onClick={submitCoeff} disabled={coeffForm.loading}>
              {coeffForm.loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal ajouter matière à la classe ── */}
      {addSubjectOpen && (
        <ModalOverlay onClose={() => { setAddSubjectOpen(false); setAddSubjectId(''); setAddCoefficient(''); setAddError(''); setAddClassOnly(false) }}>
          <div style={sModalTitle}>Ajouter une matière</div>
          <div style={{ fontSize: 15, color: '#a89478', marginBottom: 18 }}>
            à <strong>{selectedClassName}</strong>
          </div>
          <div style={sLabel}>Matière *</div>
          <select value={addSubjectId} onChange={e => setAddSubjectId(e.target.value)}
            style={sInput}>
            <option value="">— Choisir une matière —</option>
            {subjects.filter(s => !classSubjectIds.has(s.id)).map(s => (
              <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
            ))}
          </select>
          <div style={sLabel}>Coefficient *</div>
          <input type="number" min="0.5" step="0.5" value={addCoefficient}
            onChange={e => setAddCoefficient(e.target.value)}
            style={sInput} placeholder="Ex: 1, 2, 3…" />

          {/* Toggle portée */}
          <div style={{ display: 'flex', background: '#f0ebe3', borderRadius: 10, padding: 3, gap: 2, marginBottom: 4, marginTop: 4 }}>
            <button type="button"
              onClick={() => setAddClassOnly(false)}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: !addClassOnly ? 'white' : 'transparent',
                color:      !addClassOnly ? '#1a1209' : '#a89478',
                boxShadow:  !addClassOnly ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
              Pour toutes les {classList.find(c => c.id === selectedClass)?.level ?? 'classes du même niveau'}
            </button>
            <button type="button"
              onClick={() => setAddClassOnly(true)}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: addClassOnly ? 'white' : 'transparent',
                color:      addClassOnly ? '#6d28d9' : '#a89478',
                boxShadow:  addClassOnly ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
              📌 Cette classe uniquement
            </button>
          </div>
          {!addClassOnly && (
            <div style={{ fontSize: 12, color: '#a89478', marginBottom: 8 }}>
              ⚠️ Sera ajoutée à toutes les classes du même niveau et série
            </div>
          )}

          {addError && <div style={sError}>{addError}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => { setAddSubjectOpen(false); setAddSubjectId(''); setAddCoefficient(''); setAddError(''); setAddClassOnly(false) }}>
              Annuler
            </button>
            <button style={{ ...btnPrim, flex: 1, opacity: addLoading ? 0.7 : 1 }} onClick={handleAddSubject} disabled={addLoading}>
              {addLoading ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal assigner enseignant ── */}
      {assignForm.open && (
        <ModalOverlay onClose={() => setAssignForm(EMPTY_ASSIGN)}>
          <div style={sModalTitle}>Assigner un enseignant</div>
          <div style={{ fontSize: 15, color: '#a89478', marginBottom: 18 }}>{assignForm.subjectName}</div>
          <div style={sLabel}>Rechercher un enseignant</div>
          <input style={sInput} placeholder="Nom de l'enseignant…" value={assignForm.teacherSearch}
            onChange={e => setAssignForm(f => ({ ...f, teacherSearch: e.target.value, selected: null }))} />
          {assignForm.selected && (
            <div style={{ background: '#d1fae5', color: '#065f46', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
              ✓ {assignForm.selected.firstName} {assignForm.selected.lastName}
            </div>
          )}
          {!assignForm.selected && (
            <div style={{ border: '1.5px solid #e8e0d4', borderRadius: 10, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
              {filteredTeachers.length === 0
                ? <div style={{ padding: '16px', textAlign: 'center', color: '#a89478', fontSize: 14 }}>Aucun enseignant</div>
                : filteredTeachers.map(t => (
                  <div key={t.id}
                    onClick={() => setAssignForm(f => ({ ...f, selected: t, teacherSearch: `${t.firstName} ${t.lastName}` }))}
                    style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f0ebe3', color: '#1a1209' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#faf8f5'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    {t.firstName} {t.lastName}
                  </div>
                ))}
            </div>
          )}
          {assignForm.error && <div style={sError}>{assignForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setAssignForm(EMPTY_ASSIGN)}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: assignForm.loading ? 0.7 : 1 }} onClick={submitAssign} disabled={assignForm.loading}>
              {assignForm.loading ? 'Assignation…' : 'Assigner'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal créer département ── */}
      {deptCreateForm.open && (
        <ModalOverlay onClose={() => setDeptCreateForm({ open: false, name: '', color: '#6b7280', loading: false, error: '' })}>
          <div style={sModalTitle}>Créer un département</div>
          <div style={sLabel}>Nom *</div>
          <input style={sInput} placeholder="Ex: Lettres, Sciences…" value={deptCreateForm.name}
            onChange={e => setDeptCreateForm(f => ({ ...f, name: e.target.value }))} />
          <div style={sLabel}>Couleur</div>
          <DeptColorPicker value={deptCreateForm.color} onChange={c => setDeptCreateForm(f => ({ ...f, color: c }))} />
          {deptCreateForm.error && <div style={sError}>{deptCreateForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setDeptCreateForm({ open: false, name: '', color: '#6b7280', loading: false, error: '' })}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: deptCreateForm.loading ? 0.7 : 1 }} onClick={submitCreateDept} disabled={deptCreateForm.loading}>
              {deptCreateForm.loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal modifier département ── */}
      {deptEditForm.open && (
        <ModalOverlay onClose={() => setDeptEditForm(f => ({ ...f, open: false }))}>
          <div style={sModalTitle}>Modifier le département</div>

          <div style={sLabel}>Nom *</div>
          <input style={sInput} value={deptEditForm.name}
            onChange={e => setDeptEditForm(f => ({ ...f, name: e.target.value }))} />

          <div style={sLabel}>Couleur</div>
          <DeptColorPicker value={deptEditForm.color} onChange={c => setDeptEditForm(f => ({ ...f, color: c }))} />

          <div style={sLabel}>Animateur Pédagogique (AP)</div>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input style={sInput} placeholder="Rechercher un enseignant…" value={deptEditForm.teacherSearch}
              onChange={e => setDeptEditForm(f => ({ ...f, teacherSearch: e.target.value, headId: '' }))}
              onFocus={() => { if (!deptEditForm.headId) setDeptEditForm(f => ({ ...f, teacherSearch: '' })) }} />
            {deptEditForm.headId && (
              <div style={{ background: '#d1fae5', color: '#065f46', padding: '8px 14px', borderRadius: 8, marginBottom: 8, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>✓ {deptEditForm.teachers.find(t => t.id === deptEditForm.headId)?.firstName} {deptEditForm.teachers.find(t => t.id === deptEditForm.headId)?.lastName}</span>
                <button onClick={() => setDeptEditForm(f => ({ ...f, headId: '', teacherSearch: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14, fontFamily: 'inherit', fontWeight: 700 }}>✕ Retirer</button>
              </div>
            )}
            {!deptEditForm.headId && (
              <div style={{ border: '1.5px solid #e8e0d4', borderRadius: 10, maxHeight: 180, overflowY: 'auto' }}>
                {(deptEditForm.teacherSearch
                  ? deptEditForm.teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(deptEditForm.teacherSearch.toLowerCase()))
                  : deptEditForm.teachers
                ).length === 0
                  ? <div style={{ padding: '14px', textAlign: 'center', color: '#a89478', fontSize: 14 }}>Aucun enseignant</div>
                  : (deptEditForm.teacherSearch
                    ? deptEditForm.teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(deptEditForm.teacherSearch.toLowerCase()))
                    : deptEditForm.teachers
                  ).map(t => (
                    <div key={t.id}
                      onClick={() => setDeptEditForm(f => ({ ...f, headId: t.id, teacherSearch: `${t.firstName} ${t.lastName}` }))}
                      style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f0ebe3', color: '#1a1209' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#faf8f5'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <div style={{ fontWeight: 600 }}>{t.firstName} {t.lastName}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {deptEditForm.error && <div style={sError}>{deptEditForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setDeptEditForm(f => ({ ...f, open: false }))}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: deptEditForm.loading ? 0.7 : 1 }} onClick={submitEditDept} disabled={deptEditForm.loading}>
              {deptEditForm.loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
          <div style={{ borderTop: '1px solid #e8e0d4', marginTop: 18, paddingTop: 16 }}>
            <button onClick={() => handleDeleteDept({ id: deptEditForm.id, name: deptEditForm.name })}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: departmentHasSubjects(deptEditForm.id) ? 'not-allowed' : 'pointer',
                background: departmentHasSubjects(deptEditForm.id) ? '#f1f5f9' : '#fee2e2',
                color: departmentHasSubjects(deptEditForm.id) ? '#94a3b8' : '#dc2626',
                border: `1.5px solid ${departmentHasSubjects(deptEditForm.id) ? '#e2e8f0' : '#fecaca'}`,
              }}
              disabled={departmentHasSubjects(deptEditForm.id)}
              title={departmentHasSubjects(deptEditForm.id) ? 'Déplacez d\'abord les matières de ce département' : 'Supprimer ce département'}>
              🗑 Supprimer le département
            </button>
            {departmentHasSubjects(deptEditForm.id) && (
              <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Déplacez d'abord les matières de ce département</div>
            )}
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

// ── DnD Helper Components ──────────────────────────────────────────────────────
function DeptDroppable({ deptId, children }: { deptId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: deptId })
  return (
    <div ref={setNodeRef} style={{ position: 'relative' }}>
      {isOver && <div style={{ position: 'absolute', inset: 0, borderRadius: 16, border: '2px dashed #059669', background: 'rgba(5,150,105,0.05)', zIndex: 10, pointerEvents: 'none' }} />}
      {children}
    </div>
  )
}

function DraggableSubject({ subjectId, deptId, children }: { subjectId: string; deptId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: subjectId, data: { deptId } })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}>
      {children}
    </div>
  )
}

// ── 8 couleurs prédéfinies ────────────────────────────────────────────────────
const DEPT_COLORS = [
  { name: 'Lettres', color: '#3b82f6' },
  { name: 'Sciences Humaines', color: '#f59e0b' },
  { name: 'Langues Vivantes', color: '#10b981' },
  { name: 'Maths & Sciences', color: '#ef4444' },
  { name: 'Informatique', color: '#8b5cf6' },
  { name: 'Arts & Culture', color: '#f97316' },
  { name: 'Gris', color: '#6b7280' },
  { name: 'Personnalisé', color: '#1a1209' },
]

function DeptColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [custom, setCustom] = useState(value)
  const selected = DEPT_COLORS.find(c => c.color === value)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {DEPT_COLORS.map(c => (
          <div key={c.color} onClick={() => onChange(c.color)}
            style={{
              width: 32, height: 32, borderRadius: '50%', background: c.color, cursor: 'pointer',
              border: value === c.color ? '3px solid #1a1209' : '3px solid transparent',
              transition: 'border 0.15s',
            }} title={c.name} />
        ))}
      </div>
      {!selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="color" value={custom} onChange={e => { setCustom(e.target.value); onChange(e.target.value) }}
            style={{ width: 40, height: 32, padding: 0, border: '1.5px solid #e8e0d4', borderRadius: 6, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: '#6b5c45' }}>{custom}</span>
          <button onClick={() => onChange(custom)} style={{ ...btnSec2, padding: '4px 12px', fontSize: 13 }}>Appliquer</button>
        </div>
      )}
    </div>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <span>
      {text.slice(0, idx)}
      <strong style={{ background: '#fef3c7', color: '#92400e', padding: '1px 3px', borderRadius: 4, fontWeight: 900 }}>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </span>
  )
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 480, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {children}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const sModalTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 22 }
const sLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }
const sInput: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }
const sError: React.CSSProperties = { background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec2: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '7px 16px', borderRadius: 9, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 16, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
