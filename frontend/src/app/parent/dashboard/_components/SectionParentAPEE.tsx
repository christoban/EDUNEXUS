'use client'
import { useCallback, useEffect } from 'react'
import { HandCoins, CheckCircle2, Clock, Package } from 'lucide-react'
import type { Toast } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: Toast['type']) => void
}

interface Transaction {
  id: string
  type: 'COLLECTE' | 'DEPENSE'
  montant: number
  categorie: string | null
  description: string | null
  date: string
  valide: boolean
}

interface Solde {
  totalCollectes: number
  totalDepenses: number
  solde: number
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

function chipStyle(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, borderRadius: 20, padding: '5px 12px', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }
}

interface ApeeData { solde: Solde | null; transactions: Transaction[] }

export default function SectionParentAPEE({ onToast }: Props) {
  const t = useT('parent')

  const fetchFn = useCallback(async (): Promise<ApeeData> => {
    const [rSolde, rTx] = await Promise.all([
      fetchApi('/api/v2/apee/solde', { credentials: 'include' }),
      fetchApi('/api/v2/apee/transactions', { credentials: 'include' }),
    ])
    const dSolde = await rSolde.json()
    const dTx = await rTx.json()
    if (!dSolde.success || !dTx.success) throw new Error(t('apee.loadError'))
    return { solde: dSolde.data, transactions: dTx.data }
  }, [t])

  const { data, loading, error, fromCache, cachedAt } = useCachedFetch<ApeeData>('parent-apee', fetchFn)
  const solde = data?.solde ?? null
  const transactions = data?.transactions ?? []

  useEffect(() => {
    if (error && error !== 'OFFLINE_NO_CACHE' && !data) onToast(t('apee.loadError'), 'error')
  }, [error, data, onToast, t])

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{t('apee.title')}</div>
        <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500, marginTop: 4 }}>{t('apee.subtitle')}</div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Package size={14} strokeWidth={2} /> {t('cacheBadge').replace('{date}', new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}
          </div>
        )}
      </div>

      {solde && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
          {[
            { label: t('apee.totalCollectes'), value: fmtCFA(solde.totalCollectes), color: 'var(--green)' },
            { label: t('apee.totalDepenses'), value: fmtCFA(solde.totalDepenses), color: 'var(--red)' },
            { label: t('apee.solde'), value: fmtCFA(solde.solde), color: 'var(--blue)' },
          ].map((k) => (
            <div key={k.label} style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color, marginTop: 6 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{t('apee.history')}</div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>{t('apee.loading')}</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>{t('apee.noTransactions')}</div>
        ) : (
          <div>
            {transactions.map((tx) => (
              <div key={tx.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <HandCoins size={16} color="var(--text3)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={chipStyle(tx.type === 'COLLECTE' ? 'var(--green-light)' : 'var(--red-light)', tx.type === 'COLLECTE' ? 'var(--green)' : 'var(--red)')}>
                      {tx.type === 'COLLECTE' ? t('apee.typeCollecte') : t('apee.typeDepense')}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{fmtCFA(tx.montant)}</span>
                    {tx.valide ? (
                      <span style={chipStyle('var(--green-light)', 'var(--green)')}><CheckCircle2 size={12} /> {t('apee.validated')}</span>
                    ) : (
                      <span style={chipStyle('var(--amber-light)', 'var(--amber)')}><Clock size={12} /> {t('apee.pending')}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                    {tx.categorie || '—'} {tx.description ? `· ${tx.description}` : ''} · {new Date(tx.date).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
