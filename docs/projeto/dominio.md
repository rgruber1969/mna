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
* Deal encerrado continua acessível para consulta.

### Valuation

Entidade própria, no mesmo nível do deal, usada principalmente pelo advisor.
Pode estar ligada a um deal e/ou a uma empresa vendedora. Estrutura a
detalhar.

### E-book

Material de apresentação da empresa vendedora, montado pelo advisor, em
geral durante a prospecção. Tarefa importante, mas opcional. Estrutura a
detalhar.

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
* Sem marca d'água ou bloqueio de download: vale a permissão do usuário.
* O conjunto de documentos do deal, filtrado por permissão, funciona como
  **data room**.

### Tarefas e pendências

* **Na tela principal:** pendências do usuário e status do processo,
  inclusive o que depende de outras pessoas.
* **Tela de detalhe com kanban** (a definir) e **mensageria**.

## Pendências de domínio

* Estrutura de valuation e de e-book.
* Kanban e mensageria: escopo e comportamento.
* Áreas restritas dentro de um deal (para depois).
