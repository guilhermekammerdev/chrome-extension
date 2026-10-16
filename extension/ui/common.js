import { TYPES } from '../lib/core.js';

export const $ = selector => document.querySelector(selector);

export async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ ...payload, type });
  if (!response?.ok) throw new Error(response?.error || 'Não foi possível comunicar com a extensão. Tente novamente.');
  return response.data;
}

export function feedback(message, error = false) {
  const element = $('#feedback');
  element.textContent = message;
  element.classList.toggle('error', error);
}

export function describeEvent(event) {
  if (event.type === 'certificate_declared') return `Declaração do usuário · ${event.alias}`;
  if (event.type === 'cookie_changed') return `${event.operation === 'removed' ? 'Cookie removido' : 'Cookie criado ou atualizado'} · contexto anterior encerrado${event.partitioned ? ' · particionado' : ''}`;
  if (event.type === 'context_ended') return 'Encerrado pelo usuário';
  if (event.type === 'navigation') {
    const cookies = event.cookiesAvailable ? `${event.cookieCount} cookie(s) observado(s)` : 'Cookies indisponíveis';
    return event.context ? `${cookies} · contexto declarado: ${event.context.alias} · reuso não comprovado` : `${cookies} · sem contexto declarado vigente`;
  }
  return 'Registro local';
}

export function renderEvents(events, tbody) {
  tbody.replaceChildren();
  for (const event of events) {
    const row = document.createElement('tr');
    const values = [new Date(event.at).toLocaleString('pt-BR'), event.hostname, TYPES[event.type] || event.type, describeEvent(event)];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    tbody.append(row);
  }
}
