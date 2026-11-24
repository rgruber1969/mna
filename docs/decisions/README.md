# Decisões de arquitetura

Resumo das decisões de **plataforma** (reaproveitáveis em qualquer
projeto). Contexto, alternativas e prós e contras ficam em cada ADR (formato
MADR, ver ADR-0001). Regras específicas da aplicação ficam no `CLAUDE.md` do
projeto e em `docs/projeto/`.

## Decisões em vigor

| ADR | Tema | Decisão |
|---|---|---|
| [0001](0001-registrar-decisoes-de-arquitetura-com-adrs.md) | Registro de decisões | ADRs MADR + este resumo |
| [0002](0002-pasta-de-trabalho-local-e-backup.md) | Pasta e backup | `C:\dev\<nome>`; commits frequentes; GitHub privado como backup; dados locais em backup criptografado (adendos) |
| [0003](0003-banco-de-dados-postgresql-neon-docker.md) | Banco | PostgreSQL; Neon (produção), Docker (local) |
| [0004](0004-linguagem-e-framework-typescript-nextjs-hono.md) | Stack | TypeScript; Next.js + Hono com OpenAPI via Zod; camada de serviços |
| [0005](0005-autenticacao-better-auth.md) | Autenticação | Better Auth, dados no nosso banco |
| [0006](0006-baseline-de-seguranca-asvs-nist-lgpd.md) | Segurança | ASVS 5.0 nível 2 + NIST 800-63B + LGPD |
| [0007](0007-protecao-de-dados-pessoais.md) | Dados pessoais | Classificação; sensíveis criptografados; logs sem dados pessoais |
| [0008](0008-organizacao-das-instrucoes-do-claude-code.md) | Instruções do Claude | CLAUDE.md como índice; `docs/projeto/`; rules; skills |
| [0009](0009-multi-tenant-banco-unico-com-rls.md) | Multi-tenant | Banco único, `tenant_id` + RLS |
| [0010](0010-white-label-tokens-por-tenant.md) | White label | Tokens limitados por tenant; tokens semânticos obrigatórios; logos PNG/JPG/WebP e e-mail com logo; paleta 2 + 1 com cor de destaque por tenant e cores de situação fixas (adendos) |
| [0011](0011-enderecos-subdominio-por-tenant-e-console.md) | Endereços | Subdomínio por tenant; console `admin.` na mesma aplicação |
| [0012](0012-armazenamento-de-arquivos-s3.md) | Arquivos | Protocolo S3: RustFS (local) / R2 / S3 São Paulo |
| [0013](0013-modelo-de-permissoes.md) | Permissões | Perfis configuráveis, por função (lado vem do papel); participação com alcance; lista de acesso de quem cria; negado por padrão |
| [0014](0014-envio-de-email.md) | E-mail | Mailpit / Resend / SES São Paulo |
| [0015](0015-tarefas-em-segundo-plano-inngest.md) | Tarefas em segundo plano | Inngest; lógica separada da orquestração; só identificadores |
| [0016](0016-antivirus-nos-uploads.md) | Antivírus | Simulado (local/demo), GuardDuty (produção); download só após "Disponível" |
| [0017](0017-gestao-de-chaves-de-criptografia.md) | Chaves | Envelope com chave por tenant em todos os ambientes; chave mestra no `.env` / Vercel (fora da produção) ou AWS KMS (produção); anexos de cadastro também criptografados (adendo) |
| [0018](0018-ferramentas-de-desenvolvimento.md) | Ferramentas | Drizzle; shadcn/ui + Tailwind; Vitest + Playwright; ESLint + Prettier; pnpm |
| [0019](0019-identidade-unica-e-vinculo-por-tenant.md) | Identidade | Conta única + vínculo por tenant (tabelas próprias, RLS); sessão única por endereço |
| [0020](0020-internacionalizacao-preparada-desde-a-v1.md) | Idiomas | Base de idiomas (next-intl) desde a V1, só português; textos em arquivos de mensagens; idioma por usuário |
| [0021](0021-leitura-de-documentos-para-cadastro.md) | Leitura de documentos | Local sem IA (texto do PDF, CNPJ/CPF, base pública), sempre com conferência; IA depois no mesmo módulo |
| [0022](0022-busca-por-conteudo-dos-documentos.md) | Busca em documentos | Texto extraído no servidor, no banco com índice em português; só versões visíveis à pessoa; escaneados depois (OCR) |

## Premissas de arquitetura

* **Camada de serviços única:** telas, API e MCP só chamam serviços.
* **API REST desde a versão 1**, com OpenAPI/Swagger gerado do código.
* **Preparada para MCP:** mesmas operações e regras da API.
* **Autenticação ≠ autorização:** agente de IA nunca vê mais que o usuário.
* **Padrão × política:** padrões no ADR-0006; políticas no projeto.

## Em discussão

| Tema | Situação |
|---|---|

## Decisões menores (sem ADR próprio)

| Tema | Decisão | Data |
|---|---|---|
| Finais de linha | LF em todos os arquivos (`.gitattributes`) | 2026-11-16 |
| Tema visual padrão | Identidade RGRUBER ([docs/marca/rgruber](../marca/rgruber/README.md)) | 2026-11-16 |
| Nome do produto | Sempre por configuração (`PRODUCT_NAME`), nunca escrito em telas e e-mails | 2026-11-17 |
| Região do banco | Produção na mesma região dos arquivos (São Paulo) | 2026-11-17 |
| Região das funções | Funções da Vercel em São Paulo (`gru1`), na mesma região do banco | 2026-11-17 |
| Resumos automáticos | Módulo único de resumo; local e demonstração com resumo local sem IA (nada sai do servidor); produção: IA ou local, a decidir | 2026-11-17 |
| Funcionalidades simuladas | Configuração por funcionalidade (real ou simulada); simulada sempre com aviso visível; a aplicação recusa iniciar em produção com funcionalidade simulada | 2026-11-17 |
| Hooks do Claude Code | Após editar: Prettier + ESLint no arquivo (e aviso de CLAUDE.md > 80 linhas); após `pnpm add`: aviso de pacotes bloqueados; antes de commit: varredura de segredos; ao encerrar: tipos + testes ([.claude/hooks](../../.claude/hooks)) | 2026-11-17 |
| Checklist ASVS | 253 requisitos L1/L2 classificados em [docs/seguranca/asvs-checklist.md](../seguranca/asvs-checklist.md) | 2026-11-17 |
| Entrada de desenvolvimento | Só e-mail, ligada por variável, só em `*.localhost`; a aplicação recusa iniciar em produção com ela ([autenticacao-e-sessao.md](../projeto/autenticacao-e-sessao.md)) | 2026-11-18 |
| Consulta de CNPJ e CEP | BrasilAPI (CNPJ, com quadro de sócios; CNPJ.ws de reserva e resultado guardado 24 h na memória, ajuste de 2026-11-19) e ViaCEP (CEP, com a BrasilAPI de reserva); gratuitos, sem chave; consulta pelo servidor; fora do ar, preenchimento manual | 2026-11-18 |
| Layout das áreas logadas | Inspirado no tema de referência indicado pelo responsável: menu lateral recolhível, cabeçalho sem fundo com paleta de comandos (Ctrl K), mensagens, sino e foto; menu do usuário no rodapé do menu lateral (ajuste de 2026-11-23); rodapé discreto; modo claro e escuro por usuário; menu lateral com grupos e favoritos guardados no banco | 2026-11-19 |
| Nome do processo em PT-BR | "Negócio" nas telas, e-mails e textos; "deal" só como nome interno (código, banco, documentação) | 2026-11-19 |
| Listas | Paginação numerada no servidor (25 por página; 10, 50 ou 100), total visível, ordenação por coluna; página, busca, filtros e ordem no endereço; componente único para todas as listas | 2026-11-19 |
| Telas de cadastro grandes | Abas por assunto, um único Salvar, aba com erro sinalizada e aberta sozinha, aba no endereço; criação com formulário curto e o restante nas abas | 2026-11-19 |
| Usuários e acesso | Usuários, Perfis e Auditoria num item só do menu (Administração), com abas no topo das três telas | 2026-11-23 |
| Tela do negócio | Abas verticais em grupos (Negócio, Trabalho, Comercial), como o painel do kanban; atalho único "Compradoras e ofertas" na etapa de prospecção | 2026-11-23 |
| Linhas das listas | Linha destacada ao passar o mouse em todas as tabelas; nas listas principais, a linha inteira abre o registro; seletor "Por página" único (10, 25, 50, 100) | 2026-11-23 |
| Configurações | Um item de menu "Configurações", com abas **verticais** em dois grupos (Tenant; Cadastros auxiliares), em ordem alfabética dentro de cada grupo (ajuste de 2026-11-23); cadastros auxiliares em tabela, com as ações em colunas e inclusão na última linha ("Adicionar") | 2026-11-19 |

## Substituídas

Nenhuma até o momento.
