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

**Resposta:** Apresentar a vendedora a potenciais compradores. Versão anônima "teaser" antes do NDA e versão completa depois. Além das 2 versões, criar OnePager pela plataforma nas 2 versões também. 

**E2.** Quais seções costuma ter? (Ex.: sumário executivo, histórico,
produtos/serviços, mercado, clientes, equipe, estrutura societária,
números financeiros, tese de investimento, próximos passos.)

**Resposta:** Pode sugerir.

**E3.** De onde vêm as informações? Digitadas no MNA, puxadas do cadastro
da empresa e do valuation, anexadas de arquivos, ou uma combinação?

**Resposta:** Combinação.

**E4.** Formato de saída: PDF, apresentação (PPTX), página web com link
privado, ou mais de um? 

**Resposta:** Versão 1 com PDF. Anote as demais opções no backlog de versões futuras. Depois me diga onde fica esse backlog geral.

**E5.** Visual: segue a marca do tenant (advisor), um modelo fixo, ou o
usuário escolhe entre modelos? 

**Resposta:** Opções para seguir a identidade visual do Tenant (Vendedor), do Advisor do Vendedor ou de ambos.

**E6.** Precisa de versões (rascunho, revisão, final) e de aprovação de
alguém (ex.: a vendedora aprova antes de enviar)?

**Resposta:** Sim, com espaço para comentários do Vendedor antes do Advisor produzir uma próxima versão.

**E7.** Como o e-book chega ao comprador: download por quem tem permissão no
deal, link com validade, ou envio por e-mail? Precisa saber quem abriu?

**Resposta:** Como o comprador também terá acesso à plataforma, deve existir um status comandado pelo Vendedor de que aquele e-book está disponível para o Comprador, enviando um e-mail ao último notificando o fato, com o link da tela ou documento em questão dentro da plataforma, onde o comprador poderá visualizar ou baixar o PDF.

**E8.** Algo que você já usa hoje (modelo, ferramenta, exemplo) que o MNA
deveria reproduzir ou melhorar?

**Resposta:** Posso anexar um e-book da rgbtec para inspiração ou complementação.

---

## 3b. Kanban de tarefas

Contexto: tela principal com pendências do usuário e status do processo;
tela de detalhe com kanban (`dominio.md`).

**K1.** Quais colunas o kanban deve ter? (Ex.: A fazer → Em andamento →
Aguardando terceiros → Concluído.) Fixas ou configuráveis pelo tenant? 

**Resposta:** Configuráveis, mas pode preencher inicialmente com a sua sugestão. Para tarefas gerais (que pode ficar no backlog de versões futuras), as etapas sigeridas acima fazem sentido. Para o Kanban de Deal, seguir as Etapas e SubEtapas que sugeri anteriormente.


**K2.** O kanban é por deal, por etapa do deal, ou geral (todas as tarefas
do usuário em todos os deals)? Ou mais de uma visão?

**Resposta:** A visão inicial deve ser por etapa do deal, assim o usuário consegue visualizar quais deals estão naquela etapa (naquela coluna do kanban). Pode acrescentar a visão tabela. Importante poder visualizar o histórico de um Deal, mesmo que pra isso o usuário precise selecionar o card daquele Deal na visão de kanban por etapa (ou clicar numa célula da tabela)

**K3.** Que informações uma tarefa tem? (Ex.: título, descrição,
responsável, prazo, prioridade, etapa/subetapa, documentos ligados,
checklist, comentários.)

**Resposta:** Sigo a sua recomendação. No caso do Deal, podem surgir atributos específicos posteriormente.

**K4.** Uma tarefa pode ter mais de um responsável? Pode ser atribuída a
uma empresa (ex.: "escritório da compradora") em vez de uma pessoa?

**Resposta:** Sim, pode ter mais de uma pessoa (usuário) e/ou perfil.

**K5.** Quem pode criar, mover e concluir tarefas? (Lembrando que as
permissões são configuráveis; aqui vale o comportamento padrão sugerido.)

**Resposta:** Seguir as permissões daquele Deal.

**K6.** Tarefas podem surgir automaticamente? (Ex.: ao entrar numa etapa,
criar as tarefas padrão daquela etapa; documento padrão pendente vira
tarefa.)

**Resposta:** Podem, através de gatilhos que ainda vamso informar ou até mesmo num cenário mais complexo, gatilhos configuráveis via sistema.

**K7.** Lembretes e avisos: avisar prazo próximo, prazo vencido, tarefa
atribuída? Por e-mail, no sistema, ou ambos? Com que antecedência?

**Resposta:** Uma configuração global de mensageria feita pelo(s) Adm(s) do Tenant dirá se e-mail, sistema ou ambos. No sistema, além de umn ícone de mensageria, a tela principal deve apresentar também um bloco com as últimas mensagens daquele usuário. Antecedência de lembretes deve ser configurável também nessa parte de mensageria pelo(s) Adm(s) do Tenant. 

**K8.** Dependência entre tarefas (uma só começa quando outra termina) é
necessária?

**Resposta:** Por enquanto só quero essa complexidade para as etapas do Deal, conforme expliquei antes: algumas etapas de um Deal dependem da(s) anterior(es), mas noutros casos pode-se desempenhar tarefas de etapas diferentes de um Deal em paralelo.

**K9.** Na tela principal, o que exatamente deve aparecer? (Ex.: minhas
tarefas, tarefas que aguardam outros, prazos da semana, status de cada deal
em que participo.)

**Resposta:** Além das sugestões acima, logo no topo gráficos e KPIs bem visuais com a quantidade de Deals geral e por Etapa (do usuário e geral se tiver permissão pra isso), quantidade de tarefas pendentes etc.

---

## 3c. Mensageria

Contexto: comunicação entre os participantes dentro do MNA (`dominio.md`).
A resposta da pergunta M5 define se os 4 requisitos "condicionais" de
WebSocket do checklist ASVS passam a valer.

**M1.** Onde acontecem as conversas: por deal, por etapa, por documento, por
tarefa, ou em mais de um lugar?

**Resposta:** Conversas entre as partes em todos esses lugares. É disso que se trata?

**M2.** Conversas são abertas a todos os participantes do deal ou podem ser
restritas (ex.: só o lado vendedor; conversa privada entre duas pessoas)?

**Resposta:** Privada 2 pessoas não. As demais conversas ocorrem com todos os usuários que tem acesso aquela função: por exemplo, as conversas de uma versão de um documento estarão restritas aos usários que tem acesso aquele documento (por sua vez, conforme defini neste documento mais a frente, são os usuários determinados por quem subir aquela versão do documento).

**M3.** Mensagens podem ter anexos? Esses anexos viram documentos do deal
(com versões e permissões) ou ficam só na conversa?

**Resposta:** Sim, com anexo, mas ficam só na conversa. Pode criar um botão manual para transformar aquele anexo informativo num documento do deal.

**M4.** Mensagens podem ser editadas ou apagadas depois de enviadas? (Em
M&A, o histórico costuma ter valor probatório.)

**Resposta:** Como é um histórico de conversa, não, pois se houver um erro o usuário pode enviar nova mensagem retificando.

**M5.** Precisa ser em **tempo real** (a mensagem aparece na hora, como no
WhatsApp) ou basta aparecer ao atualizar a tela ou em poucos segundos?

**Resposta:** Não precisa ser em tempo real, pode aguardar a renderização.

**M6.** Avisos de mensagem nova: no sistema, por e-mail (imediato ou
resumo diário), ou ambos?

**Resposta:** Respondido em K7. Acrescentar funcionalidade para resumir via IA as últimas mensagens ou as mensagens ainda nçao lidas.

**M7.** Menções a pessoas (ex.: "@Ana") e marcação de mensagem como
pendência/tarefa são desejáveis?

**Resposta:** Interessante.

**M8.** As mensagens entram na exportação completa do deal (PDF) e na
retenção de 10 anos?

**Resposta:** Sim.

---

## 3d. Áreas restritas dentro do deal

Contexto: hoje o acesso dentro do deal é controlado por perfil, permissões e
alcance por etapa/subetapa (ADR-0013). Esta seção define se é preciso
restringir mais.

**R1.** Além do alcance por etapa, há conteúdos que precisam ficar ocultos
de parte dos participantes do mesmo deal? (Ex.: notas internas do lado
vendedor, documentos só do advisor e da vendedora, rascunhos antes de
liberar ao comprador.)

**Resposta:** Essa questão das noltas internas do lado vendedor é excelente. existe a necessidade. Por exemplo, um documento que apenas a parte vendedora pode ver aqueles comentários. Sendo assim, ao subir um documento (se o usuário tiver permissão pra isso no Deal), o usuário poderia escolher quem terá acesso (leitura, porque se a pessoa que tiver acesso leitura quiser mexer no documento, deve baixar, fazer o comentário no word e subir nova versão atrelada ao documento "pai") àquele documento? Da forma que descrevi, não precisa de rascunho, vão existir várias versões daquele documento, penduradas no documento "pai" e ordenadas decrescente por data-hora, com visilidade e permissão de baixar apenas para os usuários para os quais o usuário que fez upload concedeu permissão, além de um botão para visualizar um texto produzido por IA com o resumo do histórico de alterações do documento.

**R2.** Se sim, a restrição seria por **lado** (vendedor × comprador), por
**empresa**, por **pessoa**, ou por **pasta/grupo de documentos**?

**Resposta:** conforme expliquei, a restrição daquela versão do documento virá por parte do usuário que fez o upload.

**R3.** Um documento pode ter visibilidade própria diferente da etapa em que
está? (Ex.: "visível só para o lado vendedor" mesmo estando na diligência.)

**Resposta:** não entendi, epxlicar melhor ou verificar se a pergunta é dispensável com a regra que propus em R2 acima (usuário que faz o upload determina quem pode acessar e baixar a versão do documento).

**R4.** É necessário um fluxo de "liberar para o comprador" (o documento
nasce restrito e é publicado depois)?

**Resposta:**  Acredito que com a regra que estabeleci (usuário que faz o upload determina quem pode acessar e baixar a versão do documento), não é necessária esta funcionalidade, pois quando as pessoas do lado venedor aprovarem ma versão final, uma dessas pessoas será o usuário que vai fazer um upload dessa versão e assim determinar quem tem permissão naquela versão do documento, incluindo usuários do lado comprador.

**R5.** Quem decide essas restrições: administradores do tenant,
responsável pelo deal, ou quem enviou o documento? 

**Resposta:** usuário que faz o upload determina quem pode acessar e baixar a versão do documento

De forma geral, o usuário que faz o upload, ao escolher quem tem acesso pra visualizar e baixar aquela versão do documento, pode escolher por perfil e/ou por usuário, para facilitar a usabilidade.

---

## Observações livres

**Resposta:**
