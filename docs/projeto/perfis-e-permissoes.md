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
  * **Perfil no tenant:** atribuído uma vez, vale no tenant todo; um usuário
    pode ter **vários, com permissões somadas**.
  * **Perfis padrão:** todo tenant novo recebe uma cópia do conjunto padrão
    (das duas camadas), que passa a ser dele e é editável. Lista e matrizes:
    a aprovar.
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
* **Auditoria:** consultável por quem tiver essa permissão concedida pelos
  administradores do tenant.
* **Lista de acesso por versão de documento** (áreas restritas):
  * Quem envia uma versão escolhe, por **perfil e/ou usuário**, quem pode
    **ver e baixar** aquela versão.
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

Exemplo ilustrativo (os valores reais são configurados pelo tenant):

| Perfil | Ver deal | Editar deal | Baixar documentos |
|---|---|---|---|
| Advisor | sim | sim | sim |
| Cliente | sim | não | só os liberados |

## Exemplo: escritório com duas funções no mesmo deal

O escritório da compradora atua como advogado societário do deal e também
faz a diligência jurídica. A Ana, desse escritório, tem duas participações:

| Participação | Perfil | Alcance | Matriz (exemplo) |
|---|---|---|---|
| 1 | Advogado da compradora | Deal inteiro | Documentos: ver, baixar · Tarefas: ver |
| 2 | Auditor jurídico da compradora | Subetapa "Diligência jurídica" | Documentos: ver, criar, editar, baixar · Tarefas: ver, criar, editar |

Resultado: na diligência jurídica, a Ana soma as duas matrizes; nas demais
etapas, vale só a participação 1.
