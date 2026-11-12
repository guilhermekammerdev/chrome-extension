import { useEffect, useMemo, useState } from 'react'
import { ListChecks, Search, Pencil, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader, Spinner, Modal, Field, Badge, useToast } from '../components/ui'
import { TEMAS, STATUS_SOA } from '../lib/constants'

export default function SoA() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [fTema, setFTema] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [edit, setEdit] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sgsi_soa')
      .select('*, controle:sgsi_controles(codigo,titulo,tema,ordem)')
    const ordenado = (data || []).sort((a, b) => (a.controle?.ordem || 0) - (b.controle?.ordem || 0))
    setRows(ordenado)
    setLoading(false)
  }
  useEffect(() => { carregar() }, [])

  const atualizarInline = async (id, patch) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    const { error } = await supabase.from('sgsi_soa').update(patch).eq('id', id)
    if (error) { toast(error.message, 'erro'); carregar() }
  }

  const salvarDetalhe = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const { id, justificativa, responsavel, evidencia, aplicavel, status_implementacao } = edit
    const { error } = await supabase.from('sgsi_soa')
      .update({ justificativa, responsavel, evidencia, aplicavel, status_implementacao }).eq('id', id)
    setSalvando(false)
    if (error) return toast(error.message, 'erro')
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, justificativa, responsavel, evidencia, aplicavel, status_implementacao } : r)))
    toast('Controle atualizado')
    setEdit(null)
  }

  const filtrados = useMemo(() => {
    const t = busca.toLowerCase()
    return rows.filter((r) => {
      if (fTema && r.controle?.tema !== fTema) return false
      if (fStatus === 'nao_aplicavel' && r.aplicavel) return false
      if (fStatus && fStatus !== 'nao_aplicavel' && (!r.aplicavel || r.status_implementacao !== fStatus)) return false
      if (t && !r.controle?.codigo.toLowerCase().includes(t) && !r.controle?.titulo.toLowerCase().includes(t)) return false
      return true
    })
  }, [rows, busca, fTema, fStatus])

  const aplicaveis = rows.filter((r) => r.aplicavel)
  const implementados = aplicaveis.filter((r) => r.status_implementacao === 'implementado').length
  const pct = aplicaveis.length ? Math.round((implementados / aplicaveis.length) * 100) : 0

  const exportarCsv = () => {
    const head = ['Codigo', 'Tema', 'Titulo', 'Aplicavel', 'Status', 'Justificativa', 'Responsavel', 'Evidencia']
    const linhas = rows.map((r) => [
      r.controle?.codigo, r.controle?.tema, r.controle?.titulo,
      r.aplicavel ? 'Sim' : 'Nao',
      r.aplicavel ? STATUS_SOA[r.status_implementacao].label : 'Nao aplicavel',
      r.justificativa || '', r.responsavel || '', r.evidencia || '',
    ])
    const csv = [head, ...linhas].map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `SoA_ISO27001_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div>
      <PageHeader title="Declaracao de Aplicabilidade (SoA)" icon={ListChecks}
        subtitle="Os 93 controles do Anexo A da ISO/IEC 27001:2022">
        <button onClick={exportarCsv} className="btn-ghost"><Download className="h-4 w-4" /> Exportar CSV</button>
      </PageHeader>

      {/* Progresso */}
      <div className="mb-6 card p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-navy-800">Implementacao dos controles aplicaveis</span>
          <span className="text-sm font-bold text-emerald-700">{pct}% · {implementados}/{aplicaveis.length}</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input w-64 pl-9" placeholder="Buscar codigo ou titulo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select className="input w-auto" value={fTema} onChange={(e) => setFTema(e.target.value)}>
          <option value="">Todos os temas</option>
          {Object.entries(TEMAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="nao_iniciado">Nao iniciado</option>
          <option value="em_andamento">Em andamento</option>
          <option value="implementado">Implementado</option>
          <option value="nao_aplicavel">Nao aplicavel</option>
        </select>
        <span className="ml-auto text-sm text-slate-400">{filtrados.length} controles</span>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6 text-navy-600" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Controle</th>
                  <th className="px-4 py-3 text-center">Aplicavel</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responsavel</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TEMAS[r.controle?.tema]?.dot }} />
                        <div>
                          <span className="font-mono text-xs font-semibold text-navy-600">{r.controle?.codigo}</span>
                          <p className="text-slate-700">{r.controle?.titulo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={r.aplicavel} className="h-4 w-4 accent-emerald-600"
                        onChange={(e) => atualizarInline(r.id, { aplicavel: e.target.checked })} />
                    </td>
                    <td className="px-4 py-3">
                      {r.aplicavel ? (
                        <select value={r.status_implementacao} onChange={(e) => atualizarInline(r.id, { status_implementacao: e.target.value })}
                          className={`rounded-md border-0 px-2 py-1 text-xs font-semibold focus:ring-2 focus:ring-navy-300 ${STATUS_SOA[r.status_implementacao].color}`}>
                          <option value="nao_iniciado">Nao iniciado</option>
                          <option value="em_andamento">Em andamento</option>
                          <option value="implementado">Implementado</option>
                        </select>
                      ) : <Badge className="bg-slate-200 text-slate-500">Nao aplicavel</Badge>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.responsavel || <span className="text-slate-300">-</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEdit({ ...r })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700"><Pencil className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `${edit.controle?.codigo} — ${edit.controle?.titulo}` : ''}>
        {edit && (
          <form onSubmit={salvarDetalhe} className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={edit.aplicavel} className="h-4 w-4 accent-emerald-600"
                  onChange={(e) => setEdit({ ...edit, aplicavel: e.target.checked })} />
                Controle aplicavel
              </label>
              {edit.aplicavel && (
                <select className="input w-auto" value={edit.status_implementacao} onChange={(e) => setEdit({ ...edit, status_implementacao: e.target.value })}>
                  <option value="nao_iniciado">Nao iniciado</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="implementado">Implementado</option>
                </select>
              )}
            </div>
            <Field label={edit.aplicavel ? 'Justificativa de inclusao / Como e implementado' : 'Justificativa de exclusao'}>
              <textarea className="input" rows={3} value={edit.justificativa || ''} onChange={(e) => setEdit({ ...edit, justificativa: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Responsavel">
                <input className="input" value={edit.responsavel || ''} onChange={(e) => setEdit({ ...edit, responsavel: e.target.value })} />
              </Field>
              <Field label="Evidencia (documento/link)">
                <input className="input" value={edit.evidencia || ''} onChange={(e) => setEdit({ ...edit, evidencia: e.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEdit(null)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={salvando} className="btn-emerald">{salvando && <Spinner className="h-4 w-4" />} Salvar</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
