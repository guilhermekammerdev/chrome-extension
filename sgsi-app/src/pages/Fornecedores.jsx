import { useState } from 'react'
import { Truck, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useTable } from '../lib/useTable'
import { PageHeader, Spinner, EmptyState, Modal, Field, Badge, useToast } from '../components/ui'
import { fmtData } from '../lib/constants'

const CRIT = {
  baixa: { label: 'Baixa', color: 'bg-emerald-100 text-emerald-800' },
  media: { label: 'Media', color: 'bg-yellow-100 text-yellow-800' },
  alta: { label: 'Alta', color: 'bg-red-100 text-red-800' },
}
const STATUS = {
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-800' },
  em_avaliacao: { label: 'Em avaliacao', color: 'bg-amber-100 text-amber-800' },
  inativo: { label: 'Inativo', color: 'bg-slate-200 text-slate-500' },
}
const VAZIO = {
  nome: '', servico: '', criticidade: 'media', contato: '', possui_contrato: false,
  possui_nda: false, avaliacao_risco: '', data_avaliacao: '', proxima_avaliacao: '', status: 'ativo',
}

export default function Fornecedores() {
  const { rows, loading, insert, update, remove } = useTable('sgsi_fornecedores')
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [editId, setEditId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const abrirNovo = () => { setForm(VAZIO); setEditId(null); setModal(true) }
  const abrirEdicao = (r) => {
    setForm({ ...VAZIO, ...r, data_avaliacao: r.data_avaliacao || '', proxima_avaliacao: r.proxima_avaliacao || '' })
    setEditId(r.id); setModal(true)
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      nome: form.nome, servico: form.servico || null, criticidade: form.criticidade,
      contato: form.contato || null, possui_contrato: form.possui_contrato, possui_nda: form.possui_nda,
      avaliacao_risco: form.avaliacao_risco || null, data_avaliacao: form.data_avaliacao || null,
      proxima_avaliacao: form.proxima_avaliacao || null, status: form.status,
    }
    const { error } = editId ? await update(editId, payload) : await insert(payload)
    setSalvando(false)
    if (error) return toast(error.message, 'erro')
    toast(editId ? 'Fornecedor atualizado' : 'Fornecedor cadastrado')
    setModal(false)
  }
  const excluir = async (r) => {
    if (!confirm(`Excluir "${r.nome}"?`)) return
    const { error } = await remove(r.id)
    toast(error ? error.message : 'Fornecedor excluido', error ? 'erro' : 'ok')
  }

  const Bool = ({ v }) => v ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-slate-300" />

  return (
    <div>
      <PageHeader title="Fornecedores e Terceiros" icon={Truck}
        subtitle="Gestao de seguranca nas relacoes com fornecedores (A.5.19 a A.5.23)">
        <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Novo fornecedor</button>
      </PageHeader>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6 text-navy-600" /></div>
      ) : rows.length === 0 ? (
        <EmptyState message="Nenhum fornecedor cadastrado."><button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Cadastrar fornecedor</button></EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Criticidade</th><th className="px-4 py-3 text-center">Contrato</th><th className="px-4 py-3 text-center">NDA</th><th className="px-4 py-3">Prox. avaliacao</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><p className="font-semibold text-navy-900">{r.nome}</p>{r.servico && <p className="text-xs text-slate-400">{r.servico}</p>}</td>
                    <td className="px-4 py-3"><Badge className={CRIT[r.criticidade].color}>{CRIT[r.criticidade].label}</Badge></td>
                    <td className="px-4 py-3"><div className="flex justify-center"><Bool v={r.possui_contrato} /></div></td>
                    <td className="px-4 py-3"><div className="flex justify-center"><Bool v={r.possui_nda} /></div></td>
                    <td className="px-4 py-3 text-slate-600">{fmtData(r.proxima_avaliacao)}</td>
                    <td className="px-4 py-3"><Badge className={STATUS[r.status].color}>{STATUS[r.status].label}</Badge></td>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar fornecedor' : 'Novo fornecedor'}>
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome *"><input className="input" value={form.nome} onChange={(e) => set('nome', e.target.value)} required autoFocus /></Field>
            <Field label="Servico prestado"><input className="input" value={form.servico} onChange={(e) => set('servico', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Criticidade"><select className="input" value={form.criticidade} onChange={(e) => set('criticidade', e.target.value)}>{Object.entries(CRIT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            <Field label="Status"><select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          </div>
          <Field label="Contato"><input className="input" value={form.contato} onChange={(e) => set('contato', e.target.value)} /></Field>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={form.possui_contrato} onChange={(e) => set('possui_contrato', e.target.checked)} /> Possui contrato</label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={form.possui_nda} onChange={(e) => set('possui_nda', e.target.checked)} /> Possui NDA (confidencialidade)</label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data da avaliacao"><input type="date" className="input" value={form.data_avaliacao} onChange={(e) => set('data_avaliacao', e.target.value)} /></Field>
            <Field label="Proxima avaliacao"><input type="date" className="input" value={form.proxima_avaliacao} onChange={(e) => set('proxima_avaliacao', e.target.value)} /></Field>
          </div>
          <Field label="Avaliacao de risco"><textarea className="input" rows={2} value={form.avaliacao_risco} onChange={(e) => set('avaliacao_risco', e.target.value)} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-emerald">{salvando && <Spinner className="h-4 w-4" />} Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
