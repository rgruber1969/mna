---
status: aceito
date: 2026-11-16
decision-makers: Ricardo Gruber
scope: plataforma
---

# Endereços: subdomínio por tenant e console administrativo na mesma aplicação

## Contexto e problema

Cada tenant (ADR-0009) acessa a aplicação com sua própria marca (ADR-0010)
num endereço próprio. A RGRUBER precisa de uma área exclusiva para cadastrar
e administrar tenants, que nenhum usuário de tenant possa ver. Como
estruturar os endereços dos tenants e do console administrativo, e o console
deve ser uma aplicação separada?

## Fatores de decisão

* Endereço próprio e com aparência de produto para cada tenant
* Isolamento de sessão (cookies) entre tenants e entre tenant e console
* Console da RGRUBER inacessível a usuários de tenant
* Manutenção baixa (sem duplicar banco, login e componentes)
* Compatibilidade com a Vercel e com domínio próprio do cliente no futuro

## Alternativas consideradas

Endereço do tenant:

* Caminho: `dominio.com.br/tenant`
* Subdomínio: `tenant.dominio.com.br`

Console administrativo:

* Mesma aplicação, servida em `admin.dominio.com.br`
* Aplicação e repositório separados

## Decisão

* **Subdomínio por tenant** (ex.: `bt.mna.com.br`), porque é o padrão de
  produtos white label, isola os cookies de cada tenant e prepara o uso de
  domínio próprio do cliente.
* **Console na mesma aplicação**, em `admin.mna.com.br`, porque evita
  duplicar banco, autenticação e componentes, mantendo para o usuário a
  aparência de um sistema separado.

Regras:

1. **Resolução pelo endereço:** a aplicação identifica pelo host se a
   requisição é do console (`admin.`), de um tenant (`<slug>.`) ou inválida,
   e direciona para a área correspondente.
2. **O endereço identifica, a sessão autoriza:** o tenant do host precisa
   coincidir com uma participação ativa do usuário naquele tenant; caso
   contrário, acesso negado. O host nunca concede acesso por si só.
3. **Cookies restritos ao host** (sem `Domain=.mna.com.br`): sessão de um
   tenant não vale em outro nem no console. Um usuário que participa de
   vários tenants entra separadamente em cada endereço.
4. **Console:** acessível só a usuários da RGRUBER, com 2FA obrigatório,
   papel próprio e todas as ações auditadas; nenhuma rota do console responde
   em endereços de tenant, e vice-versa.
5. **Slugs reservados:** `admin`, `www`, `api`, `app`, `mail`, `static`,
   `status`, `docs` e similares não podem ser usados como tenant.
6. **API:** servida no endereço do tenant (`bt.mna.com.br/api`); com chave
   de API, o tenant vem da chave, e ela precisa corresponder ao host.
7. **Desenvolvimento local:** `admin.localhost:3000` e
   `<slug>.localhost:3000`, sem configuração de DNS.
8. **Produção:** domínio com subdomínio coringa (`*.mna.com.br`) na
   Vercel, que exige o DNS do domínio gerenciado pela Vercel.
9. **Depois da versão 1:** domínio próprio do cliente (ex.:
   `mna.bt.com.br`), mapeado para o tenant.

### Consequências

* Positiva: endereço profissional por tenant e isolamento de sessão.
* Positiva: um único código, banco e deploy para console e tenants.
* Positiva: caminho aberto para domínios próprios de clientes.
* Negativa: requer domínio próprio com DNS na Vercel e subdomínio
  coringa.
* Negativa: usuário de vários tenants faz login em cada endereço.
* Negativa: falha de código no roteamento poderia expor o console num
  host de tenant (mitigada por testes e pela checagem de papel em toda
  rota do console).
* Negativa: passkeys são vinculadas ao domínio; a configuração deve usar o
  domínio principal para que funcionem em todos os subdomínios.

### Confirmação

* Testes: rota do console em host de tenant retorna 404; sessão de um
  tenant rejeitada em outro; usuário sem participação no tenant do host é
  barrado; chave de API de um tenant rejeitada em outro host.
* Cadastro de tenant recusa slugs reservados.

## Prós e contras das alternativas

### Caminho (`dominio.com.br/tenant`)

* Prós: um domínio, nenhum DNS especial.
* Contras: cookies compartilhados entre tenants; aparência menos white
  label; domínio próprio de cliente mais difícil.

### Subdomínio (escolhida)

* Prós: padrão white label; isolamento de cookies; domínio próprio
  viável.
* Contras: DNS coringa; login separado por tenant.

### Console na mesma aplicação (escolhida)

* Prós: sem duplicação; um deploy; mesmas regras de segurança.
* Contras: exige rigor no roteamento por host.

### Console em aplicação separada

* Prós: isolamento máximo.
* Contras: dois repositórios e deploys; banco, login e componentes
  duplicados ou compartilhados com mais complexidade.

## Mais informações

* Relacionado: ADR-0009 (multi-tenant), ADR-0010 (white label), ADR-0005
  (Better Auth).
* `mna.com.br` é o domínio de exemplo; o domínio definitivo e sua compra
  ficam pendentes.
* Adendo (2026-11-17): na demonstração, `<domínio>` = `mna.rgruber.com.br`,
  com registro DNS manual por tenant no Registro.br (sem coringa). O domínio
  definitivo depende do nome comercial do produto e deve ser adotado antes
  da produção com usuários reais, pois passkeys ficam vinculadas ao domínio.
