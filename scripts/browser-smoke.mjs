import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

if (!process.env.CHROMIUM_PATH || ['/usr/bin/chromium', '/usr/lib/chromium/chromium'].includes(process.env.CHROMIUM_PATH)) {
  let policy;
  try { policy = JSON.parse(await readFile('/etc/chromium/policies/managed/extensions.json', 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (policy?.ExtensionInstallBlocklist?.includes('*') && !policy.ExtensionInstallAllowlist?.length) {
    throw new Error('Validação bloqueada pelo ambiente: a política gerenciada ExtensionInstallBlocklist=["*"] proíbe instalar esta extensão no Chromium. Execute este teste em uma estação de testes com instalação autorizada pelo administrador. Nenhuma política foi alterada.');
  }
}

const temp = await mkdtemp(join(tmpdir(), 'certificate-audit-test-'));
const fixture = join(temp, 'extension');
await cp(resolve('extension'), fixture, { recursive: true });
const manifest = JSON.parse(await readFile(join(fixture, 'manifest.json'), 'utf8'));
// Grant only loopback hosts in the disposable test copy. Production permissions remain
// optional. Native browser permission dialogs need manual validation in the real Chrome.
manifest.host_permissions = ['http://127.0.0.1/*', 'https://127.0.0.1/*'];
await writeFile(join(fixture, 'manifest.json'), JSON.stringify(manifest));

const secret = 'SYNTHETIC_COOKIE_MUST_NOT_APPEAR_IN_AUDIT';
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  if (path === '/login') res.setHeader('Set-Cookie', `corporate_session=${secret}; Path=/; HttpOnly; SameSite=Lax`);
  if (path === '/logout') res.setHeader('Set-Cookie', 'corporate_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  const authenticated = path === '/login' || (path !== '/logout' && req.headers.cookie?.includes(secret));
  res.end(`<!doctype html><html lang="pt-BR"><title>Portal de teste</title><h1>${authenticated ? 'Sessão ativa' : 'Sem sessão'}</h1><p>Portal local de validação da extensão.</p></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let context;

try {
  context = await chromium.launchPersistentContext(join(temp, 'profile'), {
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', `--disable-extensions-except=${fixture}`, `--load-extension=${fixture}`],
    viewport: { width: 1440, height: 1100 },
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 20000 });
  const extensionOrigin = `chrome-extension://${new URL(worker.url()).hostname}`;
  const dashboard = await context.newPage();
  const errors = [];
  dashboard.on('pageerror', error => errors.push(error.message));
  await dashboard.goto(`${extensionOrigin}/options.html`);
  await dashboard.locator('#collection-status').filter({ hasText: 'Aguardando primeiro site' }).waitFor();
  const rpc = async (type, payload = {}) => {
    const response = await dashboard.evaluate(async ({ type, payload }) => chrome.runtime.sendMessage({ ...payload, type }), { type, payload });
    assert.equal(response?.ok, true, response?.error);
    return response.data;
  };
  const portal = await context.newPage();
  await portal.goto(`${origin}/login?token=URL_SECRET_MUST_NOT_BE_SAVED`);
  await portal.getByRole('heading', { name: 'Sessão ativa' }).waitFor();
  assert.equal((await rpc('GET_STATE')).eventCount, 0, 'Unconfigured browsing must not be collected');
  await portal.bringToFront();
  const initial = await rpc('GET_STATE');
  assert.equal(initial.active.hostname, '127.0.0.1');
  await rpc('DECLARE_CERTIFICATE', { confirmed: true, alias: 'Certificado de teste', tabId: initial.active.tabId });

  await portal.goto(`${origin}/area?token=URL_SECRET_MUST_NOT_BE_SAVED#fragment`);
  await portal.getByRole('heading', { name: 'Sessão ativa' }).waitFor();
  let state;
  await assertEventually(async () => {
    state = await rpc('GET_STATE');
    assert.ok(state.events.some(event => event.type === 'navigation' && event.context?.alias === 'Certificado de teste'));
  });
  const observed = state.events.find(event => event.type === 'navigation' && event.context);
  assert.equal(observed.cookieCount, 1, 'HttpOnly cookies must be represented by count only');
  assert.equal(observed.origin, origin);
  assert.equal(observed.context.declarationId, state.events.find(event => event.type === 'certificate_declared').id);

  const anotherTab = await context.newPage();
  await anotherTab.goto(`${origin}/area`);
  await anotherTab.getByRole('heading', { name: 'Sessão ativa' }).waitFor();
  await assertEventually(async () => {
    const after = await rpc('GET_STATE');
    assert.ok(after.events.filter(event => event.type === 'navigation' && event.context).length >= 2, 'Context must be observable from another tab in the same profile');
  });

  await portal.goto(`${origin}/logout`);
  await portal.getByRole('heading', { name: 'Sem sessão' }).waitFor();
  await assertEventually(async () => {
    const after = await rpc('GET_STATE');
    assert.ok(after.events.some(event => event.type === 'cookie_changed' && event.operation === 'removed'));
  });
  await portal.goto(`${origin}/area`);
  await portal.getByRole('heading', { name: 'Sem sessão' }).waitFor();
  await assertEventually(async () => {
    state = await rpc('GET_STATE');
    assert.equal(state.events.find(event => event.type === 'navigation').cookieCount, 0);
    assert.equal(state.events.find(event => event.type === 'navigation').context, null);
  });

  await dashboard.bringToFront();
  await dashboard.locator('#refresh').click();
  await dashboard.getByRole('cell', { name: 'Uso do certificado declarado', exact: true }).waitFor();
  await dashboard.locator('#filter-domain').fill('not-monitored.test');
  await dashboard.locator('#empty').waitFor({ state: 'visible' });
  await dashboard.locator('#filter-domain').fill('');
  await dashboard.locator('#filter-type').selectOption('certificate_declared');
  assert.equal(await dashboard.locator('#events tr').count(), 1);
  await dashboard.locator('#filter-type').selectOption('');

  const exportData = await rpc('EXPORT_LOGS');
  const serialized = JSON.stringify(exportData);
  assert.doesNotMatch(serialized, new RegExp(secret));
  assert.doesNotMatch(serialized, /URL_SECRET_MUST_NOT_BE_SAVED|\/area|\/login|fragment/);
  assert.ok(exportData.events.length >= 5);
  const downloadPromise = dashboard.waitForEvent('download');
  await dashboard.locator('#export').click();
  const download = await downloadPromise;
  const downloadData = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.ok(downloadData.events.length >= exportData.events.length);

  await mkdir('artifacts', { recursive: true });
  await dashboard.screenshot({ path: 'artifacts/dashboard.png', fullPage: true });

  await dashboard.locator('#enabled').uncheck();
  await dashboard.locator('#save').click();
  await dashboard.locator('#feedback').filter({ hasText: 'Configurações salvas' }).waitFor();
  const beforePause = (await rpc('GET_STATE')).eventCount;
  await portal.goto(`${origin}/login`);
  await assertEventually(async () => assert.equal((await rpc('GET_STATE')).eventCount, beforePause));
  await dashboard.bringToFront();
  dashboard.once('dialog', dialog => dialog.accept());
  await dashboard.locator('#clear').click();
  await dashboard.locator('#event-count').filter({ hasText: /^0$/ }).waitFor();
  assert.equal((await rpc('EXPORT_LOGS')).events.length, 0);
  assert.deepEqual(errors, []);
  console.log('PASS: Chromium carregou a extensão; navegação não configurada foi ignorada; cookie HttpOnly permaneceu no navegador; contexto declarado acompanhou visitas e outra aba; logout encerrou o contexto; HTML, filtros, exportação, pausa e exclusão funcionaram.');
  console.log('Captura de tela: artifacts/dashboard.png. O prompt nativo de permissão requer validação manual.');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
}

async function assertEventually(check) {
  const deadline = Date.now() + 8000;
  let lastError;
  while (Date.now() < deadline) {
    try { await check(); return; } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError;
}
