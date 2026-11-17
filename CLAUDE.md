# MNA

Sistema da RGRUBER Consultoria para controlar todas as fases de processos
de M&A (inicialmente aquisições, foco no sell side): deals, etapas,
documentos com versões (data room), tarefas, contratos de serviço,
valuation e e-book. SaaS multi-tenant e white label: cada contratante
(ex.: escritório de advocacia) é um tenant; tenant piloto: BT.

Decisões de arquitetura em vigor (stack, segurança, tenants):
@docs/decisions/README.md

## Regras de negócio (ler o documento antes de mexer na área)

- Entidades e processo: [docs/projeto/dominio.md](docs/projeto/dominio.md)
- Perfis e permissões: [docs/projeto/perfis-e-permissoes.md](docs/projeto/perfis-e-permissoes.md)
- Autenticação e sessão: [docs/projeto/autenticacao-e-sessao.md](docs/projeto/autenticacao-e-sessao.md)
- Dados pessoais e auditoria: [docs/projeto/dados-pessoais.md](docs/projeto/dados-pessoais.md)
- Escopo da versão 1: [docs/projeto/escopo-v1.md](docs/projeto/escopo-v1.md)
- Fora da versão 1: [docs/projeto/backlog-futuro.md](docs/projeto/backlog-futuro.md)
- Ambientes, domínios e nome do produto: [docs/projeto/ambientes-e-dominios.md](docs/projeto/ambientes-e-dominios.md)
- Identidade visual padrão: [docs/marca/rgruber/README.md](docs/marca/rgruber/README.md)

## Regras inegociáveis

- **Isolamento por tenant:** toda tabela de negócio tem `tenant_id` com RLS;
  o tenant vem da sessão ou da chave de API, nunca de parâmetro do cliente.
- **Camada de serviços única:** telas, API e MCP só chamam serviços;
  nenhum acesso ao banco fora deles.
- **Permissões em toda operação:** verificadas na camada de serviços, por
  menu × ação (ver, criar, editar, excluir, baixar) e por deal. API e MCP
  seguem exatamente as mesmas regras das telas.
- **Auditoria de tudo:** toda ação relevante gera evento de auditoria,
  inclusive visualização de dados sensíveis e downloads.
- **Dados pessoais:** CPF, RG, dados de cônjuge e salário criptografados
  por campo; nenhum dado pessoal em logs; novo campo pessoal → atualizar o
  inventário em `docs/projeto/dados-pessoais.md` no mesmo commit.
- **Cores só por tokens semânticos** (`primary`, `surface`, `text-muted`
  etc.); nunca cor fixa em componente.
- **Nome do produto só por configuração** (`PRODUCT_NAME`): "MNA" é
  codinome; nunca escrever o nome diretamente em telas, e-mails ou textos.
- **Fora da versão 1** → registrar em `docs/projeto/backlog-futuro.md`.

## Endereços

- Console da RGRUBER: `admin.<domínio>` (local: `admin.localhost:3000`).
- Tenant: `<slug>.<domínio>` (local: `bt.localhost:3000`).
- Demonstração: `<domínio>` = `mna.rgruber.com.br`; definitivo pendente.

## Comandos

- Serviços locais (Postgres, Mailpit, Inngest): `docker compose up -d`.
- Primeira vez: copiar `.env.example` para `.env`; `pnpm install`;
  `pnpm db:preparar`; `pnpm db:migrar`; `pnpm db:migrar:teste`.
- Aplicação: `pnpm dev` (http://localhost:3000; API em `/api/docs`).
- Antes de commitar: `pnpm verificar` (tipos, lint, formatação, testes);
  navegador: `pnpm test:e2e`.
- Mudou `src/server/db/esquema.ts`: `pnpm db:gerar` e depois `pnpm db:migrar`.

## Estrutura

- `docs/decisions/`: ADRs, resumo (`README.md`) e notas explicativas.
- `docs/projeto/`: regras de negócio do MNA (fonte da verdade).
- `docs/marca/`: identidade visual e logos.
- `docs/seguranca/asvs-checklist.md`: checklist ASVS (consultar em trabalho de segurança).
- `docs/claude/instrucoes-repetidas.md`: registro de repetições.
- `src/server/services/`: camada de serviços (regras de negócio).
- `src/server/api/`: rotas Hono; `src/server/db/`: esquema, migrações e acesso;
  `src/server/tarefas/`: Inngest. `e2e/`: testes no navegador.
- `.claude/rules/`: regras por área, com `paths:` (a criar com o código).

## Manutenção deste arquivo

- Meta: até ~80 linhas (ADR-0008). Ao passar, propor o que mover para
  `docs/projeto/`, rule ou skill, antes de mover.
- Regra só fica aqui se valer para qualquer tarefa.
