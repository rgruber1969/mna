# MNA: questionário de negócios (item 8 e participação)

Responda abaixo de cada pergunta, no campo **Resposta**. Cada pergunta traz
uma **Sugestão** minha: se concordar, basta escrever "ok". Se ainda não
souber, escreva "em aberto". Também pode responder na conversa (ex.: "ok em
todas, menos N3 e P4").

Para editar e ver formatado ao mesmo tempo no VS Code: `Ctrl+K` e depois `V`.

Já decidido (não precisa responder): nas telas o processo se chama
"Negócio"; uma compradora pode adquirir várias vendedoras no mesmo negócio;
um negócio pode envolver uma empresa, o grupo econômico inteiro ou parte
dele; perfis por função, com o lado vindo do papel da empresa; cada
participação registra a empresa representada; a mesma empresa não pode
estar nos dois lados; quem cria decide quem vê cada registro.

---

## 1. Dados do negócio

**N1. Campos do negócio.** Quais dados guardar na criação?

**Sugestão:** nome interno (ex.: "Venda da Padaria Pão Quente"),
**codinome** (ex.: "Projeto Trigo", usado no e-book e onde a vendedora não
pode aparecer), tipo de operação, lado do contratante (vendedor ou
comprador), data de início, previsão de fechamento (opcional), valor
estimado (opcional, em reais) e descrição livre.

**Resposta:** OK para a sua sugestão. 

**N2. Tipo de operação.** Quais tipos oferecer na V1?

**Sugestão:** lista editável pelo tenant (cadastro auxiliar), começando com:
aquisição total, aquisição parcial (com o percentual), fusão, incorporação
e investimento (aporte). O sistema trata todos da mesma forma na V1; o tipo
serve para filtro, relatório e e-book.

**Resposta:** OK para a sua sugestão. 

**N3. Número do negócio.** Cada negócio ganha um código sequencial?

**Sugestão:** sim, por tenant e automático (ex.: **N-0001**, N-0002…),
usado na lista, nas buscas e nos e-mails, sem expor o nome da vendedora.

**Resposta:** OK para a sua sugestão. Pode expor o nome interno do negócio (por exemplo, "Projeto Gadol").

**N4. Quem cria negócios.** Hoje a regra é: quem tem a permissão "Negócios ×
criar" (perfis Gestor e Equipe do contratante) cria, e **entra nele como
Coordenador do negócio**.

**Sugestão:** manter. Usuários externos nunca criam negócios.

**Resposta:** OK para a sua sugestão. Caso "Usuários externos nunca criam negócios" não exista na descrição desse perfil de tenant, acrescentar.

**N5. Situação do negócio.** Quais situações um negócio pode ter?

**Sugestão:** **Em andamento**, **Suspenso** (parado, pode voltar),
**Concluído** (operação fechada) e **Encerrado sem conclusão** (com motivo:
desistência da vendedora, da compradora, preço, diligência, outro).
Concluído e encerrado ficam só para consulta (ninguém altera nada, só vê e
baixa, conforme o perfil). Reabrir: só administradores do tenant, com
auditoria. A etapa em que o negócio está vem das etapas (item 9), não da
situação.

**Resposta:** OK para a sua sugestão.

**N6. Excluir negócio.** Um negócio pode ser apagado?

**Sugestão:** só enquanto não tiver documentos, tarefas nem mensagens (ex.:
criado por engano), e só por quem tem "Negócios × excluir". Depois disso,
apenas encerrar. A exclusão gera auditoria.

**Resposta:** OK para a sua sugestão.

## 2. Empresas no negócio

**E1. Vendedoras e compradoras.** Num negócio de venda (sell side), o
advisor costuma abordar **vários compradores potenciais** (teaser, NDA,
propostas) antes de haver uma compradora final. Como registrar isso?

**Sugestão:** o papel "Compradora" pode ser dado a **várias empresas** no
mesmo negócio, cada uma com uma **situação no funil**: Prospectada →
Teaser enviado → NDA assinado → Proposta recebida → **Escolhida** ou
Descartada. Só uma (ou um consórcio) chega a "Escolhida". Cada compradora
potencial só vê o que for liberado para ela (lista de acesso), nunca as
outras compradoras.

**Resposta:** OK para a sua sugestão. Observações: 1) Normalmente a escolhida tem um período de exclusividade (60 ou 90 ou qualquer quantidade de dias) no qual a vendedora não pode negociar com mais ninguém. É muito importante existir esse atributo do período de exclusividade e controles e alertas em torno disso, incluindo na tela principal uma informação visual da linha do tempo desse período de exclusividade para os usuários da parte vendedora. 2) Uma empresa descartada agora pode voltar com um nova proposta no futuro: nesse caso ela voltaria no mesmo negócio para Proposta recebida ou seria melhor criar um novo Negócio, até pra não perder o histórico da Proposta anterior?

**E2. Identidade da vendedora para compradores potenciais.** Antes do NDA,
o comprador não pode saber quem é a vendedora (por isso existe o teaser
anônimo). Pessoas de uma compradora potencial entram no sistema antes do
NDA?

**Sugestão:** podem entrar, e enquanto a situação dela for "Prospectada" ou
"Teaser enviado", o negócio aparece para elas **só pelo codinome**, sem o
nome, o CNPJ nem o logo da vendedora. Depois do NDA assinado, passam a ver
a identidade. Alternativa mais simples: compradores potenciais só entram no
sistema depois do NDA (o teaser vai por e-mail, fora do sistema).

**Resposta:** Primeiar opção, pois é importante ficar tudo no sistema, inclusive o histórico completo.

**E3. Grupo econômico no negócio.** Já decidido que o negócio pode envolver
uma empresa, o grupo inteiro ou parte dele. Como incluir?

**Sugestão:** ao incluir uma empresa que pertence a um grupo, o sistema
pergunta "incluir também as outras empresas do grupo?" e mostra a lista
para marcar. Cada empresa incluída fica como participante com seu papel
(ex.: três vendedoras do mesmo grupo). O grupo em si não é participante.

**Resposta:** Não seria melhor existir um atributo no negócio para dizer se a venedora é uma empresa específica ou o grupo?

**E4. Empresa do contratante.** Quando o BT cria um negócio, ele entra
automaticamente como empresa participante?

**Sugestão:** sim, com o papel escolhido na criação a partir do "lado do
contratante" (ex.: "Escritório de advocacia da vendedora"), e quem criou o
negócio entra representando o BT.

**Resposta:** ok para a sua sugestão.

**E5. Logo da vendedora no negócio.** O domínio prevê enviar a logomarca da
vendedora no próprio negócio (para e-book e OnePager).

**Sugestão:** um logo por empresa vendedora, enviado na tela do negócio
(mesmos formatos e conversão da identidade visual). Com várias vendedoras,
cada uma pode ter o seu.

**Resposta:** por que o logo da empresa vendedora não pode vir direto do cadastro da empresa (não precisando ser por negócio)? Outro ponto: considerando o que escrevi em E3, no caso de várias vendedoras a logomarca deveria vir do Grupo (por exmeplo, vendi as empresas RGBsys e HTEC, que não tem logomarcas próprias, num único negócio, e elas pertencem ao Grupo RGBtec que tem a sua logomarca).

## 3. Participação das pessoas

**P1. Quem inclui e remove pessoas.** Hoje a regra é: só administradores do
tenant na V1.

**Sugestão:** ampliar para **o Coordenador do negócio** também (ele conduz
o dia a dia), sempre com auditoria e aviso por e-mail à pessoa incluída.
Administradores continuam podendo tudo.

**Resposta:** Se a inclusão e remoção de pessoas a que se refere for no cadastro geral, isso deve ser uma permissão do usuário ou perfil do usuário. Se a inclusão e remoção de pessoas a que se refere for no negócio, sim, ampliar para o coordenador do negócio.

**P2. Pessoa sem usuário.** Pode participar do negócio uma pessoa que ainda
não tem acesso ao sistema (ex.: o dono da vendedora)?

**Sugestão:** sim, como **contato** do negócio (aparece na lista de
participantes, pode ser responsável por uma tarefa "fora do sistema"), sem
perfil. Ao ser convidada e aceitar, ela recebe o perfil sugerido pelo papel
da empresa, e o administrador ou o Coordenador confirma.

**Resposta:** ok para a sua sugestão.

**P3. Alcance.** Toda participação tem alcance: "negócio inteiro" ou
etapas/subetapas específicas. As etapas chegam no item 9.

**Sugestão:** nesta entrega, só "negócio inteiro"; a escolha por etapas
entra junto com as etapas (item 9), sem refazer nada.

**Resposta:** ok para a sua sugestão.

**P4. Prazo da participação.** Auditores e consultores costumam participar
por um período (ex.: só durante a diligência).

**Sugestão:** data de término **opcional** na participação; ao vencer, o
acesso acaba sozinho e o Coordenador recebe um aviso. Sem data, vale até
ser removida ou até o negócio terminar.

**Resposta:** ok para a sua sugestão. Incluir num painel de alertas na tela principal, junto a outros alertas de prazo, situações em que o usuário tem prazo de atuação no negócio.

**P5. Ao remover uma pessoa.** O que acontece com o que ela fez?

**Sugestão:** tudo continua (documentos, mensagens, tarefas e histórico
ficam com o nome dela); tarefas abertas sob a responsabilidade dela
aparecem como "sem responsável" para o Coordenador redistribuir. A pessoa
perde o acesso na hora.

**Resposta:** ok para a sua sugestão.

## 4. Lista e tela do negócio

**L1. Lista de negócios.** O que mostrar nesta entrega (o kanban é o item
15)?

**Sugestão:** tabela com número, nome (ou codinome, para quem não pode ver a
vendedora), vendedora(s), compradora escolhida, papel do contratante,
situação, etapa atual (quando houver etapas), coordenador e data de início;
filtros por situação, lado e tipo; busca por nome, codinome, número ou
empresa. Cada pessoa só vê os negócios em que participa (administradores
veem todos).

**Resposta:** ok para a sua sugestão.

**L2. Tela do negócio.** Como organizar?

**Sugestão:** cabeçalho com número, nome, situação e etapa, e abas:
**Resumo** (dados do negócio), **Empresas**, **Participantes**, e as que
chegam nas próximas entregas (Etapas, Documentos, Tarefas, Mensagens,
Contratos, Valuation, E-book, Ofertas, Histórico), que aparecem só quando
existirem. Também entra na busca do cabeçalho.

**Resposta:** ok para a sua sugestão.

**L3. Histórico do negócio.** O domínio prevê um histórico visível a partir
do cartão ou da linha.

**Sugestão:** nesta entrega, o histórico mostra os eventos de auditoria do
negócio (criação, alterações de dados, entrada e saída de empresas e
pessoas, mudança de situação), em linguagem simples e respeitando o que a
pessoa pode ver. Cresce sozinho com as próximas funcionalidades.

**Resposta:** ok para a sua sugestão.

**L4. Avisos.** Quem é avisado do quê?

**Sugestão:** no sino e por e-mail: a pessoa incluída num negócio (com o
link); a pessoa removida (só no sino, se ainda tiver acesso ao tenant); os
participantes quando a situação muda para Suspenso, Concluído ou
Encerrado.

**Resposta:** ok para a sua sugestão. Avisar também sobre troca de etapas de um negócio e outros eventos que envolvam prazo, por exemplo quando o período de exclusividade começou ou encerrou, quando expirou o prazo de acesso do auditor ao negócio etc.

## 5. API e demonstração

**A1. API.** Os serviços de negócios seguem as mesmas regras das telas.

**Sugestão:** como em empresas e pessoas, a API REST de negócios fica para
quando entrarmos com as chaves de API (itens 25 e 26), sem retrabalho.

**Resposta:** ok para a sua sugestão.

**A2. Dados de demonstração.** Para a demonstração ao BT, criar negócios
fictícios prontos?

**Sugestão:** sim, um comando (`pnpm demo:negocios`) que cria 3 negócios
fictícios em situações diferentes (um em prospecção com compradores
potenciais, um em diligência, um concluído), com empresas e pessoas
fictícias (@exemplo.test), só fora da produção.

**Resposta:** por enquanto não, vou cadastrar manualmente um caso real meu. 
