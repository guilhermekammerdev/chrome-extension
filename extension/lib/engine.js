import {
  DEFAULT_CONFIG, TYPES, normalizeConfig, normalizeAlias, siteFromUrl, isConfigured,
  originsForDomain, contextKey, liveContext, invalidateContexts, pruneEvents, normalizeDomain,
} from './core.js';

export class AuditEngine {
  constructor(api, clock = () => Date.now()) {
    this.api = api;
    this.clock = clock;
    this.config = structuredClone(DEFAULT_CONFIG);
    this.events = [];
    this.contexts = {};
    this.queue = this.initialize();
  }

  async initialize() {
    await this.api.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    const stored = await this.api.storage.local.get(['config', 'events', 'contexts']);
    if (stored.config) this.config = normalizeConfig(stored.config);
    this.events = Array.isArray(stored.events) ? stored.events : [];
    this.contexts = stored.contexts || {};
    await this.persist();
  }

  run(task) {
    const result = this.queue.then(task);
    // Recover after an individual operation fails, without hiding that failure from its caller.
    this.queue = result.catch(() => {});
    return result;
  }

  async persist() {
    const now = this.clock();
    this.events = pruneEvents(this.events, this.config.retentionDays, now);
    this.contexts = Object.fromEntries(Object.entries(this.contexts).filter(([, context]) => Date.parse(context.expiresAt) > now));
    const state = { config: this.config, events: this.events, contexts: this.contexts };
    const serialized = JSON.stringify(state);
    if (serialized !== this.lastPersisted) {
      await this.api.storage.local.set(state);
      this.lastPersisted = serialized;
    }
  }

  append(type, site, details = {}) {
    const event = { id: crypto.randomUUID(), at: new Date(this.clock()).toISOString(), type, hostname: site.hostname, origin: site.origin, ...details };
    this.events.push(event);
    return event;
  }

  async hasPermission(site) {
    return this.api.permissions.contains({ origins: [`${site.protocol}//${site.hostname}/*`] });
  }

  async storeForTab(tabId) {
    const stores = await this.api.cookies.getAllCookieStores();
    const store = stores.find(item => item.tabIds.includes(tabId));
    if (!store) throw new Error('Não foi possível identificar o perfil de cookies da aba.');
    return store.id;
  }

  async cookieSummary(site, storeId, pageUrl = `${site.origin}/`) {
    try {
      // Cookie values are never read, persisted, hashed or transmitted.
      const path = new URL(pageUrl).pathname;
      const cookies = await this.api.cookies.getAll({ url: `${site.origin}${path}`, storeId });
      const unpartitioned = cookies.filter(cookie => !cookie.partitionKey);
      return { count: unpartitioned.length, available: true };
    } catch { return { count: null, available: false }; }
  }

  async activeSite() {
    const [tab] = await this.api.tabs.query({ active: true, currentWindow: true });
    const site = siteFromUrl(tab?.url);
    if (!site || tab.incognito) return null;
    const authorized = await this.hasPermission(site);
    let summary = { count: null, available: false };
    let context = null;
    if (authorized) {
      const storeId = await this.storeForTab(tab.id);
      summary = await this.cookieSummary(site, storeId, tab.url);
      if (this.config.enabled && isConfigured(site.hostname, this.config)) context = liveContext(this.contexts, site.hostname, storeId, summary.count, this.clock());
    }
    return { ...site, tabId: tab.id, configured: isConfigured(site.hostname, this.config), authorized, cookieCount: summary.count, cookiesAvailable: summary.available, context };
  }

  async snapshot() {
    await this.persist();
    const authorized = await Promise.all(this.config.domains.map(domain => this.api.permissions.contains({ origins: originsForDomain(domain) })));
    return {
      config: this.config,
      events: this.events.slice(-200).reverse(),
      eventCount: this.events.length,
      totalDeclarations: this.events.filter(event => event.type === 'certificate_declared').length,
      authorizedDomains: this.config.domains.filter((_, index) => authorized[index]),
      active: await this.activeSite(),
    };
  }

  async saveConfig(input) {
    const next = normalizeConfig(input);
    for (const domain of next.enabled ? next.domains : []) {
      if (!await this.api.permissions.contains({ origins: originsForDomain(domain) })) throw new Error(`Autorize o acesso a ${domain} para salvar.`);
    }
    // Changing collection scope ends all previous declarations.
    this.contexts = {};
    this.config = next;
    await this.persist();
    return this.snapshot();
  }

  async declare(input) {
    if (input.confirmed !== true) throw new Error('Confirme explicitamente o uso do certificado.');
    const alias = normalizeAlias(input.alias);
    const active = await this.activeSite();
    if (!active || active.tabId !== input.tabId) throw new Error('A aba mudou. Reabra a extensão no site em que usou o certificado.');
    if (!active.authorized) throw new Error('Autorize o acompanhamento deste site.');
    if (!this.config.enabled) throw new Error('Ative o monitoramento nas configurações antes de registrar.');
    if (!isConfigured(active.hostname, this.config)) {
      this.config = normalizeConfig({ ...this.config, domains: [...this.config.domains, active.hostname] });
    }
    const storeId = await this.storeForTab(active.tabId);
    const cookies = { count: active.cookieCount, available: active.cookiesAvailable };
    const event = this.append('certificate_declared', active, {
      evidence: 'user_declaration', alias, cookieCount: cookies.count, cookiesAvailable: cookies.available,
    });
    this.contexts[contextKey(active.hostname, storeId)] = {
      hostname: active.hostname, storeId, alias, declarationId: event.id, declaredAt: event.at,
      expiresAt: new Date(this.clock() + this.config.contextHours * 3600000).toISOString(),
    };
    await this.persist();
    return this.snapshot();
  }

  async navigation(details) {
    if (details.frameId !== 0 || details.tabId < 0 || !this.config.enabled) return;
    const site = siteFromUrl(details.url);
    if (!site || !isConfigured(site.hostname, this.config) || !await this.hasPermission(site)) return;
    const tab = await this.api.tabs.get(details.tabId);
    if (tab.incognito) return;
    const storeId = await this.storeForTab(details.tabId);
    const cookies = await this.cookieSummary(site, storeId, details.url);
    const context = liveContext(this.contexts, site.hostname, storeId, cookies.count, this.clock());
    this.append('navigation', site, {
      evidence: 'browser_navigation', cookieCount: cookies.count, cookiesAvailable: cookies.available,
      context,
    });
    await this.persist();
  }

  async cookieChanged(change) {
    if (!this.config.enabled) return;
    let domain;
    try { domain = normalizeDomain(change.cookie.domain); } catch { return; }
    // A parent-domain cookie can affect an explicitly monitored subdomain.
    const domains = this.config.domains.filter(item => item === domain || item.endsWith(`.${domain}`) || domain.endsWith(`.${item}`));
    if (!domains.length) return;
    const local = ['localhost', '127.0.0.1'].includes(domain);
    const site = siteFromUrl(`${local && !change.cookie.secure ? 'http' : 'https'}://${domain}`);
    const permissionSites = [site, ...domains.map(item => siteFromUrl(`https://${item}`))];
    if (!(await Promise.all(permissionSites.map(item => this.hasPermission(item)))).some(Boolean)) return;
    // Conservatively drop the context after any relevant cookie change: metadata cannot
    // prove that a new cookie belongs to the same authenticated session.
    this.contexts = invalidateContexts(this.contexts, domain);
    this.append('cookie_changed', site, {
      evidence: 'cookie_metadata', operation: change.removed ? 'removed' : 'added',
      cause: ['explicit', 'overwrite', 'expired', 'evicted', 'expired_overwrite', 'unknown'].includes(change.cause) ? change.cause : 'unknown',
      partitioned: Boolean(change.cookie.partitionKey),
    });
    await this.persist();
  }

  async endContext(tabId) {
    const active = await this.activeSite();
    if (!active || active.tabId !== tabId || !active.configured) throw new Error('Abra a extensão em um site monitorado.');
    const storeId = await this.storeForTab(tabId);
    delete this.contexts[contextKey(active.hostname, storeId)];
    this.append('context_ended', active, { evidence: 'user_action' });
    await this.persist();
    return this.snapshot();
  }

  async clear() {
    this.events = [];
    this.contexts = {};
    await this.persist();
    return this.snapshot();
  }

  async export() {
    await this.persist();
    return {
      schemaVersion: 1, exportedAt: new Date(this.clock()).toISOString(),
      notice: 'Declarações são fornecidas pelo usuário. Presença de cookies não comprova autenticação, envio de cookies ou uso de certificado. Este histórico local pode ser alterado ou apagado.',
      config: this.config, events: this.events,
    };
  }
}

export { TYPES };
