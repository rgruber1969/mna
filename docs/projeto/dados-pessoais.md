# MNA: dados pessoais e auditoria

Aplicação das regras do ADR-0007 (proteção de dados pessoais) ao MNA.
Este arquivo é o **inventário de dados pessoais** do projeto: todo campo
novo com dado pessoal é registrado aqui no mesmo commit.

## Classificação

* **Pessoal:** legível no banco, acesso controlado por permissão.
* **Sensível:** criptografado por campo no banco; exibido legível na
  aplicação para quem tem permissão; **cada visualização é auditada**.

## Inventário

| Titulares | Dado | Classificação | Base legal | Observação |
|---|---|---|---|---|
| Usuários | Nome, e-mail, telefone | Pessoal | Contrato | E-mail usado no login e nos convites |
| Usuários | CPF | **Sensível** | Contrato | |
| Sócios e partes de contratos | Nome, e-mail, telefone, endereço completo | Pessoal | Contrato | Usados na confecção de contratos |
| Sócios e partes de contratos | CPF, RG (identidade) | **Sensível** | Contrato | |
| Sócios e partes de contratos | Dados do cônjuge | **Sensível** | Contrato | |
| Funcionários das empresas-alvo | Nome, cargo, data de admissão | Pessoal | Contrato (a validar) | Circulam sobretudo dentro de arquivos de diligência |
| Funcionários das empresas-alvo | CPF, salário | **Sensível** | Contrato (a validar) | Idem |

"A validar": para terceiros que não são parte do contrato (ex.:
funcionários da empresa-alvo), confirmar com o jurídico se a base é
contrato, legítimo interesse ou outra.

## Dados dentro de arquivos

Documentos de diligência contêm dados pessoais de terceiros. Proteção:
armazenamento criptografado em repouso, acesso só por permissão, download
auditado. Sem marca d'água ou bloqueio de download.

## Retenção e exclusão

* **Retenção:** 10 anos.
* Ao fim do prazo, antes de excluir um deal, gerar **exportação completa
  em PDF** das informações do deal.
* **Pedido de exclusão do titular:** se não houver base legal para recusar,
  **anonimizar** os dados pessoais do solicitante (preservando o histórico
  do processo).

## Auditoria

* Registrar **tudo** o que ocorre no sistema: logins, visualizações,
  downloads, criações, alterações, exclusões, convites, mudanças de
  permissão e visualizações de dados sensíveis.
* Registros de auditoria **sem dados pessoais** no conteúdo: usar IDs
  internos (ADR-0007).
* **Retenção da auditoria:** configurada pela RGRUBER por tenant, no
  console.
* **Rotina de limpeza** com opção de **exportar em PDF e/ou XLSX** o
  período a ser limpo.
* Consulta da auditoria: quem tiver a permissão concedida pelos
  administradores do tenant.
