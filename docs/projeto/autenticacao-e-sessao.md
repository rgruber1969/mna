# MNA: autenticação e sessão

Políticas do MNA dentro do baseline de segurança (ADR-0006), implementadas
com Better Auth (ADR-0005).

## Convites e entrada

* **Somente administradores** (do tenant ou da RGRUBER) convidam.
* Cadastro **só por convite**, com **confirmação do convidado por e-mail**.
* Convite **expira em 3 dias**.
* Os primeiros administradores de cada tenant são cadastrados pela RGRUBER
  no console.

## Formas de login

Todas as gratuitas, para todos os usuários:

* E-mail e senha
* Link mágico (link de uso único enviado por e-mail)
* Passkey
* Google (simulado na V1: escopo-v1.md, item 3)
* Microsoft (simulado na V1: escopo-v1.md, item 3)

## Link mágico (decidido em 2026-11-17)

* **Substitui só a senha:** quem tem segundo fator digita o código (ou usa
  a passkey) depois do link; o link nunca dispensa o 2FA.
* Vale **10 minutos** e **uma vez**; só é enviado se a conta tem acesso ao
  endereço, mas a resposta na tela é sempre a mesma.
* Abrir o link mostra um botão **"Entrar"**; o login não é automático,
  porque antivírus de e-mail abrem links sozinhos e gastariam o link.

## Passkey (decidido em 2026-11-17)

* **Login completo:** passkey sozinha já vale como dois fatores (aparelho +
  digital, rosto ou PIN), sem senha nem código.
* A sessão registra se foi aberta com dois fatores; áreas que exigem 2FA
  (o console sempre) recusam sessão aberta só com senha ou só com link.
* No desenvolvimento local, cada passkey fica presa ao subdomínio
  (`*.localhost`); na demonstração e na produção, vale em todo o domínio.

## Senha

* Mínimo de **12 caracteres**, máximo de 128, sem regras de composição
  (NIST 800-63B); limite de tentativas ativo.
* Mensagem de erro única no login, sem revelar se o e-mail tem conta.

### Esqueci minha senha (2026-11-26)

* Opção na tela de entrada: a pessoa informa o e-mail e recebe um link
  para criar senha nova, que vale **15 minutos** e **uma vez**.
* Só é enviado se a conta tem acesso ao endereço do pedido, e o link só
  funciona nesse endereço; a resposta na tela é sempre a mesma.
* No máximo um link por minuto para a mesma conta.
* Trocar a senha encerra todas as sessões abertas, envia um aviso por
  e-mail ("sua senha foi alterada") e registra o evento na auditoria. O
  2FA continua exigido no próximo login.

## Segundo fator (2FA)

* **Métodos:** passkey **ou** aplicativo autenticador (ex.: Google ou
  Microsoft Authenticator), à escolha do usuário.
* **Não** usar código por e-mail ou SMS como segundo fator (não aceito pelo
  NIST 800-63B; com link mágico, seria o mesmo canal do login).
* **Console da RGRUBER:** 2FA sempre obrigatório.

### Exigência no tenant (decidido em 2026-11-17)

* **As regras se somam:** o 2FA é exigido de uma pessoa se o tenant exige
  de **todos**, **ou** se o **perfil** dela exige, **ou** se ela foi
  **marcada individualmente**. Desligar uma regra não apaga as outras.
* **Administradores do tenant sempre** precisam de 2FA.
* **Por perfil** (decidido em 2026-11-18): cada perfil do tenant tem a
  opção "exige 2FA"; basta um perfil da pessoa exigir.
* **Seguro por padrão no convite** (decidido em 2026-11-18): o convite vem
  com "Exigir 2FA" **marcado** (marcação individual); o administrador pode
  desmarcar. Desmarcar a individual não libera quem é obrigado por perfil,
  pelo tenant ou por ser administrador: vale sempre a regra mais segura.
* Depois do convite, a marcação individual muda no detalhe do usuário
  (Usuários → pessoa); a de perfil, na tela do perfil; a de todos, em
  Usuários.
* **Bloqueio imediato:** quem passa a ser obrigado e não tem 2FA só vê a
  tela de configuração no próximo acesso. Quem tem 2FA mas entrou só com
  senha ou só com link precisa entrar de novo com dois fatores.
* A exigência é por tenant; os **fatores são da conta** (ADR-0019): a
  passkey ou o autenticador configurados valem em todos os tenants da
  pessoa.

### Recuperação (decidido em 2026-11-17)

* **Pela própria pessoa:** códigos de recuperação (10, uso único) gerados
  ao configurar o aplicativo autenticador; a tela de segurança incentiva
  cadastrar uma segunda passkey.
* **Administrador do tenant pode sempre:** exigir 2FA, revogar o acesso e
  remover um aparelho perdido (uma passkey ou o autenticador) **desde que
  reste outro fator**.
* **Redefinição completa** (a conta fica sem nenhum fator): o administrador
  do tenant faz se **nenhum outro tenant exige 2FA** da pessoa; caso
  contrário, só a RGRUBER, pelo console, com motivo obrigatório e
  confirmação prévia da identidade da pessoa (procedimento, fora do
  sistema).
* Toda redefinição apaga autenticador, códigos e passkeys, encerra todas as
  sessões da pessoa, avisa por e-mail e é auditada.
* Aprovação da redefinição pelos outros tenants (sem a RGRUBER): backlog.

## Entrada de desenvolvimento (decidido em 2026-11-18)

Só para agilizar testes locais: entrar informando apenas o e-mail.

* Ligada por `DEV_ENTRAR_SO_COM_EMAIL=sim` no `.env` (desligada por
  padrão) e aceita **somente** em endereços `*.localhost`, fora de produção.
* A aplicação **recusa iniciar em produção** com a marcação ligada (mesma
  regra das funcionalidades simuladas).
* A tela mostra uma faixa de aviso "modo desenvolvimento"; a sessão conta
  como de dois fatores; cada entrada gera evento de auditoria próprio.
* Valem as demais regras: vínculo ativo, tenant não suspenso, papel do
  console.

## Sessão

* **Duração máxima:** 8 horas; depois, novo login.
* **Inatividade:** saída automática após 1 hora sem uso.
* **Uma sessão por usuário por endereço:** um novo login num endereço
  encerra a sessão anterior naquele endereço (em outro dispositivo);
  sessões em outros tenants e no console continuam (ADR-0019).
* Sessão válida só no endereço onde foi criada (tenant ou console;
  ADR-0011).

## Conta e vínculo (ADR-0019)

* Cada pessoa tem **uma conta** na plataforma (uma senha, um 2FA) e um
  **vínculo** por tenant; revogar o vínculo na BT não afeta outros tenants.
* Nenhuma tela de um tenant revela se um e-mail já tem conta na plataforma.

## Desligamento

* Administradores revogam o acesso de forma **imediata**: a revogação
  encerra as sessões ativas e invalida chaves de API do usuário.
* Acessos **não expiram** automaticamente ao encerrar o deal: deals
  encerrados seguem disponíveis para consulta.

## Chaves de API

* Geradas **somente por administradores**.
* Cada chave pertence a um tenant e respeita as mesmas permissões das
  telas.
* **Construído em 2026-11-22 (itens 25 e 26):** tela Administração › Chaves
  de API. Cada chave é um **usuário de serviço** com o **perfil do tenant**
  escolhido (e uma pessoa "Chave de API: nome", para ser incluída como
  participante dos negócios que deve ver). Validade opcional.
* O segredo (`chv_…`) aparece **uma única vez**; guarda-se só o hash. Uso:
  cabeçalho `Authorization: Bearer <segredo>`, só no endereço do tenant da
  chave (outro endereço recusa).
* **Revogar** corta na hora (e encerra o vínculo do usuário de serviço);
  último uso registrado. Criação e revogação auditadas.
* Usuários de serviço não aparecem na lista de Usuários e nunca recebem
  e-mail.
* Rotas da v1 (documentação em `/api/docs`): negócios, documentos (lista,
  link de download auditado, busca), tarefas (lista e criação), mensagens
  (conversas, leitura e envio) e cadastros (empresas e pessoas, dados
  sensíveis mascarados).
