import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Boxes, AlertTriangle, ListChecks, FileText,
  ClipboardCheck, ScrollText, ShieldCheck, LogOut, Menu, X, Truck, Siren, Target, Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const GRUPOS = [
  {
    titulo: 'Painel',
    itens: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    titulo: 'Planejamento e Riscos',
    itens: [
      { to: '/ativos', label: 'Inventario de Ativos', icon: Boxes },
      { to: '/riscos', label: 'Gestao de Riscos', icon: AlertTriangle },
      { to: '/soa', label: 'Declaracao de Aplicabilidade', icon: ListChecks },
    ],
  },
  {
    titulo: 'Operacao',
    itens: [
      { to: '/documentos', label: 'Documentos e Politicas', icon: FileText },
      { to: '/incidentes', label: 'Incidentes', icon: Siren },
      { to: '/fornecedores', label: 'Fornecedores', icon: Truck },
    ],
  },
  {
    titulo: 'Avaliacao e Melhoria',
    itens: [
      { to: '/auditorias', label: 'Auditorias', icon: ClipboardCheck },
      { to: '/nao-conformidades', label: 'Nao Conformidades', icon: ScrollText },
      { to: '/objetivos', label: 'Objetivos e Indicadores', icon: Target },
    ],
  },
  {
    titulo: 'Contexto',
    itens: [{ to: '/partes-interessadas', label: 'Partes Interessadas', icon: Users }],
  },
]

function NavItems({ onNavigate }) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {GRUPOS.map((g) => (
        <div key={g.titulo}>
          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-navy-300">{g.titulo}</p>
          <div className="space-y-0.5">
            {g.itens.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'text-navy-100 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <i.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{i.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

export default function Layout({ children }) {
  const { perfil, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const sair = async () => { await signOut(); navigate('/login') }

  const Brand = (
    <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
      <div className="rounded-lg bg-emerald-500/20 p-1.5">
        <ShieldCheck className="h-6 w-6 text-emerald-400" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">SGSI</p>
        <p className="text-[11px] text-navy-300">ISO/IEC 27001:2022</p>
      </div>
    </div>
  )

  const UserBox = (
    <div className="border-t border-white/10 p-3">
      <div className="mb-2 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
          {(perfil?.nome || user?.email || '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-xs font-semibold text-white">{perfil?.nome || 'Usuario'}</p>
          <p className="truncate text-[11px] text-navy-300">{user?.email}</p>
        </div>
      </div>
      <button onClick={sair} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-navy-200 hover:bg-white/5 hover:text-white">
        <LogOut className="h-4 w-4" /> Sair
      </button>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 lg:flex">
        {Brand}
        <NavItems />
        {UserBox}
      </aside>

      {/* Sidebar mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-navy-900">
            {Brand}
            <NavItems onNavigate={() => setOpen(false)} />
            {UserBox}
          </aside>
        </div>
      )}

      {/* Conteudo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span className="font-bold text-navy-900">SGSI</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
