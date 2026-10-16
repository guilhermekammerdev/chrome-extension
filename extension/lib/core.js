export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  domains: [],
  retentionDays: 7,
  contextHours: 8,
});

export const MAX_EVENTS = 2000;
export const TYPES = Object.freeze({
  certificate_declared: 'Uso do certificado declarado',
  navigation: 'Visita observada',
  cookie_changed: 'Alteração de cookie',
  context_ended: 'Contexto encerrado',
});

export function normalizeDomain(input) {
  const domain = String(input).trim().toLowerCase().replace(/^\./, '');
  if (!domain || /[\s/:*?@#\\]/.test(domain)) throw new Error('Informe apenas o domínio, sem protocolo, caminho ou curingas.');
  const url = new URL(`https://${domain}`);
  const host = url.hostname;
  if (host.endsWith('.') || host.length > 253 || (host !== 'localhost' && host !== '127.0.0.1' && (!host.includes('.') || /^\d+(\.\d+){3}$/.test(host)))) {
    throw new Error('Informe um domínio válido. Endereços locais aceitos: localhost e 127.0.0.1.');
  }
  if (!host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error('Domínio inválido.');
  return host;
}

export function normalizeConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('Configuração inválida.');
  if (!Array.isArray(input.domains) || input.domains.length > 100) throw new Error('Informe no máximo 100 domínios.');
  const domains = [...new Set(input.domains.filter(d => String(d).trim()).map(normalizeDomain))].sort();
  const retentionDays = Number(input.retentionDays);
  const contextHours = Number(input.contextHours);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 30) throw new Error('A retenção deve ser de 1 a 30 dias.');
  if (!Number.isInteger(contextHours) || contextHours < 1 || contextHours > 24) throw new Error('O contexto deve durar de 1 a 24 horas.');
  return { enabled: Boolean(input.enabled), domains, retentionDays, contextHours };
}

export function siteFromUrl(raw) {
  try {
    const url = new URL(raw);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if (url.username || url.password) return null;
    return { hostname: normalizeDomain(url.hostname), origin: url.origin, protocol: url.protocol };
  } catch { return null; }
}

export function matchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function isConfigured(hostname, config) {
  return config.domains.some(domain => matchesDomain(hostname, domain));
}

export function originsForDomain(domain) {
  if (domain === 'localhost' || domain === '127.0.0.1') return [`https://${domain}/*`, `http://${domain}/*`];
  return [`https://*.${domain}/*`];
}

export function contextKey(hostname, storeId) { return `${storeId}|${hostname}`; }

export function liveContext(contexts, hostname, storeId, cookieCount, now) {
  if (!Number.isInteger(cookieCount) || cookieCount < 1) return null;
  const context = contexts[contextKey(hostname, storeId)];
  if (!context || Date.parse(context.expiresAt) <= now) return null;
  return { declarationId: context.declarationId, alias: context.alias, declaredAt: context.declaredAt };
}

export function invalidateContexts(contexts, cookieDomain) {
  return Object.fromEntries(Object.entries(contexts).filter(([, context]) => !matchesDomain(context.hostname, cookieDomain)));
}

export function pruneEvents(events, retentionDays, now) {
  const cutoff = now - retentionDays * 86400000;
  return events.filter(event => Date.parse(event.at) >= cutoff).slice(-MAX_EVENTS);
}

export function normalizeAlias(value) {
  const alias = String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (!alias || alias.length > 64) throw new Error('Use um apelido de 1 a 64 caracteres, sem CPF ou dados do titular.');
  return alias;
}
