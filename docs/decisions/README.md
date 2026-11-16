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

## Em discussão

| Tema | Situação |
|---|---|
| Modelo de permissões | Papel global + papel por recurso; ADR próprio |
| Envio de e-mail | Necessário para convites, link mágico e recuperação de senha |
| ORM, interface, testes e lint | Na criação do projeto |
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

### O que são Hono e Zod (ADR-0004)

* **Hono:** framework para construir a API, a parte da aplicação que atende
  outros sistemas com dados, não pessoas com telas. Define as rotas (ex.:
  `GET /api/contatos/42` devolve o contato 42 em JSON; `POST /api/contatos`
  cria um contato) e o que cada uma faz. É leve, roda dentro do Next.js na Vercel ou
  sozinho em qualquer servidor, e o complemento `@hono/zod-openapi` gera a
  documentação Swagger automaticamente. Analogia: o Next.js é a recepção que
  atende pessoas; o Hono é o balcão de protocolo que atende sistemas.
* **Zod:** biblioteca para descrever o formato dos dados e verificá-los.
  Escreve-se uma vez como um dado deve ser, por exemplo:

  ```ts
  const NovoContato = z.object({
    nome: z.string().min(3),
    email: z.string().email(),
    tipo: z.enum(["cliente", "fornecedor", "parceiro"]),
  })
  ```

  Essa única definição serve a quatro usos: (1) **validação**: a API recusa
  dados inválidos com mensagem clara; (2) **Swagger**: a documentação mostra
  campos e valores permitidos; (3) **MCP**: um agente de IA sabe que dados
  fornecer; (4) **telas**: o TypeScript aponta, já no editor, o uso de campos
  inexistentes. Documentação e comportamento nunca divergem.
* **Swagger / OpenAPI:** OpenAPI é o padrão de descrição de APIs; Swagger é
  a página interativa que lê essa descrição e permite consultar e testar
  cada rota pelo navegador.

### O que é Better Auth (ADR-0005)

* **Biblioteca de autenticação** open source em TypeScript que roda dentro da
  própria aplicação (não é um serviço externo). Usuários, sessões e chaves
  ficam em tabelas no nosso PostgreSQL.
* **Funciona por plugins**, ativados conforme a necessidade: e-mail e senha,
  link mágico (login por link enviado ao e-mail), login com Google/Microsoft,
  2FA, passkeys, organizações e convites, papéis, chaves de API para
  integrações e servidor OAuth para clientes MCP.
* **Responde "quem é você?"** (autenticação). "O que você pode fazer?"
  (autorização, como acesso restrito a determinados registros) é regra
  nossa, na camada de serviços.
* **Custo zero por usuário:** importante quando há muitos usuários externos
  (clientes, parceiros, convidados).
* **Responsabilidade nossa:** manter a biblioteca atualizada, configurar
  limite de tentativas e cookies seguros, e construir as telas de login,
  convite e 2FA.
* **Contexto:** a equipe do Auth.js (NextAuth), biblioteca mais antiga do
  ecossistema, juntou-se ao Better Auth em 2025; o Auth.js ficou em
  manutenção.

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
