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
* Google
* Microsoft

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

## Segundo fator (2FA)

* **Métodos:** passkey **ou** aplicativo autenticador (ex.: Google ou
  Microsoft Authenticator), à escolha do usuário.
* **Não** usar código por e-mail ou SMS como segundo fator (não aceito pelo
  NIST 800-63B; com link mágico, seria o mesmo canal do login).
* **Configuração do tenant** (pelos administradores): 2FA obrigatório para
  todos, por perfil ou por usuário.
* **Recuperação:** códigos de recuperação gerados no cadastro do 2FA; se
  perdidos, o administrador do tenant redefine o 2FA do usuário (ação
  auditada).
* **Console da RGRUBER:** 2FA sempre obrigatório.

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
