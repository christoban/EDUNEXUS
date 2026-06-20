'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface Book {
  id: string; title: string; author: string | null; isbn: string | null
  quantity: number; available: number; category: string | null; createdAt: string
  _count?: { loans: number }
}

interface StudentResult { id: string; firstName: string; lastName: string }

interface BookLoan {
  id: string; status: string; borrowedAt: string; dueDate: string | null; returnedAt: string | null
  book: { id: string; title: string; author: string | null; isbn: string | null }
  student: { id: string; firstName: string; lastName: string }
}

interface Pagination { total: number; page: number; pages: number }

const LOAN_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE:   { bg: '#fef3c7', color: '#92400e', label: '📖 En cours'  },
  RETURNED: { bg: '#d1fae5', color: '#065f46', label: '✓ Retourné'   },
  OVERDUE:  { bg: '#fee2e2', color: '#991b1b', label: '⏰ En retard'  },
}

const CATEGORIES = [
  'Manuel / Ouvrage au programme',
  'Roman / Œuvre littéraire au programme',
  'Lecture libre / Culture générale',
  'Référence / Encyclopédie / Dictionnaire',
  'Autre',
]

export default function SectionLibrary({ onToast }: Props) {
  const [tab, setTab]             = useState<'books' | 'loans'>('books')
  const [books, setBooks]         = useState<Book[]>([])
  const [loans, setLoans]         = useState<BookLoan[]>([])
  const [bookPag, setBookPag]     = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loanPag, setLoanPag]     = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [bookSearch, setBookSearch] = useState('')
  const [bookCategory, setBookCategory] = useState('')
  const [loanStatus, setLoanStatus] = useState('ACTIVE')
  const [returningId, setReturningId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Modal ajout livre ──
  const [addBookOpen, setAddBookOpen] = useState(false)
  const [bookForm, setBookForm] = useState({ title: '', author: '', isbn: '', quantity: '1', category: '' })
  const [savingBook, setSavingBook] = useState(false)

  // ── Modal emprunt ──
  const [borrowOpen, setBorrowOpen] = useState(false)
  const [borrowForm, setBorrowForm] = useState({ bookId: '', bookTitle: '', studentSearch: '', studentResults: [] as StudentResult[], selectedStudent: null as StudentResult | null, dueDate: '', loading: false, error: '' })

  const fetchBooks = useCallback(async (page = 1) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page) })
      if (bookSearch) params.set('search', bookSearch)
      if (bookCategory) params.set('category', bookCategory)
      const res = await fetchApi(`/api/v2/library/books?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setBooks(data.data || [])
      setBookPag(data.pagination ?? { total: 0, page, pages: 1 })
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') }
    finally { setLoading(false) }
  }, [bookSearch])

  const fetchLoans = useCallback(async (page = 1) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page) })
      if (loanStatus) params.set('status', loanStatus)
      const res = await fetchApi(`/api/v2/library/loans?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setLoans(data.data || [])
      setLoanPag(data.pagination ?? { total: 0, page, pages: 1 })
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') }
    finally { setLoading(false) }
  }, [loanStatus])

  useEffect(() => {
    if (tab === 'books') fetchBooks(1)
    else fetchLoans(1)
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const addBook = async () => {
    if (!bookForm.title.trim()) { onToast('Le titre est obligatoire', 'error'); return }
    setSavingBook(true)
    try {
      const res = await fetchApi('/api/v2/library/books', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bookForm.title.trim(), author: bookForm.author || undefined, isbn: bookForm.isbn || undefined, quantity: bookForm.quantity, category: bookForm.category || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`"${bookForm.title}" ajouté au catalogue`, 'success')
      setAddBookOpen(false)
      setBookForm({ title: '', author: '', isbn: '', quantity: '1', category: '' })
      fetchBooks(1)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setSavingBook(false) }
  }

  const searchStudents = async (q: string) => {
    if (q.trim().length < 2) { setBorrowForm(f => ({ ...f, studentResults: [] })); return }
    try {
      const res = await fetchApi(`/api/v2/users?role=STUDENT&search=${encodeURIComponent(q)}&limit=8`, { credentials: 'include' })
      const data = await res.json()
      setBorrowForm(f => ({ ...f, studentResults: data.data || [] }))
    } catch { setBorrowForm(f => ({ ...f, studentResults: [] })) }
  }

  const submitBorrow = async () => {
    if (!borrowForm.bookId || !borrowForm.selectedStudent) { setBorrowForm(f => ({ ...f, error: 'Livre et élève requis' })); return }
    setBorrowForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/library/loans', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: borrowForm.bookId, studentId: borrowForm.selectedStudent.id, dueDate: borrowForm.dueDate || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Emprunt enregistré pour ${borrowForm.selectedStudent.firstName} ${borrowForm.selectedStudent.lastName}`, 'success')
      setBorrowOpen(false)
      setBorrowForm({ bookId: '', bookTitle: '', studentSearch: '', studentResults: [], selectedStudent: null, dueDate: '', loading: false, error: '' })
      fetchBooks(1)
      if (tab === 'loans') fetchLoans(1)
    } catch (err) {
      setBorrowForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const deleteBook = async (bookId: string, bookTitle: string) => {
    if (!confirm(`Supprimer "${bookTitle}" du catalogue ?`)) return
    setDeletingId(bookId)
    try {
      const res = await fetchApi(`/api/v2/library/books/${bookId}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`"${bookTitle}" supprimé`, 'success')
      fetchBooks(bookPag.page)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setDeletingId(null) }
  }

  const returnLoan = async (loanId: string, bookTitle: string) => {
    if (!confirm(`Confirmer le retour de "${bookTitle}" ?`)) return
    setReturningId(loanId)
    try {
      const res = await fetchApi(`/api/v2/library/loans/${loanId}/return`, { method: 'PATCH', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Retour enregistré', 'success')
      fetchLoans(1)
      fetchBooks(1)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setReturningId(null) }
  }

  const totalAvailable = books.reduce((s, b) => s + b.available, 0)
  const totalBooks = books.reduce((s, b) => s + b.quantity, 0)
  const activeLoans = tab === 'loans' && loanStatus === 'ACTIVE' ? loanPag.total : null

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Bibliothèque</div>
          <div style={sSub}>Gestion du fonds documentaire et des emprunts</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnSec} onClick={() => setAddBookOpen(true)}>📚 Ajouter ouvrage</button>
          <button style={btnPrim} onClick={() => setBorrowOpen(true)}>+ Enregistrer emprunt</button>
        </div>
      </div>

      {/* KPIs */}
      {tab === 'books' && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
          {[
            { icon: '📚', bg: '#dbeafe', val: String(bookPag.total), label: 'Titres dans le catalogue', color: '#1e40af' },
            { icon: '✅', bg: '#d1fae5', val: String(totalAvailable), label: 'Exemplaires disponibles', color: '#065f46' },
            { icon: '📖', bg: '#fef3c7', val: String(totalBooks - totalAvailable), label: 'Emprunts en cours', color: '#92400e' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '18px 20px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{k.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 14, color: '#a89478', fontWeight: 600, marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#f0ebe3', padding: 5, borderRadius: 12, marginBottom: 18, width: 'fit-content' }}>
        {(['books', 'loans'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: tab === t ? 'white' : 'transparent', color: tab === t ? '#1a1209' : '#a89478', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}>
            {t === 'books' ? '📚 Catalogue' : `📖 Emprunts${activeLoans != null ? ` (${activeLoans})` : ''}`}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span><span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={() => tab === 'books' ? fetchBooks(1) : fetchLoans(1)} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {/* Catalogue */}
      {!loading && !error && tab === 'books' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 12px', flex: 1, minWidth: 180 }}>
              <span>🔍</span>
              <input value={bookSearch} onChange={e => setBookSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchBooks(1)}
                placeholder="Titre, auteur ou ISBN…"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 15, fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
            </div>
            <select value={bookCategory} onChange={e => setBookCategory(e.target.value)} style={filterSt}>
              <option value="">Toutes catégories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button style={btnSec} onClick={() => fetchBooks(1)}>Rechercher</button>
            {bookCategory && <button style={{ ...btnSec, color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }} onClick={() => { setBookCategory(''); fetchBooks(1) }}>✕ Réinitialiser</button>}
          </div>

          {books.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#a89478' }}>
              {bookSearch ? 'Aucun résultat pour cette recherche' : 'Catalogue vide — Ajoutez votre premier ouvrage'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Titre', 'Auteur', 'ISBN', 'Catégorie', 'Stock', 'Disponible', 'Actions'].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {books.map(b => (
                  <tr key={b.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209', maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                    </td>
                    <td style={tdSt}>{b.author ?? '—'}</td>
                    <td style={tdSt}>{b.isbn ? <code style={{ background: '#f0ebe3', padding: '2px 6px', borderRadius: 5, fontSize: 13 }}>{b.isbn}</code> : '—'}</td>
                    <td style={tdSt}>{b.category ?? '—'}</td>
                    <td style={tdSt}><span style={{ fontWeight: 700, color: '#1a1209' }}>{b.quantity}</span></td>
                    <td style={tdSt}>
                      <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: b.available === 0 ? '#fee2e2' : '#d1fae5', color: b.available === 0 ? '#991b1b' : '#065f46' }}>
                        {b.available === 0 ? 'Épuisé' : `${b.available} dispo.`}
                      </span>
                    </td>
                    <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
                      <button
                        style={{ padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: '#dbeafe', color: '#1e40af', border: '1px solid rgba(29,78,216,0.2)', cursor: b.available === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: b.available === 0 ? 0.5 : 1, marginRight: 6 }}
                        disabled={b.available === 0}
                        onClick={() => { setBorrowForm(f => ({ ...f, bookId: b.id, bookTitle: b.title })); setBorrowOpen(true) }}>
                        📖 Emprunter
                      </button>
                      <button
                        style={{ padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: '#fee2e2', color: '#991b1b', border: '1px solid rgba(153,27,27,0.2)', cursor: deletingId === b.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: deletingId === b.id ? 0.5 : 1 }}
                        disabled={deletingId === b.id}
                        onClick={() => deleteBook(b.id, b.title)}>
                        {deletingId === b.id ? '⏳' : '🗑️'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {bookPag.pages > 1 && (
            <div style={{ padding: '12px 18px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button style={btnSec} disabled={bookPag.page <= 1} onClick={() => fetchBooks(bookPag.page - 1)}>← Préc.</button>
              <span style={{ padding: '6px 12px', fontSize: 14, fontWeight: 700 }}>{bookPag.page}/{bookPag.pages}</span>
              <button style={btnSec} disabled={bookPag.page >= bookPag.pages} onClick={() => fetchBooks(bookPag.page + 1)}>Suiv. →</button>
            </div>
          )}
        </div>
      )}

      {/* Emprunts */}
      {!loading && !error && tab === 'loans' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={loanStatus} onChange={e => setLoanStatus(e.target.value)} style={filterSt}>
              <option value="ACTIVE">En cours</option>
              <option value="RETURNED">Retournés</option>
              <option value="OVERDUE">En retard</option>
              <option value="">Tous</option>
            </select>
            <button style={btnSec} onClick={() => fetchLoans(1)}>Filtrer</button>
          </div>

          {loans.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#a89478' }}>
              Aucun emprunt {loanStatus === 'ACTIVE' ? 'en cours' : loanStatus === 'RETURNED' ? 'retourné' : 'en retard'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Élève', 'Ouvrage', 'Emprunté le', 'Date limite', 'Statut', 'Actions'].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loans.map(l => {
                  const st = LOAN_STATUS[l.status] ?? { bg: '#f1f5f9', color: '#475569', label: l.status }
                  const isOverdue = l.status === 'ACTIVE' && l.dueDate && new Date(l.dueDate) < new Date()
                  return (
                    <tr key={l.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{l.student.firstName} {l.student.lastName}</td>
                      <td style={tdSt}>
                        <div style={{ fontWeight: 600, color: '#1a1209', fontSize: 15 }}>{l.book.title}</div>
                        {l.book.author && <div style={{ fontSize: 13, color: '#a89478' }}>{l.book.author}</div>}
                      </td>
                      <td style={tdSt}>{new Date(l.borrowedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</td>
                      <td style={tdSt}>
                        {l.dueDate ? (
                          <span style={{ fontWeight: 600, color: isOverdue ? '#dc2626' : '#6b5c45' }}>
                            {isOverdue && '⚠️ '}{new Date(l.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={tdSt}>
                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: isOverdue ? '#fee2e2' : st.bg, color: isOverdue ? '#991b1b' : st.color }}>
                          {isOverdue ? '⏰ En retard' : st.label}
                        </span>
                      </td>
                      <td style={tdSt}>
                        {l.status === 'ACTIVE' && (
                          <button
                            style={{ padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: '#d1fae5', color: '#065f46', border: '1px solid rgba(5,150,105,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                            onClick={() => returnLoan(l.id, l.book.title)}
                            disabled={returningId === l.id}>
                            {returningId === l.id ? '⏳' : '✓ Retour'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {loanPag.pages > 1 && (
            <div style={{ padding: '12px 18px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button style={btnSec} disabled={loanPag.page <= 1} onClick={() => fetchLoans(loanPag.page - 1)}>← Préc.</button>
              <span style={{ padding: '6px 12px', fontSize: 14, fontWeight: 700 }}>{loanPag.page}/{loanPag.pages}</span>
              <button style={btnSec} disabled={loanPag.page >= loanPag.pages} onClick={() => fetchLoans(loanPag.page + 1)}>Suiv. →</button>
            </div>
          )}
        </div>
      )}

      {/* Modal ajouter livre */}
      {addBookOpen && (
        <>
          <div onClick={() => setAddBookOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'white', borderRadius: 20, padding: '36px 40px', width: 480, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 22 }}>Ajouter un ouvrage</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {([
                { label: 'Titre *', key: 'title', placeholder: 'Mathématiques 1re C' },
                { label: 'Auteur', key: 'author', placeholder: 'Jean Dupont' },
                { label: 'ISBN', key: 'isbn', placeholder: '978-2-...' },
              ] as { label: string; key: keyof typeof bookForm; placeholder: string }[]).map(f => (
                <div key={f.key}>
                  <label style={labelSt}>{f.label}</label>
                  <input value={bookForm[f.key]} onChange={e => setBookForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} style={inputSt} />
                </div>
              ))}
              <div>
                <label style={labelSt}>Catégorie</label>
                <select value={bookForm.category} onChange={e => setBookForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputSt, cursor: 'pointer' }}>
                  <option value="">— Sélectionner —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Nombre d&apos;exemplaires</label>
                <input type="number" min="1" value={bookForm.quantity} onChange={e => setBookForm(p => ({ ...p, quantity: e.target.value }))} style={inputSt} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button style={btnSec} onClick={() => setAddBookOpen(false)}>Annuler</button>
              <button style={btnPrim} onClick={addBook} disabled={savingBook}>{savingBook ? '⏳' : '📚 Ajouter'}</button>
            </div>
          </div>
        </>
      )}

      {/* Modal emprunt */}
      {borrowOpen && (
        <>
          <div onClick={() => setBorrowOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'white', borderRadius: 20, padding: '36px 40px', width: 480, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 22 }}>Enregistrer un emprunt</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Livre */}
              <div>
                <label style={labelSt}>Ouvrage *</label>
                {borrowForm.bookId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#d1fae5', borderRadius: 10, border: '1.5px solid rgba(5,150,105,0.3)' }}>
                    <span style={{ fontWeight: 700, color: '#065f46', flex: 1 }}>📚 {borrowForm.bookTitle}</span>
                    <button onClick={() => setBorrowForm(f => ({ ...f, bookId: '', bookTitle: '' }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: 16 }}>✕</button>
                  </div>
                ) : (
                  <input
                    value=""
                    onChange={() => {}}
                    placeholder="Sélectionnez d'abord un livre dans le catalogue"
                    style={{ ...inputSt, cursor: 'default', background: '#f0ebe3' }}
                    readOnly
                  />
                )}
              </div>

              {/* Élève */}
              <div>
                <label style={labelSt}>Élève *</label>
                {borrowForm.selectedStudent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#d1fae5', borderRadius: 10, border: '1.5px solid rgba(5,150,105,0.3)' }}>
                    <span style={{ fontWeight: 700, color: '#065f46', flex: 1 }}>✓ {borrowForm.selectedStudent.firstName} {borrowForm.selectedStudent.lastName}</span>
                    <button onClick={() => setBorrowForm(f => ({ ...f, selectedStudent: null, studentSearch: '', studentResults: [] }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: 16 }}>✕</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      value={borrowForm.studentSearch}
                      onChange={e => { setBorrowForm(f => ({ ...f, studentSearch: e.target.value })); searchStudents(e.target.value) }}
                      placeholder="Taper le nom de l'élève…"
                      style={inputSt}
                    />
                    {borrowForm.studentResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
                        {borrowForm.studentResults.map(s => (
                          <div key={s.id}
                            onClick={() => setBorrowForm(f => ({ ...f, selectedStudent: s, studentSearch: '', studentResults: [] }))}
                            style={{ padding: '10px 14px', fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#1a1209', borderBottom: '1px solid #faf7f2' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0ebe3'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                            {s.firstName} {s.lastName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Date limite */}
              <div>
                <label style={labelSt}>Date de retour prévue</label>
                <input type="date" value={borrowForm.dueDate} onChange={e => setBorrowForm(f => ({ ...f, dueDate: e.target.value }))} style={inputSt} />
              </div>

              {borrowForm.error && (
                <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 9, fontSize: 14, fontWeight: 700, color: '#dc2626' }}>{borrowForm.error}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button style={btnSec} onClick={() => setBorrowOpen(false)}>Annuler</button>
              <button style={btnPrim} onClick={submitBorrow} disabled={borrowForm.loading || !borrowForm.bookId}>
                {borrowForm.loading ? '⏳' : '📖 Enregistrer'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, fontSize: 14, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const filterSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: '#6b5c45', outline: 'none', fontFamily: 'inherit' }
const inputSt: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e8e0d4', fontSize: 15, fontFamily: 'inherit', color: '#1a1209', outline: 'none', background: '#fafaf8', boxSizing: 'border-box' }
const labelSt: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#6b5c45', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px' }
const thSt: React.CSSProperties = { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 14px', fontSize: 15, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
