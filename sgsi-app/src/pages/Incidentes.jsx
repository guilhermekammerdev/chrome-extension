import { useState } from 'react'
import { Siren, Plus, Pencil, Trash2 } from 'lucide-react'
import { useTable } from '../lib/useTable'
import { PageHeader, Spinner, EmptyState, Modal, Field, Badge, useToast } from '../components/ui'
import { fmtData } from '../lib/constants'

const SEVERIDADE = {
  baixa: { label: 'Baixa', color: 'bg-emerald-100 text-emerald-800' },
  media: { label: 'Media', color: 'bg-yellow-100 text-yellow-800' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  critica: { label: 'Critica', color: 'bg-red-100 text-red-800' },
}
const STATUS = {
  aberto: { label: 'Aberto', color: 'bg-red-100 text-red-800' },
  em_analise: { label: 'Em analise', color: 'bg-amber-100 text-amber-800' },
  contido: { label: 'Contido', color: 'bg-blue-100 text-blue-800' },
  resolvido: { label: 'Resolvido', color: 'bg-emerald-100 text-emerald-800' },
  fechado: { label: 'Fechado', color: 'bg-slate-200 text-slate-500' },
}
const VAZIO = {
  titulo: '', descricao: '', categoria: '', severidade: 'media',
  data_ocorrencia: '', data_deteccao: '', status: 'aberto', responsavel: '',
  impacto: '', acoes: '', licoes_aprendidas: '',
}

export default function Incidentes() {
  const { rows, loading, insert, update, remove } = useTable('sgsi_incidentes')
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [editId, setEditId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const abrirNovo = () => { setForm(VAZIO); setEditId(null); setModal(true) }
  const abrirEdicao = (r) => {
    setForm({ ...VAZIO, ...r, data_ocorrencia: iso(r.data_ocorrencia), data_deteccao: iso(r.data_deteccao) })
    setEditId(r.id); setModal(true)
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      titulo: form.titulo, descricao: form.descricao || null, categoria: form.categoria || null,
      severidade: form.severidade, data_ocorrencia: form.data_ocorrencia || null,
      data_deteccao: form.data_deteccao || null, status: form.status, responsavel: form.responsavel || null,
      impacto: form.impacto || null, acoes: form.acoes || null, licoes_aprendidas: form.licoes_aprendidas || null,
    }
    const { error } = editId ? await update(editId, payload) : await insert(payload)
    setSalvando(false)
    if (error) return toast(error.message, 'erro')
    toast(editId ? 'Incidente atualizado' : 'Incidente registrado')
    setModal(false)
  }
  const excluir = async (r) => {
    if (!confirm(`Excluir "${r.titulo}"?`)) return
    const { error } = await remove(r.id)
    toast(error ? error.message : 'Incidente excluido', error ? 'erro' : 'ok')
  }

  return (
    <div>
      <PageHeader title="Incidentes de Seguranca" icon={Siren}
        subtitle="Registro e tratamento de incidentes (A.5.24 a A.5.28)">
        <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Novo incidente</button>
      </PageHeader>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6 text-navy-600" /></div>
      ) : rows.length === 0 ? (
        <EmptyState message="Nenhum incidente registrado."><button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Registrar incidente</button></EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Incidente</th><th className="px-4 py-3">Severidade</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ocorrencia</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">INC-{String(r.numero).padStart(3, '0')}</td>
                    <td className="px-4 py-3"><p className="font-semibold text-navy-900">{r.titulo}</p>{r.categoria && <p className="text-xs text-slate-400">{r.categoria}</p>}</td>
                    <td className="px-4 py-3"><Badge className={SEVERIDADE[r.severidade].color}>{SEVERIDADE[r.severidade].label}</Badge></td>
                    <td className="px-4 py-3"><Badge className={STATUS[r.status].color}>{STATUS[r.status].label}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{fmtData(r.data_ocorrencia)}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      <button onClick={() => abrirEdicao(r)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => excluir(r)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar incidente' : 'Novo incidente'}>
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Titulo *"><input className="input" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required autoFocus /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoria"><input className="input" value={form.categoria} onChange={(e) => set('categoria', e.target.value)} placeholder="Ex.: Phishing, Malware, Acesso indevido" /></Field>
            <Field label="Severidade"><select className="input" value={form.severidade} onChange={(e) => set('severidade', e.target.value)}>{Object.entries(SEVERIDADE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Ocorrencia"><input type="datetime-local" className="input" value={form.data_ocorrencia} onChange={(e) => set('data_ocorrencia', e.target.value)} /></Field>
            <Field label="Deteccao"><input type="datetime-local" className="input" value={form.data_deteccao} onChange={(e) => set('data_deteccao', e.target.value)} /></Field>
            <Field label="Status"><select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          </div>
          <Field label="Descricao"><textarea className="input" rows={2} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsavel"><input className="input" value={form.responsavel} onChange={(e) => set('responsavel', e.target.value)} /></Field>
            <Field label="Impacto"><input className="input" value={form.impacto} onChange={(e) => set('impacto', e.target.value)} /></Field>
          </div>
          <Field label="Acoes tomadas"><textarea className="input" rows={2} value={form.acoes} onChange={(e) => set('acoes', e.target.value)} /></Field>
          <Field label="Licoes aprendidas"><textarea className="input" rows={2} value={form.licoes_aprendidas} onChange={(e) => set('licoes_aprendidas', e.target.value)} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-emerald">{salvando && <Spinner className="h-4 w-4" />} Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 16) : '')
