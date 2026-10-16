import test from 'node:test';
import assert from 'node:assert/strict';
import { AuditEngine } from '../extension/lib/engine.js';
import {
  DEFAULT_CONFIG, MAX_EVENTS, normalizeDomain, normalizeConfig, siteFromUrl,
  matchesDomain, originsForDomain, contextKey, liveContext, pruneEvents,
} from '../extension/lib/core.js';

async function harness() {
  let now = Date.parse('2026-10-15T12:00:00Z');
  let stored = {};
  let writes = 0;
  let granted = true;
  let cookieFailure = false;
  const cookieQueries = [];
  const cookie = { domain: '.empresa.com.br', hostOnly: false };
  Object.defineProperty(cookie, 'value', { get() { throw new Error('Cookie values must never be read'); } });
  let cookies = [cookie];
  const tab = { id: 1, url: 'https://portal.empresa.com.br/area?token=URL_SECRET#fragment', incognito: false };
  const api = {
    storage: { local: {
      async setAccessLevel(options) { assert.equal(options.accessLevel, 'TRUSTED_CONTEXTS'); },
      async get() { return structuredClone(stored); },
      async set(value) { stored = structuredClone(value); writes++; },
    } },
    permissions: { async contains() { return granted; } },
    tabs: { async query() { return [tab]; }, async get() { return tab; } },
    cookies: {
      async getAllCookieStores() { return [{ id: 'profile-0', tabIds: [1] }]; },
      async getAll(query) { cookieQueries.push(query); if (cookieFailure) throw new Error('Unavailable'); return cookies; },
    },
  };
  const engine = new AuditEngine(api, () => now);
  await engine.queue;
  const run = task => engine.run(task);
  const declare = () => run(() => engine.declare({ tabId: 1, confirmed: true, alias: 'Financeiro' }));
  const visit = (overrides = {}) => run(() => engine.navigation({ tabId: 1, frameId: 0, url: tab.url, ...overrides }));
  return { engine, api, tab, run, declare, visit, cookieQueries,
    get stored() { return structuredClone(stored); },
    get writes() { return writes; },
    setGranted(value) { granted = value; }, setCookies(value) { cookies = value; },
    failCookies() { cookieFailure = true; }, advance(ms) { now += ms; },
  };
}

test('domains are normalized and malicious or ambiguous inputs are rejected', () => {
  assert.equal(normalizeDomain(' PORTAL.Empresa.com.br '), 'portal.empresa.com.br');
  assert.equal(normalizeDomain('.empresa.com.br'), 'empresa.com.br');
  assert.equal(normalizeDomain('localhost'), 'localhost');
  for (const value of ['https://gov.br', 'gov.br/path', '*.gov.br', 'gov.br@evil.test', 'gov.br:443', 'foo..bar', '-foo.test', 'gov.br.', '10.0.0.1', '']) {
    assert.throws(() => normalizeDomain(value), undefined, value);
  }
  assert.equal(matchesDomain('sso.gov.br', 'gov.br'), true);
  assert.equal(matchesDomain('evilgov.br', 'gov.br'), false);
  assert.equal(matchesDomain('gov.br.evil.test', 'gov.br'), false);
});

test('configuration deduplicates domains and enforces bounded collection', () => {
  const config = normalizeConfig({ ...DEFAULT_CONFIG, domains: ['gov.br', 'GOV.BR', ''] });
  assert.deepEqual(config.domains, ['gov.br']);
  for (const overrides of [{ retentionDays: 0 }, { retentionDays: 31 }, { contextHours: 0 }, { contextHours: 25 }, { domains: Array(101).fill('gov.br') }]) {
    assert.throws(() => normalizeConfig({ ...DEFAULT_CONFIG, ...overrides }));
  }
  assert.deepEqual(originsForDomain('gov.br'), ['https://*.gov.br/*']);
  assert.deepEqual(originsForDomain('localhost'), ['https://localhost/*', 'http://localhost/*']);
});

test('unsupported pages and credentials in URLs are rejected; saved sites contain only origins', () => {
  assert.deepEqual(siteFromUrl('https://gov.br/segredo?token=abc#cpf'), { hostname: 'gov.br', origin: 'https://gov.br', protocol: 'https:' });
  for (const url of ['http://gov.br', 'chrome://settings', 'file:///etc/passwd', 'https://user:password@gov.br', 'not-a-url']) assert.equal(siteFromUrl(url), null);
  assert.equal(siteFromUrl('http://127.0.0.1:4321/session').origin, 'http://127.0.0.1:4321');
});

test('unconfigured sites, denied permissions, subframes and incognito are not recorded', async () => {
  const h = await harness();
  await h.visit();
  assert.equal(h.stored.events.length, 0);
  await h.declare();
  const count = h.stored.events.length;
  await h.visit({ frameId: 1 });
  await h.visit({ url: 'https://portal.empresa.com.br.evil.test/' });
  h.setGranted(false);
  await h.visit();
  h.setGranted(true);
  h.tab.incognito = true;
  await h.visit();
  assert.equal(h.stored.events.length, count);
});

test('declaration requires confirmation, a stable tab, permission and an alias', async () => {
  const h = await harness();
  await assert.rejects(h.run(() => h.engine.declare({ tabId: 1, alias: 'Financeiro', confirmed: false })), /Confirme/);
  await assert.rejects(h.run(() => h.engine.declare({ tabId: 2, alias: 'Financeiro', confirmed: true })), /aba mudou/);
  await assert.rejects(h.run(() => h.engine.declare({ tabId: 1, alias: '', confirmed: true })), /apelido/);
  h.setGranted(false);
  await assert.rejects(h.declare(), /Autorize/);
  h.setGranted(true);
  await h.declare(); // An earlier rejected message must not poison the worker's queue.
  assert.deepEqual(h.stored.config.domains, ['portal.empresa.com.br']);
  assert.equal(h.stored.events[0].evidence, 'user_declaration');
});

test('visits show declared context without claiming certificate proof; cookie values and URL secrets are never persisted', async () => {
  const h = await harness();
  await h.declare();
  await h.visit();
  const event = h.stored.events.at(-1);
  assert.equal(event.type, 'navigation');
  assert.equal(event.cookieCount, 1);
  assert.equal(event.context.alias, 'Financeiro');
  assert.equal(event.evidence, 'browser_navigation');
  assert.equal(event.origin, 'https://portal.empresa.com.br');
  assert.ok(h.cookieQueries.every(query => query.url === 'https://portal.empresa.com.br/area'));
  const exported = await h.run(() => h.engine.export());
  assert.doesNotMatch(JSON.stringify(exported), /URL_SECRET|fragment|\/area|cookieValue|password|privateKey/);
  assert.match(exported.notice, /não comprova/);
});

test('cookie changes drop the declaration; unrelated cookies do not affect it', async () => {
  const h = await harness();
  await h.declare();
  await h.run(() => h.engine.cookieChanged({ cookie: { domain: '.other.test', secure: true }, removed: false, cause: 'explicit' }));
  assert.equal(Object.keys(h.stored.contexts).length, 1);
  await h.run(() => h.engine.cookieChanged({ cookie: { domain: '.empresa.com.br', secure: true }, removed: true, cause: 'expired' }));
  assert.equal(Object.keys(h.stored.contexts).length, 0);
  await h.visit();
  assert.equal(h.stored.events.at(-1).context, null);
  assert.equal(h.stored.events.at(-2).type, 'cookie_changed');
});

test('expired contexts, no cookies and unavailable cookie APIs never establish a session link', async () => {
  const h = await harness();
  await h.declare();
  h.setCookies([]);
  await h.visit();
  assert.equal(h.stored.events.at(-1).context, null);
  h.failCookies();
  await h.visit();
  assert.equal(h.stored.events.at(-1).cookiesAvailable, false);
  assert.equal(h.stored.events.at(-1).cookieCount, null);
  assert.equal(h.stored.events.at(-1).context, null);
  h.advance(9 * 3600000);
  await h.run(() => h.engine.snapshot());
  assert.equal(Object.keys(h.stored.contexts).length, 0);
});

test('a declaration is scoped to one domain and cookie profile', () => {
  const now = Date.now();
  const contexts = { [contextKey('sso.gov.br', '0')]: { alias: 'Corp', declarationId: 'id', declaredAt: new Date(now).toISOString(), expiresAt: new Date(now + 10000).toISOString() } };
  assert.equal(liveContext(contexts, 'sso.gov.br', '1', 1, now), null);
  assert.equal(liveContext(contexts, 'portal.gov.br', '0', 1, now), null);
  assert.equal(liveContext(contexts, 'sso.gov.br', '0', 0, now), null);
  assert.equal(liveContext(contexts, 'sso.gov.br', '0', 1, now).alias, 'Corp');
});

test('partitioned cookies are not confused with first-party session cookies', async () => {
  const h = await harness();
  h.setCookies([{ domain: 'portal.empresa.com.br', partitionKey: { topLevelSite: 'https://elsewhere.test' } }]);
  await h.declare();
  await h.visit();
  assert.equal(h.stored.events.at(-1).cookieCount, 0);
  assert.equal(h.stored.events.at(-1).context, null);
});

test('pausing stops collection, ending or clearing contexts never changes website cookies', async () => {
  const h = await harness();
  await h.declare();
  await h.run(() => h.engine.endContext(1));
  assert.equal(Object.keys(h.stored.contexts).length, 0);
  await h.run(() => h.engine.saveConfig({ ...h.stored.config, enabled: false }));
  const count = h.stored.events.length;
  await h.visit();
  await h.run(() => h.engine.cookieChanged({ cookie: { domain: '.empresa.com.br' }, removed: true }));
  await assert.rejects(h.declare(), /Ative/);
  assert.equal(h.stored.events.length, count);
  await h.run(() => h.engine.clear());
  assert.equal(h.stored.events.length, 0);
  assert.equal(Object.keys(h.stored.contexts).length, 0);
  assert.deepEqual(h.stored.config.domains, ['portal.empresa.com.br']);
});

test('retention and the event limit are applied to persisted data and exports', async () => {
  const h = await harness();
  await h.declare();
  h.advance(8 * 86400000);
  const snapshot = await h.run(() => h.engine.snapshot());
  assert.equal(snapshot.eventCount, 0);
  assert.equal(h.stored.events.length, 0);
  const now = Date.now();
  const events = Array.from({ length: MAX_EVENTS + 5 }, (_, i) => ({ id: i, at: new Date(now).toISOString() }));
  const pruned = pruneEvents(events, 7, now);
  assert.equal(pruned.length, MAX_EVENTS);
  assert.equal(pruned[0].id, 5);
});

test('a service worker restart retains local history and its bounded declaration', async () => {
  const h = await harness();
  await h.declare();
  const next = new AuditEngine(h.api, () => Date.parse('2026-10-15T12:01:00Z'));
  await next.queue;
  const snapshot = await next.run(() => next.snapshot());
  assert.equal(snapshot.eventCount, 1);
  assert.equal(snapshot.active.context.alias, 'Financeiro');
});

test('reading unchanged state does not trigger a storage-change feedback loop', async () => {
  const h = await harness();
  await h.declare();
  const writes = h.writes;
  await h.run(() => h.engine.snapshot());
  await h.run(() => h.engine.snapshot());
  assert.equal(h.writes, writes);
});

test('pausing never requires a revoked host permission to be granted again', async () => {
  const h = await harness();
  await h.declare();
  h.setGranted(false);
  await h.run(() => h.engine.saveConfig({ ...h.stored.config, enabled: false }));
  assert.equal(h.stored.config.enabled, false);
  await assert.rejects(h.run(() => h.engine.saveConfig({ ...h.stored.config, enabled: true })), /Autorize/);
});
