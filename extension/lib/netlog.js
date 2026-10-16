import { normalizeDomain } from './core.js';

export const MAX_NETLOG_BYTES = 20 * 1024 * 1024;
export const MAX_NETLOG_EVENTS = 100000;

export const TLS_STATUS = Object.freeze({
  client_certificate_tls_completed: 'TLS concluído com certificado de cliente',
  certificate_provided: 'Certificado disponibilizado à conexão TLS',
  certificate_provided_tls_failed: 'Certificado disponibilizado; conexão TLS falhou',
  no_certificate_provided: 'Nenhum certificado disponibilizado',
  certificate_requested: 'Servidor solicitou certificado',
});

// Parse only the SNI field of a TLS ClientHello. Certificate messages, cookie
// headers, certificate subjects and private-key material are never inspected.
export function clientHelloServerName(base64) {
  try {
    if (typeof base64 !== 'string' || base64.length > 100000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return null;
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    let position = 0;
    const read = length => {
      if (position + length > bytes.length) throw new Error('Truncated');
      const value = bytes.slice(position, position + length);
      position += length;
      return value;
    };
    const u8 = () => read(1)[0];
    const u16 = () => { const value = read(2); return value[0] * 256 + value[1]; };
    if (u8() !== 1) return null;
    const length = read(3).reduce((sum, value) => sum * 256 + value, 0);
    if (length !== bytes.length - 4) return null;
    read(34); // client_version and random
    const sessionLength = u8();
    if (sessionLength > 32) return null;
    read(sessionLength);
    const cipherLength = u16();
    if (!cipherLength || cipherLength % 2) return null;
    read(cipherLength);
    const compressionLength = u8();
    if (!compressionLength) return null;
    read(compressionLength);
    if (position === bytes.length) return null;
    const extensionsLength = u16();
    if (position + extensionsLength !== bytes.length) return null;
    let hostname = null;
    let sawSni = false;
    while (position < bytes.length) {
      const type = u16();
      const size = u16();
      const end = position + size;
      if (end > bytes.length) return null;
      if (type !== 0) { read(size); continue; }
      if (sawSni) return null;
      sawSni = true;
      const listLength = u16();
      if (position + listLength !== end) return null;
      while (position < end) {
        const nameType = u8();
        const nameBytes = read(u16());
        if (position > end) return null;
        if (nameType !== 0) continue;
        if (hostname || !nameBytes.length || nameBytes.some(value => value > 127)) return null;
        const name = String.fromCharCode(...nameBytes);
        // SNI carries a DNS name, never a URL, an origin or a port.
        if (!/^[a-zA-Z0-9.-]+$/.test(name)) return null;
        hostname = normalizeDomain(name);
      }
    }
    return hostname;
  } catch { return null; }
}

function timestamp(time, offset) {
  if (typeof time !== 'string' && typeof time !== 'number') return null;
  if (offset === null || (typeof time === 'string' && !time.trim()) || !Number.isFinite(Number(time))) return null;
  const value = Number(time) + offset;
  if (value < Date.UTC(2000, 0, 1) || value > Date.UTC(2100, 0, 1)) return null;
  return new Date(value).toISOString();
}

function statusOf(attempt) {
  if (attempt.certificateProvided === true) {
    if (attempt.handshake === 'failed') return 'certificate_provided_tls_failed';
    if (attempt.requested && attempt.handshake === 'completed' && attempt.signature === 'succeeded' && attempt.tlsResumed === false && attempt.completeCapture) return 'client_certificate_tls_completed';
    return 'certificate_provided';
  }
  return attempt.certificateProvided === false ? 'no_certificate_provided' : 'certificate_requested';
}

export function analyzeNetLog(log) {
  if (!log || !Array.isArray(log.events) || !log.constants?.logEventTypes || !log.constants?.logEventPhase) {
    throw new Error('Selecione um JSON NetLog do Chrome com constants e events.');
  }
  if (log.events.length > MAX_NETLOG_EVENTS) throw new Error('O diagnóstico aceita até 100.000 eventos. Faça uma captura mais curta.');
  const requiredTypes = ['SSL_CONNECT', 'SSL_CLIENT_CERT_REQUESTED', 'SSL_CLIENT_CERT_PROVIDED', 'SSL_PRIVATE_KEY_OP', 'SSL_HANDSHAKE_MESSAGE_SENT'];
  const requiredIds = requiredTypes.map(name => log.constants.logEventTypes[name]);
  if (!requiredIds.every(value => Number.isSafeInteger(value) && value >= 0) || new Set(requiredIds).size !== requiredIds.length) throw new Error('Formato de eventos NetLog não reconhecido.');
  const names = new Map(Object.entries(log.constants.logEventTypes).filter(([, value]) => Number.isSafeInteger(value)).map(([name, value]) => [value, name]));
  const phases = log.constants.logEventPhase;
  if (!Number.isSafeInteger(phases.PHASE_BEGIN) || !Number.isSafeInteger(phases.PHASE_END) || phases.PHASE_BEGIN === phases.PHASE_END) throw new Error('Formato de fases NetLog não reconhecido.');
  const rawOffset = log.constants.timeTickOffset;
  const hasOffset = (typeof rawOffset === 'string' && Boolean(rawOffset.trim())) || typeof rawOffset === 'number';
  const offset = hasOffset && Number.isFinite(Number(rawOffset)) ? Number(rawOffset) : null;
  const relevant = new Set(['SSL_CONNECT', 'SSL_CLIENT_CERT_REQUESTED', 'SSL_CLIENT_CERT_PROVIDED', 'SSL_PRIVATE_KEY_OP', 'SSL_HANDSHAKE_MESSAGE_SENT', 'SSL_ECH_CONFIG_LIST', 'SSL_ENCRYPTED_CLIENT_HELLO']);
  const current = new Map();
  const attempts = [];
  let skippedEvents = 0;
  const create = (key, event, completeCapture) => {
    const attempt = {
      connectionId: `${key}/${attempts.length + 1}`, at: timestamp(event.time, offset),
      requested: false, certificateProvided: null, certificateChainLength: null,
      handshake: 'incomplete', signature: 'unobserved', tlsResumed: null,
      completeCapture, names: new Set(), ech: false, closed: false, signatureStarted: false,
    };
    attempts.push(attempt);
    current.set(key, attempt);
    return attempt;
  };

  for (const event of log.events) {
    if (!event || !relevant.has(names.get(event.type))) continue;
    if (!Number.isSafeInteger(event.source?.id) || event.source.id < 0 || !Number.isSafeInteger(event.source?.type) || event.source.type < 0) { skippedEvents++; continue; }
    if (event.params !== undefined && (!event.params || typeof event.params !== 'object' || Array.isArray(event.params))) { skippedEvents++; continue; }
    const type = names.get(event.type);
    const key = `${event.source.type}:${event.source.id}`;
    if (type === 'SSL_CONNECT' && event.phase === phases.PHASE_BEGIN) {
      create(key, event, true);
      continue;
    }
    let attempt = current.get(key);
    if (!attempt || attempt.closed) attempt = create(key, event, false);
    const params = event.params && typeof event.params === 'object' ? event.params : {};
    if (type === 'SSL_CLIENT_CERT_REQUESTED') {
      attempt.requested = true;
      attempt.at = timestamp(event.time, offset) || attempt.at;
    } else if (type === 'SSL_CLIENT_CERT_PROVIDED') {
      const count = params.cert_count;
      if (Number.isSafeInteger(count) && (count >= 0 || count === -1)) {
        attempt.certificateProvided = count !== 0;
        attempt.certificateChainLength = count >= 0 ? count : null;
      }
    } else if (type === 'SSL_HANDSHAKE_MESSAGE_SENT' && params.type === 1) {
      const hostname = clientHelloServerName(params.bytes);
      if (hostname) attempt.names.add(hostname);
    } else if (type === 'SSL_ECH_CONFIG_LIST' || type === 'SSL_ENCRYPTED_CLIENT_HELLO') {
      attempt.ech = true;
    } else if (type === 'SSL_PRIVATE_KEY_OP' && event.phase === phases.PHASE_BEGIN) {
      attempt.signatureStarted = true;
    } else if (type === 'SSL_PRIVATE_KEY_OP' && event.phase === phases.PHASE_END) {
      if (attempt.signatureStarted && (params.net_error === undefined || params.net_error === 0)) attempt.signature = 'succeeded';
      else if (typeof params.net_error === 'number' && params.net_error < 0) attempt.signature = 'failed';
      attempt.signatureStarted = false;
    } else if (type === 'SSL_CONNECT' && event.phase === phases.PHASE_END) {
      if (typeof params.net_error === 'number' && params.net_error < 0) attempt.handshake = 'failed';
      else if ((params.net_error === undefined || params.net_error === 0) && /^TLS[ v]*1\.[0-3]$/i.test(params.version || '')) attempt.handshake = 'completed';
      if (typeof params.is_resumed === 'boolean') attempt.tlsResumed = params.is_resumed;
      if (params.encrypted_client_hello === true) attempt.ech = true;
      attempt.closed = true;
    }
  }

  const signals = attempts.filter(attempt => attempt.requested || attempt.certificateProvided !== null);
  if (signals.length > 500) throw new Error('Mais de 500 conexões com sinais de certificado. Reduza o período da captura.');
  const connections = signals.map(attempt => ({
    connectionId: attempt.connectionId,
    at: attempt.at,
    hostname: !attempt.ech && attempt.names.size === 1 ? [...attempt.names][0] : null,
    hostResolution: attempt.ech ? 'ech_unresolved' : attempt.names.size > 1 ? 'ambiguous' : attempt.names.size === 1 ? 'client_hello_sni' : 'unavailable',
    requested: attempt.requested, certificateProvided: attempt.certificateProvided,
    certificateChainLength: attempt.certificateChainLength,
    handshake: attempt.handshake, signature: attempt.signature, tlsResumed: attempt.tlsResumed,
    completeCapture: attempt.completeCapture, status: statusOf(attempt),
    certificateIdentity: 'unknown', sessionReuse: 'unproven',
  }));

  return {
    schemaVersion: 1, source: 'imported_chrome_netlog',
    notice: 'Diagnóstico de arquivo local, editável. Certificado disponibilizado não identifica o A1 e não comprova login no portal. SNI identifica o nome TLS, não a URL ou a aba. Não comprova continuidade de sessão por cookies.',
    summary: {
      connections: connections.length,
      certificateProvided: connections.filter(item => item.certificateProvided === true).length,
      tlsCompletedWithCertificate: connections.filter(item => item.status === 'client_certificate_tls_completed').length,
      unresolvedHosts: connections.filter(item => !item.hostname).length,
      skippedEvents,
    },
    connections,
  };
}
