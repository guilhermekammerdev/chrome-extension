import { useEffect, useMemo, useState } from 'react'
import {
  ScrollText, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Wrench,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTable } from '../lib/useTable'
import { PageHeader, Spinner, EmptyState, Modal, Field, Badge, useToast } from '../components/ui'
import {
  STATUS_NC, CLASSIFICACAO_NC, ORIGEM_NC, STATUS_ACAO, EFICACIA, fmtData, diasAte,
} from '../lib/constants'

const NC_VAZIO = {
  titulo: '', descricao: '', origem: 'auditoria_interna', auditoria_id: '', controle_id: '',
  classificacao: 'menor', responsavel: '', data_identificacao: new Date().toISOString().slice(0, 10), status: 'aberta',
}
const ACAO_VAZIO = { descricao: '', analise_causa: '', tipo: 'corretiva', responsavel: '', prazo: '', status: 'planejada', data_conclusao: '', eficacia: 'pendente', evidencia: '' }

export default function NaoConformidades() {
  const { rows, loading, refetch, insert, update, remove } = useTable('sgsi_nao_conformidades', {
    select: '*, acoes:sgsi_acoes_corretivas(*), auditoria:sgsi_auditorias(titulo,numero), controle:sgsi_controles(codigo)',
  })
  const toast = useToast()
  const [auditorias, setAuditorias] = useState([])
  const [controles, setControles] = useState([])
  const [fStatus, setFStatus] = useState('')
  const [expandido, setExpandido] = useState({})
  const [ncModal, setNcModal] = useState(false)
  const [ncForm, setNcForm] = useState(NC_VAZIO)
  const [ncEditId, setNcEditId] = useState(null)
  const [acaoModal, setAcaoModal] = useState(null) // { ncId, acao? }
  const [acaoForm, setAcaoForm] = useState(ACAO_VAZIO)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('sgsi_auditorias').select('id,titulo,numero').order('numero', { ascending: false }).then(({ data }) => setAuditorias(data || []))
    supabase.from('sgsi_controles').select('id,codigo,titulo').order('ordem').then(({ data }) => setControles(data || []))
  }, [])

  const filtrados = useMemo(() => fStatus ? rows.filter((r) => r.status === fStatus) : rows, [rows, fStatus])

  // ---- NC ----
  const abrirNcNovo = () => { setNcForm(NC_VAZIO); setNcEditId(null); setNcModal(true) }
  const abrirNcEdicao = (r) => {
    setNcForm({ ...NC_VAZIO, ...r, auditoria_id: r.auditoria_id || '', controle_id: r.controle_id || '' })
    setNcEditId(r.id); setNcModal(true)
  }
  const setNc = (k, v) => setNcForm((f) => ({ ...f, [k]: v }))

  const salvarNc = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      titulo: ncForm.titulo, descricao: ncForm.descricao || null, origem: ncForm.origem,
      auditoria_id: ncForm.auditoria_id || null, controle_id: ncForm.controle_id || null,
      classificacao: ncForm.classificacao, responsavel: ncForm.responsavel || null,
      data_identificacao: ncForm.data_identificacao, status: ncForm.status,
    }
    const { error } = ncEditId ? await update(ncEditId, payload) : await insert(payload)
    setSalvando(false)
    if (error) return toast(error.message, 'erro')
    toast(ncEditId ? 'NC atualizada' : 'NC registrada')
    setNcModal(false)
  }
  const excluirNc = async (r) => {
    if (!confirm(`Excluir a NC "${r.titulo}" e suas acoes?`)) return
    const { error } = await remove(r.id)
    toast(error ? error.message : 'NC excluida', error ? 'erro' : 'ok')
  }

  // ---- Acoes ----
  const abrirAcaoNova = (ncId) => { setAcaoForm(ACAO_VAZIO); setAcaoModal({ ncId }) }
  const abrirAcaoEdicao = (ncId, acao) => {
    setAcaoForm({ ...ACAO_VAZIO, ...acao, prazo: acao.prazo || '', data_conclusao: acao.data_conclusao || '' })
    setAcaoModal({ ncId, acaoId: acao.id })
  }
  const setAc = (k, v) => setAcaoForm((f) => ({ ...f, [k]: v }))

  const salvarAcao = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      nc_id: acaoModal.ncId, descricao: acaoForm.descricao, analise_causa: acaoForm.analise_causa || null,
      tipo: acaoForm.tipo, responsavel: acaoForm.responsavel || null, prazo: acaoForm.prazo || null,
      status: acaoForm.status, data_conclusao: acaoForm.data_conclusao || null,
      eficacia: acaoForm.eficacia, evidencia: acaoForm.evidencia || null,
    }
    const { error } = acaoModal.acaoId
      ? await supabase.from('sgsi_acoes_corretivas').update(payload).eq('id', acaoModal.acaoId)
      : await supabase.from('sgsi_acoes_corretivas').insert(payload)
    setSalvando(false)
    if (error) return toast(error.message, 'erro')
    await refetch()
    toast('Acao salva')
    setAcaoModal(null)
  }
  const excluirAcao = async (id) => {
    if (!confirm('Excluir esta acao corretiva?')) return
    const { error } = await supabase.from('sgsi_acoes_corretivas').delete().eq('id', id)
    if (error) return toast(error.message, 'erro')
    await refetch(); toast('Acao excluida')
  }

  const toggle = (id) => setExpandido((e) => ({ ...e, [id]: !e[id] }))

  return (
    <div>
      <PageHeader title="Nao Conformidades" icon={ScrollText}
        subtitle="Registro de NCs e acoes corretivas (Clausula 10)">
        <button onClick={abrirNcNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Nova NC</button>
      </PageHeader>

      <div className="mb-4 flex gap-2">
        <select className="input w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_NC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6 text-navy-600" /></div>
      ) : filtrados.length === 0 ? (
        <EmptyState message="Nenhuma nao conformidade registrada.">
          <button onClick={abrirNcNovo} className="btn-emerald"><Plus className="h-4 w-4" /> Registrar NC</button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {filtrados.map((r) => {
            const aberto = expandido[r.id]
            const acoes = r.acoes || []
            return (
              <div key={r.id} className="card overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <button onClick={() => toggle(r.id)} className="mt-0.5 text-slate-400 hover:text-navy-700">
                    {aberto ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">NC-{String(r.numero).padStart(3, '0')}</span>
                      <Badge className={CLASSIFICACAO_NC[r.classificacao].color}>{CLASSIFICACAO_NC[r.classificacao].label}</Badge>
                      <Badge className={STATUS_NC[r.status].color}>{STATUS_NC[r.status].label}</Badge>
                      {r.controle && <Badge className="bg-navy-100 text-navy-700">{r.controle.codigo}</Badge>}
                    </div>
                    <h3 className="mt-1 font-semibold text-navy-900">{r.titulo}</h3>
                    <p className="text-xs text-slate-400">
                      {ORIGEM_NC[r.origem]} · {fmtData(r.data_identificacao)}
                      {r.responsavel && ` · ${r.responsavel}`}
                      {` · ${acoes.length} acao(oes)`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => abrirNcEdicao(r)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => excluirNc(r)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {aberto && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                    {r.descricao && <p className="mb-3 text-sm text-slate-600"><span className="font-semibold text-slate-500">Descricao:</span> {r.descricao}</p>}
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="flex items-center gap-1.5 text-sm font-bold text-navy-800"><Wrench className="h-4 w-4" /> Acoes corretivas</h4>
                      <button onClick={() => abrirAcaoNova(r.id)} className="btn-ghost px-3 py-1 text-xs"><Plus className="h-3.5 w-3.5" /> Acao</button>
                    </div>
                    {acoes.length === 0 ? (
                      <p className="py-3 text-center text-sm text-slate-400">Nenhuma acao. Registre a analise de causa e o plano de acao.</p>
                    ) : (
                      <div className="space-y-2">
                        {acoes.map((a) => {
                          const atrasada = a.prazo && diasAte(a.prazo) < 0 && !['concluida', 'verificada'].includes(a.status)
                          return (
                            <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-navy-900">{a.descricao}</p>
                                <div className="flex shrink-0 gap-1">
                                  <button onClick={() => abrirAcaoEdicao(r.id, a)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-navy-700"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => excluirAcao(a.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </div>
                              {a.analise_causa && <p className="mt-1 text-xs text-slate-500"><span className="font-semibold">Causa:</span> {a.analise_causa}</p>}
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                <Badge className={STATUS_ACAO[a.status].color}>{STATUS_ACAO[a.status].label}</Badge>
                                <Badge className={EFICACIA[a.eficacia].color}>Eficacia: {EFICACIA[a.eficacia].label}</Badge>
                                {a.responsavel && <span className="text-slate-400">{a.responsavel}</span>}
                                {a.prazo && <span className={atrasada ? 'font-semibold text-red-600' : 'text-slate-400'}>Prazo: {fmtData(a.prazo)}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal NC */}
      <Modal open={ncModal} onClose={() => setNcModal(false)} title={ncEditId ? 'Editar NC' : 'Nova nao conformidade'}>
        <form onSubmit={salvarNc} className="space-y-4">
          <Field label="Titulo *">
            <input className="input" value={ncForm.titulo} onChange={(e) => setNc('titulo', e.target.value)} required autoFocus />
          </Field>
          <Field label="Descricao / Evidencia objetiva">
            <textarea className="input" rows={2} value={ncForm.descricao} onChange={(e) => setNc('descricao', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Origem">
              <select className="input" value={ncForm.origem} onChange={(e) => setNc('origem', e.target.value)}>
                {Object.entries(ORIGEM_NC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Classificacao">
              <select className="input" value={ncForm.classificacao} onChange={(e) => setNc('classificacao', e.target.value)}>
                {Object.entries(CLASSIFICACAO_NC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Auditoria relacionada">
              <select className="input" value={ncForm.auditoria_id} onChange={(e) => setNc('auditoria_id', e.target.value)}>
                <option value="">—</option>
                {auditorias.map((a) => <option key={a.id} value={a.id}>AUD-{String(a.numero).padStart(3, '0')} · {a.titulo}</option>)}
              </select>
            </Field>
            <Field label="Controle do Anexo A">
              <select className="input" value={ncForm.controle_id} onChange={(e) => setNc('controle_id', e.target.value)}>
                <option value="">—</option>
                {controles.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.titulo}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Responsavel">
              <input className="input" value={ncForm.responsavel} onChange={(e) => setNc('responsavel', e.target.value)} />
            </Field>
            <Field label="Data identificacao">
              <input type="date" className="input" value={ncForm.data_identificacao} onChange={(e) => setNc('data_identificacao', e.target.value)} />
            </Field>
            <Field label="Status">
              <select className="input" value={ncForm.status} onChange={(e) => setNc('status', e.target.value)}>
                {Object.entries(STATUS_NC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setNcModal(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-emerald">{salvando && <Spinner className="h-4 w-4" />} Salvar</button>
          </div>
        </form>
      </Modal>

      {/* Modal Acao */}
      <Modal open={!!acaoModal} onClose={() => setAcaoModal(null)} title={acaoModal?.acaoId ? 'Editar acao corretiva' : 'Nova acao corretiva'}>
        <form onSubmit={salvarAcao} className="space-y-4">
          <Field label="Acao *">
            <input className="input" value={acaoForm.descricao} onChange={(e) => setAc('descricao', e.target.value)} required autoFocus />
          </Field>
          <Field label="Analise de causa raiz">
            <textarea className="input" rows={2} value={acaoForm.analise_causa} onChange={(e) => setAc('analise_causa', e.target.value)} placeholder="Ex.: 5 porques, Ishikawa..." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <select className="input" value={acaoForm.tipo} onChange={(e) => setAc('tipo', e.target.value)}>
                <option value="correcao">Correcao (imediata)</option>
                <option value="corretiva">Acao corretiva</option>
                <option value="preventiva">Acao preventiva</option>
              </select>
            </Field>
            <Field label="Responsavel">
              <input className="input" value={acaoForm.responsavel} onChange={(e) => setAc('responsavel', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prazo">
              <input type="date" className="input" value={acaoForm.prazo} onChange={(e) => setAc('prazo', e.target.value)} />
            </Field>
            <Field label="Status">
              <select className="input" value={acaoForm.status} onChange={(e) => setAc('status', e.target.value)}>
                {Object.entries(STATUS_ACAO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data de conclusao">
              <input type="date" className="input" value={acaoForm.data_conclusao} onChange={(e) => setAc('data_conclusao', e.target.value)} />
            </Field>
            <Field label="Verificacao de eficacia">
              <select className="input" value={acaoForm.eficacia} onChange={(e) => setAc('eficacia', e.target.value)}>
                {Object.entries(EFICACIA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Evidencia da eficacia">
            <input className="input" value={acaoForm.evidencia} onChange={(e) => setAc('evidencia', e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAcaoModal(null)} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-emerald">{salvando && <Spinner className="h-4 w-4" />} Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
