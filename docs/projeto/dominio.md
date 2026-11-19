# MNA: domínio

Fonte da verdade das entidades e do processo do MNA. Origem: respostas do
questionário (`perguntas-mna.md`) e decisões de 2026-11-16. Regras de
acesso em `perfis-e-permissoes.md`; dados pessoais em `dados-pessoais.md`.

## Visão geral

O MNA controla todas as fases de um processo de M&A, inicialmente
**aquisições** e com foco no **sell side**.

* **Contratante típico (tenant):** escritório de advocacia do lado vendedor.
  Usuários: advogados do escritório, empresa vendedora e advisors.
* **Lado comprador também participa:** representantes, advisors e advogados
  da compradora interagem principalmente em pendências, consulta de status e
  data room.
* **Advisor também pode ser contratante**, sobretudo para valuation e
  montagem de e-book para a empresa vendedora.
* **Qualquer lado pode ser contratante** (decidido em 2026-11-18): a versão 1
  é construída com foco no lado vendedor, mas o tenant pode ser do lado
  comprador (ex.: compradora, seu advisor ou escritório). Nada no modelo
  supõe que o tenant é do lado vendedor: os administradores do tenant, de
  qualquer lado, definem os poderes de cada usuário.
* **Tenant piloto:** BT (Bastos Tigre, escritório de advocacia, Rio de
  Janeiro).

## Entidades

### Tenant

Empresa contratante da plataforma. Cadastrado e administrado **somente pela
RGRUBER** no console (`admin.<domínio>`); acessado pelo seu subdomínio
(`<slug>.<domínio>`). Tem administradores próprios, identidade visual
(white label) e configurações gerais. Detalhes técnicos: ADR-0009 a 0011.

### Empresa

Pessoa jurídica (CNPJ) cadastrada no tenant. Num deal, assume um ou mais
**papéis**, inclusive simultâneos (ex.: o escritório que atua no jurídico
geral do comprador e também faz a diligência jurídica do comprador):

* Vendedora; Compradora
* Advisor da vendedora; Advisor da compradora
* Escritório de advocacia da vendedora; Escritório de advocacia da
  compradora
* Contabilidade da vendedora; Contabilidade da compradora
* Auditora da vendedora; Auditora da compradora (contábil, fiscal,
  jurídica, trabalhista, societária etc.)
* Investidores e sócios da compradora; Sócios da vendedora

A lista de papéis deve ser um cadastro extensível.

Regras do cadastro (questionário `perguntas-empresas-pessoas.md`, 2026-11-18):

* **Campos:** CNPJ, razão social, nome fantasia, endereço completo,
  atividade principal (CNAE), site, telefone e e-mail gerais, observações.
  **Empresa estrangeira:** país + identificador do país de origem, sem CNPJ.
  Faturamento e dados financeiros ficam no valuation, não no cadastro.
* **Preenchimento automático:** ao digitar o CNPJ, busca na base pública
  da Receita (razão social, endereço, CNAE e quadro de sócios); os sócios
  aparecem como sugestão de pessoas, confirmadas uma a uma. Ao digitar o
  CEP, o endereço é preenchido (empresas e pessoas).
* **Grupo econômico:** cadastro simples de grupos (nome e **logo**); cada
  empresa pode pertencer a um grupo, sem hierarquia na V1. **Um deal pode
  estar associado a uma empresa, ao grupo inteiro ou a algumas empresas do
  grupo** (campo "Objeto" do deal, abaixo).
* **Logo da empresa** (decidido em 2026-11-19): no cadastro da empresa, não
  no deal; o grupo econômico também tem logo (ex.: RGBsys e HTEC, sem logo
  próprio, vendidas juntas usam o logo do Grupo RGBtec).
* **Empresa sócia de outra empresa** (decidido em 2026-11-19): vínculo
  próprio entre empresas ("participação"), com percentual e qualificação
  opcionais, visível nas duas (sócias de uma; empresas em que a outra
  participa). No quadro de sócios da Receita, sócio pessoa jurídica é
  cadastrado "como empresa e sócia": o CNPJ da matriz é montado a partir
  do início informado e os dados vêm da consulta pública; se a empresa já
  existir, só a participação é criada. Vale também no cadastro a partir de
  documento.
* **Quadro de sócios × vínculo:** quem é sócio na Receita vira vínculo
  "Sócio" (a qualificação vai para o cargo); quem é só administrador vira
  vínculo "Administrador". O botão mostra a qualificação da Receita
  ("Cadastrar pessoa como Sócio-Administrador"). A base pública é mensal:
  a tela mostra a data da base quando o serviço a informa, e quem saiu da
  sociedade em bases anteriores fica de fora. Pessoa já cadastrada com o
  mesmo nome (e CPF compatível com os dígitos que a Receita mostra) é
  reaproveitada: só o vínculo é criado (2026-11-19).
* **Anexos e cadastro a partir de documento** (item 34, ADR-0021):
  documentos da empresa e da pessoa anexados ao cadastro, criptografados;
  um PDF pode ser lido para propor empresas, sócios e vínculos.
* **Sem duplicidade:** CNPJ único por tenant (o sistema avisa e leva ao
  cadastro existente). Cada tenant tem o seu cadastro.
* **Empresa do contratante:** criada automaticamente com o tenant, com uma
  **marcação** (não é perfil nem papel) que impede a exclusão; nos deals,
  é escolhida e recebe papéis como qualquer outra.
* **Papéis:** a lista acima é copiada para cada tenant (como os perfis
  padrão) e é editável; papel em uso não pode ser excluído. Cada papel
  indica o **perfil de deal sugerido** para as pessoas daquela empresa; no
  deal, o administrador confirma. O papel é dado à empresa **dentro de
  cada deal** (item 8).

### Anonimização de clientes (incluída na V1 em 2026-11-18)

Funcionalidade de venda: quem envia documentos (tipicamente a vendedora ao
comprador) consegue **não revelar quem são os clientes**.

* **Anonimização** é uma entidade própria. O tenant pode ter **N
  anonimizações**; cada uma tem a sua lista de clientes e os seus códigos.
* **Onde vale:** quem cria a anonimização escolhe a quais **deals** ela se
  aplica (aos documentos desses deals).
* **Clientes da anonimização:** razão social, nome fantasia, **variações de
  grafia** (abreviações e outras formas como o nome aparece nos documentos,
  digitadas pelo usuário para a associação) e o **código**, gerado em
  sequência e **único dentro da anonimização** (`C00001`, `C00002`...).
* **Grupo econômico em 2 níveis:** clientes do mesmo grupo compartilham a
  raiz do código e ganham um sufixo (ex.: ABC e XYZ do mesmo grupo:
  `C00087.001` e `C00087.002`).
* **Importação de planilha** (XLSX ou CSV, modelo padrão) além do cadastro
  manual.
* **Substituição nos documentos:** ao enviar um documento num deal onde há
  anonimização aplicável, se ele contiver nomes de clientes (razão social,
  nome fantasia ou uma das variações), o sistema pergunta se deseja trocar
  pelos códigos. Vale para **qualquer usuário** com permissão de enviar
  documentos (inclusive o lado comprador).
* **Original e anonimizado:** os dois ficam guardados. O original tem
  acesso restrito (lista de acesso definida por quem envia, como nas
  versões de documento); o anonimizado é o que circula.
* A **tabela de correspondência** (código × nome) é sigilosa: visível só a
  quem o criador da anonimização der acesso.
* **Versão 1:** substituição real em planilhas (XLSX, CSV); em DOCX e PDF,
  simulada (escopo-v1.md, item 33). O restante fica no backlog.

### Pessoa e usuário

* **Pessoa:** pessoa física registrada no tenant, vinculada a uma ou mais
  empresas, **com ou sem acesso ao sistema** (ex.: sócio cujos dados entram
  num contrato, funcionário citado numa diligência).
* **Usuário:** pessoa **com login**. Toda pessoa pode virar usuário ao ser
  convidada; nem toda pessoa é usuária.
* Cada empresa pode ter N pessoas e N usuários. Um usuário pode ter
  perfis diferentes em deals diferentes.
* **Campos da pessoa** (qualificação nos contratos): nome completo, e-mail,
  telefone, nacionalidade, estado civil, profissão, data de nascimento,
  endereço completo; **sensíveis, criptografados:** CPF, RG (órgão emissor
  e UF) ou documento estrangeiro. **Cônjuge:** nome, e-mail (para futuras
  assinaturas eletrônicas e avisos) e, criptografados, CPF, RG e regime de
  bens.
* **Vínculos com empresas:** uma pessoa pode ter vários vínculos, inclusive
  mais de um com a mesma empresa, com cargo (texto livre). Tipos de vínculo
  num **cadastro do tenant, extensível**, com os padrões: sócio (com
  percentual de participação), administrador, representante legal,
  procurador, funcionário e contato.
* **Pessoa e conta:** o convite pode partir do cadastro da pessoa. Ao
  aceitar um convite, se já existe pessoa com o mesmo e-mail no tenant, a
  conta é ligada a ela; senão, a pessoa é criada com nome e e-mail. O CPF só
  é exigido quando necessário (ex.: contrato).
* **Sem duplicidade:** CPF único por tenant (verificado por índice cego);
  **e-mail único por tenant quando preenchido** (pessoa pode não ter
  e-mail). Sem CPF, o sistema avisa sobre nomes parecidos.
* **Dados sensíveis mascarados** (ex.: `***.456.789-**`); "mostrar" revela
  para quem pode editar "Empresas e pessoas" e registra a visualização na
  auditoria. Exportações e API seguem a mesma regra.
* **Funcionários das empresas-alvo:** sem salário no cadastro na V1 (fica só
  nos arquivos de diligência); entram como pessoa comum, se necessário.

#### Exclusão de empresas e pessoas

* Exige a permissão de excluir em "Empresas e pessoas" **e** que o cadastro
  não esteja em nenhum deal, contrato ou valuation; senão, a opção é
  **inativar** (some das listas de escolha, o histórico fica). A exclusão
  definitiva a pedido do titular segue a anonimização (item 23).

### Deal (Negócio)

Processo de M&A (inicialmente aquisição). **Nas telas, e-mails e textos em
PT-BR chama-se "Negócio"**; "deal" fica só como nome interno (código,
banco e estes documentos). Pontos-chave:

* Uma compradora pode adquirir **mais de uma vendedora** (N CNPJs) no mesmo
  deal.
* Participantes: empresas com seus papéis e usuários com seu perfil naquele
  deal.
* **Participação e lado** (decidido em 2026-11-19):
  * Cada participação registra **qual empresa a pessoa representa** naquele
    deal; o lado (vendedor ou comprador) vem do papel dessa empresa. A mesma
    pessoa pode estar em lados diferentes em deals diferentes, com o mesmo
    perfil.
  * Ao incluir a pessoa, o sistema oferece só as empresas dela (vínculos)
    que já estão no deal: se houver uma, escolhe sozinho; se houver mais de
    uma, pede para escolher.
  * **Pessoa sem empresa** (ex.: consultor autônomo): o lado é escolhido
    direto na participação.
  * **Mesma empresa nos dois lados do mesmo deal** (conflito de interesse):
    **bloqueado**: uma empresa só pode estar em um dos lados de cada deal.
* Contém etapas, documentos, tarefas e contratos de serviço.
* Deal encerrado continua acessível para consulta.
* **Histórico do deal** visível a partir do cartão (kanban) ou da linha
  (tabela).

Regras do item 8 (questionário `perguntas-negocios.md`, respondido em
2026-11-19):

* **Campos:** número, nome interno, **codinome**, tipo de operação, lado do
  contratante (vendedor ou comprador), **objeto**, data de início, previsão
  de fechamento (opcional), valor estimado (opcional, em reais) e descrição.
* **Número:** sequencial e automático por tenant (N-0001, N-0002…).
* **Nome que aparece:** todos veem **número + codinome** (ex.: "N-0001
  Projeto Gadol"); o nome interno, que pode citar a vendedora, só para quem
  já pode ver a vendedora. **E-mails sempre com número + codinome.**
* **Tipo de operação:** cadastro auxiliar editável pelo tenant, começando
  com aquisição total, aquisição parcial (com percentual), fusão,
  incorporação e investimento (aporte); serve para filtro, relatório e
  e-book.
* **Objeto:** "Empresas específicas" ou "Grupo econômico" (escolhendo o
  grupo, que entra com as suas empresas; cada uma mantém papel e rateio).
  **Logo usado no deal** (e-book, OnePager): o do grupo, quando o objeto é
  o grupo; senão, o da vendedora (com várias, escolhe-se qual). Vem do
  cadastro, não é enviado no deal. A marca do sistema continua a do tenant.
* **Quem cria:** quem tem "Negócios × criar" (perfis Gestor e Equipe do
  contratante), e entra como Coordenador do deal; usuários externos nunca
  criam deals. A empresa do contratante entra automaticamente, com o papel
  vindo do lado do contratante, e quem criou entra representando-a.
* **Situação:** Em andamento, Suspenso, Concluído e Encerrado sem conclusão
  (com motivo: desistência da vendedora, da compradora, preço, diligência,
  outro). Concluído e encerrado ficam só para consulta; reabrir só por
  administradores do tenant, com auditoria. A etapa vem das etapas (item
  9), não da situação.
* **Exclusão:** só sem documentos, tarefas e mensagens, por quem tem
  "Negócios × excluir", com auditoria; depois disso, só encerrar.
* **Compradoras potenciais:** o papel "Compradora" pode ser dado a várias
  empresas, cada uma com a **situação no funil**: Prospectada → Teaser
  enviado → NDA assinado → Proposta recebida → **Escolhida** ou Descartada.
  Cada uma só vê o que lhe for liberado, nunca as outras compradoras.
  * **Descartada que volta** com nova proposta: volta para "Proposta
    recebida" **no mesmo deal**; cada proposta é um registro próprio em
    Ofertas e o histórico guarda as mudanças de situação.
  * **Antes do NDA** (Prospectada, Teaser enviado), as pessoas da
    compradora entram no sistema, mas veem o deal **só pelo codinome**, sem
    nome, CNPJ nem logo da vendedora; depois do NDA, passam a ver.
* **Período de exclusividade da escolhida:** início e duração em dias (ou
  data de fim); alertas ao lado vendedor (coordenador e participantes da
  vendedora) no início, no fim e com antecedência configurada pelo
  administrador do tenant nas configurações gerais (padrão: 15 e 5 dias
  antes); **linha do tempo do período na tela principal** para o lado
  vendedor.
* **Participantes:** incluir e remover pessoas do deal: administradores do
  tenant e o **Coordenador do deal**, com auditoria e aviso por e-mail. (No
  cadastro geral de pessoas, vale a permissão "Empresas e pessoas".)
  * **Pessoa sem usuário** participa como **contato** (sem perfil; pode ser
    responsável por tarefa fora do sistema); ao aceitar convite, recebe o
    perfil sugerido pelo papel, confirmado pelo administrador ou
    coordenador.
  * **Alcance:** nesta entrega só "deal inteiro"; por etapas com o item 9.
  * **Prazo da participação** (opcional): ao vencer, o acesso acaba sozinho
    e o coordenador é avisado; prazos aparecem no painel de alertas da tela
    principal.
  * **Ao remover:** o que a pessoa fez continua, com o nome dela; tarefas
    abertas dela ficam "sem responsável" para o coordenador redistribuir; o
    acesso acaba na hora.
* **Lista:** número, codinome (ou nome interno, para quem pode ver),
  vendedora(s), compradora escolhida, descrição (só para quem pode ver a vendedora; trocada pelo papel do contratante em 2026-11-19), situação, etapa,
  coordenador e início; filtros por situação, lado e tipo; busca por nome,
  codinome, número ou empresa. Cada pessoa vê só os deals em que participa
  (administradores veem todos).
* **Tela do deal:** cabeçalho (número, nome, situação, etapa) e abas
  Resumo, Empresas e Participantes; as demais (Etapas, Documentos, Tarefas,
  Mensagens, Contratos, Valuation, E-book, Ofertas, Histórico) aparecem
  quando existirem. Entra na busca do cabeçalho.
* **Histórico:** eventos de auditoria do deal em linguagem simples,
  respeitando o que a pessoa pode ver.
* **Avisos** (sino e e-mail): pessoa incluída (com link); pessoa removida
  (só no sino); mudança de situação para Suspenso, Concluído ou Encerrado;
  **troca de etapa**; e eventos de prazo: início e fim da exclusividade,
  vencimento do prazo de participação etc.
* **API:** junto com as chaves de API (itens 25 e 26). **Sem dados de
  demonstração** por enquanto (o responsável cadastra um caso real).
* **Lado do contratante pelo papel** (ajuste de 2026-11-19, na construção):
  ao criar, escolhe-se o **papel** da empresa do contratante (ex.:
  "Escritório de advocacia da vendedora"); o lado vem desse papel. Cada
  papel tem um **lado** (vendedor, comprador ou nenhum), editável nos
  cadastros auxiliares. As empresas do objeto entram com o papel
  "Vendedora".
* **Regras de apoio** (2026-11-19): o negócio não fica sem Coordenador; a
  empresa do contratante fica com ao menos um papel; empresa com
  participantes só sai depois deles; papel e tipo de operação em uso não
  podem ser excluídos.
* **Andamento do negócio** (respostas N1–N6, 2026-11-19):
  * **Funil de compradoras** (ajuste de 2026-11-19): aba em kanban no
    negócio (colunas = situações; arrastar o cartão muda a situação; cada
    cartão mostra a equipe e o histórico de mudanças). Move o funil quem
    está do **lado vendedor** e tem a permissão "Funil de compradoras ×
    editar" (padrão: Coordenador, Advogado e Advisor; Representante só vê).
    Ao escolher, o sistema oferece descartar as demais. **Descartada perde o
    acesso na hora**, com a sua equipe; se voltar ao funil, os acessos
    voltam como estavam. No kanban de negócios (item 15), o cartão na etapa
    Prospecção mostrará o resumo do funil.
  * **Exclusividade:** com a compradora escolhida; início e duração (ou
    data de fim); **prorrogações** com histórico (de, para, motivo). Avisos
    (sino e e-mail) ao lado vendedor no início, no último dia e com as
    antecedências das **Configurações gerais** (padrão 15 e 5 dias); cada
    aviso sai uma vez; a prorrogação recomeça os avisos. Tarefa diária às
    8 h (Brasília), que também avisa o Coordenador quando vence o prazo de
    uma participação.
  * **Situação:** suspender, retomar, concluir e encerrar (com motivo) por
    quem edita o negócio; concluído e encerrado ficam só para consulta;
    reabrir só administradores. Participantes são avisados (sino; e-mail
    para suspenso, concluído e encerrado). Administradores podem **encerrar
    os acessos externos** (quem não representa o contratante) de uma vez.
  * **E-mail ao incluir participante** com usuário (número + codinome e
    link); contato sem usuário não recebe.
  * **Histórico:** aba com os eventos do negócio; o lado comprador vê só os
    eventos gerais (criação, edição, situação).
* **Equipe da compradora** (decidido em 2026-11-19): empresa do lado
  comprador que não é compradora (escritório, advisor, contabilidade,
  auditora) fica ligada à compradora **para quem trabalha** e vê o negócio
  como ela: só número e codinome antes do NDA dela; a vendedora depois.
  * **Uma compradora no negócio:** a ligação é automática, sem pergunta;
    quem entrou antes da primeira compradora é ligado a ela quando ela
    entra.
  * **Duas ou mais:** ao incluir a empresa, escolhe-se para qual
    compradora ela trabalha.
  * Pessoas do lado comprador nunca veem as outras compradoras nem as
    equipes delas; a compradora só sai do negócio depois da sua equipe.

### Valuation

Processo próprio e independente, no mesmo nível do deal, usado
principalmente pelo advisor.

* **Finalidades:** definir o preço pedido pela vendedora, preparar a
  negociação, avaliar ofertas recebidas e alimentar o e-book.
* **Criado por qualquer usuário com permissão** (menu Valuation × criar),
  de qualquer lado (vendedor ou comprador). Decidido em 2026-11-18.
* **Pode existir sem deal** (avaliação avulsa de uma empresa); o **criador**
  pode ligá-lo a um deal, e então ele fica ligado ao deal e à(s)
  empresa(s) avaliada(s).
* **Quantidade livre:** um deal pode ter vários valuations (ex.: um do lado
  vendedor e outro do lado comprador).
* **Visibilidade definida pelo criador**, como na lista de acesso por versão
  de documento: quem cria escolhe, por **usuário e/ou perfil**, quem vê. Ligar
  a um deal não amplia essa visibilidade. Objetivo: sigilo entre os lados (o
  valuation do comprador revela quanto ele pagaria). Administradores do
  tenant veem todos, com auditoria (`perfis-e-permissoes.md`).
* **Mesmos campos para os dois lados** (decidido em 2026-11-18): o
  valuation não tem "lado"; quem cria e a visibilidade escolhida bastam.
  Campos específicos do comprador ficam no backlog futuro.
* **Deal com várias vendedoras: um valuation único do conjunto**, com
  DRE e documentos de cada empresa, e o **percentual de cada empresa sobre
  o total** (rateio). O critério do rateio é registrado (ex.: faturamento
  de cada empresa sobre o do grupo) e o percentual pode ser definido em
  qualquer etapa, comumente no QPA.
* **Acesso:** pelo modelo de permissões (montar, comentar, aprovar e ver são
  permissões), dentro da visibilidade definida pelo criador. Padrão no
  valuation do lado vendedor: advisor monta, vendedora vê, comenta e aprova;
  **lado comprador sem acesso**.
* **Métodos:** fluxo de caixa descontado, múltiplos de mercado (EV/EBITDA,
  EV/Receita, EV/ARR), transações comparáveis, patrimonial ajustado e
  múltiplo de faturamento recorrente ou "regra de bolso" do setor.
* **Resultado:** valor de cada método **e** valor final ponderado, com peso
  configurável por método (soma dos pesos = 100%).
* **Cenários** (pessimista, base, otimista) e **tabelas de sensibilidade**.
* **Tese do setor:** campo para os múltiplos de EBITDA e de faturamento
  usados no segmento da vendedora, com documentos ou links que os comprovem.
* **Faixa de valor esperado:** valor **mínimo** e valor **máximo**
  esperados, opcionais. No lado vendedor: mínimo = abaixo disso não vende
  (expectativa da vendedora); máximo = preço pedido/ancoragem. No lado
  comprador: mínimo = oferta inicial; máximo = teto acima do qual desiste.
* **Painel visual** confrontando todos os números: métodos, valor final,
  faixa mínimo–máximo × realidade, ofertas recebidas.
* **Dados de entrada (V1):** digitados ou importados por arquivo (modelo
  padrão de planilha). DRE de 3 anos; demais dados conforme o método
  (balanço, projeções, ajustes de EBITDA, dívida líquida, capital de giro,
  contingências, regime tributário). Taxa de desconto (WACC) digitada.
* **Versões e aprovação**, como o e-book (comentários entre versões). Aprova
  quem tiver a permissão "aprovar" naquele valuation, de qualquer lado.
* **No e-book:** inclusão dos números do valuation é **opcional**, porque a
  vendedora costuma não expô-los até receber ofertas. Quem monta o e-book só
  puxa números dos valuations que pode ver.
* **Saída na V1:** tela com resumo e gráficos.

### Ofertas

* Registro das **ofertas recebidas** de compradores, na negociação informal
  ou no Term Sheet (ou LOI, ou MOU).
* Guarda a **estrutura de pagamento**: parcela à vista, parcelas a prazo,
  earnout e condições.
* Comparação das ofertas com o valuation no painel visual.
* **Quem vê:** definido por quem registra a oferta (lista de acesso,
  pré-preenchida com o próprio lado), para que uma compradora não veja a
  oferta de outra.
* **Preço único para várias vendedoras:** o preço fechado (total, parcelas,
  earnout) é rateado entre as empresas vendedoras pelo percentual definido
  (ex.: 70% e 30%), com o critério registrado.

### E-book e OnePager

Material de apresentação da empresa vendedora a potenciais compradores,
montado pelo advisor, em geral durante a prospecção (tarefa importante, mas
opcional).

* **Quatro documentos por deal:** e-book **teaser** (anônimo, antes do NDA),
  e-book **completo** (depois do NDA), **OnePager teaser** e **OnePager
  completo**.
* **Formato na versão 1:** PDF (outros formatos no backlog).
* **Conteúdo:** combinação de dados digitados no sistema, puxados do
  cadastro da empresa e do valuation, e arquivos anexados.
* **Identidade visual:** do tenant, da empresa vendedora (logo enviada no
  deal), do advisor da vendedora, ou combinação, à escolha do usuário.
* **Versões e revisão:** cada versão recebe comentários da vendedora antes
  de o advisor produzir a próxima.
* **Liberação ao comprador:** a vendedora muda o status para "disponível ao
  comprador", o que inclui os participantes do lado comprador na lista de
  acesso daquela versão (e-book tratado como documento; ver
  `perfis-e-permissoes.md`); o sistema envia e-mail aos usuários do
  comprador com link para a tela no sistema, onde visualizam ou baixam o PDF.

Estrutura sugerida (aprovada; referência complementar: info memo enviado
pelo responsável):

| Seção | E-book completo | Teaser |
|---|---|---|
| Capa com codinome do projeto | Sim | Sim |
| Aviso legal | Sim | Sim |
| Agenda | Sim | Sim |
| Sumário executivo e grandes números (KPIs) | Sim | Sim, números em faixas |
| Histórico e marcos | Sim | Sem nomes nem datas identificáveis |
| Produtos e serviços | Sim | Genérico |
| Mercado, ecossistema e concorrência | Sim | Sim |
| Clientes: perfil, concentração e casos | Sim | Sem clientes nomeados |
| Operação, equipe, sócios e organograma | Sim | Sem nomes |
| Parcerias | Sim | Genérico |
| Estrutura societária | Sim | Não |
| Plano de negócios e prioridades | Sim | Resumido |
| Dados financeiros (histórico e projeções) | Sim | Em faixas |
| Tese de investimento | Sim | Sim |
| Estrutura da transação proposta | Sim | Resumida |
| Próximos passos e contatos do advisor | Sim | Sim (só o advisor) |

**OnePager:** uma página com destaques, grandes números e tese (versões
teaser e completa).

### Contrato de serviço

Contrato de prestação de serviço ligado ao processo, com **tipo**:

* Mandato do advisor (ex.: vendedora contrata advisor para vender a empresa)
* Contrato de honorários advocatícios
* Outros tipos no futuro (contabilidade, auditoria)

Campos de referência: partes, escopo, exclusividade, vigência, honorários,
success fee e documentos.

* **Quem vê:** definido por quem cria o contrato (lista de acesso,
  pré-preenchida com o próprio lado); cada lado vê os seus contratos e os
  que lhe forem liberados.

### Etapas

* **Cadastro padrão** de etapas no tenant, copiado para cada deal e
  **adaptável** por deal (incluir, remover, renomear, reordenar).
* **Subetapas** (ex.: diligência quebrada em várias diligências, com
  empresas e documentos próprios).
* **Relação entre etapas:** dependente (só começa após outra), em paralelo
  ou pulada (ex.: closing junto com a assinatura do QPA, sem condições
  precedentes).
* **Visualização e manuseio gráficos** das etapas do deal (forte desejo de
  usabilidade).

Regras construídas (itens 9 e 10, respostas E1–E7, 2026-11-19):

* **Cadastro auxiliar "Etapas padrão"**: incluir, renomear, reordenar,
  desativar; subetapas padrão (Diligência jurídica, contábil e financeira,
  fiscal e trabalhista). Copiadas para cada negócio novo; negócios
  existentes não mudam.
* **No negócio** (aba Etapas): situação Não iniciada · Em andamento ·
  Concluída · Pulada; datas previstas e reais (iniciar e concluir preenchem
  as reais); incluir, remover (só não iniciadas), reordenar; um nível de
  subetapas; quem tem "Etapas × editar" naquela etapa muda a situação.
* **Dependência só avisa**: por padrão cada etapa depende da anterior;
  iniciar antes pede confirmação. "Sem dependência" = em paralelo.
* **Etapa principal**: a em andamento mais avançada ("+1 em paralelo");
  aparece no cabeçalho e na lista de negócios; a troca avisa os
  participantes (sino).
* **Alcance por etapa**: a participação pode valer só para algumas etapas
  ou subetapas; a pessoa vê só essas (e a etapa-mãe como contexto).
* **Linha do tempo** (item 10): barras pelas datas, só leitura; a edição
  gráfica (arrastar e ligar dependências) aparece como demonstração.

Etapas padrão:

1. **Prospecção** (com e-book e valuation como tarefas opcionais em
   paralelo)
2. **Negociação informal** (telefone, WhatsApp, e-mail, presencial)
3. **Term Sheet** (ou MOU, ou LOI)
4. **Diligência** (due diligence; pode ter várias subdiligências)
5. **QPA** (ou SPA: acordo de compra e venda)
6. **QPA → Closing** (cumprimento das condições precedentes)
7. **Closing** (fechamento; pagamento da parcela à vista)
8. **Pós-closing** (datas de transição, earnout e parcelas a prazo; a
   última costuma vencer cerca de 5 anos após o closing)

### Documentos

* **Documento é uma entidade com versões.** Cada versão guarda arquivo,
  usuário que enviou, data e hora, e comentários.
* No upload, o usuário indica se é **nova versão** de um documento existente
  ou **documento novo**.
* A interface mostra os documentos com seu status e permite **expandir e
  recolher** as versões de cada um.
* Atributos para **classificação, agrupamento e filtragem**.
* Tipos predominantes: XLSX, PDF e DOCX; tamanhos variáveis.
* **Cadastro de documentos** (catálogo do tenant) com a indicação de
  **obrigatório ou opcional** em cada contexto: no deal, na etapa/subetapa
  e no valuation. Diligências usam listas de centenas de documentos com
  checklist próprio. Quando o deal tem várias vendedoras, os documentos são
  pedidos por empresa vendedora.
* **Lista padrão de documentos por etapa e subetapa**, no cadastro padrão de
  etapas, editável em cada deal.
* **Templates** (tipicamente DOCX que depois viram PDF para assinatura)
  podem ser atrelados aos documentos padrão. Na versão 1, por
  **preenchimento de campos** (o sistema gera o DOCX preenchido; a edição
  acontece no Word).
* **Lista de acesso por versão:** quem envia uma versão escolhe, por perfil
  e/ou usuário, quem pode **ver e baixar** aquela versão (regras em
  `perfis-e-permissoes.md`). Quem quiser alterar baixa, edita (ex.:
  comentários no Word) e envia nova versão ligada ao mesmo documento.
  Não há rascunho nem fluxo de "liberar": a versão final é enviada já com
  o acesso do lado comprador, quando for o caso.
* Versões listadas em ordem decrescente de data e hora.
* **Resumo do histórico de alterações** do documento (ver "Resumos
  automáticos").
* Sem marca d'água ou bloqueio de download: vale a permissão do usuário.
* O conjunto de documentos do deal, filtrado por permissão, funciona como
  **data room**.

### Kanban de deals

* **Funil por etapa:** colunas = etapas do deal (configuráveis, com padrão
  igual às etapas padrão); cartões = deals.
* Deal com etapas em paralelo aparece só na **etapa principal** (a mais
  avançada), com indicador de outras etapas ativas; assim os KPIs não
  contam o mesmo deal duas vezes.
* **Visão em tabela** como alternativa.
* Kanban de tarefas gerais (fora de deal): backlog.

### Tarefas e pendências

* Campos: título, descrição, responsáveis, prazo, prioridade,
  etapa/subetapa, documentos ligados, checklist e comentários; atributos
  específicos de deal podem surgir depois.
* **Vários responsáveis:** usuários e/ou perfis.
* Criar, mover e concluir seguem as **permissões do deal**.
* **Tarefas automáticas** por gatilhos (a informar); gatilhos configuráveis
  pelo sistema são um cenário futuro.
* Dependência entre tarefas: não; dependência só entre **etapas** do deal.

### Tela principal

* **Topo:** gráficos e KPIs (deals por etapa, do usuário e gerais se tiver
  permissão; tarefas pendentes etc.).
* Minhas tarefas, tarefas que aguardam outros, prazos da semana, status de
  cada deal em que participo.
* **Bloco com as últimas mensagens** do usuário.
* **Painel de alertas de prazo** (decidido em 2026-11-19): prazos de
  participação (ex.: acesso do auditor), período de exclusividade (com
  linha do tempo para o lado vendedor) e demais prazos.

### Mensageria e avisos

* **Conversas** em deal, etapa, documento (versão) e tarefa, visíveis a
  todos que têm acesso àquele item. **Sem conversa privada** entre duas
  pessoas.
* **Anexos** ficam na conversa; botão para transformá-los em documento do
  deal.
* Mensagens **não podem ser editadas nem apagadas** (correção por nova
  mensagem).
* **Sem tempo real:** atualização ao recarregar ou em poucos segundos.
* **Menções** (`@pessoa`) e **marcar mensagem como tarefa**: desejáveis
  (escopo a decidir).
* Mensagens entram na **exportação do deal** e na **retenção de 10 anos**.
* **Configuração do tenant** (administradores): avisos por e-mail, sistema
  ou ambos; antecedência dos lembretes de prazo.
* Ícone de mensagens no topo do sistema.

### Resumos automáticos

* Resumo das mensagens não lidas ou recentes.
* Resumo do histórico de alterações de um documento.
* **Desenvolvimento e demonstração: resumo local real, sem IA**, gerado por
  regras no nosso servidor (nada sai do ambiente). Exemplos: "12 mensagens
  não lidas de 4 pessoas desde ontem; você foi mencionado 2 vezes; trechos
  mais relevantes: …"; "3 versões em 10 dias; a v3 alterou as seções 4 e 7;
  comentários de 2 pessoas".
* **Produção:** manter o resumo local ou adotar IA (provedor e
  confidencialidade a decidir; ver `pendencias.md`). A troca é feita no
  módulo de resumo, sem mudar as telas.

## Pendências de domínio

* Gatilhos de tarefas automáticas (a informar).

## Decisões do questionário de pendências (2026-11-19)

Respostas completas em `perguntas-pendentes.md` (as sugestões marcadas "OK"
valem como regra). Ajustes e acréscimos do responsável:

* **Pedido de documentos (D4):** entidade própria **Pedido** (número, data,
  descrição, quem pediu), com **itens**; é comum o pedido chegar como
  planilha com várias abas (uma por assunto) e muitas linhas. Em cada item,
  o pedinte informa ao menos número, tipo de documento, documento,
  observações e situação; a vendedora responde com observação, onde obter o
  documento e onde ele está no data room. Importação da planilha do pedido.
* **Onde obter cada documento (D4):** catálogo de documentos comuns em M&A
  com a fonte (órgão, site, gratuito ou pago), para ajudar a vendedora a
  buscar. O responsável pode enviar uma planilha-base.
* **Prazos configuráveis (T5, M2):** um bloco **"Prazos de notificações e
  tarefas"** nas Configurações gerais reúne todos os prazos (avisos da
  exclusividade, lembretes de tarefa, dias sem envio de documento,
  intervalo do resumo de mensagens por e-mail, padrão 1 hora).
* **Contratos (C1, C3, C4):** contratante e contratada podem ser **mais de
  uma empresa**; registrar se os honorários fixos (retainer) são
  **descontados do success fee**. Na V1, botão para **enviar ao financeiro**
  da empresa os dados para nota fiscal e cobrança (contatos e dados na aba
  de dados bancários ou numa aba própria). Geração de documentos do
  processo, como o anexo de assessores do QPA, a partir dos cadastros.
* **Ofertas (O1):** campos a mais: garantias da compradora, garantias da
  vendedora, índice e condições de correção das parcelas a prazo,
  condições de transição, período de exclusividade proposto, período de
  não concorrência (no-compete) e observações gerais.
* **Tarefa automática "Enviar checklist de diligência" (T5):** vai para o
  **lado comprador** (equipe da compradora escolhida: auditoria e advogados),
  que normalmente manda a lista de pedidos.
* **Anonimização (X6):** o arquivo original fica intacto para quem tem
  acesso a ele.

### Pedido de documentos: estrutura observada em listas reais (2026-11-19)

Proposta para os itens 11 e 12, a partir de duas listas reais de
diligência enviadas pelo responsável (uma contábil/fiscal/trabalhista e
uma jurídica). Só a estrutura; nenhum dado do caso.

* **Pedido** (a lista de um solicitante, ex.: auditoria contábil ou
  advogados da compradora): número, solicitante (empresa e pessoas), data,
  **data-base** e **períodos de revisão** (ex.: exercícios 2020–2024 e a
  data-base), meses de amostragem, descrição.
* **Rodadas:** o mesmo pedido recebe listas complementares ao longo do
  tempo (ex.: "lista inicial", "complementar 1"); cada item registra a
  rodada em que entrou.
* **Assuntos** (as abas da planilha): Geral/Societário, Contábil, Fiscal,
  Trabalhista/Folha, Certidões, Contratos, Propriedade intelectual,
  Contencioso, Imobiliário, Ambiental, Seguros, Regulatório,
  Concorrencial, Questionário (perguntas).
* **Item:** código hierárquico (ex.: "B1.03", "3.1.2"), grupo e subgrupo,
  **prioridade** (escala do tenant, ex.: Imediata, Alta, Média, Baixa),
  descrição, **formato esperado** (PDF, XLSX, TXT…), **tipo** (documento
  ou pergunta), data do pedido, **dias em aberto**, data de entrega,
  departamento e **responsável do lado vendedor**.
* **Situação por período:** quando o pedido cobre vários exercícios, cada
  item tem situação **por período** (ex.: 2024 entregue, 2023 pendente,
  2020 não aplicável); situações: Pendente, Parcialmente pendente,
  Entregue/Disponibilizado, Em análise, Aprovado, Não aplicável.
* **Conversa por item:** comentários datados, alternando solicitante e
  vendedora, ao longo das rodadas (é o que hoje vira várias colunas
  "Comentários de X em dd/mm"); entra na mensageria por item.
* **Ligação com o data room:** cada item aponta para os documentos (e
  pastas) que o atendem; um documento pode atender vários itens.
* **Painel do pedido** (a "capa"): totais por situação × assunto.
* **Importar e exportar a planilha** no formato do solicitante (as abas e
  colunas dele), para devolver a lista respondida sem retrabalho.
* **Rediligência:** começar um pedido a partir de um pedido anterior (de
  outro negócio da mesma vendedora), reaproveitando itens, respostas e
  documentos ainda válidos.
* **Catálogo "onde obter":** documentos comuns (sobretudo certidões) com
  órgão emissor, link oficial, abrangência (federal, estadual por UF,
  municipal) e se é gratuito ou pago (ex.: Junta Comercial).
