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
| Usuários | Endereço IP e navegador da sessão | Pessoal | Legítimo interesse (segurança) | Tabela `sessao`; apagados quando a sessão termina |
| Usuários | Passkeys: chave pública e nome dado ao aparelho | Pessoal | Contrato | Tabela `chave_de_acesso`; a chave privada nunca sai do aparelho |
| Usuários | Foto (opcional, enviada pela própria pessoa) | Pessoal | Consentimento (a pessoa envia e remove quando quiser) | Da conta, vale em todos os tenants; guardada no armazenamento de arquivos, reduzida a 256 × 256 px, sem metadados (EXIF); apagada ao ser trocada ou removida |
| Convidados | Nome e e-mail do convite | Pessoal | Contrato | Tabelas `convite` e `convite_plataforma`; token guardado só como hash |
| Pessoas do tenant (sócios, partes, representantes, contatos) | Nome, e-mail, telefone, nacionalidade, estado civil, profissão, data de nascimento, endereço completo | Pessoal | Contrato | Qualificação nos contratos (dominio.md, "Pessoa e usuário") |
| Pessoas do tenant | CPF, RG (órgão emissor e UF) ou documento estrangeiro | **Sensível** | Contrato | Criptografados com a chave do tenant; CPF com índice cego para evitar duplicidade |
| Pessoas e empresas do tenant | Anexos do cadastro (ex.: RG, CPF, comprovante de CNPJ, contrato social) | **Sensível** | Contrato | Criptografados com a chave do tenant antes de ir para o armazenamento; download só pelo servidor, com permissão e auditoria; o documento lido no cadastro a partir de documento pode ficar como anexo (ADR-0021) |
| Pessoas e empresas do tenant | Dados bancários: agência, conta e chave Pix (2026-11-19) | **Sensível** | Contrato | Criptografados por campo com a chave do tenant (também nas empresas, por simplicidade); mascarados nas telas; "Mostrar" revela com auditoria (na pessoa, exige permissão de editar) |
| Participantes dos negócios | Texto das mensagens (livre; pode conter dados pessoais digitados) | Pessoal | Contrato | Tabela `mensagem`, imutável; visível só a quem está no canal e vê o item; avisos e resumos por e-mail **sem o texto**; nada do texto em logs ou auditoria (só tipo de conversa, canal e número de menções) |
| Cônjuges das pessoas | Nome e e-mail | Pessoal | Contrato | E-mail para futuras assinaturas eletrônicas e avisos |
| Cônjuges das pessoas | CPF, RG e regime de bens | **Sensível** | Contrato | Criptografados com a chave do tenant |
| Clientes das empresas (quando pessoa física) | Nome e variações de grafia | Pessoal | Contrato (a validar) | Clientes das anonimizações (dominio.md); razão social de pessoa jurídica não é dado pessoal |
| Funcionários das empresas-alvo | Nome, cargo, data de admissão | Pessoal | Contrato (a validar) | Circulam sobretudo dentro de arquivos de diligência |
| Funcionários das empresas-alvo | CPF, salário | **Sensível** | Contrato (a validar) | Idem; salário **não** é cadastrado na V1 (só nos arquivos) |

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
