---
status: aceito
date: 2026-11-16
decision-makers: Ricardo Gruber
scope: plataforma
---

# Linguagem e framework: TypeScript com Next.js e API em Hono

## Contexto e problema

A aplicação precisa de interface web, de uma API REST documentada em
OpenAPI/Swagger desde a versão 1 e de arquitetura preparada para um servidor
MCP, todos chamando uma camada de serviços única sobre PostgreSQL (ADR-0003).
O deploy previsto é na Vercel, e a stack será reaproveitada em futuras
aplicações. Qual linguagem e quais frameworks usar?

## Fatores de decisão

* OpenAPI/Swagger gerado a partir do código, sem especificação escrita à mão
* SDK oficial de MCP na linguagem escolhida
* Uma única definição por operação, compartilhada por web, API e MCP
* Deploy simples na Vercel (idealmente um projeto, um deploy)
* Uma linguagem só, com tipos de ponta a ponta
* Ecossistema e volume de exemplos para o Claude Code
* Possibilidade de sair da Vercel sem reescrever a API

## Alternativas consideradas

* TypeScript: Next.js com API em Hono montada dentro dele
* TypeScript: Next.js (telas) + NestJS (API)
* Python FastAPI (API) + Next.js (telas)
* C# ASP.NET Core (+ Blazor ou React)

## Decisão

Alternativa escolhida: "TypeScript: Next.js com API em Hono", porque um único
esquema Zod por operação define ao mesmo tempo a validação de entrada, a
especificação OpenAPI exibida no Swagger, o esquema das ferramentas MCP (o
SDK MCP em TypeScript também usa Zod) e os tipos das telas, num único
repositório publicado como um único projeto na Vercel.

Estrutura de referência:

* **Next.js (App Router)** para a interface web.
* **Hono** montado em `/api` (rota catch-all do Next.js), com
  `@hono/zod-openapi` gerando a especificação OpenAPI e uma interface Swagger
  servida pela própria aplicação.
* **Camada de serviços** em módulo próprio, sem dependência de Next.js ou
  Hono, chamada pelas telas (Server Components/Server Actions), pelas rotas
  Hono e, futuramente, pelo servidor MCP.
* **Zod** como fonte única dos esquemas de entrada e saída.
* **MCP (futuro)** com o SDK oficial em TypeScript, expondo operações da
  camada de serviços como ferramentas.
* TypeScript em modo `strict`.

### Consequências

* Positiva: cada operação é descrita uma vez e serve a web, API e MCP.
* Positiva: um repositório e um deploy na Vercel.
* Positiva: a API em Hono roda fora do Next.js (Node, Bun, Cloudflare,
  contêiner) se for preciso sair da Vercel.
* Positiva: maior base de exemplos para o Claude Code.
* Negativa: curva do Next.js (fronteira servidor/cliente, cache, mudanças
  entre versões).
* Negativa: duas camadas de roteamento (Next.js para telas, Hono para API)
  exigem convenção clara de onde cada coisa fica.
* Negativa: análise de dados e IA pesadas, se surgirem, são menos naturais
  que em Python; podem virar um serviço à parte.

### Confirmação

* A especificação OpenAPI é gerada pelo código e o Swagger fica acessível em
  ambiente de desenvolvimento.
* Rotas Hono e telas não acessam o banco diretamente: só chamam a camada de
  serviços (revisão e, futuramente, regra de lint).
* Todo endpoint tem esquema Zod de entrada e saída.

## Prós e contras das alternativas

### Next.js + Hono (TypeScript)

* Prós: um esquema para validação, OpenAPI, MCP e tipos; um deploy na
  Vercel; Hono portátil; ecossistema amplo.
* Contras: curva do Next.js; dois roteadores para organizar.

### Next.js + NestJS (TypeScript)

* Prós: OpenAPI nativo por decorators; estrutura rígida e "corporativa".
* Contras: dois projetos; a API fica melhor fora da Vercel; mais cerimônia.

### FastAPI + Next.js

* Prós: melhor OpenAPI automático; Python forte para dados, IA e finanças;
  SDK MCP excelente.
* Contras: duas linguagens e dois projetos; tipos não atravessam front e
  back.

### ASP.NET Core

* Prós: robusto; OpenAPI nativo; SDK MCP oficial; EF Core maduro.
* Contras: não roda na Vercel (Azure ou contêiner); mais cerimônia.

## Mais informações

* Relacionado: ADR-0003 (banco de dados).
* A definir na criação do projeto, como decisões menores ou ADRs próprios:
  ORM (Drizzle ou Prisma), biblioteca de interface (ex.: shadcn/ui +
  Tailwind), testes e lint.
* Próximo ADR: autenticação (pessoas, sistemas via API e agentes via MCP).
