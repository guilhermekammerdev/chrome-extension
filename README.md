# Certificado · Auditoria local

MVP de extensão Chrome (Manifest V3) com painel HTML em português para acompanhar sites associados ao uso de um certificado digital e observar visitas e mudanças de cookies posteriormente. Funciona com qualquer domínio HTTPS autorizado, sem lista fixa de portais. HTTP é aceito apenas em `localhost` e `127.0.0.1` para testes.

**Limite central:** as APIs padrão de uma extensão Chrome não revelam qual certificado de cliente foi usado em uma conexão TLS. Elas também não informam se um cookie de sessão foi emitido a partir desse certificado. Portanto, nesta versão, o uso do certificado é **declarado pelo usuário**. Presença de cookies e navegações são observações separadas e nunca são apresentadas como comprovação de autenticação ou de reuso de sessão. A detecção automática em todos os sites, solicitada para o produto final, depende de outra fonte de evidência e ainda não está implementada.

Para o cenário confirmado de **Windows com A1**, o painel inclui um diagnóstico local de arquivos NetLog do Chrome. Ele distingue solicitação de certificado, disponibilização à conexão e sinais de conclusão do TLS. A captura continua sendo iniciada e importada pelo operador; não há agente contínuo. Esse diagnóstico não identifica qual A1 foi usado e não comprova a sessão do portal. Veja [o roteiro de piloto Windows](windows/README.md) e [o helper de captura](windows/Start-CertificateAuditCapture.ps1), que ainda precisa ser validado em Windows.

## Instalar no Chrome

1. Abra `chrome://extensions` e ative **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e selecione a pasta `extension/` deste projeto (a pasta que contém `manifest.json`). Nenhum build é necessário.
3. Fixe o ícone da extensão na barra do Chrome.
4. Após se autenticar com o certificado em um site, clique no ícone. Informe um apelido, marque a confirmação de uso e clique em **Confirmar uso e acompanhar site**.
5. Autorize o acompanhamento do domínio. A extensão passa a registrar as próximas navegações de página principal e alterações de cookies relevantes.
6. Abra **Histórico e configurações** no popup para consultar o HTML, filtrar a atividade, exportar JSON, pausar ou apagar o histórico.

Em um Chrome gerenciado, a organização pode bloquear o Modo do desenvolvedor. Nesse caso, a instalação de teste precisa ser autorizada pelo administrador. Uma distribuição corporativa definitiva exige empacotamento, assinatura/hospedagem ou publicação e configuração das políticas de instalação da empresa; este projeto ainda não foi publicado nem instalado nas estações.

## O que aparece no histórico

| Registro | Origem da informação | Significado |
| --- | --- | --- |
| Uso do certificado declarado | Confirmação no popup | O usuário afirma que utilizou o apelido informado naquele domínio. A extensão não valida o titular, o certificado nem a assinatura. |
| Visita observada | `webNavigation.onCommitted`, página principal | O navegador concluiu uma navegação no domínio acompanhado. Não inclui iframes, recursos de rede, redirecionamentos intermediários ou mudanças de rota de aplicações SPA. |
| Cookies observados | Contagem retornada pela API de cookies | Cookies não particionados aplicáveis ao endereço visitado, incluindo HttpOnly. Podem ter qualquer finalidade; não demonstram que foram enviados ou que o servidor aceitou uma sessão. |
| Contexto declarado | Declaração anterior no mesmo domínio e perfil, dentro da validade, com cookies presentes | Associação temporal explícita. Não comprova o reuso da autenticação. Funciona em outras abas do mesmo perfil. Não é transferida para outros domínios ou perfis. |
| Alteração de cookie | `cookies.onChanged` | Criação, substituição ou remoção de cookie relacionado ao domínio. Qualquer alteração relevante encerra o contexto anterior, inclusive cookies de análise de acesso. |

Um contexto também termina após seu prazo (padrão: oito horas), no início de uma nova sessão do Chrome, em alterações de configuração, revogação de permissões ou encerramento manual. O reinício normal do service worker do Manifest V3 preserva os dados e o prazo. Encerrar um contexto ou apagar o histórico **não** faz logout e não altera os cookies dos sites.

O primeiro registro começa após a confirmação e autorização. Não há reconstrução do histórico anterior à instalação. É possível configurar domínios manualmente no painel, mas isso não registra uma declaração de uso de certificado. Os domínios configurados incluem seus subdomínios; o contexto de uma declaração continua restrito ao hostname exato em que ela ocorreu.

## Dados e permissões

- Tudo fica no `chrome.storage.local` do perfil, com acesso limitado aos contextos confiáveis da extensão. Não há servidor, telemetria, scripts de conteúdo nem chamadas de envio de dados.
- São armazenados horário, domínio, origem (`protocolo://host:porta`), tipo de registro, apelido informado e metadados mínimos: contagem de cookies, motivo de alteração e referência da declaração. Evite inserir CPF ou dados pessoais no apelido.
- O diagnóstico NetLog é processado somente em memória no painel, separado do histórico persistente. Seu resumo opcional contém apenas sinais técnicos e nome TLS quando resolvido; não contém o arquivo bruto, cookies, certificados ou identidade do titular. O arquivo bruto criado no Windows pode conter URLs e outros dados de navegação: mantenha-o local e apague-o conforme a política da empresa após o teste.
- Caminho, query string, fragmento, conteúdo de página, chave privada, certificado e valores de cookies não são persistidos. A API do Chrome entrega objetos de cookies à extensão; o código utiliza apenas os campos necessários e não acessa o campo `value`.
- A extensão não copia, restaura, injeta ou transmite cookies. Não interfere no processo de login dos portais.
- As permissões de host são opcionais e solicitadas por domínio em uma ação do usuário. A lista `https://*/*` no manifesto permite solicitar qualquer domínio, **não** concede acesso automaticamente a todos os sites.
- Não há coleta em sites não configurados, com monitoramento pausado ou em janelas anônimas. Remover um domínio interrompe sua coleta. Permissões antigas podem ser revogadas nas configurações da extensão no Chrome; revogá-las encerra os contextos.
- Retenção padrão: sete dias, configurável de um a 30 dias, limitada a 2.000 registros. A limpeza ocorre em atividade da extensão e periodicamente a cada hora enquanto o Chrome está em execução.
- O histórico local pode ser apagado ou alterado pelo usuário da estação. Não é uma trilha centralizada com integridade garantida, mesmo quando o Chrome é gerenciado. Não há identificação automática do funcionário, inventário de certificados ou comprovação por CPF/CNPJ.

## Desenvolvimento e validação

Node.js 22 ou superior. A extensão não tem dependências de produção e funciona diretamente de `extension/`. O Playwright é usado somente nos testes de navegador.

```sh
npm ci
npm run check
npm test
npm run test:ui
npm run test:netlog
npm run test:browser
```

O último comando utiliza um Chromium instalado em `/usr/bin/chromium`. Para outro caminho, configure a variável `CHROMIUM_PATH`. O teste usa perfil descartável, servidor HTTP local, cookies sintéticos HttpOnly e uma cópia temporária da extensão com permissão obrigatória somente para loopback, evitando prompts nativos no teste automatizado. O manifesto de produção mantém os acessos opcionais. A captura de tela é salva em `artifacts/dashboard.png`.

`test:ui` valida o HTML real no Chromium, usando uma API `chrome` simulada com dados fictícios. Exercita popup, confirmação, recusa/concessão de permissão, configurações, filtros, renderização segura, exportação e exclusão. Não substitui `test:browser` e não comprova integração com as APIs reais. Sua captura é `artifacts/dashboard-synthetic.png`.

`test:netlog` gera um NetLog real do Chromium com uma tentativa TLS local e um certificado de servidor sintético não confiável. Verifica que a validação TLS rejeita esse certificado e que o analisador não inventa um uso bem-sucedido de certificado de cliente. O teste não instala certificado no repositório do sistema, não desativa verificação e não usa A1 real. Requer OpenSSL e Chromium. A classificação positiva de handshake com certificado é coberta por fixtures sintéticas baseadas no formato do Chromium; falta validá-la com A1 no Windows.

**Resultado neste ambiente de desenvolvimento:** 28 testes unitários, verificações estáticas, teste da interface HTML com APIs simuladas e teste negativo com NetLog real do Chromium passaram. A integração `test:browser` está bloqueada porque o Chromium da nuvem possui a política `ExtensionInstallBlocklist=["*"]`, que impede carregar esta extensão. Nenhuma política foi alterada. Execute a integração em uma estação autorizada; o manifesto ainda não foi validado como extensão instalada neste ambiente. O helper PowerShell e o uso real do A1 também dependem da estação Windows.

O teste no navegador verifica que navegações não configuradas não são coletadas; declara um uso fictício; observa visitas e continuidade entre abas; simula logout e encerramento do contexto; valida o painel, filtros, exportação, pausa e exclusão. O teste **não utiliza certificado real**, não acessa gov.br e não comprova autenticação por certificado. Os testes unitários cobrem escopo por perfil/domínio, permissões, retenção, expiração e ausência de dados sensíveis nos registros.

Validação manual ainda necessária em uma estação corporativa: instalar o manifesto original, conferir os prompts de concessão e recusa de permissão, realizar um login real com A1/A3, declarar esse uso e conferir as observações do site. Não exporte cookies nem chaves durante a validação. Após alterar o código, use **Recarregar** em `chrome://extensions` e reabra o painel/popup.

## Caminho para comprovação automática

Como a empresa usa Chrome gerenciado e ainda não possui logs de autenticação, a próxima etapa de arquitetura é escolher uma fonte que observe efetivamente o uso da credencial:

1. **Aplicações controladas pela empresa:** registrar no servidor a autenticação por certificado e a criação/revogação da sessão, usando um identificador de correlação sem expor o cookie ao coletor.
2. **Portais externos, como gov.br:** avaliar um agente corporativo e a fonte de eventos disponível no sistema operacional/navegador, antes de escolher a implementação. Um host Native Messaging pode transportar eventos, mas a simples existência do host não prova o uso do certificado nem garante que todos os portais forneçam essa evidência. Não se deve supor que um proxy consegue observar uma autenticação TLS de cliente fim a fim.
3. **Extensão:** receber eventos verificáveis dessa fonte, correlacionar domínio/perfil/horário e distinguir confirmação técnica de declaração e observação. A política de instalação do Chrome distribui a extensão; ela não cria, por si só, uma API de auditoria do certificado.
4. **Auditoria corporativa:** acrescentar ingestão autenticada, identidade corporativa, retenção, controle de acesso e proteção contra alteração no servidor. O MVP atual mantém somente a interface e o registro local.

Sem uma fonte verificável, não é possível prometer uma lista completa e confiável de todos os sites que usaram o certificado ou reutilizaram sua autenticação.
