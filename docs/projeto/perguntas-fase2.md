# MNA: questionário 2 (e-book, kanban, mensageria, áreas restritas)

Responda abaixo de cada pergunta, no campo **Resposta**. Como no primeiro
questionário: se ainda não souber, escreva "em aberto" ou deixe em branco;
exemplos e comentários são bem-vindos. Onde há opções, pode escolher uma,
combinar ou propor outra.

Para editar e ver formatado ao mesmo tempo no VS Code: `Ctrl+K` e depois `V`.

---

## 3a. E-book

Contexto: material de apresentação da empresa vendedora, montado pelo
advisor, em geral na prospecção (`dominio.md`).

**E1.** Para quem o e-book é feito e qual o objetivo? (Ex.: apresentar a
vendedora a potenciais compradores; versão anônima "teaser" antes do NDA e
versão completa depois?)

**Resposta:**

**E2.** Quais seções costuma ter? (Ex.: sumário executivo, histórico,
produtos/serviços, mercado, clientes, equipe, estrutura societária,
números financeiros, tese de investimento, próximos passos.)

**Resposta:**

**E3.** De onde vêm as informações? Digitadas no MNA, puxadas do cadastro
da empresa e do valuation, anexadas de arquivos, ou uma combinação?

**Resposta:**

**E4.** Formato de saída: PDF, apresentação (PPTX), página web com link
privado, ou mais de um?

**Resposta:**

**E5.** Visual: segue a marca do tenant (advisor), um modelo fixo, ou o
usuário escolhe entre modelos?

**Resposta:**

**E6.** Precisa de versões (rascunho, revisão, final) e de aprovação de
alguém (ex.: a vendedora aprova antes de enviar)?

**Resposta:**

**E7.** Como o e-book chega ao comprador: download por quem tem permissão no
deal, link com validade, ou envio por e-mail? Precisa saber quem abriu?

**Resposta:**

**E8.** Algo que você já usa hoje (modelo, ferramenta, exemplo) que o MNA
deveria reproduzir ou melhorar?

**Resposta:**

---

## 3b. Kanban de tarefas

Contexto: tela principal com pendências do usuário e status do processo;
tela de detalhe com kanban (`dominio.md`).

**K1.** Quais colunas o kanban deve ter? (Ex.: A fazer → Em andamento →
Aguardando terceiros → Concluído.) Fixas ou configuráveis pelo tenant?

**Resposta:**

**K2.** O kanban é por deal, por etapa do deal, ou geral (todas as tarefas
do usuário em todos os deals)? Ou mais de uma visão?

**Resposta:**

**K3.** Que informações uma tarefa tem? (Ex.: título, descrição,
responsável, prazo, prioridade, etapa/subetapa, documentos ligados,
checklist, comentários.)

**Resposta:**

**K4.** Uma tarefa pode ter mais de um responsável? Pode ser atribuída a
uma empresa (ex.: "escritório da compradora") em vez de uma pessoa?

**Resposta:**

**K5.** Quem pode criar, mover e concluir tarefas? (Lembrando que as
permissões são configuráveis; aqui vale o comportamento padrão sugerido.)

**Resposta:**

**K6.** Tarefas podem surgir automaticamente? (Ex.: ao entrar numa etapa,
criar as tarefas padrão daquela etapa; documento padrão pendente vira
tarefa.)

**Resposta:**

**K7.** Lembretes e avisos: avisar prazo próximo, prazo vencido, tarefa
atribuída? Por e-mail, no sistema, ou ambos? Com que antecedência?

**Resposta:**

**K8.** Dependência entre tarefas (uma só começa quando outra termina) é
necessária?

**Resposta:**

**K9.** Na tela principal, o que exatamente deve aparecer? (Ex.: minhas
tarefas, tarefas que aguardam outros, prazos da semana, status de cada deal
em que participo.)

**Resposta:**

---

## 3c. Mensageria

Contexto: comunicação entre os participantes dentro do MNA (`dominio.md`).
A resposta da pergunta M5 define se os 4 requisitos "condicionais" de
WebSocket do checklist ASVS passam a valer.

**M1.** Onde acontecem as conversas: por deal, por etapa, por documento, por
tarefa, ou em mais de um lugar?

**Resposta:**

**M2.** Conversas são abertas a todos os participantes do deal ou podem ser
restritas (ex.: só o lado vendedor; conversa privada entre duas pessoas)?

**Resposta:**

**M3.** Mensagens podem ter anexos? Esses anexos viram documentos do deal
(com versões e permissões) ou ficam só na conversa?

**Resposta:**

**M4.** Mensagens podem ser editadas ou apagadas depois de enviadas? (Em
M&A, o histórico costuma ter valor probatório.)

**Resposta:**

**M5.** Precisa ser em **tempo real** (a mensagem aparece na hora, como no
WhatsApp) ou basta aparecer ao atualizar a tela ou em poucos segundos?

**Resposta:**

**M6.** Avisos de mensagem nova: no sistema, por e-mail (imediato ou
resumo diário), ou ambos?

**Resposta:**

**M7.** Menções a pessoas (ex.: "@Ana") e marcação de mensagem como
pendência/tarefa são desejáveis?

**Resposta:**

**M8.** As mensagens entram na exportação completa do deal (PDF) e na
retenção de 10 anos?

**Resposta:**

---

## 3d. Áreas restritas dentro do deal

Contexto: hoje o acesso dentro do deal é controlado por perfil, permissões e
alcance por etapa/subetapa (ADR-0013). Esta seção define se é preciso
restringir mais.

**R1.** Além do alcance por etapa, há conteúdos que precisam ficar ocultos
de parte dos participantes do mesmo deal? (Ex.: notas internas do lado
vendedor, documentos só do advisor e da vendedora, rascunhos antes de
liberar ao comprador.)

**Resposta:**

**R2.** Se sim, a restrição seria por **lado** (vendedor × comprador), por
**empresa**, por **pessoa**, ou por **pasta/grupo de documentos**?

**Resposta:**

**R3.** Um documento pode ter visibilidade própria diferente da etapa em que
está? (Ex.: "visível só para o lado vendedor" mesmo estando na diligência.)

**Resposta:**

**R4.** É necessário um fluxo de "liberar para o comprador" (o documento
nasce restrito e é publicado depois)?

**Resposta:**

**R5.** Quem decide essas restrições: administradores do tenant,
responsável pelo deal, ou quem enviou o documento?

**Resposta:**

---

## Observações livres

**Resposta:**
