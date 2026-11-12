import { useState } from 'react'
import { Target, Plus, Pencil, Trash2 } from 'lucide-react'
import { useTable } from '../lib/useTable'
import { PageHeader, Spinner, EmptyState, Modal, Field, Badge, useToast } from '../components/ui'

const STATUS = {
  no_prazo: { label: 'No prazo', color: 'bg-blue-100 text-blue-800' },
  atrasado: { label: 'Atrasado', color: 'bg-amber-100 text-amber-800' },
  atingido: { label: 'Atingido', color: 'bg-emerald-100 text-emerald-800' },
  nao_atingido: { label: 'Nao atingido', color: 'bg-red-100 text-red-800' },
}
const VAZIO = { descricao: '', indicador: '', meta: '', valor_atual: '', unidade: '', periodicidade: '', responsavel: '', status: 'no_prazo' }

export default function Objetivos() {
  const { rows, loading, insert, update, remove } = useTable('sgsi_objetivos')
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [editId, setEditId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const abrirNovo = () => { setForm(VAZIO); setEditId(null); setModal(true) }
  const abrirEdicao = (r) => { setForm({ ...VAZIO, ...r }); setEditId(r.id); setModal(true) }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      descricao: form.descricao, indicador: form.indicador || null, meta: form.meta || null,
      valor_atual: form.valor_atual || null, unidade: form.unidade || null,
      periodicidade: form.periodicidade || null, responsavel: form.responsavel || null, status: form.status,
    }
    const { error } = editId ? await update(editId, payload) : await insert(payload)
    setSalvando(false)
    if (error) return toast(error.message, 'erro')
    toast(editId ? 'Objetivo atualizado' : 'Objetivo cadastrado')
    setModal(false)
  }
  const excluir = async (r) => {
    if (!confirm('Excluir este objetivo?')) return
    const { error } = await remove(r.id)
    toast(error ? error.message : 'Objetivo excluido', error ? 'erro' : 'ok')
  }

  return (
    <div>
      <PageHeader title="Objetivos e Indicadores" icon={Target}
        subtitle="Objetivos de seguranca da informacao e monitoramento (Clausulas 6.2 e 9.1)">
        <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Novo objetivo</button>
      </PageHeader>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6 text-navy-600" /></div>
      ) : rows.length === 0 ? (
        <EmptyState message="Nenhum objetivo definido. Estabeleca objetivos mensuraveis de seguranca da informacao.">
          <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Definir objetivo</button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-bold text-navy-900">{r.descricao}</h3>
                <Badge className={STATUS[r.status].color}>{STATUS[r.status].label}</Badge>
              </div>
              {r.indicador && <p className="text-sm text-slate-500">Indicador: {r.indicador}</p>}
              <div className="mt-3 flex items-end gap-4">
                <div><p className="text-xs text-slate-400">Meta</p><p className="text-lg font-bold text-navy-900">{r.meta || '-'} <span className="text-xs font-normal text-slate-400">{r.unidade}</span></p></div>
                <div><p className="text-xs text-slate-400">Atual</p><p className="text-lg font-bold text-emerald-700">{r.valor_atual || '-'} <span className="text-xs font-normal text-slate-400">{r.unidade}</span></p></div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                <span>{r.periodicidade} {r.responsavel && `· ${r.responsavel}`}</span>
                <div className="flex gap-1">
                  <button onClick={() => abrirEdicao(r)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-navy-700"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => excluir(r)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar objetivo' : 'Novo objetivo'}>
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Objetivo *"><input className="input" value={form.descricao} onChange={(e) => set('descricao', e.target.value)} required autoFocus placeholder="Ex.: Reduzir incidentes de phishing" /></Field>
          <Field label="Indicador"><input className="input" value={form.indicador} onChange={(e) => set('indicador', e.target.value)} placeholder="Ex.: Nº de incidentes de phishing/mes" /></Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Meta"><input className="input" value={form.meta} onChange={(e) => set('meta', e.target.value)} /></Field>
            <Field label="Valor atual"><input className="input" value={form.valor_atual} onChange={(e) => set('valor_atual', e.target.value)} /></Field>
            <Field label="Unidade"><input className="input" value={form.unidade} onChange={(e) => set('unidade', e.target.value)} placeholder="%, un, dias" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Periodicidade"><input className="input" value={form.periodicidade} onChange={(e) => set('periodicidade', e.target.value)} placeholder="Mensal, Trimestral" /></Field>
            <Field label="Responsavel"><input className="input" value={form.responsavel} onChange={(e) => set('responsavel', e.target.value)} /></Field>
            <Field label="Status"><select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-emerald">{salvando && <Spinner className="h-4 w-4" />} Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
