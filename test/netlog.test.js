import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeNetLog, clientHelloServerName, MAX_NETLOG_EVENTS } from '../extension/lib/netlog.js';
import { clientHello, netlogFixture } from './fixtures/netlog-fixture.js';

const byType = (log, name) => log.events.find(event => event.type === log.constants.logEventTypes[name]);

test('TLS ClientHello parser extracts only a DNS SNI and rejects malformed payloads', () => {
  assert.equal(clientHelloServerName(clientHello('sso.acesso.gov.br')), 'sso.acesso.gov.br');
  assert.equal(clientHelloServerName(clientHello('PORTAL.Exemplo.com.br')), 'portal.exemplo.com.br');
  for (const value of ['', 'not base64!', 'AA==', clientHello().slice(0, -8), clientHello('https://evil.test/a'), clientHello('foo..test')]) assert.equal(clientHelloServerName(value), null);
  const truncated = Buffer.from(clientHello(), 'base64');
  truncated[3] = 1;
  assert.equal(clientHelloServerName(truncated.toString('base64')), null);
});

test('technical TLS evidence requires certificate, signing operation and a complete, non-resumed handshake', () => {
  const result = analyzeNetLog(netlogFixture());
  assert.equal(result.connections.length, 1);
  const [connection] = result.connections;
  assert.equal(connection.status, 'client_certificate_tls_completed');
  assert.equal(connection.hostname, 'portal.exemplo.com.br');
  assert.equal(connection.at, '2026-10-15T15:00:01.000Z');
  assert.equal(connection.signature, 'succeeded');
  assert.equal(connection.certificateChainLength, 2);
  assert.equal(connection.certificateIdentity, 'unknown');
  assert.equal(connection.sessionReuse, 'unproven');
  assert.equal(result.summary.tlsCompletedWithCertificate, 1);
});

test('certificate count zero is never counted as certificate use, including when TLS completes', () => {
  const log = netlogFixture();
  byType(log, 'SSL_CLIENT_CERT_PROVIDED').params.cert_count = 0;
  const result = analyzeNetLog(log);
  assert.equal(result.connections[0].status, 'no_certificate_provided');
  assert.equal(result.summary.certificateProvided, 0);
  assert.equal(result.summary.tlsCompletedWithCertificate, 0);
});

test('a requested certificate without a provided event remains only a request', () => {
  const log = netlogFixture();
  log.events = log.events.filter(event => event.type !== log.constants.logEventTypes.SSL_CLIENT_CERT_PROVIDED);
  const [connection] = analyzeNetLog(log).connections;
  assert.equal(connection.status, 'certificate_requested');
  assert.equal(connection.certificateProvided, null);
});

test('unknown certificate-chain length is handled without inventing certificate identity', () => {
  const log = netlogFixture();
  byType(log, 'SSL_CLIENT_CERT_PROVIDED').params.cert_count = -1;
  const [connection] = analyzeNetLog(log).connections;
  assert.equal(connection.certificateProvided, true);
  assert.equal(connection.certificateChainLength, null);
  assert.equal(connection.certificateIdentity, 'unknown');
  for (const count of [-2, '2', null]) {
    byType(log, 'SSL_CLIENT_CERT_PROVIDED').params.cert_count = count;
    assert.equal(analyzeNetLog(log).summary.tlsCompletedWithCertificate, 0);
  }
});

test('TLS failure, resumed TLS and missing completion never become a new completed certificate handshake', () => {
  for (const mode of ['failure', 'resumed', 'missing-end', 'missing-version', 'missing-begin', 'missing-private-key', 'missing-requested']) {
    const log = netlogFixture();
    const end = log.events.find(event => event.type === log.constants.logEventTypes.SSL_CONNECT && event.phase === 2);
    if (mode === 'failure') end.params = { net_error: -202 };
    if (mode === 'resumed') end.params.is_resumed = true;
    if (mode === 'missing-end') log.events = log.events.filter(event => event !== end);
    if (mode === 'missing-version') end.params = {};
    if (mode === 'missing-begin') log.events.shift();
    if (mode === 'missing-private-key') log.events = log.events.filter(event => event.type !== log.constants.logEventTypes.SSL_PRIVATE_KEY_OP);
    if (mode === 'missing-requested') log.events = log.events.filter(event => event.type !== log.constants.logEventTypes.SSL_CLIENT_CERT_REQUESTED);
    const result = analyzeNetLog(log);
    assert.equal(result.summary.tlsCompletedWithCertificate, 0, mode);
    if (mode === 'failure') assert.equal(result.connections[0].status, 'certificate_provided_tls_failed');
  }
});

test('failed private-key operations and ends without a matching begin are not successful signatures', () => {
  for (const mode of ['failure', 'missing-begin']) {
    const log = netlogFixture();
    if (mode === 'failure') log.events.find(event => event.type === log.constants.logEventTypes.SSL_PRIVATE_KEY_OP && event.phase === 2).params = { net_error: -1 };
    else log.events = log.events.filter(event => !(event.type === log.constants.logEventTypes.SSL_PRIVATE_KEY_OP && event.phase === 1));
    assert.equal(analyzeNetLog(log).summary.tlsCompletedWithCertificate, 0);
  }
});

test('source IDs and handshake cycles never share a hostname or certificate state', () => {
  const log = netlogFixture();
  byType(log, 'SSL_HANDSHAKE_MESSAGE_SENT').source.id = 88;
  assert.equal(analyzeNetLog(log).connections[0].hostname, null);
  const fresh = netlogFixture();
  const types = fresh.constants.logEventTypes;
  fresh.events.push(
    { type: types.SSL_CONNECT, phase: 1, source: { id: 7, type: 9 }, time: '2000' },
    { type: types.SSL_CLIENT_CERT_REQUESTED, phase: 0, source: { id: 7, type: 9 }, time: '2001' },
    { type: types.SSL_CLIENT_CERT_PROVIDED, phase: 0, source: { id: 7, type: 9 }, time: '2002', params: { cert_count: 0 } },
  );
  const result = analyzeNetLog(fresh);
  assert.equal(result.connections.length, 2);
  assert.equal(result.connections[1].hostname, null);
  assert.equal(result.connections[1].status, 'no_certificate_provided');
});

test('ambiguous SNI and ECH do not attribute a destination by approximation', () => {
  for (const mode of ['ambiguous', 'ech-event', 'ech-result']) {
    const log = netlogFixture();
    if (mode === 'ambiguous') log.events.splice(2, 0, { ...structuredClone(byType(log, 'SSL_HANDSHAKE_MESSAGE_SENT')), params: { type: 1, bytes: clientHello('other.example.test') } });
    if (mode === 'ech-event') log.events.splice(2, 0, { ...structuredClone(byType(log, 'SSL_HANDSHAKE_MESSAGE_SENT')), type: log.constants.logEventTypes.SSL_ECH_CONFIG_LIST });
    if (mode === 'ech-result') log.events.find(event => event.type === log.constants.logEventTypes.SSL_CONNECT && event.phase === 2).params.encrypted_client_hello = true;
    const [connection] = analyzeNetLog(log).connections;
    assert.equal(connection.hostname, null);
    assert.equal(connection.hostResolution, mode === 'ambiguous' ? 'ambiguous' : 'ech_unresolved');
  }
});

test('sanitized reports omit URLs, cookies, authorization, certificate bytes and provider data', () => {
  const log = netlogFixture();
  const certificateMessage = { ...structuredClone(byType(log, 'SSL_HANDSHAKE_MESSAGE_SENT')), params: { type: 11 } };
  Object.defineProperty(certificateMessage.params, 'bytes', { get() { throw new Error('Client certificate bytes must never be read'); } });
  log.events.splice(3, 0, certificateMessage);
  const report = analyzeNetLog(log);
  assert.doesNotMatch(JSON.stringify(report), /COOKIE_SECRET|AUTH_SECRET|URL_SECRET|SYNTHETIC_PROVIDER|other\.example|private\?|bytes|headers/);
});

test('missing timestamp offsets are shown as unavailable instead of using an invented date', () => {
  const log = netlogFixture();
  delete log.constants.timeTickOffset;
  assert.equal(analyzeNetLog(log).connections[0].at, null);
});

test('unrelated traffic creates no certificate evidence and malformed sources are skipped', () => {
  const log = netlogFixture();
  log.events = log.events.filter(event => event.source.id === 99);
  assert.equal(analyzeNetLog(log).connections.length, 0);
  log.events.push({ type: log.constants.logEventTypes.SSL_CLIENT_CERT_REQUESTED, source: { id: 'bad', type: 9 }, phase: 0 });
  assert.equal(analyzeNetLog(log).summary.skippedEvents, 1);
});

test('unsupported schemas, oversized event arrays and excessive report counts are rejected', () => {
  assert.throws(() => analyzeNetLog({ events: [] }), /NetLog/);
  const unsupported = netlogFixture();
  delete unsupported.constants.logEventTypes.SSL_CLIENT_CERT_PROVIDED;
  assert.throws(() => analyzeNetLog(unsupported), /não reconhecido/);
  const log = netlogFixture();
  log.events = Array(MAX_NETLOG_EVENTS + 1).fill(null);
  assert.throws(() => analyzeNetLog(log), /100.000/);
  log.events = Array.from({ length: 501 }, (_, id) => ({ type: log.constants.logEventTypes.SSL_CLIENT_CERT_REQUESTED, source: { id, type: 9 }, phase: 0 }));
  assert.throws(() => analyzeNetLog(log), /500/);
});
