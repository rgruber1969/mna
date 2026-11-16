# Decisões de arquitetura

Estado atual das decisões do projeto. Cada linha aponta para o ADR com o
contexto, as alternativas e os prós e contras (formato MADR,
ver [ADR-0001](0001-registrar-decisoes-de-arquitetura-com-adrs.md)).

**Escopo:** `plataforma` = reaproveitado no template e em futuras aplicações;
`projeto` = específico da aplicação atual.

Este arquivo contém apenas decisões e premissas de plataforma, reaproveitáveis
em qualquer projeto. Regras de negócio e premissas específicas da aplicação
ficam no `CLAUDE.md` do projeto.

## Decisões em vigor

| Tema | Decisão | Escopo | ADR |
|---|---|---|---|
| Registro de decisões | ADRs MADR em `docs/decisions/` + este resumo | plataforma | [0001](0001-registrar-decisoes-de-arquitetura-com-adrs.md) |
| Pasta e backup | Projetos em `C:\dev\<nome>`; git com commits frequentes; backup manual no Google Drive | plataforma | [0002](0002-pasta-de-trabalho-local-e-backup.md) |
| Banco de dados | PostgreSQL; produção no Neon (Marketplace da Vercel); local em Docker Desktop | plataforma | [0003](0003-banco-de-dados-postgresql-neon-docker.md) |
| Linguagem / framework | TypeScript; Next.js (telas) + Hono em `/api` com OpenAPI/Swagger via Zod; camada de serviços independente | plataforma | [0004](0004-linguagem-e-framework-typescript-nextjs-hono.md) |
| Autenticação | Better Auth, usuários e sessões no nosso PostgreSQL; autorização na camada de serviços | plataforma | [0005](0005-autenticacao-better-auth.md) |
| Baseline de segurança | OWASP ASVS 5.0 nível 2 + NIST SP 800-63B (senhas, 2FA, recuperação) + LGPD; políticas de negócio definidas por projeto | plataforma | [0006](0006-baseline-de-seguranca-asvs-nist-lgpd.md) |
| Dados pessoais | Inventário e classificação; criptografia por campo para dados sensíveis; logs sem dados pessoais; testes e previews sem dados reais; retenção e exclusão | plataforma | [0007](0007-protecao-de-dados-pessoais.md) |
| Instruções do Claude Code | CLAUDE.md como índice (~80 linhas); regras de negócio em `docs/projeto/`; `.claude/rules/` com `paths:`; skills para procedimentos | plataforma | [0008](0008-organizacao-das-instrucoes-do-claude-code.md) |
| Multi-tenant | Banco único; `tenant_id` em toda tabela de negócio; RLS no PostgreSQL + filtro na camada de serviços; tenant = organização do Better Auth; usuário global com participação por tenant | plataforma | [0009](0009-multi-tenant-banco-unico-com-rls.md) |

## Premissas de arquitetura

Requisitos que orientam as próximas decisões:

* **Camada de serviços única:** toda regra de negócio e todo acesso ao banco
  ficam numa camada de serviços. Interface web, API REST e (futuro) servidor
  MCP são apenas "portas de entrada" que chamam essa camada.
* **API REST desde a versão 1**, documentada em OpenAPI e navegável via
  Swagger, com a especificação gerada a partir do código.
* **Preparada para MCP:** o servidor MCP não entra na versão 1, mas as
  operações expostas na API devem poder virar ferramentas MCP sem reescrever
  regras.
* **Autenticação para três públicos:** pessoas (web), sistemas (API, via
  chave ou token) e agentes de IA (MCP, via OAuth).
* **Autenticação ≠ autorização:** o login diz *quem é* o usuário; o que ele
  pode ver e fazer é verificado na camada de serviços, igual para telas, API
  e MCP. Um agente de IA nunca enxerga mais que o usuário que o autorizou.
* **Padrão × política:** os padrões de segurança (ADR-0006) definem *como*
  implementar; as políticas de negócio (quem convida, quais perfis exigem
  2FA, duração de sessão, retenção de auditoria, matriz de permissões) são
  definidas no `CLAUDE.md` de cada projeto, dentro desse baseline.

## Em discussão

| Tema | Situação |
|---|---|
| White label | Logomarca, nome e cores por tenant, com verificação de contraste; tema padrão RGRUBER; próxima decisão |
| Modelo de permissões | Papel global + papel por recurso, dentro do tenant; ADR próprio |
| Envio de e-mail | Necessário para convites, link mágico e recuperação de senha |
| ORM, interface, testes e lint | Na criação do projeto |
| Armazenamento de arquivos | A decidir (o Neon não inclui; ex.: Vercel Blob, S3); seguir as regras do ADR-0007 para documentos; necessário para logos de tenant |
| Gestão de chaves de criptografia | Guarda, backup e rotação das chaves do ADR-0007 |
| Checklist ASVS nível 2 | Curadoria dos itens aplicáveis; vira skill/rule do template |

## Notas explicativas

Explicações dos conceitos e ferramentas adotados (WSL e Docker, Neon, Hono,
Zod, Swagger/OpenAPI, Better Auth, ASVS, NIST, LGPD, proteção de dados
pessoais, instruções do Claude Code, multi-tenant e RLS) ficam em
[notas-explicativas.md](notas-explicativas.md), para leitura. Esse arquivo
não é referenciado no CLAUDE.md, para não pesar no contexto das sessões.

## Decisões menores (sem ADR próprio)

Escolhas de baixo impacto e fáceis de reverter ficam só aqui.

| Tema | Decisão | Data |
|---|---|---|
| Finais de linha | LF em todos os arquivos (`.gitattributes`) | 2026-11-16 |
| Tema visual padrão | Identidade RGRUBER: `#123E7A` / `#5E8FD3` / `#5E6470`, Manrope, sem degradês ([docs/marca/rgruber](../marca/rgruber/README.md)) | 2026-11-16 |

## Substituídas

Nenhuma até o momento.

## Como manter

* Novo ADR aceito → adicionar linha em "Decisões em vigor" no mesmo commit.
* ADR substituído → mover a linha para "Substituídas", com link para o novo.
* O CLAUDE.md referencia este arquivo com `@docs/decisions/README.md`, não os
  ADRs individuais nem as notas explicativas.
* Nova ferramenta ou conceito adotado → explicação em
  [notas-explicativas.md](notas-explicativas.md), não neste arquivo.
