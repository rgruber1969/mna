# MNA: perfis e permissões

Regras de quem acessa o quê. A implementação técnica segue o ADR de modelo
de permissões (pendente), dentro do isolamento por tenant (ADR-0009) e do
console separado (ADR-0011).

## Dois níveis de usuário

| Nível | Quem | Onde atua |
|---|---|---|
| **Plataforma** | Administrador geral da RGRUBER (Ricardo e futuros usuários da RGRUBER) | Console (`admin.<domínio>`) |
| **Tenant** | Administradores do tenant e demais usuários (advogados, advisors, vendedora, compradora, auditores etc.) | Subdomínio do tenant |

Não há distinção "interno × externo": dentro do tenant, **as permissões
determinam o acesso**, inclusive para advogados do próprio contratante.

## Administrador geral (RGRUBER)

* Único que cadastra e administra tenants.
* Ao criar ou editar um tenant, cadastra os administradores do tenant para
  o primeiro acesso.
* Define, por tenant, o prazo de retenção da auditoria.
* Pode incluir e remover pessoas de deals.
* Todo acesso a dados de tenant pelo console é auditado.

## Administradores do tenant

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
* **Escopo por deal:** o usuário só acessa deals em que foi incluído, com o
  perfil que tem naquele deal. Um usuário pode ter perfis diferentes em
  deals diferentes.
* **Auditoria:** consultável por quem tiver essa permissão concedida pelos
  administradores do tenant.
* **Áreas restritas dentro do deal** (ex.: notas internas de advisors):
  para depois.

Exemplo ilustrativo (os valores reais são configurados pelo tenant):

| Perfil | Ver deal | Editar deal | Baixar documentos |
|---|---|---|---|
| Advisor | sim | sim | sim |
| Cliente | sim | não | só os liberados |

## Pontos a definir no ADR de permissões

* Relação entre "perfil" (papel no deal) e permissões por menu: perfil
  global no tenant, perfil por deal, ou ambos.
* Precedência entre permissão do perfil e ajuste individual do usuário.
* Como as permissões se aplicam à API e ao futuro MCP (mesmas regras, sem
  exceção).
