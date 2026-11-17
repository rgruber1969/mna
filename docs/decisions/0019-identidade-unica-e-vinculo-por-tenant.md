---
status: aceito
date: 2026-11-17
decision-makers: Ricardo Gruber
scope: plataforma
---

# Identidade única na plataforma, vínculo por tenant em tabelas próprias e sessão por endereço

## Contexto e problema

A autenticação usa Better Auth (ADR-0005), os tenants ficam num banco único
com RLS (ADR-0009) e cada tenant tem seu endereço, com o console em
`admin.` (ADR-0011). Uma mesma pessoa pode atuar em mais de um tenant
(ex.: um advisor em deals de dois escritórios contratantes). Como modelar a
conta da pessoa em relação aos tenants, onde guardar vínculos e convites, e
como aplicar a regra de sessão única?

## Fatores de decisão

* Isolamento entre tenants (RLS) sem enfraquecer a segurança da biblioteca
  de autenticação
* Coerência com o modelo de permissões próprio (ADR-0013)
* Revogação imediata de acesso por tenant sem afetar os demais
* Simplicidade para quem usa: uma senha e um 2FA por pessoa
* Quem atua em vários tenants não pode ser atrapalhado pela sessão única

## Alternativas consideradas

Conta do usuário:

* A) Conta única na plataforma + vínculo por tenant
* B) Uma conta por tenant (mesmo e-mail repetido em cada tenant)

Vínculos e convites:

* A) Plugin "organization" do Better Auth
* B) Tabelas próprias com `tenant_id` e RLS

Sessão única:

* A) Uma sessão por usuário **por endereço**
* B) Uma sessão por usuário no total

## Decisão

Escolhidas: **conta única + vínculo por tenant**, **tabelas próprias** e
**sessão única por endereço**, porque mantêm o Better Auth no seu modelo
nativo (e-mail único), deixam autorização e vínculos no padrão do projeto
(RLS, auditoria, ADR-0013) e não penalizam quem atua em vários tenants.

Regras:

1. **Conta global:** contas, credenciais, 2FA e passkeys ficam em tabelas
   globais do Better Auth (sem `tenant_id`), como a tabela de tenants.
   Acesso a elas só pelo módulo de autenticação e pela camada de serviços.
2. **Better Auth = identidade e sessão:** senha, link mágico, login social,
   2FA e passkey. Não usar o plugin "organization" nem papéis do Better
   Auth.
3. **Vínculo por tenant** (tabela própria com `tenant_id` + RLS): situação
   (convidado, ativo, revogado) e perfis do ADR-0013. Sem vínculo ativo no
   tenant do endereço, acesso negado.
4. **Convites** em tabela própria com `tenant_id` + RLS, emitidos só por
   administradores, com validade definida pela aplicação; o token é
   guardado apenas como hash.
5. **Privacidade entre tenants:** nenhuma tela, mensagem ou API de um
   tenant revela se um e-mail já tem conta na plataforma ou vínculo com
   outro tenant.
6. **Usuários da plataforma** (console): marcados por papel de plataforma
   na conta; o papel só vale no endereço do console, com 2FA obrigatório.
7. **Sessão ligada ao endereço:** a sessão registra a área em que foi
   criada (console ou tenant) e é recusada em qualquer outra, mesmo com o
   cookie válido.
8. **Sessão única por endereço:** um novo login num endereço encerra as
   sessões anteriores do usuário **naquele endereço**; sessões em outros
   tenants e no console continuam.
9. **Revogação:** revogar o vínculo encerra as sessões do usuário naquele
   tenant e invalida suas chaves de API daquele tenant.

### Consequências

* Positiva: Better Auth usado como projetado, sem adaptações arriscadas.
* Positiva: vínculos, convites e perfis com RLS e auditoria, como o resto
  dos dados de negócio.
* Positiva: uma senha e um 2FA por pessoa; revogação isolada por tenant.
* Negativa: tabelas globais de contas exigem cuidado (regra 5) para não
  vazar a existência de contas entre tenants.
* Negativa: troca de senha ou de 2FA vale para todos os tenants da pessoa.
* Negativa: convites e gestão de vínculos são código nosso (telas que
  existiriam de qualquer forma).

### Confirmação

* Testes: sessão criada num tenant recusada em outro e no console; usuário
  sem vínculo ativo barrado; novo login encerra só a sessão do mesmo
  endereço; revogação encerra sessões do tenant; convite expirado ou já
  usado recusado; papel de plataforma sem efeito fora do console.
* Teste de catálogo (RLS) cobre as tabelas de vínculo e convite.
* ESLint: acesso às tabelas de autenticação só no módulo de autenticação e
  na camada de serviços.

## Prós e contras das alternativas

### Conta única + vínculo por tenant (escolhida)

* Prós: modelo nativo do Better Auth; uma senha e um 2FA; revogação por
  tenant.
* Contras: tabelas globais; cuidado para não revelar contas entre tenants.

### Uma conta por tenant

* Prós: isolamento total, nada compartilhado.
* Contras: o Better Auth exige e-mail único, e adaptá-lo traria risco; a
  pessoa teria várias senhas e passkeys.

### Plugin "organization"

* Prós: convites e membros prontos.
* Contras: papéis próprios que duplicam o ADR-0013; tabelas fora do padrão
  de RLS.

### Tabelas próprias (escolhida)

* Prós: RLS, auditoria e perfis no padrão do projeto; regras de convite
  sob controle.
* Contras: um pouco mais de código.

### Sessão única por endereço (escolhida)

* Prós: cumpre a sessão única sem derrubar quem atua em vários tenants.
* Contras: a pessoa pode ter várias sessões simultâneas, uma por endereço.

### Sessão única no total

* Prós: regra mais rígida.
* Contras: entrar num tenant derruba a sessão em outro e no console.

## Mais informações

* Relacionado: ADR-0005 (Better Auth), ADR-0009 (multi-tenant), ADR-0011
  (endereços), ADR-0013 (permissões).
