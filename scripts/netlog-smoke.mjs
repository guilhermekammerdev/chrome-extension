import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:https';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeNetLog } from '../extension/lib/netlog.js';

const temp = await mkdtemp(join(tmpdir(), 'netlog-diagnostic-'));
let context;
let server;
try {
  const certPath = join(temp, 'server.pem');
  const keyPath = join(temp, 'server.key');
  const generated = spawnSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', keyPath, '-out', certPath, '-subj', '/CN=Local audit test',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    '-addext', 'basicConstraints=critical,CA:FALSE',
  ], { stdio: 'ignore' });
  assert.equal(generated.status, 0, 'OpenSSL must generate the synthetic, temporary test server certificate');
  const cert = await readFile(certPath);
  server = createServer({ key: await readFile(keyPath), cert, ca: cert, requestCert: true, rejectUnauthorized: true }, (_req, res) => res.end('Synthetic TLS test'));
  server.on('tlsClientError', () => {});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const logPath = join(temp, 'netlog.json');
  context = await chromium.launchPersistentContext(join(temp, 'profile'), {
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', `--log-net-log=${logPath}`, '--net-log-capture-mode=Default'],
  });
  const page = await context.newPage();
  let tlsError;
  try { await page.goto(`https://localhost:${server.address().port}/synthetic?token=NOT_FOR_REPORT`, { timeout: 15000 }); }
  catch (error) { tlsError = error.message; }
  // Keep certificate verification enabled. The untrusted self-signed certificate
  // must fail; this is a real negative test, not a real A1 authentication test.
  assert.match(tlsError || '', /ERR_CERT_AUTHORITY_INVALID|ERR_BAD_SSL_CLIENT_AUTH_CERT|ERR_SSL_CLIENT_AUTH_CERT_NEEDED/);
  await context.close();
  context = null;
  const log = JSON.parse(await readFile(logPath, 'utf8'));
  const sslConnect = log.constants.logEventTypes.SSL_CONNECT;
  assert.ok(log.events.some(event => event.type === sslConnect), 'The real capture must include a TLS attempt');
  const report = analyzeNetLog(log);
  assert.equal(report.summary.tlsCompletedWithCertificate, 0);
  assert.doesNotMatch(JSON.stringify(report), /NOT_FOR_REPORT|synthetic\?|BEGIN CERTIFICATE|PRIVATE KEY/);
  console.log(`PASS: NetLog real do Chromium (${log.events.length} eventos) analisado no modo padrão; certificado de servidor não confiável foi rejeitado; nenhum uso bem-sucedido de certificado foi inventado. Sem teste de A1 real.`);
} finally {
  await context?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
