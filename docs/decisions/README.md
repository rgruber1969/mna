# Decisões de arquitetura

Estado atual das decisões do projeto. Cada linha aponta para o ADR com o
contexto, as alternativas e os prós e contras (formato MADR,
ver [ADR-0001](0001-registrar-decisoes-de-arquitetura-com-adrs.md)).

**Escopo:** `plataforma` = reaproveitado no template e em futuras aplicações;
`MNA` = específico desta aplicação.

## Decisões em vigor

| Tema | Decisão | Escopo | ADR |
|---|---|---|---|
| Registro de decisões | ADRs MADR em `docs/decisions/` + este resumo | plataforma | [0001](0001-registrar-decisoes-de-arquitetura-com-adrs.md) |
| Pasta e backup | Projetos em `C:\dev\<nome>`; git com commits frequentes; backup manual no Google Drive | plataforma | [0002](0002-pasta-de-trabalho-local-e-backup.md) |
| Banco de dados | PostgreSQL; produção no Neon (Marketplace da Vercel); local em Docker Desktop | plataforma | [0003](0003-banco-de-dados-postgresql-neon-docker.md) |

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

## Em discussão

| Tema | Situação |
|---|---|
| Linguagem / framework | Próxima decisão; considerar OpenAPI/Swagger nativo e SDK MCP |
| Autenticação | Depois da linguagem |
| Armazenamento de arquivos | A decidir (o Neon não inclui; ex.: Vercel Blob, S3) |

## Notas explicativas

### O que são WSL e Docker (ambiente local do ADR-0003)

* **WSL 2 (Windows Subsystem for Linux):** recurso do Windows que roda um
  Linux de verdade, leve, dentro do próprio Windows, sem máquina virtual
  pesada nem dual boot. Muitas ferramentas de servidor (inclusive o
  PostgreSQL usado na nuvem) nascem para Linux; o WSL permite rodá-las
  localmente como rodam em produção.
* **Docker:** ferramenta que empacota um programa com tudo de que ele precisa
  (sistema base, bibliotecas, configuração) numa **imagem**. Uma imagem em
  execução é um **contêiner**: um processo isolado do resto da máquina. Em
  vez de instalar o PostgreSQL no Windows, baixa-se a imagem oficial
  `postgres:17` e roda-se um contêiner a partir dela.
* **Docker Desktop:** o aplicativo que instala e administra o Docker no
  Windows. Ele usa o WSL 2 como "motor" Linux por baixo.
* **`docker-compose.yml`:** arquivo no repositório que descreve os
  contêineres do projeto (imagem, versão, porta, senha local, pasta de
  dados). `docker compose up -d` sobe tudo; `docker compose down` para.
  Como o arquivo está no git, qualquer máquina (ou projeto criado pelo
  template) obtém o mesmo banco com um comando.
* **Dados persistem** num "volume" do Docker: parar ou reiniciar o contêiner
  não apaga o banco; apagar o volume, sim.
* **Licença:** Docker Desktop é gratuito para uso pessoal e empresas com
  menos de 250 funcionários e menos de US$ 10 milhões de faturamento anual.

### Características do Neon (produção do ADR-0003)

* **Postgres puro e serverless:** só banco de dados, sem autenticação ou API
  embutidas. Toda regra passa pela camada de serviços da aplicação.
* **Integração com a Vercel:** criado pelo Marketplace da Vercel, sem conta
  separada; cobrança, se houver, na fatura da Vercel; a variável
  `DATABASE_URL` é injetada automaticamente no projeto.
* **Sucessor do Vercel Postgres:** o antigo banco nativo da Vercel foi
  migrado para o Neon.
* **Branch por preview:** cada deploy de preview na Vercel pode ganhar uma
  cópia isolada do banco, criada automaticamente.
* **Adormece quando ocioso (plano gratuito):** economiza recursos e acorda
  sozinho; a primeira consulta após o repouso tem latência extra.
* **Driver para serverless:** conexão por HTTP/WebSocket, adequada às funções
  da Vercel.
* **Portável:** por ser Postgres padrão, migra para qualquer outro provedor
  com `pg_dump`/`pg_restore`.
* **Não inclui:** autenticação e armazenamento de arquivos (decisões
  próprias).

## Decisões menores (sem ADR próprio)

Escolhas de baixo impacto e fáceis de reverter ficam só aqui.

| Tema | Decisão | Data |
|---|---|---|
| Finais de linha | LF em todos os arquivos (`.gitattributes`) | 2026-11-16 |

## Substituídas

Nenhuma até o momento.

## Como manter

* Novo ADR aceito → adicionar linha em "Decisões em vigor" no mesmo commit.
* ADR substituído → mover a linha para "Substituídas", com link para o novo.
* O CLAUDE.md referencia este arquivo com `@docs/decisions/README.md`, não os
  ADRs individuais.
