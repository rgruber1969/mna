# MNA: questionário de empresas, papéis e pessoas (itens 7 e 24)

Responda abaixo de cada pergunta, no campo **Resposta**. Cada pergunta traz
uma **Sugestão** minha: se concordar, basta escrever "ok". Se ainda não
souber, escreva "em aberto". Também pode responder na conversa (ex.: "ok em
todas, menos E2 e Pe5").

Para editar e ver formatado ao mesmo tempo no VS Code: `Ctrl+K` e depois `V`.

---

## 1. Empresas

**E1. Campos da empresa.** Quais dados guardar?

**Sugestão:** CNPJ, razão social, nome fantasia, endereço completo, atividade
principal (CNAE), site, telefone e e-mail gerais, observações. Empresa
**estrangeira** (comum entre compradoras) sem CNPJ: país + identificador do
país de origem. Faturamento, número de funcionários e dados financeiros
ficam no valuation, não no cadastro.

**Resposta:**

**E2. Preenchimento automático pelo CNPJ.** Ao digitar o CNPJ, o sistema
busca razão social, endereço, CNAE e o quadro de sócios na base pública da
Receita (serviço gratuito, sem cadastro; o CNPJ é dado público).

**Sugestão:** sim, real na V1. Os sócios encontrados aparecem como sugestão
para cadastrar como pessoas (o usuário confirma cada um).

**Resposta:**

**E3. Grupo econômico.** O domínio já fala em grupo econômico (anonimização
de clientes e rateio do valuation entre vendedoras). A empresa tem um campo
"grupo econômico"?

**Sugestão:** sim: cadastro simples de grupos (nome) e cada empresa pode
pertencer a um grupo. Sem hierarquia (controladora/controlada) na V1.

**Resposta:**

**E4. Duplicidade.** A mesma empresa pode ser cadastrada duas vezes no
tenant?

**Sugestão:** não: CNPJ único por tenant (o sistema avisa e leva ao cadastro
existente). Cada tenant tem o seu cadastro, sem compartilhar com outros
tenants.

**Resposta:**

**E5. O próprio contratante como empresa.** O BT também atua nos deals (ex.:
escritório da vendedora). Ele deve existir como empresa no próprio tenant?

**Sugestão:** sim, criado automaticamente na criação do tenant (marcado como
"empresa do contratante", sem exclusão), para ser escolhido nos deals como
qualquer outra empresa.

**Resposta:**

## 2. Papéis das empresas

**Pa1. Lista padrão de papéis.** A lista do domínio (vendedora, compradora,
advisor, escritório, contabilidade e auditora de cada lado, investidores e
sócios) vira um cadastro do tenant, extensível.

**Sugestão:** copiada para cada tenant, como os perfis padrão: o tenant
renomeia, cria e exclui (papel em uso não pode ser excluído). Cada papel
indica o **perfil de deal sugerido** para as pessoas daquela empresa (ex.:
"Escritório da compradora" → "Advogado da compradora"); no deal, o
administrador confirma.

**Resposta:**

**Pa2. Onde o papel é dado.** O papel é da empresa **dentro de cada deal**
(a mesma empresa pode ser vendedora num deal e compradora em outro).

**Sugestão:** sim. Nesta etapa entra só o cadastro de papéis; a atribuição
aos deals vem com o item 8 (deals).

**Resposta:**

## 3. Pessoas

**Pe1. Campos da pessoa.** Para a qualificação nos contratos (padrão
brasileiro: "nacionalidade, estado civil, profissão, RG, CPF, endereço").

**Sugestão:**
* Pessoais: nome completo, e-mail, telefone, nacionalidade, estado civil,
  profissão, data de nascimento, endereço completo.
* Sensíveis (criptografados): CPF, RG com órgão emissor e UF; estrangeiro:
  passaporte ou documento do país.
* Cônjuge (sensíveis, criptografados): nome, CPF, RG e regime de bens.

**Resposta:**

**Pe2. Vínculo da pessoa com a empresa.** Uma pessoa pode estar ligada a
várias empresas, com tipos de vínculo diferentes.

**Sugestão:** vínculos: sócio (com percentual de participação),
administrador, representante legal, procurador, funcionário e contato, com
cargo (texto livre). Uma pessoa pode ter mais de um vínculo com a mesma
empresa.

**Resposta:**

**Pe3. Pessoa e usuário.** Toda pessoa pode virar usuário ao ser convidada.

**Sugestão:** o convite pode partir do cadastro da pessoa (botão "convidar
para o sistema"); quem já é usuário do tenant aparece também como pessoa,
ligado à sua conta. A conta (login) continua única na plataforma (ADR-0019);
a pessoa é do tenant.

**Resposta:**

**Pe4. Funcionários das empresas-alvo.** O inventário prevê CPF e salário de
funcionários, que circulam sobretudo dentro dos arquivos de diligência.

**Sugestão:** não cadastrar salário na V1 (fica só nos arquivos, que já
têm acesso controlado); funcionário entra como pessoa comum, se for
necessário citá-lo. Menos dado sensível guardado = menos risco (LGPD:
minimização).

**Resposta:**

**Pe5. Quem vê os dados sensíveis.** CPF, RG e dados do cônjuge.

**Sugestão:** aparecem **mascarados** (ex.: `***.456.789-**`); um botão
"mostrar" revela o dado para quem pode **editar** "Empresas e pessoas" e
registra a visualização na auditoria. Exportações e API seguem a mesma
regra.

**Resposta:**

**Pe6. Duplicidade de pessoa.** A mesma pessoa pode ser cadastrada duas
vezes no tenant?

**Sugestão:** não: CPF único por tenant (verificado por um "índice cego",
que encontra o CPF repetido sem guardar o CPF legível). Sem CPF, o sistema
só avisa sobre nome e e-mail parecidos.

**Resposta:**

## 4. Exclusão

**X1. Excluir empresa ou pessoa.**

**Sugestão:** só se não estiver em nenhum deal, contrato ou valuation; senão,
a opção é **inativar** (some das listas de escolha, mas o histórico fica).
A exclusão definitiva a pedido do titular segue a anonimização do item 23.

**Resposta:**
