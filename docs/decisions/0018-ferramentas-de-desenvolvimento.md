---
status: aceito
date: 2026-11-17
decision-makers: Ricardo Gruber
scope: plataforma
---

# Ferramentas de desenvolvimento: Drizzle, shadcn/ui + Tailwind, Vitest + Playwright, ESLint + Prettier, pnpm

## Contexto e problema

Com a stack definida (TypeScript, Next.js, Hono, PostgreSQL; ADRs 0003 e
0004) e as regras de segurança, multi-tenant e white label decididas (ADRs
0006 a 0017), faltam as ferramentas do dia a dia: acesso ao banco, biblioteca
de interface, testes, qualidade de código e gerenciador de pacotes. Várias
decisões anteriores dependem dessas ferramentas para serem verificadas
automaticamente (RLS em toda tabela, proibição de cores fixas, SDKs restritos
a módulos). Quais ferramentas adotar?

## Fatores de decisão

* Suporte natural a RLS e ao contexto de tenant por transação (ADR-0009)
* Compatibilidade com Neon serverless, Better Auth e Zod
* Interface com tokens semânticos via variáveis CSS (ADR-0010)
* Testes de isolamento contra banco real
* Regras de lint personalizadas para verificar os ADRs
* Volume de exemplos e suporte do Claude Code

## Alternativas consideradas

* ORM: Drizzle, Prisma, Kysely
* Interface: shadcn/ui + Tailwind CSS, Mantine, MUI
* Testes: Vitest, Jest; Playwright para ponta a ponta
* Lint e formatação: ESLint + Prettier, Biome
* Pacotes: pnpm, npm

## Decisão

| Área | Escolha | Motivo principal |
|---|---|---|
| ORM | **Drizzle** | Políticas de RLS declaradas junto das tabelas; leve em serverless; adaptador Better Auth; gera esquemas Zod |
| Interface | **shadcn/ui + Tailwind CSS** | Componentes copiados para o projeto (sem limite de personalização); cores por variáveis CSS, compatíveis com white label |
| Formulários | React Hook Form + Zod | Reaproveita os esquemas da API |
| Tabelas de dados | TanStack Table | Listas grandes (documentos, auditoria) |
| Testes unitários e de integração | **Vitest** | Rápido com TypeScript |
| Testes com banco | Vitest + **Postgres no Docker** | RLS e permissões testados contra banco real, nunca simulado |
| Testes de ponta a ponta | **Playwright** | Fluxos completos no navegador |
| Lint e formatação | **ESLint + Prettier** | Regras personalizadas para os ADRs; regras do Next.js e de acessibilidade |
| Pacotes | **pnpm** | Rápido, econômico, rigoroso com dependências |
| Node.js | 22 (LTS) | Instalado e suportado pela Vercel |

Regras:

1. **Design não é o padrão do shadcn:** o design system é definido sobre a
   identidade padrão (`docs/marca/`) com apoio da skill de design
   (impeccable), evitando a aparência genérica.
2. **Testes de isolamento sempre com banco real** (Postgres no Docker),
   incluindo o teste que falha se houver tabela com `tenant_id` sem RLS.
3. **Regras de lint previstas pelos ADRs:** proibir cores fixas em
   componentes (0010); proibir importação de SDKs de armazenamento, e-mail,
   tarefas e criptografia fora dos seus módulos (0012, 0014, 0015, 0017);
   proibir o nome do produto escrito diretamente em telas e e-mails.
4. **TypeScript em modo `strict`** e formatação automática obrigatória.
5. **Lint e testes executados automaticamente** no fluxo do Claude Code
   (hooks), conforme o passo 3 do plano.
6. **Bibliotecas adicionais pontuais** (ex.: React Flow para as etapas
   gráficas) são avaliadas quando a funcionalidade for construída, como
   decisões menores.

### Consequências

* Positiva: RLS e contexto de tenant naturais no ORM.
* Positiva: interface totalmente personalizável e compatível com white
  label.
* Positiva: verificação automática das regras dos ADRs.
* Positiva: ferramentas com o maior volume de exemplos para o Claude Code.
* Negativa: componentes copiados (shadcn) são mantidos por nós (atualizações
  não chegam sozinhas).
* Negativa: testes com banco real são mais lentos que testes simulados.
* Negativa: ESLint + Prettier são mais lentos que Biome.

### Confirmação

* `package.json` com as ferramentas acima e scripts de lint, formatação e
  testes.
* Regras de lint dos ADRs implementadas e testadas.
* Pipeline local (hooks) executando lint e testes.

## Prós e contras das alternativas

### Drizzle (escolhido) × Prisma × Kysely

* Drizzle: RLS no esquema, leve; ecossistema um pouco menor que Prisma.
* Prisma: o mais popular e maduro; RLS e contexto por transação exigem
  contornos.
* Kysely: excelente construtor de consultas; migrações e esquema à mão.

### shadcn/ui + Tailwind (escolhido) × Mantine × MUI

* shadcn/ui: personalização total; manutenção dos componentes por nós.
* Mantine: completo e acessível; personalização limitada ao tema.
* MUI: maduro; aparência Material difícil de remover.

### Vitest (escolhido) × Jest

* Vitest: rápido e nativo para TypeScript moderno.
* Jest: maduro, porém mais lento e com mais configuração.

### ESLint + Prettier (escolhido) × Biome

* ESLint + Prettier: regras personalizadas e plugins completos; mais lento.
* Biome: muito rápido, ferramenta única; regras personalizadas limitadas.

### pnpm (escolhido) × npm

* pnpm: rápido, econômico, rigoroso.
* npm: já instalado; mais lento e permissivo.

## Mais informações

* Relacionado: ADRs 0003, 0004, 0009, 0010, 0012, 0014, 0015, 0017.
