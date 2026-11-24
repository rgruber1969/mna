# MNA: perfis e permissões

Regras de quem acessa o quê. Modelo técnico no ADR-0013 (perfis
configuráveis em duas camadas, com alcance), dentro do isolamento por tenant
(ADR-0009) e do console separado (ADR-0011).

## Dois níveis de usuário

| Nível | Quem | Onde atua |
|---|---|---|
| **Plataforma** | Administrador geral da RGRUBER (Ricardo e futuros usuários da RGRUBER) | Console (`admin.<domínio>`) |
| **Tenant** | Administradores do tenant (contratante de qualquer lado) e demais usuários (advogados, advisors, vendedora, compradora, auditores etc.) | Subdomínio do tenant |

Não há distinção "interno × externo": dentro do tenant, **as permissões
determinam o acesso**, inclusive para advogados do próprio contratante.

## Administrador geral (RGRUBER)

* Único que cadastra e administra tenants.
* **Edição do tenant:** o nome pode ser alterado; o **endereço
  (subdomínio) é fixo** depois de criado (trocar exigiria operação
  especial: links, convites e passkeys locais dependem dele).
* **Suspensão do tenant** (ex.: contrato encerrado): ninguém do tenant
  entra, as sessões são encerradas na hora e convites e links deixam de
  valer; os dados são preservados; a RGRUBER reativa quando quiser. Ações
  auditadas.
* **Equipe da RGRUBER:** convidada e removida pelo console; a remoção tira
  o acesso ao console na hora e encerra as sessões; ninguém remove o
  próprio acesso e o último usuário não pode ser removido.
* Ao criar ou editar um tenant, cadastra os administradores do tenant para
  o primeiro acesso.
* Define, por tenant, o prazo de retenção da auditoria.
* Pode incluir e remover pessoas de deals.
* Todo acesso a dados de tenant pelo console é auditado.

## Administradores do tenant

* Veem e acessam **todos os deals** do tenant, sem precisar ser incluídos,
  com todos os acessos auditados.
* Editam as permissões de todos os usuários do tenant.
* Únicos que convidam usuários, incluem e removem pessoas de deals (versão
  1) e geram chaves de API.
* Revogam acessos de forma imediata.
* Definem as configurações gerais do tenant: modo de permissões, regras de
  2FA e identidade visual.

## Modelo de permissões

* **Configuração geral do tenant:** permissões **por perfil** ou **por
  usuário**.
  * Por usuário permite, por exemplo, que um usuário júnior de um advisor
    tenha menos permissões que um sênior do mesmo advisor.
  * No modo por usuário, ao configurar um usuário que não é o primeiro do
    perfil, há a opção de **copiar as permissões de outro usuário** do
    mesmo perfil.
* **Granularidade:** cada item de menu × ações **ver, criar, editar, excluir
  e baixar** (quando aplicável).
* **Duas camadas de perfil:** perfil no tenant (cadastros, configurações,
  auditoria, lista de deals, valuations avulsos) e perfil no deal (etapas,
  documentos, tarefas, contratos).
  * **Todos os perfis são cadastrados no tenant**; o deal não cria perfis,
    só define qual perfil cada pessoa recebe nele (participação).
  * **Perfil no tenant:** atribuído uma vez, vale no tenant todo; **um só
    por usuário** (ou nenhum), decidido em 2026-11-18. Nos deals, a pessoa
    recebe um perfil em cada participação (perfis diferentes em deals
    diferentes; no mesmo deal, participações se somam).
  * **Perfis padrão:** todo tenant novo recebe uma cópia do conjunto padrão
    (das duas camadas), que passa a ser dele e é editável. Lista e matrizes
    em "Perfis padrão", abaixo.
  * **Administrador do tenant** é uma marcação à parte, não um perfil.
  * Perfil em uso não pode ser excluído.
* **Escopo por deal:** o usuário só acessa deals em que foi incluído
  (participação). Um usuário pode ter perfis diferentes em deals
  diferentes.
* **Vários perfis no mesmo deal:** permitido; as permissões se **somam**.
* **Alcance obrigatório em toda participação** (desde a versão 1): "deal
  inteiro" ou uma ou mais etapas/subetapas específicas.
* No modo por usuário, o ajuste individual vale por **usuário × perfil**,
  em todos os deals em que o usuário tem aquele perfil.
* **Papel da empresa × perfil do usuário:** o papel da empresa no deal
  (ex.: escritório da compradora) é informação de negócio; as permissões
  vêm do perfil de cada pessoa. Ao atribuir um papel à empresa, o sistema
  pode sugerir o perfil correspondente para os usuários dela; o
  administrador confirma.
  * **Confirmado em 2026-11-18:** papel é **da empresa** (quem é a
    vendedora, a compradora, o advisor; usado no rateio entre vendedoras,
    ofertas, e-book e anonimização, e vale mesmo para empresa sem nenhum
    usuário); perfil é **da pessoa** (o que ela pode fazer). Para não
    confundir os nomes, os perfis padrão "Vendedora" e "Compradora" viraram
    "Representante da vendedora" e "Representante da compradora", e entrou
    o perfil "Advisor da compradora".
  * **Perfis por função, sem lado (decidido em 2026-11-19):** o lado
    (vendedor ou comprador) vem do **papel da empresa**; o perfil diz só o
    tipo de trabalho. Os pares "da vendedora" / "da compradora" viraram
    **Advogado**, **Advisor**, **Contador** e **Representante da empresa**.
    O sigilo entre os lados vem da lista de acesso definida por quem cria
    cada registro (abaixo), não da matriz do perfil.
* **Auditoria:** consultável por quem tiver essa permissão concedida pelos
  administradores do tenant.
* **Lista de acesso definida por quem cria** (decidido em 2026-11-19 para
  todos os registros do negócio): versões de documento, **contratos de
  serviço**, **versões do e-book e do OnePager**, **ofertas** e valuation.
  Contrato e e-book são tratados como documentos: quem os cria decide quem
  vê.
  * **Pré-preenchida com "o meu lado":** ao criar, a lista já vem com os
    participantes do mesmo lado de quem cria (calculado pelo papel da
    empresa de cada um no negócio); quem cria ajusta.
  * **Liberar o e-book ao comprador** é incluir os participantes do lado
    comprador na lista daquela versão (com aviso por e-mail). Aprovar uma
    versão só vale antes de ela ser liberada.
* **Lista de acesso por versão de documento** (áreas restritas):
  * Quem envia uma versão escolhe, por **perfil e/ou usuário**, quem pode
    **ver e baixar** aquela versão.
  * **Vale para todos os perfis e todas as ações** sobre a versão (ver,
    editar, excluir, baixar), inclusive o Coordenador do deal (decidido em
    2026-11-18): sem acesso explícito dado por quem enviou a versão, a
    pessoa não a vê, qualquer que seja o seu perfil. A matriz do perfil diz
    o que a pessoa pode fazer nas versões a que tem acesso. Só os
    administradores do tenant têm acesso a todas.
  * A lista **só restringe**: as opções são os participantes que já têm
    acesso àquela etapa do deal; ninguém ganha acesso além do seu alcance.
  * **Administradores do tenant** veem todas as versões, inclusive as
    restritas, com auditoria.
  * Nova versão vem com a lista **pré-preenchida com a da versão anterior**,
    ajustável.
  * Conversas de uma versão ficam visíveis só para quem tem acesso a ela.
  * Exemplo: notas internas do lado vendedor numa versão visível apenas aos
    usuários da vendedora e do seu advisor.
* **Visibilidade do valuation** (decidido em 2026-11-18): segue a mesma
  lógica da lista de acesso por versão. Quem cria o valuation escolhe, por
  **perfil e/ou usuário**, quem o vê; ligá-lo a um deal não amplia essa
  lista; administradores do tenant veem todos, com auditoria. Garante o
  sigilo entre valuations de lados diferentes no mesmo deal (`dominio.md`).
* **O tenant pode ser de qualquer lado** (vendedor ou comprador): nenhuma
  regra de permissão supõe o lado do contratante.

## Perfis padrão (aprovados em 2026-11-18)

Copiados para cada tenant novo; depois da cópia, o tenant renomeia, ajusta,
cria e exclui à vontade.

**Ações:** V = ver · C = criar · E = editar · X = excluir · B = baixar ·
Co = comentar (sem editar) · Ap = aprovar uma versão · Li = liberar ao
comprador · — = sem acesso.

### Perfis do tenant (fora dos deals)

| Perfil | Painel | Deals (lista) | Valuations avulsos | Empresas e pessoas | Cadastros gerais¹ | Auditoria |
|---|---|---|---|---|---|---|
| **Gestor do contratante** | V | V C E X | V C E X B | V C E X B | V C E X | V |
| **Equipe do contratante** | V | V C E | V C E X B | V C E B | V | — |
| **Usuário externo** | V | V | — | — | — | — |

¹ Etapas padrão, catálogo de documentos, templates, papéis de empresa e
tipos de vínculo entre pessoa e empresa.

* A lista de deals mostra só os deals em que a pessoa participa; quem cria
  um deal entra nele como "Coordenador do deal".
* Usuários, perfis, configurações e chaves de API: só administradores do
  tenant (fora das matrizes).

### Perfis de deal (escolhidos em cada participação, com alcance)

| Perfil | Deal e participantes | Etapas | Documentos² | Tarefas | Mensagens | Contratos | E-book / OnePager | Ofertas |
|---|---|---|---|---|---|---|---|---|
| **Coordenador do deal** | V E | V C E X | V C E X B | V C E X | V C | V C E X B | V C E X B Li | V C E X |
| **Advogado** | V | V E | V C E B | V C E | V C | V C E B | V Co | V C E |
| **Advisor** | V | V E | V C E B | V C E | V C | V C E B | V C E B Li | V C E |
| **Contador** | V | V | V C E B | V C E | V C | — | — | — |
| **Representante da empresa** | V | V | V C B | V E | V C | V B | V Co Ap | V |
| **Auditor (diligência)** | V | V | V C E B | V C E | V C | — | — | — |
| **Somente leitura** | V | V | V | V | V | — | — | — |

² Sempre só nos registros a que a pessoa recebeu acesso de quem os criou
(lista de acesso); vale também para contratos, e-book e ofertas. "C" é
enviar documento ou nova versão.

* **Pedidos de documentos** (recurso de deal, 2026-11-23): ver, criar,
  editar, excluir e baixar (exportar a planilha respondida). Padrão:
  Coordenador V C E X B; Advogado, Advisor, Contador e Auditor V C E B;
  Representante V E B; Somente leitura V. Do lado comprador, só os pedidos
  da própria compradora; pedido interno (sem compradora) só o lado
  vendedor. Perfis padrão de tenants antigos recebem o recurso novo ao
  rodar `pnpm tenants:completar-padrao` (recurso que o tenant já ajustou
  fica como está).

* **Etapas: "Alterar (lado comprador)"** (2026-11-19): do lado comprador,
  criar, editar, mover ou excluir etapas exige também esta permissão,
  desmarcada por padrão em todos os perfis (o tenant marca em Perfis, se
  quiser). O lado vendedor segue só a matriz.
* **Funil de compradoras** (2026-11-19): ver e editar; padrão V E para
  Coordenador, Advogado e Advisor e V para Representante da empresa. Só vale
  para quem está do lado vendedor do negócio.
* Mensagens são imutáveis (sem editar nem excluir).
* Em Tarefas, "E" do Representante da empresa serve para atualizar e
  concluir as próprias tarefas.
* Valuation no deal segue a visibilidade definida pelo criador (fora da
  matriz).
* Incluir e remover pessoas do deal: administradores do tenant e o
  **Coordenador do deal** (decidido em 2026-11-19), com auditoria e aviso;
  o "E" do Coordenador em "Deal e participantes" também edita os dados do
  deal.
* "Auditor" cobre as diligências (contábil, jurídica, trabalhista etc.),
  normalmente com alcance só na subetapa da sua diligência.

## Exemplo: escritório com duas funções no mesmo deal

O escritório da compradora atua como advogado societário do deal e também
faz a diligência jurídica. A Ana, desse escritório, tem duas participações:

| Participação | Perfil | Alcance | Matriz (exemplo) |
|---|---|---|---|
| 1 | Advogado | Deal inteiro | Documentos: ver, baixar · Tarefas: ver |
| 2 | Auditor (diligência) | Subetapa "Diligência jurídica" | Documentos: ver, criar, editar, baixar · Tarefas: ver, criar, editar |

Resultado: na diligência jurídica, a Ana soma as duas matrizes; nas demais
etapas, vale só a participação 1.
