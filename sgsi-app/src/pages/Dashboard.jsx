import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell as BCell,
} from 'recharts'
import {
  ShieldCheck, AlertTriangle, ScrollText, FileText, ClipboardCheck, ArrowRight, TrendingUp,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader, StatCard, Spinner, Badge } from '../components/ui'
import { nivelRisco, STATUS_SOA, TEMAS, fmtData, diasAte } from '../lib/constants'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState(null)

  useEffect(() => {
    (async () => {
      const [soa, controles, riscos, ncs, acoes, docs, auds] = await Promise.all([
        supabase.from('sgsi_soa').select('aplicavel,status_implementacao'),
        supabase.from('sgsi_controles').select('id,tema'),
        supabase.from('sgsi_riscos').select('titulo,nivel_inerente,nivel_residual,status,prazo'),
        supabase.from('sgsi_nao_conformidades').select('numero,titulo,status,classificacao,data_identificacao'),
        supabase.from('sgsi_acoes_corretivas').select('descricao,status,prazo'),
        supabase.from('sgsi_documentos').select('titulo,status,proxima_revisao'),
        supabase.from('sgsi_auditorias').select('status'),
      ])
      setD({
        soa: soa.data || [], controles: controles.data || [], riscos: riscos.data || [],
        ncs: ncs.data || [], acoes: acoes.data || [], docs: docs.data || [], auds: auds.data || [],
      })
      setLoading(false)
    })()
  }, [])

  if (loading)
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-7 w-7 text-navy-600" /></div>

  // --- SoA ---
  const aplicaveis = d.soa.filter((s) => s.aplicavel)
  const implementados = aplicaveis.filter((s) => s.status_implementacao === 'implementado').length
  const pctSoA = aplicaveis.length ? Math.round((implementados / aplicaveis.length) * 100) : 0
  const soaStatus = ['nao_iniciado', 'em_andamento', 'implementado', 'nao_aplicavel'].map((k) => ({
    key: k, name: STATUS_SOA[k].label,
    value: d.soa.filter((s) => (k === 'nao_aplicavel' ? !s.aplicavel : s.aplicavel && s.status_implementacao === k)).length,
  })).filter((x) => x.value > 0)
  const soaColors = { nao_iniciado: '#cbd5e1', em_andamento: '#f59e0b', implementado: '#10b981', nao_aplicavel: '#94a3b8' }

  // --- Riscos ---
  const riscosBandas = { baixo: 0, moderado: 0, alto: 0, critico: 0 }
  d.riscos.forEach((r) => {
    const nivel = r.status === 'tratado' || r.status === 'aceito' ? r.nivel_residual : r.nivel_inerente
    riscosBandas[nivelRisco(nivel).band] = (riscosBandas[nivelRisco(nivel).band] || 0) + 1
  })
  const riscosChart = [
    { name: 'Baixo', value: riscosBandas.baixo, hex: '#10b981' },
    { name: 'Moderado', value: riscosBandas.moderado, hex: '#eab308' },
    { name: 'Alto', value: riscosBandas.alto, hex: '#f97316' },
    { name: 'Critico', value: riscosBandas.critico, hex: '#ef4444' },
  ]
  const riscosAltos = riscosBandas.alto + riscosBandas.critico

  // --- Pendencias ---
  const ncsAbertas = d.ncs.filter((n) => ['aberta', 'em_tratamento'].includes(n.status))
  const acoesAtrasadas = d.acoes.filter((a) => a.status !== 'verificada' && a.status !== 'concluida' && a.prazo && diasAte(a.prazo) < 0)
  const docsRever = d.docs.filter((x) => x.proxima_revisao && diasAte(x.proxima_revisao) <= 30)
  const audsAndamento = d.auds.filter((a) => a.status === 'em_andamento' || a.status === 'planejada').length

  return (
    <div>
      <PageHeader title="Painel de Conformidade" icon={ShieldCheck}
        subtitle="Visao geral do Sistema de Gestao de Seguranca da Informacao" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Conformidade SoA" value={`${pctSoA}%`} hint={`${implementados}/${aplicaveis.length} controles aplicaveis`} icon={TrendingUp} accent="emerald" />
        <StatCard label="Riscos alto/critico" value={riscosAltos} hint={`${d.riscos.length} riscos no total`} icon={AlertTriangle} accent={riscosAltos ? 'red' : 'emerald'} />
        <StatCard label="NCs abertas" value={ncsAbertas.length} hint={`${d.ncs.length} registradas`} icon={ScrollText} accent={ncsAbertas.length ? 'amber' : 'emerald'} />
        <StatCard label="Auditorias ativas" value={audsAndamento} hint="planejadas + em andamento" icon={ClipboardCheck} accent="navy" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* SoA progresso */}
        <div className="card p-5">
          <h3 className="mb-1 font-bold text-navy-900">Declaracao de Aplicabilidade</h3>
          <p className="mb-4 text-xs text-slate-500">Status de implementacao dos 93 controles do Anexo A</p>
          <div className="flex items-center gap-6">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={soaStatus} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2}>
                    {soaStatus.map((s) => <Cell key={s.key} fill={soaColors[s.key]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {soaStatus.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: soaColors[s.key] }} />
                    {s.name}
                  </span>
                  <span className="font-semibold text-navy-900">{s.value}</span>
                </div>
              ))}
              <Link to="/soa" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">
                Abrir SoA <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Riscos por nivel */}
        <div className="card p-5">
          <h3 className="mb-1 font-bold text-navy-900">Riscos por nivel</h3>
          <p className="mb-4 text-xs text-slate-500">Considera o risco residual quando ja tratado</p>
          {d.riscos.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-slate-400">Nenhum risco cadastrado ainda</div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer>
                <BarChart data={riscosChart}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {riscosChart.map((e, i) => <BCell key={i} fill={e.hex} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <Link to="/riscos" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">
            Gerir riscos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Controles por tema */}
      <div className="mt-6 card p-5">
        <h3 className="mb-4 font-bold text-navy-900">Controles do Anexo A por tema</h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Object.entries(TEMAS).map(([k, v]) => {
            const total = d.controles.filter((c) => c.tema === k).length
            return (
              <div key={k} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: v.dot }} />
                  <span className="text-sm font-semibold text-navy-800">{v.label}</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-navy-900">{total}</p>
                <p className="text-xs text-slate-400">controles</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pendencias */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <PendenciaCard titulo="NCs em aberto" to="/nao-conformidades" vazio="Nenhuma NC em aberto"
          itens={ncsAbertas.slice(0, 5).map((n) => ({ chave: n.numero, texto: n.titulo, extra: fmtData(n.data_identificacao) }))} />
        <PendenciaCard titulo="Acoes corretivas atrasadas" to="/nao-conformidades" vazio="Nenhuma acao atrasada"
          itens={acoesAtrasadas.slice(0, 5).map((a, i) => ({ chave: i, texto: a.descricao, extra: `venceu ${fmtData(a.prazo)}`, alerta: true }))} />
        <PendenciaCard titulo="Documentos a revisar (30d)" to="/documentos" vazio="Nenhum documento proximo da revisao"
          itens={docsRever.slice(0, 5).map((x, i) => ({ chave: i, texto: x.titulo, extra: fmtData(x.proxima_revisao), alerta: diasAte(x.proxima_revisao) < 0 }))} />
      </div>
    </div>
  )
}

function PendenciaCard({ titulo, itens, to, vazio }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-navy-900">{titulo}</h3>
        <Link to={to} className="text-xs font-semibold text-emerald-700 hover:underline">ver tudo</Link>
      </div>
      {itens.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">{vazio}</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((i) => (
            <li key={i.chave} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 text-sm last:border-0">
              <span className="line-clamp-2 text-slate-700">{i.texto}</span>
              <Badge className={i.alerta ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}>{i.extra}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
