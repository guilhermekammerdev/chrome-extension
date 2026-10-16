import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { netlogFixture } from '../test/fixtures/netlog-fixture.js';

// This validates real DOM interactions with a synthetic chrome API, not Chrome's
// extension APIs or certificate authentication. test:browser is the separate integration.
const root = resolve('extension');
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}/`)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'certificate-ui-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox'], viewport: { width: 1440, height: 1100 }, timezoneId: 'America/Sao_Paulo',
  });
  await context.addInitScript(() => {
    window.__mock = { grants: true, declarations: 0, saves: 0, requests: [], calls: 0 };
    const now = Date.now();
    const events = [
      { id: '3', type: 'navigation', evidence: 'browser_navigation', hostname: 'portal.exemplo.com.br', origin: 'https://portal.exemplo.com.br', at: new Date(now).toISOString(), cookieCount: 2, cookiesAvailable: true, context: { alias: 'Financeiro · dados fictícios', declarationId: '1' } },
      { id: '2', type: 'cookie_changed', evidence: 'cookie_metadata', hostname: 'login.exemplo.com.br', origin: 'https://login.exemplo.com.br', at: new Date(now - 60000).toISOString(), operation: 'removed' },
      { id: '1', type: 'certificate_declared', evidence: 'user_declaration', hostname: 'portal.exemplo.com.br', origin: 'https://portal.exemplo.com.br', at: new Date(now - 120000).toISOString(), alias: '<img src=x onerror="window.xss=true">' },
    ];
    const state = {
      config: { enabled: true, domains: ['portal.exemplo.com.br', 'login.exemplo.com.br'], retentionDays: 7, contextHours: 8 },
      eventCount: 3, totalDeclarations: 1, authorizedDomains: ['portal.exemplo.com.br', 'login.exemplo.com.br'], events,
      active: { hostname: 'portal.exemplo.com.br', protocol: 'https:', origin: 'https://portal.exemplo.com.br', tabId: 1, configured: true, authorized: true, context: null },
    };
    window.__mock.setDemoAlias = alias => { events.find(event => event.type === 'certificate_declared').alias = alias; };
    window.chrome = {
      permissions: { async request(request) { window.__mock.requests.push(request); return window.__mock.grants; } },
      storage: { onChanged: { addListener() {} } },
      runtime: {
        async openOptionsPage() { window.__mock.openedOptions = true; },
        async sendMessage(message) {
          window.__mock.calls++;
          if (message.type === 'SAVE_CONFIG') { state.config = message.config; window.__mock.saves++; }
          if (message.type === 'DECLARE_CERTIFICATE') {
            window.__mock.declarations++;
            state.active.context = { alias: message.alias };
          }
          if (message.type === 'END_CONTEXT') state.active.context = null;
          if (message.type === 'CLEAR_LOGS') { state.events = []; state.eventCount = 0; state.totalDeclarations = 0; }
          if (message.type === 'EXPORT_LOGS') return { ok: true, data: { schemaVersion: 1, events: state.events } };
          return { ok: true, data: structuredClone(state) };
        },
      },
    };
  });
  const dashboard = await context.newPage();
  const errors = [];
  dashboard.on('pageerror', error => errors.push(error.message));
  await dashboard.goto(`${base}/options.html`);
  await dashboard.locator('#event-count').filter({ hasText: /^3$/ }).waitFor();
  assert.equal(await dashboard.locator('#events tr').count(), 3);
  assert.equal(await dashboard.locator('#events img').count(), 0, 'Aliases must render as text');
  assert.equal(await dashboard.evaluate(() => window.xss), undefined);
  await dashboard.locator('#filter-type').selectOption('navigation');
  assert.equal(await dashboard.locator('#events tr').count(), 1);
  assert.match(await dashboard.locator('#events').innerText(), /reuso não comprovado/);
  await dashboard.locator('#filter-domain').fill('inexistente.test');
  await dashboard.locator('#empty').waitFor({ state: 'visible' });
  await dashboard.locator('#filter-domain').fill('');
  await dashboard.locator('#filter-type').selectOption('');

  await dashboard.locator('#domains').fill('novo.exemplo.com.br');
  await dashboard.evaluate(() => { window.__mock.grants = false; });
  await dashboard.locator('#save').click();
  await dashboard.locator('#feedback').filter({ hasText: 'Permissões recusadas' }).waitFor();
  assert.equal(await dashboard.evaluate(() => window.__mock.saves), 0);
  await dashboard.evaluate(() => { window.__mock.grants = true; });
  await dashboard.locator('#save').click();
  await dashboard.locator('#feedback').filter({ hasText: 'Configurações salvas' }).waitFor();
  assert.equal(await dashboard.evaluate(() => window.__mock.saves), 1);

  const downloadPromise = dashboard.waitForEvent('download');
  await dashboard.locator('#export').click();
  const download = await downloadPromise;
  assert.equal(JSON.parse(await readFile(await download.path(), 'utf8')).events.length, 3);
  await dashboard.evaluate(() => window.__mock.setDemoAlias('Financeiro · dados fictícios'));
  await dashboard.locator('#domains').fill('portal.exemplo.com.br\nlogin.exemplo.com.br');
  await dashboard.locator('#save').click();
  await dashboard.locator('#domain-count').filter({ hasText: /^2$/ }).waitFor();
  await dashboard.locator('#netlog-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await dashboard.locator('#netlog-analyze').click();
  await dashboard.locator('#netlog-feedback').filter({ hasText: 'JSON inválido' }).waitFor();
  assert.equal(await dashboard.locator('#netlog-export').isDisabled(), true);
  await dashboard.locator('#netlog-file').setInputFiles({ name: 'diagnostic-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(netlogFixture())) });
  await dashboard.locator('#netlog-analyze').click();
  await dashboard.locator('#netlog-feedback').filter({ hasText: '1 conexão(ões)' }).waitFor();
  assert.match(await dashboard.locator('#netlog-connections').innerText(), /portal.exemplo.com.br/);
  assert.match(await dashboard.locator('#netlog-connections').innerText(), /A1 não identificado/);
  const diagnosticDownload = dashboard.waitForEvent('download');
  await dashboard.locator('#netlog-export').click();
  const summaryFile = await diagnosticDownload;
  const diagnostic = JSON.parse(await readFile(await summaryFile.path(), 'utf8'));
  assert.equal(diagnostic.connections[0].status, 'client_certificate_tls_completed');
  assert.doesNotMatch(JSON.stringify(diagnostic), /COOKIE_SECRET|AUTH_SECRET|URL_SECRET|bytes|headers/);
  await mkdir('artifacts', { recursive: true });
  await dashboard.screenshot({ path: 'artifacts/dashboard-synthetic.png', fullPage: true });
  dashboard.once('dialog', dialog => dialog.accept());
  await dashboard.locator('#clear').click();
  await dashboard.locator('#event-count').filter({ hasText: /^0$/ }).waitFor();

  const popup = await context.newPage();
  popup.on('pageerror', error => errors.push(error.message));
  await popup.goto(`${base}/popup.html`);
  await popup.getByRole('heading', { name: 'portal.exemplo.com.br' }).waitFor();
  await popup.locator('#declare').click();
  assert.equal(await popup.evaluate(() => window.__mock.declarations), 0, 'Confirmation must be required');
  await popup.locator('#confirmed').check();
  await popup.evaluate(() => { window.__mock.grants = false; });
  await popup.locator('#declare').click();
  await popup.locator('#feedback').filter({ hasText: 'permissão foi recusada' }).waitFor();
  assert.equal(await popup.evaluate(() => window.__mock.declarations), 0);
  await popup.evaluate(() => { window.__mock.grants = true; });
  await popup.locator('#declare').click();
  await popup.locator('#feedback').filter({ hasText: 'Declaração registrada' }).waitFor();
  assert.equal(await popup.evaluate(() => window.__mock.declarations), 1);
  await popup.locator('#end-context').click();
  await popup.locator('#feedback').filter({ hasText: 'Contexto encerrado' }).waitFor();
  await popup.locator('#open-dashboard').click();
  assert.equal(await popup.evaluate(() => window.__mock.openedOptions), true);
  assert.deepEqual(errors, []);
  console.log('PASS: interface HTML com APIs simuladas: popup, confirmação obrigatória, recusa/concessão, configurações, filtros, renderização segura, exportação e exclusão; análise local de NetLog sintético, tratamento de JSON inválido e exportação sanitizada.');
  console.log('Captura com dados fictícios: artifacts/dashboard-synthetic.png. Este teste não valida as APIs reais de extensão do Chrome.');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
