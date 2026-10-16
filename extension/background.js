import { AuditEngine } from './lib/engine.js';

const engine = new AuditEngine(chrome);

function report(error) {
  // Never log URLs, cookies, message payloads or authentication data.
  console.error('Falha na operação de auditoria:', error instanceof Error ? error.message : 'erro desconhecido');
}

chrome.alarms.create('retention', { periodInMinutes: 60 }).catch(report);
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'retention') engine.run(() => engine.persist()).catch(report);
});

chrome.webNavigation.onCommitted.addListener(details => {
  engine.run(() => engine.navigation(details)).catch(report);
});

chrome.cookies.onChanged.addListener(change => {
  engine.run(() => engine.cookieChanged(change)).catch(report);
});

chrome.permissions.onRemoved.addListener(() => {
  engine.run(async () => { engine.contexts = {}; await engine.persist(); }).catch(report);
});

chrome.runtime.onStartup.addListener(() => {
  engine.run(async () => { engine.contexts = {}; await engine.persist(); }).catch(report);
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false;
  const handlers = {
    GET_STATE: () => engine.snapshot(),
    SAVE_CONFIG: () => engine.saveConfig(message.config),
    DECLARE_CERTIFICATE: () => engine.declare(message),
    END_CONTEXT: () => engine.endContext(message.tabId),
    CLEAR_LOGS: () => engine.clear(),
    EXPORT_LOGS: () => engine.export(),
  };
  const handler = handlers[message?.type];
  if (!handler || !Object.hasOwn(handlers, message.type)) return false;
  engine.run(handler).then(data => respond({ ok: true, data })).catch(error => respond({ ok: false, error: error.message }));
  return true;
});
