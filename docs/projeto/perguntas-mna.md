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

**Resposta:**

**2.** Quais são as principais entidades? Por exemplo: empresas, deals,
etapas, contatos, documentos, tarefas, mandatos.

**Resposta:**

**3.** Quais são as etapas de um deal (ex.: prospecção → NDA → due diligence
→ negociação → fechamento)?

**Resposta:**

**4.** O que entra na **versão 1** e o que fica para depois?

**Resposta:**

## 2. Usuários e perfis

**5.** Quais são todos os perfis? Já citados: administradores do portal,
advogados, advisors e clientes. Falta algum, como analistas,
investidores/compradores ou auditores?

**Resposta:**

**6.** Quais perfis são internos (sua equipe) e quais são externos?

**Resposta:**

**7.** Um usuário pode ter perfis diferentes em deals diferentes? Por
exemplo, advisor num deal e observador em outro.

**Resposta:**

## 3. Permissões (matriz perfil × ação × deal)

**8.** O que cada perfil pode **ver, criar, editar, excluir e baixar**?
(Uma tabela ajuda: perfis nas linhas, ações nas colunas.)

**Resposta:**

**9.** Há documentos ou áreas restritas dentro de um deal? Por exemplo, um
cliente que não vê as notas internas dos advisors.

**Resposta:**

**10.** Quem inclui e remove pessoas de um deal?

**Resposta:**

## 4. Convites e entrada

**11.** Quem pode convidar: só administradores ou também o responsável pelo
deal?

**Resposta:**

**12.** Em quantos dias o convite expira?

**Resposta:**

**13.** O cadastro é **só por convite**, ou existe algum cadastro aberto?

**Resposta:**

## 5. Login e 2FA

**14.** Quais formas de login são permitidas: e-mail e senha, link mágico,
Google, Microsoft? São as mesmas para internos e externos?

**Resposta:**

**15.** 2FA: obrigatório para todos, só para alguns perfis, ou só para quem
acessa documentos sigilosos?

**Resposta:**

**16.** Quais métodos de 2FA: aplicativo autenticador, passkey, ou ambos?

**Resposta:**

## 6. Sessão

**17.** Por quanto tempo a sessão dura antes de pedir login de novo (ex.: 8
horas, 7 dias)?

**Resposta:**

**18.** Depois de quanto tempo de inatividade a saída é automática (ex.: 30
minutos)?

**Resposta:**

**19.** Um usuário pode ficar conectado em vários dispositivos ao mesmo
tempo?

**Resposta:**

## 7. Saída de usuários (desligamento)

**20.** Quando alguém sai de um deal ou da firma, quem revoga o acesso e com
que rapidez?

**Resposta:**

**21.** Os acessos de externos expiram automaticamente, por exemplo ao
encerrar o deal?

**Resposta:**

## 8. Auditoria

**22.** Que eventos registrar: login, visualização de deal, visualização ou
download de documento, alterações, convites?

**Resposta:**

**23.** Por quanto tempo guardar a trilha de auditoria?

**Resposta:**

**24.** Quem pode consultar a auditoria?

**Resposta:**

## 9. Dados pessoais (LGPD)

**25.** Quais dados pessoais o MNA coleta, tanto de usuários quanto de
terceiros (ex.: sócios e funcionários das empresas-alvo)?

**Resposta:**

**26.** Em que nível cada um se enquadra: **público**, **pessoal** ou
**sensível** (criptografado)? Exemplo: CPF de sócios = sensível.

**Resposta:**

**27.** Qual a finalidade e a base legal de cada um (contrato, legítimo
interesse, obrigação legal, consentimento)?

**Resposta:**

**28.** Qual o prazo de retenção, e o que acontece com os dados de um deal
encerrado ou cancelado?

**Resposta:**

**29.** Como tratar o pedido de exclusão de um titular quando há obrigação de
manter histórico?

**Resposta:**

## 10. Documentos

**30.** Que tipos de arquivo serão enviados e qual o tamanho típico?

**Resposta:**

**31.** É preciso marca d'água, bloqueio de download ou visualização somente
online para documentos sigilosos?

**Resposta:**

**32.** É preciso controlar versões de documentos?

**Resposta:**

## 11. API e integrações

**33.** Quais sistemas externos vão consumir a API na versão 1, se houver
algum?

**Resposta:**

**34.** Quem pode gerar chaves de API, e com quais permissões?

**Resposta:**

---

## Observações livres

Qualquer outra regra, preferência ou contexto do MNA que não coube acima.

**Resposta:**
