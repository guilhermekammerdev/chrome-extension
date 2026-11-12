import { useState } from 'react'
import { Users, Plus, Pencil, Trash2 } from 'lucide-react'
import { useTable } from '../lib/useTable'
import { PageHeader, Spinner, EmptyState, Modal, Field, Badge, useToast } from '../components/ui'

const TIPO = {
  interna: { label: 'Interna', color: 'bg-navy-100 text-navy-700' },
  externa: { label: 'Externa', color: 'bg-emerald-100 text-emerald-800' },
}
const VAZIO = { nome: '', tipo: 'externa', necessidades: '', expectativas: '' }

export default function PartesInteressadas() {
  const { rows, loading, insert, update, remove } = useTable('sgsi_partes_interessadas')
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
    const payload = { nome: form.nome, tipo: form.tipo, necessidades: form.necessidades || null, expectativas: form.expectativas || null }
    const { error } = editId ? await update(editId, payload) : await insert(payload)
    setSalvando(false)
    if (error) return toast(error.message, 'erro')
    toast(editId ? 'Parte interessada atualizada' : 'Parte interessada cadastrada')
    setModal(false)
  }
  const excluir = async (r) => {
    if (!confirm(`Excluir "${r.nome}"?`)) return
    const { error } = await remove(r.id)
    toast(error ? error.message : 'Registro excluido', error ? 'erro' : 'ok')
  }

  return (
    <div>
      <PageHeader title="Partes Interessadas" icon={Users}
        subtitle="Necessidades e expectativas das partes interessadas (Clausula 4.2)">
        <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Nova parte</button>
      </PageHeader>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6 text-navy-600" /></div>
      ) : rows.length === 0 ? (
        <EmptyState message="Nenhuma parte interessada mapeada. Ex.: clientes, colaboradores, orgaos reguladores, fornecedores.">
          <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Cadastrar</button>
        </EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Parte interessada</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Necessidades</th><th className="px-4 py-3">Expectativas</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3 font-semibold text-navy-900">{r.nome}</td>
                    <td className="px-4 py-3"><Badge className={TIPO[r.tipo].color}>{TIPO[r.tipo].label}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{r.necessidades || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.expectativas || '-'}</td>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar parte interessada' : 'Nova parte interessada'}>
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-[1fr_140px] gap-4">
            <Field label="Nome *"><input className="input" value={form.nome} onChange={(e) => set('nome', e.target.value)} required autoFocus /></Field>
            <Field label="Tipo"><select className="input" value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>{Object.entries(TIPO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          </div>
          <Field label="Necessidades"><textarea className="input" rows={2} value={form.necessidades} onChange={(e) => set('necessidades', e.target.value)} /></Field>
          <Field label="Expectativas"><textarea className="input" rows={2} value={form.expectativas} onChange={(e) => set('expectativas', e.target.value)} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-emerald">{salvando && <Spinner className="h-4 w-4" />} Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
