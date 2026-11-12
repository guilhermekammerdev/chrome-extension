// Rotulos, cores e utilitarios compartilhados pelo SGSI

export const TEMAS = {
  Organizacional: { label: 'Organizacional', color: 'bg-navy-100 text-navy-800', dot: '#1e3a5f' },
  Pessoas: { label: 'Pessoas', color: 'bg-amber-100 text-amber-800', dot: '#b45309' },
  Fisico: { label: 'Fisico', color: 'bg-violet-100 text-violet-800', dot: '#6d28d9' },
  Tecnologico: { label: 'Tecnologico', color: 'bg-emerald-100 text-emerald-800', dot: '#047857' },
}

export const STATUS_SOA = {
  nao_iniciado: { label: 'Nao iniciado', color: 'bg-slate-100 text-slate-700' },
  em_andamento: { label: 'Em andamento', color: 'bg-amber-100 text-amber-800' },
  implementado: { label: 'Implementado', color: 'bg-emerald-100 text-emerald-800' },
  nao_aplicavel: { label: 'Nao aplicavel', color: 'bg-slate-200 text-slate-500' },
}

export const STATUS_RISCO = {
  identificado: { label: 'Identificado', color: 'bg-slate-100 text-slate-700' },
  em_tratamento: { label: 'Em tratamento', color: 'bg-amber-100 text-amber-800' },
  tratado: { label: 'Tratado', color: 'bg-emerald-100 text-emerald-800' },
  aceito: { label: 'Aceito', color: 'bg-blue-100 text-blue-800' },
}

export const OPCAO_TRATAMENTO = {
  mitigar: 'Mitigar / Modificar',
  aceitar: 'Aceitar / Reter',
  transferir: 'Transferir / Compartilhar',
  evitar: 'Evitar',
}

export const STATUS_NC = {
  aberta: { label: 'Aberta', color: 'bg-red-100 text-red-800' },
  em_tratamento: { label: 'Em tratamento', color: 'bg-amber-100 text-amber-800' },
  concluida: { label: 'Concluida', color: 'bg-blue-100 text-blue-800' },
  verificada: { label: 'Verificada (eficaz)', color: 'bg-emerald-100 text-emerald-800' },
  cancelada: { label: 'Cancelada', color: 'bg-slate-200 text-slate-500' },
}

export const CLASSIFICACAO_NC = {
  maior: { label: 'Nao conf. maior', color: 'bg-red-100 text-red-800' },
  menor: { label: 'Nao conf. menor', color: 'bg-amber-100 text-amber-800' },
  observacao: { label: 'Observacao', color: 'bg-blue-100 text-blue-800' },
  oportunidade_melhoria: { label: 'Oportunidade de melhoria', color: 'bg-emerald-100 text-emerald-800' },
}

export const ORIGEM_NC = {
  auditoria_interna: 'Auditoria interna',
  auditoria_externa: 'Auditoria externa',
  incidente: 'Incidente',
  analise_critica: 'Analise critica',
  reclamacao: 'Reclamacao',
  outro: 'Outro',
}

export const STATUS_ACAO = {
  planejada: { label: 'Planejada', color: 'bg-slate-100 text-slate-700' },
  em_andamento: { label: 'Em andamento', color: 'bg-amber-100 text-amber-800' },
  concluida: { label: 'Concluida', color: 'bg-blue-100 text-blue-800' },
  verificada: { label: 'Verificada', color: 'bg-emerald-100 text-emerald-800' },
}

export const EFICACIA = {
  pendente: { label: 'Pendente', color: 'bg-slate-100 text-slate-700' },
  eficaz: { label: 'Eficaz', color: 'bg-emerald-100 text-emerald-800' },
  nao_eficaz: { label: 'Nao eficaz', color: 'bg-red-100 text-red-800' },
}

export const STATUS_AUDITORIA = {
  planejada: { label: 'Planejada', color: 'bg-slate-100 text-slate-700' },
  em_andamento: { label: 'Em andamento', color: 'bg-amber-100 text-amber-800' },
  concluida: { label: 'Concluida', color: 'bg-emerald-100 text-emerald-800' },
  cancelada: { label: 'Cancelada', color: 'bg-slate-200 text-slate-500' },
}

export const TIPO_AUDITORIA = {
  interna: 'Interna',
  externa: 'Externa',
  certificacao: 'Certificacao',
}

export const STATUS_DOC = {
  rascunho: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  em_revisao: { label: 'Em revisao', color: 'bg-amber-100 text-amber-800' },
  aprovado: { label: 'Aprovado', color: 'bg-emerald-100 text-emerald-800' },
  obsoleto: { label: 'Obsoleto', color: 'bg-slate-200 text-slate-500' },
}

export const TIPO_DOC = {
  politica: 'Politica',
  procedimento: 'Procedimento',
  instrucao: 'Instrucao de trabalho',
  registro: 'Registro',
  manual: 'Manual',
  outro: 'Outro',
}

export const TIPO_ATIVO = {
  informacao: 'Informacao / Dados',
  software: 'Software',
  hardware: 'Hardware',
  servico: 'Servico',
  pessoas: 'Pessoas',
  instalacao: 'Instalacao fisica',
  outro: 'Outro',
}

// Nivel de risco a partir do produto probabilidade x impacto (1..25)
export function nivelRisco(valor) {
  if (valor == null) return { label: '-', color: 'bg-slate-100 text-slate-500', band: 'na' }
  if (valor <= 4) return { label: 'Baixo', color: 'bg-emerald-100 text-emerald-800', band: 'baixo', hex: '#10b981' }
  if (valor <= 9) return { label: 'Moderado', color: 'bg-yellow-100 text-yellow-800', band: 'moderado', hex: '#eab308' }
  if (valor <= 15) return { label: 'Alto', color: 'bg-orange-100 text-orange-800', band: 'alto', hex: '#f97316' }
  return { label: 'Critico', color: 'bg-red-100 text-red-800', band: 'critico', hex: '#ef4444' }
}

export const ESCALA_1_5 = [1, 2, 3, 4, 5]

export function fmtData(d) {
  if (!d) return '-'
  const date = new Date(d)
  if (isNaN(date)) return '-'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function diasAte(d) {
  if (!d) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(d); alvo.setHours(0, 0, 0, 0)
  return Math.round((alvo - hoje) / 86400000)
}
