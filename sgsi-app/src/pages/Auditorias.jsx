import { useState } from 'react'
import { ClipboardCheck, Plus, Pencil, Trash2 } from 'lucide-react'
import { useTable } from '../lib/useTable'
import { PageHeader, Spinner, EmptyState, Modal, Field, Badge, useToast } from '../components/ui'
import { STATUS_AUDITORIA, TIPO_AUDITORIA, fmtData } from '../lib/constants'

const VAZIO = {
  titulo: '', tipo: 'interna', escopo: '', criterios: '', auditor_lider: '', equipe: '',
  data_inicio: '', data_fim: '', status: 'planejada', resultado: '', relatorio_url: '',
}

export default function Auditorias() {
  const { rows, loading, insert, update, remove } = useTable('sgsi_auditorias')
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [editId, setEditId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const abrirNovo = () => { setForm(VAZIO); setEditId(null); setModal(true) }
  const abrirEdicao = (r) => {
    setForm({ ...VAZIO, ...r, data_inicio: r.data_inicio || '', data_fim: r.data_fim || '' })
    setEditId(r.id); setModal(true)
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      titulo: form.titulo, tipo: form.tipo, escopo: form.escopo || null, criterios: form.criterios || null,
      auditor_lider: form.auditor_lider || null, equipe: form.equipe || null,
      data_inicio: form.data_inicio || null, data_fim: form.data_fim || null,
      status: form.status, resultado: form.resultado || null, relatorio_url: form.relatorio_url || null,
    }
    const { error } = editId ? await update(editId, payload) : await insert(payload)
    setSalvando(false)
    if (error) return toast(error.message, 'erro')
    toast(editId ? 'Auditoria atualizada' : 'Auditoria cadastrada')
    setModal(false)
  }

  const excluir = async (r) => {
    if (!confirm(`Excluir a auditoria "${r.titulo}"?`)) return
    const { error } = await remove(r.id)
    toast(error ? error.message : 'Auditoria excluida', error ? 'erro' : 'ok')
  }

  return (
    <div>
      <PageHeader title="Auditorias" icon={ClipboardCheck}
        subtitle="Programa de auditorias internas e externas (Clausula 9.2)">
        <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Nova auditoria</button>
      </PageHeader>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6 text-navy-600" /></div>
      ) : rows.length === 0 ? (
        <EmptyState message="Nenhuma auditoria planejada. Programe as auditorias internas do ciclo.">
          <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Planejar auditoria</button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs text-slate-400">AUD-{String(r.numero).padStart(3, '0')}</span>
                  <h3 className="font-bold text-navy-900">{r.titulo}</h3>
                </div>
                <Badge className={STATUS_AUDITORIA[r.status].color}>{STATUS_AUDITORIA[r.status].label}</Badge>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p><span className="text-slate-400">Tipo:</span> {TIPO_AUDITORIA[r.tipo]}</p>
                {r.auditor_lider && <p><span className="text-slate-400">Auditor lider:</span> {r.auditor_lider}</p>}
                <p><span className="text-slate-400">Periodo:</span> {fmtData(r.data_inicio)} a {fmtData(r.data_fim)}</p>
                {r.escopo && <p className="line-clamp-2"><span className="text-slate-400">Escopo:</span> {r.escopo}</p>}
              </div>
              <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-3">
                <button onClick={() => abrirEdicao(r)} className="btn-ghost px-3 py-1.5 text-xs"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                <button onClick={() => excluir(r)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar auditoria' : 'Nova auditoria'}>
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Titulo *">
            <input className="input" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required autoFocus placeholder="Ex.: Auditoria interna anual do SGSI" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <select className="input" value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
                {Object.entries(TIPO_AUDITORIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(STATUS_AUDITORIA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Auditor lider">
              <input className="input" value={form.auditor_lider} onChange={(e) => set('auditor_lider', e.target.value)} />
            </Field>
            <Field label="Equipe auditora">
              <input className="input" value={form.equipe} onChange={(e) => set('equipe', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data inicio">
              <input type="date" className="input" value={form.data_inicio} onChange={(e) => set('data_inicio', e.target.value)} />
            </Field>
            <Field label="Data fim">
              <input type="date" className="input" value={form.data_fim} onChange={(e) => set('data_fim', e.target.value)} />
            </Field>
          </div>
          <Field label="Escopo">
            <textarea className="input" rows={2} value={form.escopo} onChange={(e) => set('escopo', e.target.value)} />
          </Field>
          <Field label="Criterios de auditoria">
            <textarea className="input" rows={2} value={form.criterios} onChange={(e) => set('criterios', e.target.value)} placeholder="Ex.: ISO 27001:2022, politicas internas, requisitos legais" />
          </Field>
          <Field label="Resultado / Conclusao">
            <textarea className="input" rows={2} value={form.resultado} onChange={(e) => set('resultado', e.target.value)} />
          </Field>
          <Field label="Link do relatorio">
            <input className="input" value={form.relatorio_url} onChange={(e) => set('relatorio_url', e.target.value)} placeholder="https://..." />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-emerald">{salvando && <Spinner className="h-4 w-4" />} Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
