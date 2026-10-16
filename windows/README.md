# Piloto local: Windows, Chrome gerenciado e certificado A1

O objetivo deste piloto é verificar se os eventos de rede do Chrome oferecem informação suficiente para a próxima etapa de automação. **Não é um agente instalado nem monitoramento contínuo.** A extensão continua usando declaração manual no histórico principal; a análise técnica aparece em uma seção separada do painel.

O helper PowerShell foi preparado para Windows PowerShell 5.1, mas **não foi executado em Windows neste ambiente Linux**. As políticas da empresa permanecem em vigor. A instalação da extensão e a execução de scripts devem estar autorizadas pelo administrador. Não use comandos para contornar a política de execução do PowerShell ou a política do Chrome.

## Capturar e analisar

1. Instale a extensão conforme o README principal em uma estação de testes autorizada. Nenhum PFX/P12 ou senha precisa ser entregue à extensão. O A1 permanece no local e no mecanismo que a empresa já utiliza.
2. Salve seu trabalho e feche o Chrome manualmente, inclusive processos em segundo plano. O helper recusa iniciar uma captura se encontrar `chrome.exe` em execução e não encerra processos.
3. Em um PowerShell autorizado, na pasta do projeto, execute:

   ```powershell
   .\windows\Start-CertificateAuditCapture.ps1
   ```

   Se necessário, informe `-ChromePath` com o caminho do Chrome corporativo aprovado. O helper abre esse Chrome com `--log-net-log` e `--net-log-capture-mode=Default`. Não altera certificados, chaves, verificação TLS, registro do Windows, políticas, inicialização automática ou serviços.
4. Faça uma sessão curta: abra somente o portal de teste, autentique-se com o A1, abra outra aba do mesmo portal e depois faça logout. Feche o Chrome manualmente para finalizar o JSON. A captura fica em `%LOCALAPPDATA%\CertificateAudit\Capture\<sessao>\netlog.json`; o caminho exato aparece no PowerShell.
5. Reabra o Chrome e o painel da extensão. Em **Windows com A1 · Diagnóstico técnico**, selecione o JSON e clique em **Analisar arquivo local**. O limite é 20 MB / 100.000 eventos; se exceder, repita com um período menor.
6. Confira os resultados e, se necessário, exporte somente o resumo sanitizado. Ele não contém URLs completas, bytes TLS, certificados, informações do titular, headers ou cookies. Apague a captura bruta ao terminar o diagnóstico conforme a política da empresa.

Uma alternativa manual é `chrome://net-export`: mantenha o modo padrão de remoção de informações privadas, inicie a captura, faça o teste e pare a captura antes de analisar o JSON. Não ative a inclusão de cookies/credenciais ou bytes brutos. Se a organização bloquear a captura, o administrador precisa fornecer um canal autorizado; o projeto não altera essa restrição.

**Dados da captura:** mesmo no modo padrão, um NetLog bruto pode conter URLs de navegação, parâmetros e metadados de rede. A captura abrange o processo do navegador, não apenas sites autenticados com certificado. Por isso, use um período curto destinado ao teste e mantenha o arquivo na estação. A extensão processa o arquivo apenas em memória nesta página, não o salva no histórico e não o envia a servidores. Não anexe a captura bruta, PFX, senha ou chave privada no chat.

## Interpretar sem confundir evidências

| Sinal | O que permite afirmar | O que permanece desconhecido |
| --- | --- | --- |
| `SSL_CLIENT_CERT_REQUESTED` | O servidor TLS solicitou um certificado. | Se algum certificado foi disponibilizado ou aceito. |
| `SSL_CLIENT_CERT_PROVIDED`, `cert_count=0` | Nenhum certificado foi disponibilizado. | Não deve ser contado como uso do A1. |
| `SSL_CLIENT_CERT_PROVIDED`, contagem positiva ou `-1` | Um certificado foi disponibilizado à biblioteca TLS. | Identidade do certificado, envio concluído e aceitação pelo portal. |
| Disponibilização + operação de chave concluída + TLS completo, sem retomada, no mesmo ciclo de conexão | O log contém sinais de um handshake TLS concluído com certificado de cliente. | Qual A1, funcionário, CPF/CNPJ ou sessão de aplicação. O arquivo importado é editável e não é uma atestação de integridade. |
| SNI do ClientHello na mesma fonte | Nome DNS solicitado ao destino TLS. | URL, porta, aba, perfil, identidade do usuário ou autenticador. Um destino TLS também pode ser um proxy ou recurso de rede. |
| SNI ausente, ambíguo ou ECH | O destino não foi resolvido pelo analisador. | O código não atribui um domínio por aproximação nem usa dependências de DNS para ligar sites diferentes. |

O analisador mantém separados os ciclos `SSL_CONNECT` de cada fonte. Falha de TLS, captura parcial, certificado ausente, assinatura não observada e retomada de TLS não são classificados como novo handshake completo com certificado. Conexões sem nenhum sinal de certificado não aparecem no resumo. O horário é uma aproximação baseada em `timeTickOffset` do arquivo.

O Chrome omite, no modo padrão, os bytes da mensagem que contém o certificado de cliente. Este projeto mantém essa proteção. `cert_count` conta certificados na cadeia, não certificados pessoais utilizados. O Windows com A1 não elimina a necessidade de uma fonte verificável para associar a assinatura ao certificado específico da empresa. Cookies do gov.br, redirecionamentos de identidade e sessões de outros serviços também não são associados automaticamente a partir desses eventos.

## Para chegar a um agente

Depois da validação na estação, será necessário escolher uma fonte que forneça **identidade do certificado** e uma correlação verificável com a sessão. Um host Native Messaging transporta mensagens, mas não cria esses dados. Eventos de uso de chave do Windows podem ajudar a investigar a identidade; isoladamente, não informam a URL do Chrome nem a sessão do portal. A disponibilidade, o conteúdo e a relação desses eventos precisam ser confirmados em um piloto Windows antes de implementar um coletor contínuo.

O produto final deve preservar evidências distintas: solicitação TLS, operação com o certificado esperado, navegação observada e eventual correlação de sessão. Não há garantia de cobertura de todos os portais ou de sessões anteriores à captura.

## Fontes consultadas

Estas referências pertencem ao código oficial do Chromium; os detalhes são internos e podem mudar entre versões. O analisador é uma ferramenta de diagnóstico, não uma API estável de auditoria.

- [Eventos NetLog: solicitação e disponibilização de certificado](https://github.com/chromium/chromium/blob/main/net/log/net_log_event_type_list.h).
- [SSLClientSocketImpl: captura de mensagens TLS, omissão do certificado e operação de chave](https://github.com/chromium/chromium/blob/main/net/socket/ssl_client_socket_impl.cc).
- [NetLogWithSource: parâmetros ausentes em operações concluídas sem erro](https://github.com/chromium/chromium/blob/main/net/log/net_log_with_source.cc).
- [NetLog: conversão aproximada de horário](https://github.com/chromium/chromium/blob/main/net/log/net_log_util.cc).
- [Permissões da API platformKeys: restrição ao ChromeOS](https://github.com/chromium/chromium/blob/main/chrome/common/extensions/api/_permission_features.json).
