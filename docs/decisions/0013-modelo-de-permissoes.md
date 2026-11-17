---
status: aceito
date: 2026-11-17
decision-makers: Ricardo Gruber
scope: plataforma
---

# Modelo de permissões: perfis configuráveis em duas camadas, com alcance por recurso, no próprio banco

## Contexto e problema

As aplicações precisam decidir, a cada operação (tela, API ou MCP), se um
usuário pode executar uma ação sobre um recurso. Os administradores de cada
tenant precisam configurar as permissões sem depender de programação. Os
usuários participam de processos (no MNA, deals) com papéis diferentes em
cada um, às vezes com mais de um papel no mesmo processo e com atuação
restrita a uma parte dele (ex.: só a diligência jurídica). O isolamento entre
tenants já é garantido pelo ADR-0009. Como modelar as permissões dentro do
tenant?

## Fatores de decisão

* Permissões editáveis pelos administradores do tenant
* Granularidade por item de menu × ação
* Escopo por processo e por parte do processo
* Mesmas regras para telas, API e MCP
* Sem infraestrutura adicional
* Auditável e reaproveitável no template

## Alternativas consideradas

* (A) Papéis fixos definidos no código
* (B) Perfis configuráveis com escopo por recurso, em tabelas no próprio
  PostgreSQL, avaliados na camada de serviços
* (C) Motor externo de autorização (OpenFGA, SpiceDB, Permit.io)

## Decisão

Alternativa escolhida: "(B) perfis configuráveis com escopo por recurso, no
próprio banco", porque é a única que atende à configuração pelo
administrador do tenant sem infraestrutura nova, com complexidade
proporcional ao problema.

Elementos:

1. **Catálogo de recursos e ações**, definido no código: cada
   funcionalidade declara seus recursos (itens de menu) e ações aplicáveis
   (ver, criar, editar, excluir, baixar e outras, se necessário).
2. **Perfis**, criados e editados pelos administradores do tenant, cada um
   com uma matriz recurso × ação. A aplicação fornece perfis padrão para o
   tenant ajustar.
3. **Duas camadas de perfil:**
   * **Perfil no tenant:** vale para recursos fora de um processo
     (cadastros, configurações, auditoria, lista de processos).
   * **Perfil no processo:** vale para recursos dentro de um processo
     (no MNA, o deal: etapas, documentos, tarefas, contratos).
4. **Participação:** vínculo usuário + processo + perfil + **alcance**.
   * O **alcance é obrigatório**: "processo inteiro" ou uma ou mais partes
     específicas do processo (no MNA, etapas e subetapas do deal).
   * Um usuário pode ter **várias participações no mesmo processo**, com
     perfis e alcances diferentes.
   * Sem participação, o processo não existe para o usuário.
5. **Modo por perfil ou por usuário**, escolhido pelo tenant:
   * Por perfil: vale a matriz do perfil.
   * Por usuário: o usuário recebe uma matriz própria **por perfil**
     (usuário × perfil), que começa como cópia da matriz do perfil ou de
     outro usuário do mesmo perfil e pode ser ajustada. Vale em todos os
     processos em que o usuário tem aquele perfil.
6. **Cálculo da permissão efetiva:** para cada participação cujo alcance
   inclui o recurso, toma-se a matriz aplicável (do usuário, se existir;
   senão, a do perfil); a permissão efetiva é a **soma** dessas matrizes.
7. **Negado por padrão:** só é permitido o que estiver explicitamente
   concedido; não há regras de "proibir", por isso a soma nunca concede
   mais que cada participação concedeu no seu alcance.
8. **Visibilidade mínima:** participação com alcance parcial dá acesso ao
   cabeçalho do processo e às partes do seu alcance; recursos do processo
   como um todo (ex.: participantes, contratos) exigem alcance "processo
   inteiro" ou permissão explícita.
9. **Administrador do tenant:** acesso a todos os processos e recursos do
   tenant, sem precisar de participação, com todos os acessos auditados.
10. **Verificador único** na camada de serviços, usado por telas, API e
    MCP. A interface esconde ações sem permissão, mas a decisão é sempre do
    servidor.
11. **Chaves de API** atuam como um usuário de serviço, com perfil próprio
    configurado pelo administrador. **MCP** atua sempre como o usuário que
    o autorizou.
12. **Auditoria:** toda mudança de perfil, matriz, modo ou participação, e
    toda negação de acesso, geram eventos de auditoria.
13. **Integridade do alcance:** remover ou alterar uma parte do processo que
    está no alcance de alguma participação exige tratar essas participações
    (bloqueio com aviso ou realocação).

### Consequências

* Positiva: administradores do tenant configuram tudo sem programação.
* Positiva: atende a papéis múltiplos e atuação parcial, comuns em M&A.
* Positiva: sem serviço externo; dados no mesmo banco, sob o mesmo RLS.
* Positiva: mesma regra para telas, API e MCP.
* Negativa: a avaliação a cada operação exige cache e invalidação
  cuidadosa ao mudar permissões.
* Negativa: interface de configuração (matrizes, modos, alcances) é
  trabalhosa de construir e precisa ser clara para o administrador.
* Negativa: alcance por parte do processo exige integridade quando a
  estrutura do processo muda.

### Confirmação

* Testes do verificador: negado por padrão; soma de participações;
  alcance parcial; modo por usuário; administrador do tenant; chave de API.
* Testes garantindo que telas, API e (futuro) MCP usam o mesmo verificador.
* Nenhuma operação de serviço sem chamada ao verificador (revisão e teste
  que percorre o catálogo de operações).

## Prós e contras das alternativas

### (A) Papéis fixos no código

* Prós: simples.
* Contras: não atende à configuração pelo tenant; toda mudança exige
  programação.

### (B) Perfis configuráveis no próprio banco (escolhida)

* Prós: configurável; escopo por processo e por parte; sem infraestrutura
  nova.
* Contras: cache, interface de configuração e integridade do alcance a
  cuidar.

### (C) Motor externo de autorização

* Prós: muito expressivo para relações complexas e em grande escala.
* Contras: serviço a mais (custo, operação, latência); complexidade
  desproporcional ao problema.

## Mais informações

* Relacionado: ADR-0005 (autenticação ≠ autorização), ADR-0009 (isolamento
  entre tenants), ADR-0011 (console da plataforma, fora deste modelo).
* Aplicação ao MNA: `docs/projeto/perfis-e-permissoes.md`.
* Ajuste individual por usuário × processo (em vez de usuário × perfil) pode
  ser acrescentado depois sem refazer o modelo.
* Adendo (2026-11-17): **lista de acesso por item.** Itens de conteúdo (ex.:
  versão de documento) podem ter uma lista de acesso definida por quem os
  cria, por perfil e/ou usuário. A lista **só restringe** (as opções são os
  participantes cujo alcance já inclui o item; a permissão efetiva é a
  interseção); administradores do tenant continuam com acesso total,
  auditado; um novo item derivado (ex.: nova versão) herda a lista do
  anterior, ajustável. Conversas ligadas ao item seguem a mesma lista.
