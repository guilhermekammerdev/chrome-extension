import { useMemo, useState } from 'react'
import { FileText, Plus, Pencil, Trash2, Search, ExternalLink, AlertCircle } from 'lucide-react'
import { useTable } from '../lib/useTable'
import { PageHeader, Spinner, EmptyState, Modal, Field, Badge, useToast } from '../components/ui'
import { STATUS_DOC, TIPO_DOC, fmtData, diasAte } from '../lib/constants'

const VAZIO = {
  codigo: '', titulo: '', tipo: 'politica', versao: '1.0', status: 'rascunho',
  responsavel: '', aprovador: '', data_aprovacao: '', proxima_revisao: '', url: '', descricao: '',
}

export default function Documentos() {
  const { rows, loading, insert, update, remove } = useTable('sgsi_documentos')
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [editId, setEditId] = useState(null)
  const [busca, setBusca] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [salvando, setSalvando] = useState(false)

  const filtrados = useMemo(() => {
    const t = busca.toLowerCase()
    return rows.filter((r) => {
      if (fStatus && r.status !== fStatus) return false
      return !t || r.titulo?.toLowerCase().includes(t) || r.codigo?.toLowerCase().includes(t)
    })
  }, [rows, busca, fStatus])

  const abrirNovo = () => { setForm(VAZIO); setEditId(null); setModal(true) }
  const abrirEdicao = (r) => {
    setForm({ ...VAZIO, ...r, data_aprovacao: r.data_aprovacao || '', proxima_revisao: r.proxima_revisao || '' })
    setEditId(r.id); setModal(true)
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      codigo: form.codigo || null, titulo: form.titulo, tipo: form.tipo, versao: form.versao || null,
      status: form.status, responsavel: form.responsavel || null, aprovador: form.aprovador || null,
      data_aprovacao: form.data_aprovacao || null, proxima_revisao: form.proxima_revisao || null,
      url: form.url || null, descricao: form.descricao || null,
    }
    const { error } = editId ? await update(editId, payload) : await insert(payload)
    setSalvando(false)
    if (error) return toast(error.message, 'erro')
    toast(editId ? 'Documento atualizado' : 'Documento cadastrado')
    setModal(false)
  }

  const excluir = async (r) => {
    if (!confirm(`Excluir "${r.titulo}"?`)) return
    const { error } = await remove(r.id)
    toast(error ? error.message : 'Documento excluido', error ? 'erro' : 'ok')
  }

  return (
    <div>
      <PageHeader title="Documentos e Politicas" icon={FileText}
        subtitle="Controle de documentos do SGSI (Clausula 7.5) — versao, aprovacao e revisao">
        <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Novo documento</button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input w-64 pl-9" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select className="input w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_DOC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6 text-navy-600" /></div>
      ) : filtrados.length === 0 ? (
        <EmptyState message="Nenhum documento. Cadastre politicas, procedimentos e registros do SGSI.">
          <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Cadastrar documento</button>
        </EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-center">Versao</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Proxima revisao</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((r) => {
                  const dias = diasAte(r.proxima_revisao)
                  const vencido = dias != null && dias < 0
                  const proximo = dias != null && dias >= 0 && dias <= 30
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            {r.codigo && <span className="font-mono text-xs text-slate-400">{r.codigo}</span>}
                            <p className="font-semibold text-navy-900">{r.titulo}</p>
                          </div>
                          {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-emerald-600"><ExternalLink className="h-4 w-4" /></a>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{TIPO_DOC[r.tipo]}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{r.versao}</td>
                      <td className="px-4 py-3"><Badge className={STATUS_DOC[r.status].color}>{STATUS_DOC[r.status].label}</Badge></td>
                      <td className="px-4 py-3">
                        {r.proxima_revisao ? (
                          <span className={`inline-flex items-center gap-1 text-sm ${vencido ? 'font-semibold text-red-600' : proximo ? 'font-semibold text-amber-600' : 'text-slate-600'}`}>
                            {(vencido || proximo) && <AlertCircle className="h-3.5 w-3.5" />}
                            {fmtData(r.proxima_revisao)}
                          </span>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => abrirEdicao(r)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => excluir(r)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar documento' : 'Novo documento'}>
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <Field label="Codigo">
              <input className="input" value={form.codigo} onChange={(e) => set('codigo', e.target.value)} placeholder="POL-001" />
            </Field>
            <Field label="Titulo *">
              <input className="input" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required autoFocus />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Tipo">
              <select className="input" value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
                {Object.entries(TIPO_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Versao">
              <input className="input" value={form.versao} onChange={(e) => set('versao', e.target.value)} />
            </Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(STATUS_DOC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsavel (elaboracao)">
              <input className="input" value={form.responsavel} onChange={(e) => set('responsavel', e.target.value)} />
            </Field>
            <Field label="Aprovador">
              <input className="input" value={form.aprovador} onChange={(e) => set('aprovador', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data de aprovacao">
              <input type="date" className="input" value={form.data_aprovacao} onChange={(e) => set('data_aprovacao', e.target.value)} />
            </Field>
            <Field label="Proxima revisao">
              <input type="date" className="input" value={form.proxima_revisao} onChange={(e) => set('proxima_revisao', e.target.value)} />
            </Field>
          </div>
          <Field label="Link do documento (Drive, etc.)">
            <input className="input" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Descricao">
            <textarea className="input" rows={2} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} />
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
