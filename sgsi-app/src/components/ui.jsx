import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { X, Loader2, Inbox, CheckCircle2, AlertTriangle } from 'lucide-react'

export function Badge({ children, className = '' }) {
  return <span className={`chip ${className}`}>{children}</span>
}

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin ${className}`} />
}

export function PageHeader({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-900">
          {Icon && <Icon className="h-6 w-6 text-navy-600" />} {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, icon: Icon, accent = 'navy' }) {
  const accents = {
    navy: 'text-navy-600 bg-navy-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
    violet: 'text-violet-600 bg-violet-50',
  }
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && (
          <div className={`rounded-lg p-2 ${accents[accent] || accents.navy}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ message = 'Nenhum registro ainda.', children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 py-14 text-center">
      <Inbox className="h-10 w-10 text-slate-300" />
      <p className="text-sm text-slate-500">{message}</p>
      {children}
    </div>
  )
}

export function Field({ label, children, className = '', hint }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, size = 'max-w-2xl' }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/50 p-4 backdrop-blur-sm">
      <div className={`card my-8 w-full ${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-base font-bold text-navy-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx) || (() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((msg, tipo = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, msg, tipo }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
              t.tipo === 'erro' ? 'bg-red-600' : 'bg-emerald-600'
            }`}
          >
            {t.tipo === 'erro' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
