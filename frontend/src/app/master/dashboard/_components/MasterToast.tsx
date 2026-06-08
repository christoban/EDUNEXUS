'use client'
import { useEffect } from 'react'
import type { Toast } from '../_types'

interface Props {
  toasts: Toast[]
  onRemove: (id: number) => void
}

const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }
const STYLES = {
  success: 'bg-[#f0fdf4] border-[rgba(5,150,105,0.3)] text-[#065f46]',
  error:   'bg-[#fef2f2] border-[rgba(220,38,38,0.3)] text-[#991b1b]',
  info:    'bg-white border-[#e8e0d4] text-[#1a1209]',
  warning: 'bg-[#fef3c7] border-[rgba(217,119,6,0.3)] text-[#92400e]',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    const t = setTimeout(onRemove, 4000)
    return () => clearTimeout(t)
  }, [onRemove])

  return (
    <div className={`flex items-center gap-[10px] px-[18px] py-[14px] rounded-[12px] border-[1.5px] min-w-[280px] max-w-[400px] text-[13px] font-bold shadow-[0_4px_20px_rgba(0,0,0,0.12)] ${STYLES[toast.type]}`}
      style={{ animation: 'slideInRight 0.3s ease' }}>
      <span className="text-[18px] flex-shrink-0">{ICONS[toast.type]}</span>
      <span>{toast.msg}</span>
    </div>
  )
}

export default function MasterToast({ toasts, onRemove }: Props) {
  if (!toasts.length) return null
  return (
    <div className="fixed top-[72px] right-6 z-[500] flex flex-col gap-2">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  )
}
