# SGSI · Sistema de Gestão de Segurança da Informação (ISO/IEC 27001:2022)

Aplicação web para gerir o SGSI da empresa rumo à certificação ISO/IEC 27001:2022.
Front-end em **React + Vite + Tailwind**, back-end em **Supabase (PostgreSQL + Auth)**.

## Módulos

| Módulo | Cláusula / Anexo A da norma |
|---|---|
| Painel de Conformidade | Visão geral (SoA, riscos, NCs, auditorias) |
| Partes Interessadas | Cláusula 4.2 |
| Inventário de Ativos | Base da gestão de riscos |
| Gestão de Riscos | Cláusulas 6.1 e 8 (matriz 5×5, risco inerente/residual, tratamento) |
| Declaração de Aplicabilidade (SoA) | Anexo A — 93 controles, exportável em CSV |
| Documentos e Políticas | Cláusula 7.5 (versão, aprovação, revisão) |
| Incidentes | A.5.24 a A.5.28 |
| Fornecedores | A.5.19 a A.5.23 |
| Auditorias | Cláusula 9.2 |
| Não Conformidades e Ações Corretivas | Cláusula 10 |
| Objetivos e Indicadores | Cláusulas 6.2 e 9.1 |

## Como rodar localmente

Pré-requisito: Node.js 18+ (testado no Node 22).

```bash
cd sgsi-app
npm install
npm run dev
```

Acesse http://localhost:5173. O arquivo `.env` já vem preenchido com as
credenciais do projeto Supabase da CERTISEGURO.

### Build de produção

```bash
npm run build      # gera a pasta dist/
npm run preview    # serve o build localmente para conferência
```

Para publicar (Vercel, Netlify, Cloudflare Pages, etc.): faça deploy da pasta
`dist/` e configure as variáveis de ambiente `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY`. Em hospedagem de SPA, aponte o *fallback* para
`index.html` (rotas do lado do cliente).

## Configuração do Supabase

- **Projeto:** `wzftcpykmickmykcfhmg` (organização CERTISEGURO, região sa-east-1).
- Todas as tabelas do SGSI usam o prefixo **`sgsi_`** no schema `public`, isoladas
  das tabelas de negócio já existentes no projeto.
- **RLS** está ativado em todas as tabelas: apenas usuários **autenticados**
  leem/escrevem. O catálogo de controles (`sgsi_controles`) é somente leitura.

### Primeiro acesso

1. Abra o app e clique em **Criar conta** para cadastrar o primeiro usuário.
2. Se o Supabase estiver com *"Confirm email"* ativado (Authentication →
   Providers → Email), o usuário precisa confirmar pelo e-mail antes de entrar.
   Para uso interno, você pode desativar essa opção no painel do Supabase.
3. Ao entrar, um registro é criado automaticamente em `sgsi_perfis`.

## Modelo de dados (resumo)

- `sgsi_perfis` — usuários (vinculados a `auth.users`), com campo `papel`
  (`admin`/`gestor`/`auditor`/`leitor`) para evolução de permissões.
- `sgsi_ativos` — inventário, com classificação C/I/D (1–5) e criticidade calculada.
- `sgsi_controles` — catálogo dos 93 controles do Anexo A (dados de referência).
- `sgsi_soa` — Declaração de Aplicabilidade (1 linha por controle).
- `sgsi_riscos` + `sgsi_riscos_controles` — riscos com nível inerente/residual
  (colunas calculadas) e vínculo N:N com controles.
- `sgsi_auditorias`, `sgsi_nao_conformidades`, `sgsi_acoes_corretivas`,
  `sgsi_documentos`, `sgsi_incidentes`, `sgsi_objetivos`,
  `sgsi_fornecedores`, `sgsi_partes_interessadas`.

## Próximos passos sugeridos

- **RBAC por papel:** hoje todo usuário autenticado tem acesso total (modelo de
  ferramenta interna). O campo `sgsi_perfis.papel` já existe para restringir
  escrita (ex.: `leitor` só visualiza) via políticas RLS.
- **Upload de evidências:** usar o Supabase Storage para anexar arquivos a
  documentos, controles e ações corretivas.
- **Análise crítica pela direção (9.3)** e **relatórios PDF** de SoA e riscos.
- **Histórico/versionamento** de documentos.
