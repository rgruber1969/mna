---
status: aceito
date: 2026-11-16
decision-makers: Ricardo Gruber
scope: plataforma
---

# Multi-tenant: banco único com `tenant_id` e Row-Level Security

## Contexto e problema

As aplicações da plataforma são contratadas por empresas clientes
(tenants), cada uma com seus próprios usuários, dados e identidade visual
(white label). Os dados de um tenant nunca podem ser vistos por outro; no
contexto de informação confidencial, um vazamento entre tenants é o pior
incidente possível. A stack usa PostgreSQL no Neon (ADR-0003), Better Auth
com plugin de organizações (ADR-0005) e uma camada de serviços única
(ADR-0004). Como isolar os dados dos tenants?

## Fatores de decisão

* Isolamento forte entre tenants, resistente a erros de programação
* Custo e operação compatíveis com um time pequeno
* Criação de novo tenant simples e imediata
* Exclusão completa de um tenant (LGPD, fim de contrato)
* Encaixe com o Better Auth (organizações) e com o Neon
* Usuários que atendem mais de um tenant sem contas duplicadas

## Alternativas consideradas

* (A) Banco único, `tenant_id` em cada tabela de negócio + Row-Level
  Security (RLS)
* (B) Um schema do PostgreSQL por tenant
* (C) Um banco de dados por tenant

## Decisão

Alternativa escolhida: "(A) banco único com `tenant_id` e RLS", porque é o
padrão de mercado em SaaS, tem o menor custo de operação, encaixa
diretamente no plugin de organizações do Better Auth e, com RLS, mantém o
isolamento mesmo se uma consulta esquecer o filtro de tenant.

Regras:

1. **Tenant = organização do Better Auth.** O cadastro do tenant (nome,
   identidade visual, configurações) estende a organização.
2. **Usuário global, participação por tenant.** Cada pessoa tem um único
   login; a participação em cada tenant (com papel próprio) é um vínculo
   separado. Se uma pessoa pode ou não participar de vários tenants é
   política de cada projeto.
3. **Toda tabela com dado de negócio tem `tenant_id` obrigatório**, com
   chave estrangeira para o tenant e índice. Restrições de unicidade
   incluem o `tenant_id` (ex.: nome de registro único por tenant).
   Tabelas globais (sem `tenant_id`) são exceção explícita e documentada.
4. **Duas barreiras de isolamento:**
   * **Camada de serviços:** resolve o tenant da requisição (a partir da
     sessão ou da chave de API, nunca de um parâmetro enviado pelo
     cliente) e filtra todas as operações por ele.
   * **RLS no PostgreSQL:** políticas em todas as tabelas com `tenant_id`,
     comparando com o tenant da transação (`SET LOCAL app.tenant_id`,
     válido só dentro da transação, compatível com o pool de conexões do
     Neon). `FORCE ROW LEVEL SECURITY` ativado e aplicação conectando com
     papel sem privilégio de contornar RLS.
5. **Acesso administrativo da plataforma** (equipe RGRUBER, entre
   tenants): papel de banco e caminho de código separados, usados só em
   rotinas administrativas, sempre registrados na auditoria.
6. **Regras dentro do tenant** (ex.: acesso por registro, papel por recurso)
   ficam na camada de serviços e são objeto do ADR de modelo de permissões;
   o RLS cuida do isolamento entre tenants.
7. **Exclusão de tenant:** remoção em cascata por `tenant_id` (ou
   anonimização, onde houver obrigação de manter histórico), incluindo
   arquivos armazenados.
8. **Exceção prevista:** se um cliente exigir banco isolado, a alternativa
   (C) pode ser oferecida a ele sem alterar o modelo de dados.

### Consequências

* Positiva: isolamento em duas camadas; uma consulta sem filtro não vaza
  dados de outro tenant.
* Positiva: um banco, uma migração, operação simples.
* Positiva: novo tenant criado instantaneamente; uso natural do plugin de
  organizações do Better Auth.
* Positiva: usuários que atendem vários tenants com um único login.
* Negativa: toda tabela de negócio precisa de `tenant_id`, índice e
  política RLS; esquecer a política numa tabela nova é um risco (mitigado
  por teste automatizado que lista tabelas sem RLS).
* Negativa: o contexto de tenant precisa ser definido em cada transação.
* Negativa: um tenant muito grande compartilha recursos do banco com os
  demais ("vizinho barulhento").

### Confirmação

* Teste automatizado que falha se existir tabela com `tenant_id` sem RLS
  ativado e forçado.
* Testes de isolamento: um usuário do tenant A não lê, altera nem exclui
  dados do tenant B, por telas, API e (futuro) MCP.
* Revisão: nenhuma operação recebe o `tenant_id` diretamente do cliente.

## Prós e contras das alternativas

### (A) Banco único + `tenant_id` + RLS (escolhida)

* Prós: padrão de SaaS; menor custo; integração nativa com Better Auth;
  RLS como segunda barreira; criação e exclusão simples.
* Contras: disciplina em cada tabela nova; contexto por transação;
  recursos compartilhados.

### (B) Schema por tenant

* Prós: isolamento maior; exclusão por schema.
* Contras: migrações repetidas por schema; mais complexidade de conexão;
  integração com Better Auth exige adaptação; escala mal com muitos
  tenants.

### (C) Banco por tenant

* Prós: isolamento máximo; backup, restauração e exclusão por cliente;
  o Neon suporta bem.
* Contras: N bancos para migrar, monitorar e pagar; consultas entre
  tenants (administração) complexas; integração com Better Auth exige
  adaptação.

## Mais informações

* Relacionado: ADR-0003 (banco), ADR-0004 (camada de serviços), ADR-0005
  (Better Auth, organizações), ADR-0006 (baseline de segurança), ADR-0007
  (dados pessoais).
* Próximos ADRs relacionados: white label (temas por tenant), modelo de
  permissões, armazenamento de arquivos.
* Documentação PostgreSQL sobre RLS:
  <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>
