# MNA: questionário dos assuntos pendentes

Responda abaixo de cada pergunta, no campo **Resposta**. Cada pergunta traz
uma **Sugestão** minha: se concordar, basta escrever "ok". Se ainda não
souber, escreva "em aberto". Pode responder aos poucos e em qualquer ordem;
também vale responder na conversa (ex.: "ok em todas, menos E3 e X5").

Para editar e ver formatado ao mesmo tempo no VS Code: `Ctrl+K` e depois `V`.

Já decidido (não precisa responder): o que está em `dominio.md` e em
`perfis-e-permissoes.md` (lista de acesso definida por quem cria; perfis por
função; equipe da compradora; mensagens imutáveis e sem conversa privada;
e-book em PDF; etc.). As perguntas abaixo cobrem só o que falta para
construir cada item.

Ordem sugerida de construção (para você saber o que vem antes): negócios
(2ª e 3ª entregas) → etapas → documentos (data room) → tarefas → mensagens
→ tela principal e kanban → contratos → ofertas → anonimização.

---

## 1. Negócios: segunda e terceira entregas (item 8)

**N1. Quem muda a situação da compradora no funil** (Prospectada → Teaser
enviado → NDA assinado → Proposta recebida → Escolhida / Descartada)?

**Sugestão:** o Coordenador e os administradores. Cada mudança fica no
histórico do negócio. A compradora e a equipe dela veem só a própria
situação.

**Resposta:** OK

**N2. Escolher uma compradora descarta as outras automaticamente?**

**Sugestão:** não descarta sozinho. O sistema pergunta "marcar as demais
como Descartadas?", com sim ou não (às vezes se mantém uma segunda opção em
espera).

**Resposta:** OK

**N3. Ao ser descartada, a compradora perde o acesso na hora?**

**Sugestão:** sim. As participações das pessoas da compradora e da equipe
dela recebem prazo "hoje" (o histórico continua). Se ela voltar com nova
proposta, o Coordenador reabre os acessos.

**Resposta:** OK

**N4. Período de exclusividade.** Já decidido: início, duração em dias (ou
data de fim) e alertas com antecedência configurável (padrão 15 e 5 dias).
Pode haver **prorrogação**?

**Sugestão:** sim. Cada prorrogação fica registrada (nova data de fim,
quem prorrogou, motivo opcional), e os alertas recomeçam pela nova data.

**Resposta:** OK

**N5. Encerrar o negócio** (Concluído ou Encerrado sem conclusão): o que
acontece com os acessos externos?

**Sugestão:** continuam, mas só para consulta (ninguém cria nem edita
nada). Os administradores podem tirar todos os externos de uma vez, com o
botão "Encerrar acessos externos".

**Resposta:** OK

**N6. Aviso por e-mail ao incluir participante.** Já decidido: e-mail com
número + codinome e link. Quem não tem usuário (contato) recebe algo?

**Sugestão:** não. Contato não recebe e-mail na V1. Para dar acesso, o
administrador convida a pessoa, e ela passa a receber.

**Resposta:** OK

---

## 2. Etapas (itens 9 e 10)

**E1. Etapas padrão.** As 8 etapas de `dominio.md` (Prospecção →
Pós-closing) valem para todo negócio novo. O tenant pode editar a lista
padrão?

**Sugestão:** sim, no cadastro auxiliar "Etapas padrão" (incluir,
renomear, reordenar, desativar). Negócios já existentes não mudam.

**Resposta:** OK

**E2. Situação de cada etapa no negócio.**

**Sugestão:** Não iniciada · Em andamento · Concluída · Pulada, com data de
início e de conclusão (previstas e reais).

**Resposta:** OK.

**E3. Quem marca a etapa como iniciada ou concluída?**

**Sugestão:** quem tem "Etapas × editar" no negócio (Coordenador,
advogados e advisors, pelos perfis padrão), com auditoria e aviso aos
participantes.

**Resposta:** OK

**E4. Etapa principal (para o kanban e os KPIs).**

**Sugestão:** é a etapa em andamento mais avançada na ordem. O negócio
aparece só nela, com um indicador "+1 em paralelo".

**Resposta:** OK. 

**E5. Subetapas.** Quantos níveis?

**Sugestão:** só um nível (etapa → subetapas), ex.: Diligência → jurídica,
contábil, trabalhista. Cada subetapa tem situação, datas e responsáveis
próprios.

**Resposta:** OK.

**E6. Dependência entre etapas** ("só começa depois de outra").

**Sugestão:** a dependência só avisa, não bloqueia: ao iniciar uma etapa
cuja anterior não terminou, o sistema pergunta "iniciar mesmo assim?". Na
prática, M&A raramente segue a ordem à risca.

**Resposta:** OK.

**E7. Alcance por etapa nas participações.** Já decidido que o alcance
pode ser "deal inteiro" ou etapas/subetapas. Quem tem alcance só numa
subetapa (ex.: auditor da diligência contábil) vê o quê do negócio?

**Sugestão:** o cabeçalho do negócio (número, codinome, situação) e só a
sua subetapa, com os documentos, tarefas e mensagens dela.

**Resposta:** OK.

---

## 3. Documentos e data room (itens 11, 12 e 13)

**D1. Organização dos documentos na tela.**

**Sugestão:** pastas por etapa e subetapa (pasta "Gerais" para o que não
for de etapa), com filtros por categoria, empresa vendedora, situação e
quem enviou. Nada de pastas livres criadas pelo usuário na V1.

**Resposta:** OK.

**D2. Categorias (classificação).**

**Sugestão:** cadastro auxiliar do tenant, começando com: Societário,
Contábil/Financeiro, Fiscal, Trabalhista, Contratos comerciais,
Imobiliário, Ambiental, Propriedade intelectual, Tecnologia, Contencioso,
Outros.

**Resposta:** OK.

**D3. Situação de um documento pedido** (o checklist de diligência).

**Sugestão:** Pendente · Enviado · Em análise · Aprovado · Com
observações · Não aplicável. Quem pediu muda a situação; quem envia vê o
que falta.

**Resposta:** OK.

**D4. Pedidos de documento por empresa vendedora.** Com várias vendedoras,
cada item do checklist vira um pedido por empresa?

**Sugestão:** sim, mas só quando o item é marcado "por empresa" no
catálogo. Itens gerais (ex.: organograma do grupo) ficam um só.

**Resposta:** OK. Importante existir o conceito/entidade do Pedido (com numeração, data, descrição, pelo menos), pois é comum a auditoria da Compradora ou a própria Compradora mandar "lotes" de perguntas, na prática um Pedido representado por uma planilha cheia de abas, onde cada aba é um assunto e possui diversas linhas a serem respondidas pela parte Vendedora. Em cada linha o Comprador informa, pelo menos, por exemplo, Numeração/Tipo de Documento/Documento/Observações/Status e o Vendedor tem uma espaço para observação, onde buscar esse documento***, local do documento na pasta de arquivos devolvida etc.

*** seria muito bom ter um recurso para ajudar o usuário a localizar na internet onde obter os documentos, preferencialmente de graça. Normalmente os documentos que dependem da Junta Comercial são pagos, mas a maioria é gratuita. Pra ajudar nessa tarefa, imagino que o sistema precisa armazenar uma lista de documentos comuns pedidos em operações de M&A e onde buscá-los. Se precisar, mando uma planilha que trata essas questões abordadas na minha resposta.

**D5. Tamanho máximo por arquivo.**

**Sugestão:** 200 MB por arquivo; envio de vários arquivos de uma vez,
arrastando para a tela.

**Resposta:** OK.

**D6. Baixar vários de uma vez** (pasta inteira em ZIP).

**Sugestão:** sim, só com os arquivos que a pessoa pode baixar, gerado em
segundo plano e com aviso no sino quando estiver pronto. Cada download fica
na auditoria.

**Resposta:** OK.

**D7. Templates DOCX (simulado na V1).** Quais modelos aparecem na
demonstração?

**Sugestão:** NDA, Term Sheet e Procuração, com campos preenchidos do
negócio (partes, CNPJs, endereços, datas).

**Resposta:** OK.

**D8. Excluir documento.**

**Sugestão:** quem enviou (ou o Coordenador) exclui uma versão em até 24 h
se ninguém a tiver baixado. Depois disso, só uma nova versão; o histórico
nunca some.

**Resposta:** OK.

---

## 4. Tarefas (itens 27 e 28)

**T1. Situações da tarefa.**

**Sugestão:** A fazer · Em andamento · Aguardando terceiros · Concluída ·
Cancelada.

**Resposta:** OK

**T2. Prioridade.**

**Sugestão:** Baixa · Normal · Alta · Urgente (só para ordenar e filtrar;
sem regra automática).

**Resposta:** OK

**T3. Responsável que é perfil** (ex.: "todos os Advogados"): quem conclui?

**Sugestão:** qualquer pessoa com aquele perfil no negócio conclui, e fica
registrado quem foi.

**Resposta:** não entendi "Responsável que é perfil** (ex.: "todos os Advogados"): quem conclui?", dê exemplos.

**T4. Lembretes de prazo.**

**Sugestão:** aviso no sino e por e-mail 2 dias antes e no dia do prazo
(antecedência configurável pelo administrador, como a da exclusividade).

**Resposta:** OK.

**T5. Tarefas automáticas (simuladas na V1).** Quais gatilhos aparecem como
exemplo?

**Sugestão:** "Etapa Diligência iniciada → criar tarefa 'Enviar checklist
de diligência'"; "Documento pedido sem envio há 7 dias → lembrar quem deve
enviar"; "Exclusividade termina em 5 dias → tarefa para o Coordenador".

**Resposta:** 

Essa tarefa é criada para o comprador? criar tarefa 'Enviar checklist de diligência'"
7 dias e 5 dias nos outros exemplos precisam ser confugráveis no Tenant, agrupando todos esses prazos em um bloco tipo "Prazos de notificações e tarefas", por exemplo.

---

## 5. Mensagens e avisos (itens 16, 30 e 31)

**M1. Menções e "marcar mensagem como tarefa"** (escopo estava a decidir).

**Sugestão:** entram na V1. A @menção só oferece quem tem acesso àquela
conversa, e a pessoa mencionada recebe aviso no sino e por e-mail.

**Resposta:** OK.

**M2. Aviso de mensagem nova por e-mail.**

**Sugestão:** um resumo por e-mail no máximo a cada hora ("5 mensagens
novas em 2 negócios"), nunca um e-mail por mensagem. Cada pessoa pode
desligar o resumo.

**Resposta:** OK. Quantidade de horas pode ser 1, mas permitir configurar pelo Tenant.

**M3. Configurações gerais do tenant** (administrador): o que entra nessa
tela além dos prazos de aviso?

**Sugestão:** antecedência dos alertas (exclusividade, tarefas,
participações); avisos por e-mail, só no sino ou ambos, por tipo de
evento; fuso horário (padrão São Paulo).

**Resposta:** OK.

---

## 6. Tela principal e kanban (itens 14 e 15)

**P1. Blocos da tela principal** (do alto para baixo).

**Sugestão:**
- **topo:** 4 números (negócios em andamento, minhas tarefas abertas,
  tarefas atrasadas, prazos nos próximos 7 dias);
- **meio, em três áreas lado a lado:** "Meus negócios" (situação e etapa),
  "Últimas mensagens e alertas" (os 10 mais recentes, com link) e "Prazos"
  (exclusividade, tarefas e participações, com linha do tempo);
- **embaixo:** gráfico de negócios por etapa.

**Resposta:** OK.

**P2. Dados de exemplo para a demonstração** (você pediu alertas de exemplo
no sino e na tela principal).

**Sugestão:** uma ação do administrador "Carregar exemplo de demonstração",
que cria um negócio fictício completo (empresas, participantes, etapas,
documentos, tarefas, mensagens e alertas), marcado como exemplo, com aviso
visível e um botão para apagar tudo. Nada misturado com os dados reais.

**Resposta:** OK.

**P3. Kanban de negócios: arrastar o cartão muda a etapa?**

**Sugestão:** sim, para quem tem "Etapas × editar" naquele negócio. Arrastar
para a frente conclui a etapa atual e inicia a nova, depois de uma
confirmação.

**Resposta:** OK.

---

## 7. Contratos de serviço (item 17)

**C1. Campos do contrato.**

**Sugestão:** tipo (mandato do advisor, honorários advocatícios, outros),
contratante e contratada (empresas do cadastro), objeto/escopo, data de
assinatura, vigência (início e fim), exclusividade (sim/não, com prazo),
honorários fixos (valor e periodicidade), success fee (percentual e/ou
valor mínimo), forma de pagamento, conta bancária para pagamento (escolhida
entre as contas da contratada) e arquivos (versões, como nos documentos).

**Resposta:** contratante e contratada - ambas pode ser mais de uma. Outros atributos: Se os honorários fixos (retainer) são descontados em caso de success fee.

**C2. Contrato sem negócio.** Um mandato pode existir antes do negócio
(ex.: advisor contratado para procurar compradores)?

**Sugestão:** sim. O contrato pode nascer avulso e ser ligado a um negócio
depois.

**Resposta:** OK.

**C3. Cobrança dos honorários.**

**Sugestão:** a V1 só registra as condições e calcula o success fee
estimado sobre o valor da oferta escolhida; emitir cobrança ou nota fiscal
fica fora.

**Resposta:** OK. Na v1 pode existir um recurso para enviar um e-mail para o setor financeiro da empresa (dados necessários poderiam estar na aba de dados bancários da empresa ou numa aba específica) com os dados para emissão da NF e cobrança.

**C4. Anexo de contas bancárias dos assessores** (como o que você mandou,
"Anexo 3.1.1(i)(b)").

**Sugestão:** um botão no negócio gera esse quadro (razão social, banco,
agência, conta, CNPJ e chave Pix das empresas escolhidas), pronto para
colar no contrato ou exportar em DOCX/XLSX.

**Resposta:** Seria interssante esse botão, gerando este documento e outros, mais especificamente na fase de produção dos anexos do QPA, onde 1 deles apenas descreve os assessores, por exmeplo.

---

## 8. Ofertas (item 32)

**O1. Campos da oferta.**

**Sugestão:** compradora, data, instrumento (informal, Term Sheet, LOI,
MOU), valor total (enterprise value e/ou equity value), parcela à vista,
parcelas a prazo (valor e data de cada uma), earnout (fórmula em texto e
valor estimado), retenções/escrow, condições precedentes (texto), validade
da oferta e arquivo.

**Resposta:** OK, mas acrescentar: garantias do comprador, garantias do vendedor, índice e condições de correção das parcelas à prazo, condições de transição, período de exclusividade, observações gerais, período de no-compete.

A oferta se conecta no funil Principal / sub funil Compradora? Como?

**O2. Várias versões da oferta da mesma compradora** (contrapropostas).

**Sugestão:** cada nova proposta é um registro, ligado à anterior
("rodada 2"), e o histórico mostra a evolução dos valores.

**Resposta:** OK.

**O3. Comparação entre ofertas.**

**Sugestão:** tabela lado a lado com valor presente de cada oferta (as
parcelas trazidas a valor presente por uma taxa informada no negócio) e a
faixa do valuation (mínimo–máximo). Só quem vê todas as ofertas vê a
comparação.

**Resposta:** OK

**O4. Rateio entre vendedoras.** Já decidido: pelo percentual definido. O
percentual é por negócio ou pode mudar por oferta?

**Sugestão:** é por negócio, com a possibilidade de ajustar numa oferta
específica (fica registrado o critério).

**Resposta:** OK.

---

## 9. Anonimização de clientes (item 33)

**X1. Quem cria e administra uma anonimização?**

**Sugestão:** quem tem uma nova permissão "Anonimizações" (tenant ×
criar/editar). A tabela de correspondência (código × nome) só é vista por
quem o criador liberar.

**Resposta:** OK

**X2. Código do cliente.** Já decidido: `C00001`, com sufixo de grupo
(`C00087.001`). O prefixo "C" pode ser trocado por anonimização (ex.: "F"
para fornecedores)?

**Sugestão:** sim. Prefixo configurável em cada anonimização, padrão "C".

**Resposta:** OK.

**X3. Modelo da planilha de importação.**

**Sugestão:** colunas: razão social, nome fantasia, CNPJ (opcional), grupo
econômico (opcional), variações de grafia (separadas por ";"). Uma tela
mostra a prévia, avisa de duplicados e importa só depois de você conferir.

**Resposta:** OK para a versão 1. Para backlog, possibilidade de tentar intepretar planilhas (ou até PDF ou DOCX) um pouco diferentes.

**X4. Busca dos nomes nos documentos.** Sem diferenciar maiúsculas e
acentos?

**Sugestão:** sim, ignorando maiúsculas, acentos e pontuação ("Pão Quente
Ltda." encontra "PAO QUENTE LTDA"), mas só palavras inteiras (para "Sol"
não trocar dentro de "Solução").

**Resposta:** OK.

**X5. Prévia antes de trocar.**

**Sugestão:** antes de enviar, uma lista "encontramos 37 ocorrências de 12
clientes", em que dá para desmarcar um cliente ou uma ocorrência específica.

**Resposta:** OK.

**X6. Em planilhas, onde trocar?**

**Sugestão:** em todas as abas e células de texto, inclusive nos nomes das
abas e nos comentários; fórmulas não são alteradas (só os valores de
texto). 

**Resposta:** OK, lembrando de manter a versão original intacta para quem tem acesso.

**X7. Clientes que são pessoas físicas** (nome de pessoa nos documentos).

**Sugestão:** entram também, com código `P00001`. Nome de pessoa é dado
pessoal: a tabela de correspondência fica criptografada.

**Resposta:** OK.

---

## Observações livres

Escreva aqui qualquer coisa que não coube nas perguntas.

**Resposta:**
