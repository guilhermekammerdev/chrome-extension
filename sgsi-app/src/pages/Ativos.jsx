import { useMemo, useState } from 'react'
import { Boxes, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useTable } from '../lib/useTable'
import { PageHeader, Spinner, EmptyState, Modal, Field, Badge, useToast } from '../components/ui'
import { TIPO_ATIVO, ESCALA_1_5 } from '../lib/constants'

const VAZIO = {
  nome: '', tipo: 'informacao', descricao: '', responsavel: '', localizacao: '',
  confidencialidade: 3, integridade: 3, disponibilidade: 3, status: 'ativo',
}

export default function Ativos() {
  const { rows, loading, insert, update, remove } = useTable('sgsi_ativos')
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [editId, setEditId] = useState(null)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)

  const filtrados = useMemo(() => {
    const t = busca.toLowerCase()
    return rows.filter((r) => !t || r.nome?.toLowerCase().includes(t) || r.responsavel?.toLowerCase().includes(t))
  }, [rows, busca])

  const abrirNovo = () => { setForm(VAZIO); setEditId(null); setModal(true) }
  const abrirEdicao = (r) => {
    setForm({ ...VAZIO, ...r }); setEditId(r.id); setModal(true)
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      nome: form.nome, tipo: form.tipo, descricao: form.descricao || null,
      responsavel: form.responsavel || null, localizacao: form.localizacao || null,
      confidencialidade: +form.confidencialidade, integridade: +form.integridade,
      disponibilidade: +form.disponibilidade, status: form.status,
    }
    const { error } = editId ? await update(editId, payload) : await insert(payload)
    setSalvando(false)
    if (error) return toast(error.message, 'erro')
    toast(editId ? 'Ativo atualizado' : 'Ativo cadastrado')
    setModal(false)
  }

  const excluir = async (r) => {
    if (!confirm(`Excluir o ativo "${r.nome}"?`)) return
    const { error } = await remove(r.id)
    toast(error ? error.message : 'Ativo excluido', error ? 'erro' : 'ok')
  }

  return (
    <div>
      <PageHeader title="Inventario de Ativos" icon={Boxes}
        subtitle="Ativos de informacao e sua classificacao (Confidencialidade, Integridade, Disponibilidade)">
        <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Novo ativo</button>
      </PageHeader>

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar por nome ou responsavel..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6 text-navy-600" /></div>
      ) : filtrados.length === 0 ? (
        <EmptyState message="Nenhum ativo cadastrado. Comece pelo inventario de ativos — ele e a base da analise de riscos.">
          <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Cadastrar ativo</button>
        </EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ativo</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Responsavel</th>
                  <th className="px-4 py-3 text-center">C</th>
                  <th className="px-4 py-3 text-center">I</th>
                  <th className="px-4 py-3 text-center">D</th>
                  <th className="px-4 py-3 text-center">Criticidade</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-navy-900">{r.nome}</p>
                      {r.localizacao && <p className="text-xs text-slate-400">{r.localizacao}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{TIPO_ATIVO[r.tipo] || r.tipo}</td>
                    <td className="px-4 py-3 text-slate-600">{r.responsavel || '-'}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.confidencialidade}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.integridade}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.disponibilidade}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={critColor(r.criticidade)}>{r.criticidade}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => abrirEdicao(r)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => excluir(r)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar ativo' : 'Novo ativo'}>
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Nome do ativo *">
            <input className="input" value={form.nome} onChange={(e) => set('nome', e.target.value)} required autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <select className="input" value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
                {Object.entries(TIPO_ATIVO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Responsavel">
              <input className="input" value={form.responsavel} onChange={(e) => set('responsavel', e.target.value)} />
            </Field>
          </div>
          <Field label="Localizacao / Onde reside">
            <input className="input" value={form.localizacao} onChange={(e) => set('localizacao', e.target.value)} placeholder="Ex.: Servidor AWS, Google Drive, Sala 2..." />
          </Field>
          <Field label="Descricao">
            <textarea className="input" rows={2} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Confidencialidade" hint="1=baixa, 5=alta">
              <select className="input" value={form.confidencialidade} onChange={(e) => set('confidencialidade', e.target.value)}>
                {ESCALA_1_5.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Integridade" hint="1=baixa, 5=alta">
              <select className="input" value={form.integridade} onChange={(e) => set('integridade', e.target.value)}>
                {ESCALA_1_5.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Disponibilidade" hint="1=baixa, 5=alta">
              <select className="input" value={form.disponibilidade} onChange={(e) => set('disponibilidade', e.target.value)}>
                {ESCALA_1_5.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
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

function critColor(v) {
  if (v >= 5) return 'bg-red-100 text-red-800'
  if (v >= 4) return 'bg-orange-100 text-orange-800'
  if (v >= 3) return 'bg-yellow-100 text-yellow-800'
  return 'bg-emerald-100 text-emerald-800'
}
