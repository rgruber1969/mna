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

### Pessoa e usuário

* **Pessoa:** pessoa física registrada no tenant, vinculada a uma ou mais
  empresas, **com ou sem acesso ao sistema** (ex.: sócio cujos dados entram
  num contrato, funcionário citado numa diligência).
* **Usuário:** pessoa **com login**. Toda pessoa pode virar usuário ao ser
  convidada; nem toda pessoa é usuária.
* Cada empresa pode ter N pessoas e N usuários. Um usuário pode ter
  perfis diferentes em deals diferentes.

### Deal

Processo de M&A (inicialmente aquisição). Pontos-chave:

* Uma compradora pode adquirir **mais de uma vendedora** (N CNPJs) no mesmo
  deal.
* Participantes: empresas com seus papéis e usuários com seu perfil naquele
  deal.
* Contém etapas, documentos, tarefas e contratos de serviço.
* **Logomarca da empresa vendedora** pode ser enviada no próprio deal (usada
  no e-book e no OnePager). A marca do sistema continua a do tenant (white
  label).
* Deal encerrado continua acessível para consulta.
* **Histórico do deal** visível a partir do cartão (kanban) ou da linha
  (tabela).

### Valuation

Entidade própria, no mesmo nível do deal, usada principalmente pelo advisor.
Pode estar ligada a um deal e/ou a uma empresa vendedora. Estrutura a
detalhar.

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
  comprador"; o sistema envia e-mail aos usuários do comprador com link para
  a tela no sistema, onde visualizam ou baixam o PDF.

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
* A forma de gerar (IA com provedor externo ou resumo local sem IA) é
  decisão pendente para a produção; até lá, ver `pendencias.md`.

## Pendências de domínio

* Estrutura de valuation (item 6 de `pendencias.md`).
* Gatilhos de tarefas automáticas (a informar).
