export function clientHello(hostname = 'portal.exemplo.com.br') {
  const name = Buffer.from(hostname, 'ascii');
  const uint16 = value => Buffer.from([value >> 8, value & 255]);
  const entry = Buffer.concat([Buffer.from([0]), uint16(name.length), name]);
  const sni = Buffer.concat([uint16(entry.length), entry]);
  const extension = Buffer.concat([uint16(0), uint16(sni.length), sni]);
  const body = Buffer.concat([
    Buffer.from([3, 3]), Buffer.alloc(32), Buffer.from([0]),
    uint16(2), Buffer.from([0x13, 1]), Buffer.from([1, 0]),
    uint16(extension.length), extension,
  ]);
  return Buffer.concat([Buffer.from([1, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255]), body]).toString('base64');
}

export function netlogFixture() {
  const logEventTypes = {
    SSL_CONNECT: 101, SSL_CLIENT_CERT_REQUESTED: 205, SSL_CLIENT_CERT_PROVIDED: 206,
    SSL_PRIVATE_KEY_OP: 207, SSL_HANDSHAKE_MESSAGE_SENT: 300,
    SSL_ECH_CONFIG_LIST: 400, SSL_ENCRYPTED_CLIENT_HELLO: 401,
    URL_REQUEST_START_JOB: 500, HTTP_TRANSACTION_SEND_REQUEST_HEADERS: 501,
  };
  const constants = {
    logEventTypes, logEventPhase: { PHASE_NONE: 0, PHASE_BEGIN: 1, PHASE_END: 2 },
    timeTickOffset: String(Date.parse('2026-10-15T15:00:00Z')),
  };
  const event = (name, phase, params, sourceId = 7) => ({
    type: logEventTypes[name], phase, source: { id: sourceId, type: 9 }, time: '1000', ...(params ? { params } : {}),
  });
  return {
    constants,
    events: [
      event('SSL_CONNECT', 1),
      event('SSL_HANDSHAKE_MESSAGE_SENT', 0, { type: 1, bytes: clientHello() }),
      event('SSL_CLIENT_CERT_REQUESTED', 0),
      event('SSL_CLIENT_CERT_PROVIDED', 0, { cert_count: 2 }),
      event('SSL_PRIVATE_KEY_OP', 1, { provider: 'SYNTHETIC_PROVIDER' }),
      event('SSL_PRIVATE_KEY_OP', 2),
      event('SSL_CONNECT', 2, { version: 'TLS 1.3', is_resumed: false }),
      event('URL_REQUEST_START_JOB', 1, { url: 'https://other.example.test/private?token=URL_SECRET' }, 99),
      event('HTTP_TRANSACTION_SEND_REQUEST_HEADERS', 0, { headers: ['Cookie: session=COOKIE_SECRET', 'Authorization: Bearer AUTH_SECRET'] }, 99),
    ],
  };
}
