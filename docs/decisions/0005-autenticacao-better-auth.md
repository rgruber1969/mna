---
status: aceito
date: 2026-11-16
decision-makers: Ricardo Gruber
scope: plataforma
---

# Autenticação com Better Auth, usuários no próprio PostgreSQL

## Contexto e problema

A aplicação precisa autenticar três públicos: pessoas na interface web,
sistemas na API REST e, futuramente, agentes de IA via MCP, que exige OAuth
2.1. No MNA, a maioria dos usuários é externa e vem de organizações
diferentes (administradores do portal, advogados, advisors, clientes etc.),
lida com informação confidencial de M&A e participa de deals específicos.
A stack é TypeScript com Next.js e Hono (ADR-0004) sobre PostgreSQL
(ADR-0003). Qual solução de autenticação adotar?

## Fatores de decisão

* Cobrir pessoas (web), sistemas (chaves de API) e agentes (OAuth para MCP)
* Usuários e sessões no nosso banco (confidencialidade e auditoria)
* Convites, organizações e papéis; 2FA; link mágico; login Google/Microsoft
* Custo que não cresça com o número de participantes externos
* Sem dependência de fornecedor; reaproveitável no template
* Integração com TypeScript, Next.js, Hono e o ORM escolhido

## Alternativas consideradas

* Better Auth (biblioteca open source)
* Auth.js / NextAuth v5 (biblioteca open source)
* Clerk (serviço gerenciado)
* WorkOS AuthKit (serviço gerenciado)

## Decisão

Alternativa escolhida: "Better Auth", porque é a única alternativa avaliada
que cobre os três públicos (web, API e MCP) mantendo usuários e sessões no
nosso PostgreSQL, sem custo por usuário e sem dependência de fornecedor.

Diretrizes:

* Better Auth integrado ao Next.js e às rotas Hono, com tabelas no
  PostgreSQL via o ORM do projeto.
* Recursos previstos por plugins: e-mail e senha, link mágico, login
  Google/Microsoft, 2FA, convites e organizações, chaves de API e servidor
  OAuth para MCP (quando o MCP for construído).
* Cadastro por convite como padrão; cadastro aberto apenas se uma aplicação
  exigir.
* **Autenticação ≠ autorização:** o Better Auth responde "quem é o usuário";
  "o que ele pode ver e fazer" (inclusive acesso por deal no MNA) é
  verificado na camada de serviços, igualmente para telas, API e MCP.
  O modelo de permissões será decidido em ADR próprio.

### Consequências

* Positiva: dados de identidade e acesso no nosso banco, facilitando
  auditoria e confidencialidade.
* Positiva: custo zero por usuário, adequado a deals com muitos
  participantes externos.
* Positiva: mesma peça reaproveitável em todas as aplicações do template.
* Negativa: a segurança da autenticação é responsabilidade nossa (manter a
  biblioteca atualizada, configurar limite de tentativas, cookies seguros,
  envio de e-mail confiável).
* Negativa: telas de login, convite e 2FA são construídas por nós (não há
  componentes prontos como em serviços gerenciados).
* Negativa: SSO corporativo (SAML) é menos maduro que em serviços
  especializados; revisitar se clientes corporativos o exigirem.
* Negativa: exige um serviço de envio de e-mail (convites, link mágico,
  recuperação de senha), a decidir.

### Confirmação

* Nenhuma rota Hono ou tela protegida sem verificação de sessão ou chave de
  API.
* Testes automatizados cobrindo login, convite, 2FA e acesso negado.
* Dependência do Better Auth mantida atualizada (verificação periódica de
  versões e avisos de segurança).

## Prós e contras das alternativas

### Better Auth

* Prós: dados no nosso banco; grátis; plugins para organizações, convites,
  2FA, chaves de API e OAuth/MCP; feito para TypeScript.
* Contras: segurança e telas por nossa conta; SSO corporativo menos maduro.

### Auth.js / NextAuth v5

* Prós: maduro, muito difundido, dados no nosso banco.
* Contras: em modo de manutenção (equipe migrou para o Better Auth em
  2025); sem organizações, chaves de API nem OAuth para MCP; e-mail/senha e
  2FA exigem trabalho manual.

### Clerk

* Prós: telas prontas; organizações; suporte a MCP; segurança terceirizada.
* Contras: usuários fora do nosso banco; custo por usuário ativo, que cresce
  com participantes externos; alta dependência de fornecedor.

### WorkOS AuthKit

* Prós: SSO corporativo excelente; suporte a MCP; plano gratuito amplo.
* Contras: usuários fora do nosso banco; SSO pago por conexão; foco em
  clientes corporativos, pouco relevante para usuários externos diversos.

## Mais informações

* Relacionado: ADR-0003, ADR-0004.
* Próximos ADRs relacionados: modelo de permissões (papel global + papel por
  deal) e serviço de envio de e-mail.
