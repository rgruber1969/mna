---
status: aceito
date: 2026-11-16
decision-makers: Ricardo Gruber
scope: plataforma
---

# Banco de dados: PostgreSQL, com Neon em produção e Docker no desenvolvimento local

## Contexto e problema

A aplicação precisa de um banco de dados que sirva ao MNA e às futuras
aplicações derivadas do mesmo template. Os dados de M&A (empresas, deals,
etapas, contatos, documentos) são fortemente relacionados. O deploy previsto
é na Vercel ou similar, e a aplicação nasce com API REST documentada em
OpenAPI/Swagger e arquitetura preparada para um servidor MCP, todos passando
por uma camada de serviços única. Qual motor de banco usar, onde hospedá-lo
em produção e como rodá-lo localmente?

## Fatores de decisão

* Facilidade de publicação na Vercel e em outros provedores
* Custo sem "degrau" de licença ao crescer
* Portabilidade entre provedores (evitar dependência de fornecedor)
* Modelo relacional adequado aos dados de M&A
* Suporte de ORMs e ferramentas, e volume de exemplos para o Claude Code
* Ambiente local idêntico à produção e reprodutível pelo template
* Compatibilidade com a camada de serviços única (web, API, MCP)

## Alternativas consideradas

Motor:

* PostgreSQL
* Microsoft SQL Server Express (gratuito com limites)
* MySQL
* SQLite / libSQL (Turso)
* MongoDB

Produção:

* Neon (via Marketplace da Vercel)
* Supabase (via Marketplace da Vercel)
* Azure SQL / AWS RDS (para SQL Server)

Desenvolvimento local:

* Docker Desktop + Postgres em contêiner
* PostgreSQL instalado nativamente no Windows
* PGlite (Postgres embutido no processo Node)

## Decisão

* **Motor: PostgreSQL**, por ser livre sem limites, padrão de mercado,
  suportado por todos os provedores e ORMs, e ter extensões úteis (busca
  textual, JSONB, `pgvector` para busca semântica).
* **Produção: Neon**, criado pelo Marketplace da Vercel, porque é Postgres
  puro (toda regra passa pela camada de serviços da aplicação), cria um
  branch do banco por deploy de preview e não amarra autenticação nem
  armazenamento de arquivos a um fornecedor.
* **Desenvolvimento local: Docker Desktop**, com o Postgres definido em
  `docker-compose.yml` no repositório, na mesma versão major usada no Neon,
  para que o ambiente local seja reprodutível e faça parte do template.

### Consequências

* Positiva: deploy portátil (Vercel, Railway, Render, Azure etc.).
* Positiva: ambiente local versionado e igual ao de produção.
* Positiva: banco isolado por preview no fluxo da Vercel.
* Negativa: requer instalar WSL 2 e Docker Desktop no Windows (administrador
  e reinício) e consome ~2–4 GB de RAM enquanto o Docker roda.
* Negativa: Docker Desktop é pago para empresas com 250+ funcionários ou
  US$ 10 milhões+ de faturamento.
* Negativa: autenticação e armazenamento de arquivos precisam de decisões e
  serviços próprios (não vêm junto com o banco).
* Negativa: no plano gratuito do Neon, o banco "dorme" quando ocioso; a
  primeira consulta após o repouso tem latência extra.

### Confirmação

* `docker-compose.yml` no repositório com a imagem `postgres` fixada na
  versão major do Neon.
* String de conexão sempre via variável `DATABASE_URL`, nunca no código.
* Nenhum acesso ao banco fora da camada de serviços (verificável em revisão
  e, futuramente, por regra de lint).

## Prós e contras das alternativas

### PostgreSQL

* Prós: livre; portátil; ecossistema amplo; `pgvector`; drivers para
  serverless.
* Contras: nenhum relevante para este contexto.

### SQL Server Express

* Prós: gratuito para produção; excelente com .NET, SSMS e Power BI.
* Contras: limites de tamanho, memória e CPU; salto de custo para a edição
  Standard; sem opção no Marketplace da Vercel (empurra o deploy para a
  Azure); sem driver serverless; baixa portabilidade.

### MySQL

* Prós: relacional, maduro, barato.
* Contras: menos recursos que o PostgreSQL; menos opções no ecossistema
  Vercel.

### SQLite / libSQL

* Prós: simples, sem servidor.
* Contras: limites de escrita concorrente; menos recursos.

### MongoDB

* Prós: flexível para dados sem esquema.
* Contras: inadequado para dados muito relacionados; relatórios mais
  difíceis.

### Neon

* Prós: Postgres puro; integração nativa com a Vercel; branch por preview;
  banco adormece quando ocioso e acorda sozinho.
* Contras: auth e arquivos ficam por conta de outros serviços; latência na
  primeira consulta após o repouso.

### Supabase

* Prós: pacote com auth, arquivos, tempo real e API automática.
* Contras: API automática e acesso direto do navegador contornam a camada de
  serviços; maior dependência de fornecedor; projeto gratuito pausa após
  inatividade.

### Docker Desktop (local)

* Prós: idêntico à produção; reprodutível; versionado no repositório; serve
  para outros serviços locais no futuro.
* Contras: instalação de WSL e Docker; consumo de memória; licença paga para
  empresas grandes.

### PostgreSQL nativo (local)

* Prós: instalação simples, leve.
* Contras: configuração fora do repositório; uma versão por máquina.

### PGlite (local)

* Prós: zero instalação.
* Contras: uma conexão por vez; extensões limitadas; só JavaScript;
  diferenças sutis em relação ao Postgres real.

## Mais informações

* Relacionado: ADR-0001, ADR-0002.
* Próximos ADRs: linguagem/framework (considerando API com OpenAPI/Swagger e
  preparação para MCP) e autenticação.
* Revisitar o provedor se o plano gratuito do Neon deixar de atender ou se o
  deploy sair da Vercel.
