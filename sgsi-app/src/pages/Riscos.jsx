import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Plus, Pencil, Trash2, Search, Link2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTable } from '../lib/useTable'
import { PageHeader, Spinner, EmptyState, Modal, Field, Badge, useToast } from '../components/ui'
import { nivelRisco, OPCAO_TRATAMENTO, STATUS_RISCO, ESCALA_1_5, fmtData } from '../lib/constants'

const VAZIO = {
  titulo: '', descricao: '', ativo_id: '', categoria: '', ameaca: '', vulnerabilidade: '',
  probabilidade: 3, impacto: 3, opcao_tratamento: 'mitigar', plano_tratamento: '',
  prob_residual: '', impacto_residual: '', responsavel: '', prazo: '', status: 'identificado',
}

export default function Riscos() {
  const { rows, loading, refetch, insert, update, remove } = useTable('sgsi_riscos', {
    select: '*, ativo:sgsi_ativos(nome), sgsi_riscos_controles(controle_id)',
  })
  const toast = useToast()
  const [ativos, setAtivos] = useState([])
  const [controles, setControles] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [editId, setEditId] = useState(null)
  const [selControles, setSelControles] = useState([])
  const [buscaCtrl, setBuscaCtrl] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    supabase.from('sgsi_ativos').select('id,nome').order('nome').then(({ data }) => setAtivos(data || []))
    supabase.from('sgsi_controles').select('id,codigo,titulo').order('ordem').then(({ data }) => setControles(data || []))
  }, [])

  const filtrados = useMemo(() => {
    const t = busca.toLowerCase()
    return rows.filter((r) => !t || r.titulo?.toLowerCase().includes(t) || r.ativo?.nome?.toLowerCase().includes(t))
  }, [rows, busca])

  const abrirNovo = () => { setForm(VAZIO); setEditId(null); setSelControles([]); setBuscaCtrl(''); setModal(true) }
  const abrirEdicao = (r) => {
    setForm({
      ...VAZIO, ...r, ativo_id: r.ativo_id || '',
      prob_residual: r.prob_residual ?? '', impacto_residual: r.impacto_residual ?? '',
      prazo: r.prazo || '',
    })
    setEditId(r.id)
    setSelControles((r.sgsi_riscos_controles || []).map((x) => x.controle_id))
    setBuscaCtrl(''); setModal(true)
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      titulo: form.titulo, descricao: form.descricao || null, ativo_id: form.ativo_id || null,
      categoria: form.categoria || null, ameaca: form.ameaca || null, vulnerabilidade: form.vulnerabilidade || null,
      probabilidade: +form.probabilidade, impacto: +form.impacto,
      opcao_tratamento: form.opcao_tratamento, plano_tratamento: form.plano_tratamento || null,
      prob_residual: form.prob_residual ? +form.prob_residual : null,
      impacto_residual: form.impacto_residual ? +form.impacto_residual : null,
      responsavel: form.responsavel || null, prazo: form.prazo || null, status: form.status,
    }
    const { data, error } = editId ? await update(editId, payload) : await insert(payload)
    if (error) { setSalvando(false); return toast(error.message, 'erro') }

    // Sincroniza controles vinculados
    const riscoId = editId || data.id
    await supabase.from('sgsi_riscos_controles').delete().eq('risco_id', riscoId)
    if (selControles.length) {
      await supabase.from('sgsi_riscos_controles').insert(selControles.map((c) => ({ risco_id: riscoId, controle_id: c })))
    }
    await refetch()
    setSalvando(false)
    toast(editId ? 'Risco atualizado' : 'Risco cadastrado')
    setModal(false)
  }

  const excluir = async (r) => {
    if (!confirm(`Excluir o risco "${r.titulo}"?`)) return
    const { error } = await remove(r.id)
    toast(error ? error.message : 'Risco excluido', error ? 'erro' : 'ok')
  }

  const toggleCtrl = (id) => setSelControles((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])
  const ctrlFiltrados = controles.filter((c) =>
    !buscaCtrl || c.codigo.toLowerCase().includes(buscaCtrl.toLowerCase()) || c.titulo.toLowerCase().includes(buscaCtrl.toLowerCase()))

  return (
    <div>
      <PageHeader title="Gestao de Riscos" icon={AlertTriangle}
        subtitle="Identificacao, avaliacao e tratamento de riscos (Clausulas 6.1 e 8)">
        <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Novo risco</button>
      </PageHeader>

      <div className="mb-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <MatrizRisco rows={rows} />
        <div className="card p-5">
          <h3 className="mb-3 font-bold text-navy-900">Resumo</h3>
          <ResumoRiscos rows={rows} />
        </div>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar risco ou ativo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6 text-navy-600" /></div>
      ) : filtrados.length === 0 ? (
        <EmptyState message="Nenhum risco cadastrado. Identifique ameacas e vulnerabilidades sobre seus ativos.">
          <button onClick={abrirNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Cadastrar risco</button>
        </EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Risco</th>
                  <th className="px-4 py-3">Ativo</th>
                  <th className="px-4 py-3 text-center">Inerente</th>
                  <th className="px-4 py-3 text-center">Residual</th>
                  <th className="px-4 py-3">Tratamento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((r) => {
                  const ni = nivelRisco(r.nivel_inerente)
                  const temResidual = r.prob_residual && r.impacto_residual
                  const nr = nivelRisco(r.nivel_residual)
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">R-{String(r.numero).padStart(3, '0')}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-navy-900">{r.titulo}</p>
                        <p className="text-xs text-slate-400">
                          {(r.sgsi_riscos_controles || []).length > 0 && (
                            <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3" />{r.sgsi_riscos_controles.length} controle(s)</span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.ativo?.nome || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={ni.color}>{r.nivel_inerente} · {ni.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {temResidual ? <Badge className={nr.color}>{r.nivel_residual} · {nr.label}</Badge> : <span className="text-xs text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{OPCAO_TRATAMENTO[r.opcao_tratamento]}</td>
                      <td className="px-4 py-3"><Badge className={STATUS_RISCO[r.status].color}>{STATUS_RISCO[r.status].label}</Badge></td>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar risco' : 'Novo risco'} size="max-w-3xl">
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Titulo do risco *">
            <input className="input" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required autoFocus
              placeholder="Ex.: Vazamento de dados de clientes por acesso indevido" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ativo relacionado">
              <select className="input" value={form.ativo_id} onChange={(e) => set('ativo_id', e.target.value)}>
                <option value="">— selecione —</option>
                {ativos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </Field>
            <Field label="Categoria">
              <input className="input" value={form.categoria} onChange={(e) => set('categoria', e.target.value)} placeholder="Ex.: Acesso, Vazamento, Indisponibilidade" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ameaca">
              <input className="input" value={form.ameaca} onChange={(e) => set('ameaca', e.target.value)} />
            </Field>
            <Field label="Vulnerabilidade">
              <input className="input" value={form.vulnerabilidade} onChange={(e) => set('vulnerabilidade', e.target.value)} />
            </Field>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Risco inerente</p>
            <div className="grid grid-cols-3 items-end gap-4">
              <Field label="Probabilidade">
                <select className="input" value={form.probabilidade} onChange={(e) => set('probabilidade', e.target.value)}>
                  {ESCALA_1_5.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Impacto">
                <select className="input" value={form.impacto} onChange={(e) => set('impacto', e.target.value)}>
                  {ESCALA_1_5.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <div>
                <span className="label">Nivel</span>
                {(() => { const n = nivelRisco(form.probabilidade * form.impacto); return <Badge className={`${n.color} h-9 w-full justify-center`}>{form.probabilidade * form.impacto} · {n.label}</Badge> })()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Opcao de tratamento">
              <select className="input" value={form.opcao_tratamento} onChange={(e) => set('opcao_tratamento', e.target.value)}>
                {Object.entries(OPCAO_TRATAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(STATUS_RISCO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Plano de tratamento">
            <textarea className="input" rows={2} value={form.plano_tratamento} onChange={(e) => set('plano_tratamento', e.target.value)} />
          </Field>

          <div className="rounded-lg bg-emerald-50/60 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-emerald-700">Risco residual (apos tratamento)</p>
            <div className="grid grid-cols-3 items-end gap-4">
              <Field label="Prob. residual">
                <select className="input" value={form.prob_residual} onChange={(e) => set('prob_residual', e.target.value)}>
                  <option value="">—</option>
                  {ESCALA_1_5.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Impacto residual">
                <select className="input" value={form.impacto_residual} onChange={(e) => set('impacto_residual', e.target.value)}>
                  <option value="">—</option>
                  {ESCALA_1_5.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <div>
                <span className="label">Nivel</span>
                {form.prob_residual && form.impacto_residual
                  ? (() => { const n = nivelRisco(form.prob_residual * form.impacto_residual); return <Badge className={`${n.color} h-9 w-full justify-center`}>{form.prob_residual * form.impacto_residual} · {n.label}</Badge> })()
                  : <div className="flex h-9 items-center justify-center rounded-lg bg-white text-xs text-slate-400">preencher</div>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsavel">
              <input className="input" value={form.responsavel} onChange={(e) => set('responsavel', e.target.value)} />
            </Field>
            <Field label="Prazo">
              <input type="date" className="input" value={form.prazo} onChange={(e) => set('prazo', e.target.value)} />
            </Field>
          </div>

          <Field label={`Controles do Anexo A vinculados (${selControles.length})`}>
            <input className="input mb-2" placeholder="Filtrar controles..." value={buscaCtrl} onChange={(e) => setBuscaCtrl(e.target.value)} />
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {ctrlFiltrados.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={selControles.includes(c.id)} onChange={() => toggleCtrl(c.id)} className="accent-emerald-600" />
                  <span className="font-mono text-xs text-navy-600">{c.codigo}</span>
                  <span className="truncate text-slate-600">{c.titulo}</span>
                </label>
              ))}
            </div>
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

function ResumoRiscos({ rows }) {
  const bandas = { baixo: 0, moderado: 0, alto: 0, critico: 0 }
  rows.forEach((r) => {
    const nivel = (r.status === 'tratado' || r.status === 'aceito') && r.nivel_residual ? r.nivel_residual : r.nivel_inerente
    bandas[nivelRisco(nivel).band]++
  })
  const itens = [
    ['Critico', bandas.critico, 'bg-red-100 text-red-800'],
    ['Alto', bandas.alto, 'bg-orange-100 text-orange-800'],
    ['Moderado', bandas.moderado, 'bg-yellow-100 text-yellow-800'],
    ['Baixo', bandas.baixo, 'bg-emerald-100 text-emerald-800'],
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {itens.map(([label, n, cls]) => (
        <div key={label} className="rounded-lg border border-slate-200 p-3">
          <Badge className={cls}>{label}</Badge>
          <p className="mt-2 text-2xl font-bold text-navy-900">{n}</p>
        </div>
      ))}
    </div>
  )
}

function MatrizRisco({ rows }) {
  // Conta riscos por celula (probabilidade x impacto) do risco inerente
  const grid = {}
  rows.forEach((r) => {
    const k = `${r.probabilidade}-${r.impacto}`
    grid[k] = (grid[k] || 0) + 1
  })
  const probs = [5, 4, 3, 2, 1]
  const impactos = [1, 2, 3, 4, 5]
  return (
    <div className="card p-4">
      <h3 className="mb-3 font-bold text-navy-900">Matriz de risco</h3>
      <div className="flex gap-1">
        <div className="flex flex-col justify-around pr-1 text-[10px] font-semibold text-slate-400">
          <span className="rotate-0">Prob.</span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-5 gap-1">
            {probs.map((p) => impactos.map((im) => {
              const n = nivelRisco(p * im)
              const count = grid[`${p}-${im}`] || 0
              return (
                <div key={`${p}-${im}`} className="flex aspect-square items-center justify-center rounded text-xs font-bold text-white"
                  style={{ background: n.hex, opacity: count ? 1 : 0.35 }} title={`Prob ${p} x Impacto ${im} = ${p * im}`}>
                  {count || ''}
                </div>
              )
            }))}
          </div>
          <div className="mt-1 grid grid-cols-5 gap-1 text-center text-[10px] font-semibold text-slate-400">
            {impactos.map((i) => <span key={i}>{i}</span>)}
          </div>
          <p className="mt-1 text-center text-[10px] font-semibold text-slate-400">Impacto →</p>
        </div>
      </div>
    </div>
  )
}
