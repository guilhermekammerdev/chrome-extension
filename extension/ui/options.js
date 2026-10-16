import { $, send, feedback, renderEvents } from './common.js';
import { normalizeConfig, originsForDomain } from '../lib/core.js';
import { analyzeNetLog, MAX_NETLOG_BYTES, TLS_STATUS } from '../lib/netlog.js';

let state;
let settingsDirty = false;
let diagnostic;

function downloadJSON(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function renderTable() {
  if (!state) return;
  const domain = $('#filter-domain').value.trim().toLowerCase();
  const type = $('#filter-type').value;
  const events = state.events.filter(event => (!domain || event.hostname.includes(domain)) && (!type || event.type === type));
  renderEvents(events, $('#events'));
  $('#empty').hidden = events.length > 0;
}

function render(next, resetForm = false) {
  state = next;
  $('#domain-count').textContent = state.config.domains.length;
  $('#event-count').textContent = state.eventCount;
  $('#declaration-count').textContent = state.totalDeclarations;
  $('#collection-status').textContent = !state.config.enabled ? 'Monitoramento pausado' : !state.config.domains.length ? 'Aguardando primeiro site' : state.authorizedDomains.length < state.config.domains.length ? 'Permissões pendentes' : 'Monitoramento ativo';
  if (!settingsDirty || resetForm) {
    $('#enabled').checked = state.config.enabled;
    $('#domains').value = state.config.domains.join('\n');
    $('#retention-days').value = state.config.retentionDays;
    $('#context-hours').value = state.config.contextHours;
    settingsDirty = false;
  }
  renderTable();
}

$('#settings-form').addEventListener('input', () => { settingsDirty = true; });
$('#filter-domain').addEventListener('input', renderTable);
$('#filter-type').addEventListener('change', renderTable);
$('#refresh').addEventListener('click', () => send('GET_STATE').then(data => render(data)).catch(error => feedback(error.message, true)));

$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('#save').disabled = true;
  try {
    const config = normalizeConfig({
      enabled: $('#enabled').checked,
      domains: $('#domains').value.split(/\r?\n/),
      retentionDays: $('#retention-days').value,
      contextHours: $('#context-hours').value,
    });
    const origins = [...new Set(config.domains.flatMap(originsForDomain))];
    if (config.enabled && origins.length && !await chrome.permissions.request({ origins })) throw new Error('Permissões recusadas. A configuração anterior foi mantida.');
    const next = await send('SAVE_CONFIG', { config });
    render(next, true);
    feedback('Configurações salvas. Os contextos anteriores foram encerrados.');
  } catch (error) { feedback(error.message, true); }
  finally { $('#save').disabled = false; }
});

$('#export').addEventListener('click', async () => {
  try {
    const data = await send('EXPORT_LOGS');
    downloadJSON(data, `auditoria-certificado-${new Date().toISOString().slice(0, 10)}.json`);
    feedback('Exportação preparada com todos os registros retidos.');
  } catch (error) { feedback(error.message, true); }
});

$('#netlog-form').addEventListener('submit', async event => {
  event.preventDefault();
  const feedback = $('#netlog-feedback');
  diagnostic = null;
  $('#netlog-export').disabled = true;
  $('#netlog-results').hidden = true;
  $('#netlog-connections').replaceChildren();
  feedback.classList.remove('error');
  $('#netlog-analyze').disabled = true;
  $('#netlog-file').disabled = true;
  try {
    const [file] = $('#netlog-file').files;
    if (!file || file.size > MAX_NETLOG_BYTES) throw new Error('Selecione um JSON de até 20 MB.');
    feedback.textContent = 'Analisando o arquivo local…';
    let log;
    try { log = JSON.parse(await file.text()); }
    catch { throw new Error('JSON inválido ou captura ainda em andamento. Encerre a captura do Chrome antes de analisar.'); }
    diagnostic = analyzeNetLog(log);
    for (const connection of diagnostic.connections) {
      const row = document.createElement('tr');
      const values = [
        connection.at ? new Date(connection.at).toLocaleString('pt-BR') : 'Indisponível',
        connection.hostname || (connection.hostResolution === 'ech_unresolved' ? 'Não resolvido (ECH)' : 'Não resolvido'),
        TLS_STATUS[connection.status],
        'A1 não identificado · sessão não comprovada',
      ];
      for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
      $('#netlog-connections').append(row);
    }
    $('#netlog-results').hidden = diagnostic.connections.length === 0;
    $('#netlog-export').disabled = false;
    const summary = diagnostic.summary;
    feedback.textContent = summary.connections
      ? `${summary.connections} conexão(ões) com sinais de certificado; ${summary.certificateProvided} com certificado disponibilizado; ${summary.tlsCompletedWithCertificate} com operação de chave e TLS concluídos. Estes sinais não identificam o A1 nem comprovam a sessão do portal.`
      : 'Nenhum sinal de solicitação ou disponibilização de certificado nesta captura. Isso não exclui usos anteriores ou fora do período capturado.';
  } catch (error) { feedback.textContent = error.message; feedback.classList.add('error'); }
  finally { $('#netlog-analyze').disabled = false; $('#netlog-file').disabled = false; }
});

$('#netlog-file').addEventListener('change', () => {
  diagnostic = null;
  $('#netlog-export').disabled = true;
  $('#netlog-results').hidden = true;
  $('#netlog-connections').replaceChildren();
  $('#netlog-feedback').textContent = '';
});

$('#netlog-export').addEventListener('click', () => {
  if (diagnostic) downloadJSON(diagnostic, 'diagnostico-tls-resumo.json');
});

$('#clear').addEventListener('click', async () => {
  if (!confirm('Apagar todo o histórico local e os contextos declarados? Os domínios configurados serão mantidos.')) return;
  try { render(await send('CLEAR_LOGS')); feedback('Histórico e contextos apagados. Nenhum cookie foi alterado.'); }
  catch (error) { feedback(error.message, true); }
});

// Storage events make the HTML dashboard update when navigation is recorded elsewhere.
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') send('GET_STATE').then(data => render(data)).catch(error => feedback(error.message, true));
});
send('GET_STATE').then(data => render(data)).catch(error => feedback(error.message, true));
