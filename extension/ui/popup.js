import { $, send, feedback } from './common.js';
import { originsForDomain } from '../lib/core.js';

let state;

function render(next) {
  state = next;
  const active = state.active;
  $('#site').textContent = active?.hostname || 'Abra um site HTTPS';
  $('#status').textContent = !state.config.enabled ? 'Pausado' : active?.configured && active.authorized ? 'Acompanhando' : 'Sem acompanhamento';
  $('#site-detail').textContent = active?.context
    ? `Contexto declarado: ${active.context.alias}. Presença de cookies não comprova autenticação.`
    : active ? 'Confirme o uso para iniciar um contexto declarado neste domínio.' : 'Páginas internas do Chrome e janelas anônimas não são acompanhadas.';
  $('#declare').disabled = !active || !state.config.enabled;
  $('#end-context').hidden = !active?.context;
}

$('#declare-form').addEventListener('submit', async event => {
  event.preventDefault();
  const active = state?.active;
  if (!active || !$('#confirmed').checked) return;
  $('#declare').disabled = true;
  try {
    // Request inside the user gesture, before any other asynchronous operation.
    const granted = await chrome.permissions.request({ origins: originsForDomain(active.hostname) });
    if (!granted) throw new Error('A permissão foi recusada. O domínio não foi incluído.');
    render(await send('DECLARE_CERTIFICATE', { tabId: active.tabId, alias: $('#alias').value, confirmed: true }));
    $('#confirmed').checked = false;
    feedback('Declaração registrada. As próximas visitas serão acompanhadas enquanto o monitoramento estiver ativo.');
  } catch (error) { feedback(error.message, true); }
  finally { $('#declare').disabled = !state?.active || !state.config.enabled; }
});

$('#end-context').addEventListener('click', async () => {
  try { render(await send('END_CONTEXT', { tabId: state.active.tabId })); feedback('Contexto encerrado. Isso não faz logout do site.'); }
  catch (error) { feedback(error.message, true); }
});

$('#open-dashboard').addEventListener('click', () => chrome.runtime.openOptionsPage());
send('GET_STATE').then(render).catch(error => feedback(error.message, true));
