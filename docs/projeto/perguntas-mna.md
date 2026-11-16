# MNA: perguntas para definir as regras do projeto

Responda abaixo de cada pergunta, no campo **Resposta**. Não precisa ser
definitivo: se ainda não souber, escreva "em aberto" ou deixe em branco, e o
item vira pendência no `CLAUDE.md`. Comentários e exemplos são bem-vindos.

Premissas já levantadas (para conferir e detalhar nas respostas):

* Perfis diversos: administradores do portal, advogados, advisors, clientes
  e outros; a maioria externa, de organizações diferentes.
* Acesso por deal: cada usuário vê só os deals e documentos em que foi
  incluído, com um papel naquele deal.
* Entrada por convite, 2FA para documentos sigilosos e trilha de auditoria.

---

## 1. O que é o MNA

**1.** Em uma ou duas frases: qual o objetivo do sistema? Pipeline de deals,
data room, gestão de mandatos, valuation, ou uma combinação?

**Resposta:** O MNA vai controlar todas as fases do processo, inicialmente mais voltado aquisição e para o sell side (o cliente contratante da plataforma é o Escritório de Advocacia do sell side, tendo como usuários Advogado(s), empresa vendedora e Advisor(s), porém com acesso também para a parte compradora – representantes, advisors, advogados – interagir principalmente no controle de pendências, consulta de status e acesso ao data room). O advisor também poderá ser contratante do sistema, para as funções de Valuation e montagem de e-book para o cliente empresa vendedora.


**2.** Quais são as principais entidades? Por exemplo: empresas, deals,
etapas, contatos, documentos, tarefas, mandatos.

**Resposta:** Empresas (que podem ser Vendedora, Compradora, Advisor da Compradora, Advisor da Vendedora, Escritório de Advocacia da Vendedora, Escritório de Advocacia da Compradora, Contabilidade da Vendedora, Contabilidade da Compradora, Auditora da Compradora - contábil, fiscal, jurídica, trabalhista, societária etc., Auditora da Vendedora, Investidores e Sócios da compradora, Sócios da Vendedora. Uma empresa às vezes pode assumir num deal mais de uma desses papéis simultaneamente - por exemplo, o escritório de advocacia pode ter a atuação jurídica geral em nome do comprador e também assumir a digligência jurídica do comprador), Usuários dessas empresas (pessoas físicas), Deals (inicialmente Aquisições), documentos (que terão atributos para classificação, agrupamento e filtragem), etapas (detalhadas na resposta 3), contatos (que estou chamando de usuários, mas se achar mais adequado criar como contatos ok, ou se forem entidades diferentes, me explique por favor), documentos (costuma-se subir várias versões de um mesmo documento, com comentários de várias partes, assim é importante "pendurar" essas versões num mesmo documento entidade no MNA), tarefas (muito importante existir na tela proncipal uma área com as pendências do usuário e visualização do status do processo mesmo quando depender de outra pessoa e um detalhamento noutra tela com kanban que ainda vamos definir, com mensageria etc.), mandatos - me explique o que é).

Observações:

- Assim como Deal, criar uma entidade Valuation
- Num Deal a Empresa Compradora pode adquirir mais de um CNPJ, ou seja, 2 empresas Venedoras.

Importante: 
- Criar o conceito de Tenant, que somente o perfil Administrador Geral (RGRUBER) terá acesso. Somente eu (RGRUBER) poderei cadastrar e adminsitrar Tenant, que são os contratantes da ferramenta. Por exemplo, se o escritório de advocacia chamado XYZ contratar a plataforma, após cadastrado por mim, poderá acessar a URL da aplicação combinada com o nome do Tenant, por exemplo: www.mna.com.br\xyz. Avaliar se o Administrador Geral (RGRUBER) precisa de uma aplicação à parte para adminsitração dos Tenants, creio que sim. Como Tenant piloto, cadastrar BT (Bastos Tigre, escritório de advocacia no Rio de Janeiro).
- Além das entidades descritas, deve existir usuário(s) Administrador(es) representante(s) da contratante do portal, no nosso exemplo, da BT (Tenant Piloto).

**3.** Quais são as etapas de um deal (ex.: prospecção → NDA → due diligence
→ negociação → fechamento)?

**Resposta:** As etapas não são fixas, precisam ser um cadastro padrão, mas adaptáveis para cada Deal.

As etapas padrão do Deal são: Prospecção (nessa fase posso montar o E-book e o Valuation, que são tarefas importantes mas opcionais, enquanto faço a prospecção propriamente dita), Negociação informal (telefone, whatsapp, e-mail, pessoalmente etc.), Term Sheet (ou MOU ou LOI), Diligência (Due Dilligence, que pode ser quebrada em várias diligências com diferentes empresas e documentos envolvidos em cada "sub"-etapa, QPA (ou SPA, acordo de compra e venda), QPA->CLosing (entre a assinatura do QPA e o Fechamento ou Closing, período em que as partes cumprem as condições precedentes)), Closing (Fechamento, pagamento da parcela à vista), depois todas as etapas Pós-Closing (datas de controle de transição, earnout e pagamentos das parcelas à prazo onde normalmente a última parcela é paga em 5 anos após o Closing).

 Ter a opção de atrelar ou não uma etapa a outra ou correrem em paralelo (por exemplo, eu posso montar o e-book e o valuation enquanto faço a prospecção, ou posso até pular uma etapa. O Closing, por exemplo, em alguns casos, é junto com a assinatura do QPA, sem condições precedentes). 

 A usabilidade seria excelente se pudermos manusear e visualizar as etapas de um Deal graficamente.

**4.** O que entra na **versão 1** e o que fica para depois?

**Resposta:** De tudo que escrevi neste documento, não consigo decidir agora o que vai ficar de fora. Vou aguardar algumas respostas, medir custo benefício e então decidir.

## 2. Usuários e perfis

**5.** Quais são todos os perfis? Já citados: administradores do portal,
advogados, advisors e clientes. Falta algum, como analistas,
investidores/compradores ou auditores?

**Resposta:** Detalhei na resposta 2.

**6.** Quais perfis são internos (sua equipe) e quais são externos?

**Resposta:** Entendo que interno são 2 tipos, já citados: Adminsitrador(es) do Portal como um todo (RGRUBER) / dos Tenants contratantes e Administrador(es) daquele Tenant específico (Contratante).  
O restante é externo, mesmo se tratando de Advogados, por exemplo, da Contratante do Portal (Tenant).

**7.** Um usuário pode ter perfis diferentes em deals diferentes? Por
exemplo, advisor num deal e observador em outro.

**Resposta:** Sim, sem dúvida. Lembrando também que cada entidade dessas (Advisor, Advogado, Adms etc.) pode ter  N usuários pessoas físicas.

## 3. Permissões (matriz perfil × ação × deal)

Todas as permissões (exemplo abaixo) deverão ser editáveis por parte do(s) Administrador(es) do Tenant Contratante.
O Administrador do Portal (eu, Ricardo, representando RGRUBER, ou outro usuário futuro da RGRUBER), ao criar ou editar o Tenant, deverá cadastrar o(s) Adminsitrador(es) daquele Tenant para primeiro acesso.

| Perfil   | Ver deal | Editar deal | Baixar documentos |
|----------|----------|-------------|-------------------|
| Advisor  | sim      | sim         | sim               |
| Cliente  | sim      | não         | só os liberados   |

**8.** O que cada perfil pode **ver, criar, editar, excluir e baixar**?
(Uma tabela ajuda: perfis nas linhas, ações nas colunas.)

**Resposta:** Isso está no contexto da resposta anterior. Por dafault, teremos permissões por perfil + usuário (pode existir, por exemplo, um usuário do Advisor que não queremos as mesmas permissões habilitadas que outro usuário mais sênior deste mesmo Advisor) para "ver, criar, editar, excluir e baixar" para cada item do Menu (quando aplicável). 

**9.** Há documentos ou áreas restritas dentro de um deal? Por exemplo, um
cliente que não vê as notas internas dos advisors.

**Resposta:** As diretrizes gerais de permissões por usuário  por entidade por menu etc. já dei anteriormente. Podemos deixar eventuais especificidades complementares para depois.

**10.** Quem inclui e remove pessoas de um deal?

**Resposta:** Na versão 1, apenas Administrador(es) do Tenant Contratante ou Administrador(es) do Portal como um todo (RGRUBER).

## 4. Convites e entrada

**11.** Quem pode convidar: só administradores ou também o responsável pelo
deal?

**Resposta:** só adms.

**12.** Em quantos dias o convite expira?

**Resposta:** 3 dias.

**13.** O cadastro é **só por convite**, ou existe algum cadastro aberto?

**Resposta:** Por convite entendo que seja mais profissional, mediante a anuência (confirmação do convidado) por e-mail.

## 5. Login e 2FA

**14.** Quais formas de login são permitidas: e-mail e senha, link mágico,
Google, Microsoft? São as mesmas para internos e externos?

**Resposta:** Todas elas, se possível e gratuitas.

**15.** 2FA: obrigatório para todos, só para alguns perfis, ou só para quem
acessa documentos sigilosos?

**Resposta:** Ter uma configiração geral naquele Tenant, acessível aos adms do Tenant dizendo, se o 2FA (Sim ou Não) será para todos os perfis, por perfil ou por usuário. 
Para as permissões que expliquei anteriorente, nessa configuração global, indicar se as permissões serão por Perfil ou por Usuário. Se for por Usuário, criar opção na configuração inicial de permissões de um Usuário - se ele não for o primeiro do Perfil - para copiar as permissões de outro usuário do Perfil.

**16.** Quais métodos de 2FA: aplicativo autenticador, passkey, ou ambos?

**Resposta:** apenas passkey

## 6. Sessão

**17.** Por quanto tempo a sessão dura antes de pedir login de novo (ex.: 8
horas, 7 dias)?

**Resposta:** 8 horas.

**18.** Depois de quanto tempo de inatividade a saída é automática (ex.: 30
minutos)?

**Resposta:** 1 hora.

**19.** Um usuário pode ficar conectado em vários dispositivos ao mesmo
tempo?

**Resposta:** Não.

## 7. Saída de usuários (desligamento)

**20.** Quando alguém sai de um deal ou da firma, quem revoga o acesso e com
que rapidez?

**Resposta:** os Adms, de forma imediata.

**21.** Os acessos de externos expiram automaticamente, por exemplo ao
encerrar o deal?

**Resposta:** Não. Mesmo com o Deal encerrado, pode existir para consulta futura.

## 8. Auditoria

**22.** Que eventos registrar: login, visualização de deal, visualização ou
download de documento, alterações, convites?

**Resposta:** TUDO que ocorre no sistema.

**23.** Por quanto tempo guardar a trilha de auditoria?

**Resposta:** Permitir configuração do Adm do Portal (RGRUBER) ao cadastrar/editar o Tenant. Criar rotinas de limpeza com a opção de exportação (em PDF e/ou XLSX) do período a ser limpado.

**24.** Quem pode consultar a auditoria?

**Resposta:** Quem tiver a permissão concedida pelos ADMs do Tenant.

## 9. Dados pessoais (LGPD)

**25.** Quais dados pessoais o MNA coleta, tanto de usuários quanto de
terceiros (ex.: sócios e funcionários das empresas-alvo)?

**Resposta:** Nas diligencias trabalhistas ou afins costumam circular dados básicos de funcionários (nome, CPF, Cargo, Data de Admissão, Salário atual etc.) Dos sócios e alguns usuários das entidades do MNA, utiliza-se, para confecção de contratos, o nome, CPF, endereço completo, identidade, telefone, e-mail, dados do cônjuge etc. Para os demais usuários pessoas físicas, muitas vezes são necessários apenas nome, CPF, e-mail, telefone.

**26.** Em que nível cada um se enquadra: **público**, **pessoal** ou
**sensível** (criptografado)? Exemplo: CPF de sócios = sensível.

**Resposta:** podemos manter todos como dado pessoal e, depois, se necessário, criptografamos?

**27.** Qual a finalidade e a base legal de cada um (contrato, legítimo
interesse, obrigação legal, consentimento)?

**Resposta:** Contrato

**28.** Qual o prazo de retenção, e o que acontece com os dados de um deal
encerrado ou cancelado?

**Resposta:** 10 anos. Criar uma exportação completa das informações (PDF) para o caso de exclusão do deal após o prazo informado.

**29.** Como tratar o pedido de exclusão de um titular quando há obrigação de
manter histórico?

**Resposta:** Se não houver base legal para a recusa do pedido, devemos anonimizar os dados pessoais do solicitante.

## 10. Documentos

**30.** Que tipos de arquivo serão enviados e qual o tamanho típico?

**Resposta:** Planilhas excel, PDFs, DOCXs do Word, predominantemente. Tamanho - depende.

**31.** É preciso marca d'água, bloqueio de download ou visualização somente
online para documentos sigilosos?

**Resposta:** Não fazer esses tratamentos especiais, respeitar as permissões.

**32.** É preciso controlar versões de documentos?

**Resposta:** SIM. Como não sei a forma que você faria o controle de versões, instruí anteriormente que o usuário tenha poder, ao subir um documento (upload) indicar que aquilo é uma versão de um documento anterior ou então um novo documento. Assim, quero que visualmente apareçam os documentos com os seus respectivos status e opção para colapsar e expandir as versões daquele documento (com nome do usuário que subiu aquela versão, data e hora).

Importante existir um cadastro geral de documentos padrão para cada etapa (e subetapa do Deal), no cadastro padrão de etapas, mas tendo a flexibilidade de editar essas lista de documentos em cada Deal.

No cadastro geral de documentos padrão para cada etapa (e subetapa do Deal), deve existir a possibilidade de atrelar templates e editar esses templates (tipicamente arquivos WORD DOCX que algum momento viram PDF a serem assinados)

## 11. API e integrações

**33.** Quais sistemas externos vão consumir a API na versão 1, se houver
algum?

**Resposta:** Ainda não sei.

**34.** Quem pode gerar chaves de API, e com quais permissões?

**Resposta:** Somente ADMs.

---

## Observações livres

Qualquer outra regra, preferência ou contexto do MNA que não coube acima.

**Resposta:** 

Tudo que eu disser que está fora da versão 1, anote um cheklist para versões futuras.
Por exemplo, integrar PDFs de documentos com plataformas de assinatura.