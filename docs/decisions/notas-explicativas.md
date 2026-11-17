# Notas explicativas

Explicações dos conceitos e ferramentas adotados nas decisões de arquitetura.
Material de leitura para pessoas; não é carregado automaticamente pelo
Claude Code. Decisões em vigor: [README](README.md).

## O que são WSL e Docker (ambiente local do ADR-0003)

* **WSL 2 (Windows Subsystem for Linux):** recurso do Windows que roda um
  Linux de verdade, leve, dentro do próprio Windows, sem máquina virtual
  pesada nem dual boot. Muitas ferramentas de servidor (inclusive o
  PostgreSQL usado na nuvem) nascem para Linux; o WSL permite rodá-las
  localmente como rodam em produção.
* **Docker:** ferramenta que empacota um programa com tudo de que ele precisa
  (sistema base, bibliotecas, configuração) numa **imagem**. Uma imagem em
  execução é um **contêiner**: um processo isolado do resto da máquina. Em
  vez de instalar o PostgreSQL no Windows, baixa-se a imagem oficial
  `postgres:17` e roda-se um contêiner a partir dela.
* **Docker Desktop:** o aplicativo que instala e administra o Docker no
  Windows. Ele usa o WSL 2 como "motor" Linux por baixo.
* **`docker-compose.yml`:** arquivo no repositório que descreve os
  contêineres do projeto (imagem, versão, porta, senha local, pasta de
  dados). `docker compose up -d` sobe tudo; `docker compose down` para.
  Como o arquivo está no git, qualquer máquina (ou projeto criado pelo
  template) obtém o mesmo banco com um comando.
* **Dados persistem** num "volume" do Docker: parar ou reiniciar o contêiner
  não apaga o banco; apagar o volume, sim.
* **Licença:** Docker Desktop é gratuito para uso pessoal e empresas com
  menos de 250 funcionários e menos de US$ 10 milhões de faturamento anual.

## Características do Neon (produção do ADR-0003)

* **Postgres puro e serverless:** só banco de dados, sem autenticação ou API
  embutidas. Toda regra passa pela camada de serviços da aplicação.
* **Integração com a Vercel:** criado pelo Marketplace da Vercel, sem conta
  separada; cobrança, se houver, na fatura da Vercel; a variável
  `DATABASE_URL` é injetada automaticamente no projeto.
* **Sucessor do Vercel Postgres:** o antigo banco nativo da Vercel foi
  migrado para o Neon.
* **Branch por preview:** cada deploy de preview na Vercel pode ganhar uma
  cópia isolada do banco, criada automaticamente.
* **Adormece quando ocioso (plano gratuito):** economiza recursos e acorda
  sozinho; a primeira consulta após o repouso tem latência extra.
* **Driver para serverless:** conexão por HTTP/WebSocket, adequada às funções
  da Vercel.
* **Portável:** por ser Postgres padrão, migra para qualquer outro provedor
  com `pg_dump`/`pg_restore`.
* **Não inclui:** autenticação e armazenamento de arquivos (decisões
  próprias).

## O que são Hono e Zod (ADR-0004)

* **Hono:** framework para construir a API, a parte da aplicação que atende
  outros sistemas com dados, não pessoas com telas. Define as rotas (ex.:
  `GET /api/contatos/42` devolve o contato 42 em JSON; `POST /api/contatos`
  cria um contato) e o que cada uma faz. É leve, roda dentro do Next.js na Vercel ou
  sozinho em qualquer servidor, e o complemento `@hono/zod-openapi` gera a
  documentação Swagger automaticamente. Analogia: o Next.js é a recepção que
  atende pessoas; o Hono é o balcão de protocolo que atende sistemas.
* **Zod:** biblioteca para descrever o formato dos dados e verificá-los.
  Escreve-se uma vez como um dado deve ser, por exemplo:

  ```ts
  const NovoContato = z.object({
    nome: z.string().min(3),
    email: z.string().email(),
    tipo: z.enum(["cliente", "fornecedor", "parceiro"]),
  })
  ```

  Essa única definição serve a quatro usos: (1) **validação**: a API recusa
  dados inválidos com mensagem clara; (2) **Swagger**: a documentação mostra
  campos e valores permitidos; (3) **MCP**: um agente de IA sabe que dados
  fornecer; (4) **telas**: o TypeScript aponta, já no editor, o uso de campos
  inexistentes. Documentação e comportamento nunca divergem.
* **Swagger / OpenAPI:** OpenAPI é o padrão de descrição de APIs; Swagger é
  a página interativa que lê essa descrição e permite consultar e testar
  cada rota pelo navegador.

## O que é Better Auth (ADR-0005)

* **Biblioteca de autenticação** open source em TypeScript que roda dentro da
  própria aplicação (não é um serviço externo). Usuários, sessões e chaves
  ficam em tabelas no nosso PostgreSQL.
* **Funciona por plugins**, ativados conforme a necessidade: e-mail e senha,
  link mágico (login por link enviado ao e-mail), login com Google/Microsoft,
  2FA, passkeys, organizações e convites, papéis, chaves de API para
  integrações e servidor OAuth para clientes MCP.
* **Responde "quem é você?"** (autenticação). "O que você pode fazer?"
  (autorização, como acesso restrito a determinados registros) é regra
  nossa, na camada de serviços.
* **Custo zero por usuário:** importante quando há muitos usuários externos
  (clientes, parceiros, convidados).
* **Responsabilidade nossa:** manter a biblioteca atualizada, configurar
  limite de tentativas e cookies seguros, e construir as telas de login,
  convite e 2FA.
* **Contexto:** a equipe do Auth.js (NextAuth), biblioteca mais antiga do
  ecossistema, juntou-se ao Better Auth em 2025; o Auth.js ficou em
  manutenção.

## Padrões de segurança: ASVS, NIST e LGPD (ADR-0006)

* **OWASP:** fundação sem fins lucrativos que publica padrões abertos e
  gratuitos de segurança de aplicações. O **OWASP Top 10** é a lista das
  falhas mais comuns (conscientização); o **ASVS** é o checklist verificável.
* **ASVS 5.0 (Application Security Verification Standard):** centenas de
  requisitos organizados por tema (autenticação, sessão, autorização,
  validação, criptografia, logs, API, configuração) e em três níveis:
  * **Nível 1:** básico, para qualquer aplicação.
  * **Nível 2:** para aplicações com dados sensíveis ou confidenciais. É o
    adotado.
  * **Nível 3:** para sistemas críticos (bancos, saúde, infraestrutura).
* **Exemplos de requisitos do ASVS:** sessão expira e pode ser revogada;
  cookies com atributos de segurança; limite de tentativas de login;
  mensagens que não revelam se um e-mail está cadastrado; troca de senha
  exige a senha atual; autorização verificada no servidor em todo pedido.
* **NIST SP 800-63B:** diretriz do instituto de padrões dos EUA sobre
  identidade digital, referência mundial. Pontos principais:
  * Senha **longa** em vez de "complexa"; sem obrigar símbolos e números.
  * **Sem troca periódica forçada**; troca apenas se houver suspeita de
    vazamento.
  * Bloquear senhas conhecidas em vazamentos e senhas óbvias.
  * 2FA por **aplicativo autenticador ou passkey**; SMS desaconselhado
    (sujeito a clonagem de chip).
* **Passkey:** login sem senha usando a biometria ou o PIN do dispositivo
  (celular, computador), resistente a phishing.
* **LGPD (Lei nº 13.709/2018):** lei brasileira de proteção de dados
  pessoais. Exige finalidade e base legal para cada dado coletado, coletar
  só o necessário, atender aos direitos do titular (acesso, correção,
  exclusão, portabilidade), proteger os dados e comunicar incidentes
  relevantes à ANPD e aos titulares.
* **OWASP Cheat Sheets:** guias práticos e curtos por tema (ex.: "esqueci a
  senha", MFA, gestão de sessão), usados durante a implementação.
* **Padrão × política:** os padrões dizem *como* fazer com segurança; quem
  pode convidar, quais perfis exigem 2FA ou por quanto tempo guardar a
  auditoria são decisões de negócio de cada projeto.

## Proteção de dados pessoais (ADR-0007)

* **O que a stack já faz sozinha:** senhas com hash (o Better Auth grava só
  uma "impressão digital" irreversível), disco criptografado no Neon
  (protege contra roubo físico, não contra quem acessa o banco) e tráfego
  criptografado (TLS). Os demais dados pessoais ficam legíveis no banco.
* **Pseudonimização:** troca o dado por um código; a ligação com a pessoa
  fica guardada à parte. Para a LGPD continua sendo dado pessoal, mas o
  risco diminui.
* **Anonimização:** remove a ligação de forma irreversível. Deixa de ser
  dado pessoal, mas o dado não serve mais para operar o sistema.
* **Criptografia por campo:** a aplicação embaralha o campo antes de gravar
  e desembaralha ao ler, com uma chave guardada fora do banco. Quem acessa
  só o banco (ou um backup vazado) vê texto ilegível.
* **Índice cego:** um hash do valor, gravado ao lado do campo criptografado,
  que permite buscar por igualdade (ex.: "existe alguém com este CPF?") sem
  revelar o valor.
* **Por que não criptografar tudo:** campos como nome e e-mail de login
  precisam ser pesquisados, ordenados e usados para enviar mensagens. A LGPD
  exige medidas adequadas ao risco, não criptografia de todos os campos.
* **Classificação adotada:** *público* (exibível), *pessoal* (legível, com
  acesso controlado) e *sensível* (criptografado por campo).
* **Logs:** principal fonte de vazamento em sistemas reais. Registra-se o ID
  do usuário, nunca e-mail, CPF ou tokens; o indispensável é mascarado
  (ex.: `r***@dominio.com`).
* **Ambientes de teste:** o branch de preview do Neon é uma cópia do banco de
  produção; por isso previews e banco local usam dados fictícios ou
  anonimizados.
* **Inventário de dados:** lista dos campos pessoais com finalidade, base
  legal, classificação e prazo de retenção. Atende ao registro das operações
  de tratamento exigido pela LGPD (art. 37).
* **Chave de criptografia:** perder a chave significa perder os dados
  criptografados; por isso guarda, backup e rotação da chave são tratados
  como decisão própria.

## Como o Claude Code carrega instruções (ADR-0008)

| Mecanismo | Quando entra no contexto | Economiza contexto? |
|---|---|---|
| Texto no `CLAUDE.md` | Sempre, em toda sessão | Não |
| Arquivo importado com `@caminho` | Sempre: é "colado" junto com o CLAUDE.md | Não, só organiza |
| Rule em `.claude/rules/` com `paths:` | Só ao trabalhar em arquivos daqueles caminhos | Sim |
| Link simples (sem `@`) para documento | Só quando o Claude decide abrir | Sim |
| Skill | Só quando a tarefa corresponde à skill | Sim |

* **Por que limitar o CLAUDE.md:** tudo o que é carregado sempre disputa
  atenção com a tarefa do momento; regras demais carregadas sempre tendem a
  ser menos seguidas.
* **`~/.claude/CLAUDE.md`:** arquivo pessoal, na pasta do usuário, carregado
  em todos os projetos (ex.: idioma, forma de trabalhar).
* **Rule com `paths:`:** arquivo Markdown em `.claude/rules/` com um
  cabeçalho que diz a quais pastas ou arquivos ele se aplica, por exemplo:

  ```markdown
  ---
  paths:
    - "src/server/auth/**"
  ---
  Sempre exigir 2FA para perfis X e Y. Detalhes: docs/projeto/autenticacao-e-sessao.md
  ```

* **Skill:** pacote de instruções para uma tarefa recorrente (ex.: "criar
  rota protegida"), acionado quando a tarefa aparece ou pelo comando
  `/nome-da-skill`.
* **Hook:** comando executado automaticamente pelo Claude Code em momentos
  definidos (ex.: rodar lint após editar um arquivo, avisar se o CLAUDE.md
  passar de 80 linhas). Não depende da memória do Claude.

## Multi-tenant e RLS (ADR-0009)

* **Tenant:** cada empresa cliente que contrata a aplicação, com seus
  próprios usuários, dados e identidade visual. "Multi-tenant" é uma única
  instalação da aplicação atendendo vários clientes, com os dados de cada
  um isolados.
* **Modelos de isolamento:** banco único com coluna `tenant_id` (adotado),
  um schema por tenant, ou um banco por tenant. Quanto mais isolado, mais
  caro de operar.
* **RLS (Row-Level Security, segurança por linha):** recurso do PostgreSQL
  que filtra quais linhas cada conexão pode ver ou alterar. A regra fica no
  banco e vale para qualquer consulta, mesmo que o código esqueça o filtro.
* **Analogia:** a camada de serviços é a recepção do prédio, que confere
  para qual andar a pessoa pode ir; o RLS é a fechadura de cada sala. Se a
  recepção se distrair, a sala de outra empresa continua trancada.
* **Exemplo:**

  ```sql
  -- "Só mostre linhas do tenant da transação atual"
  CREATE POLICY isolamento_tenant ON deals
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
  ```

  A cada requisição, a aplicação informa o tenant ao banco
  (`SET LOCAL app.tenant_id = ...`); a partir daí, `SELECT * FROM deals`
  devolve apenas as linhas daquele tenant, mesmo sem `WHERE`.
* **Por que importa:** o erro mais comum em SaaS é esquecer um filtro de
  tenant numa consulta e mostrar dados de um cliente a outro. Com RLS, esse
  esquecimento não vaza dados.
* **O que o RLS não faz aqui:** regras finas dentro do tenant (ex.: um
  usuário só vê os registros em que foi incluído) continuam na camada de
  serviços.
* **Usuário global:** a pessoa tem um único login e uma participação em cada
  tenant que atende, com papel próprio em cada um.

## White label e tokens de design (ADR-0010)

* **White label:** o cliente usa o sistema com a própria marca (logo, nome,
  cores), como se fosse dele. Aqui, com um discreto "Desenvolvido por
  RGRUBER Consultoria" no rodapé.
* **Variável CSS:** um "apelido" para um valor de estilo, definido num lugar
  só e usado em toda a interface. Trocar o valor do apelido muda todas as
  telas de uma vez, sem novo deploy.
* **Token de design semântico:** variável com nome que diz *para que serve*,
  não *qual cor é*. Ex.: `primary` (cor principal de ação), `text-muted`
  (texto secundário), `border`. Os componentes usam sempre os tokens; o
  tenant muda o valor deles.
* **Por que proibir cor fixa no código:** se um botão usa `#123E7A`
  diretamente, ele ignora a marca do tenant. Com o token `primary`, ele
  acompanha qualquer marca e permite ampliar a personalização no futuro sem
  mexer nos componentes.
* **Tons derivados:** a partir da cor primária escolhida, o sistema calcula
  automaticamente as variações (mais clara para fundos, mais escura para
  hover, a cor de texto legível sobre ela).
* **WCAG AA:** padrão internacional de acessibilidade; exige contraste
  mínimo de 4,5:1 entre texto normal e fundo (3:1 para texto grande). Abaixo
  disso, pessoas com baixa visão ou em telas ruins não conseguem ler.
* **SVG higienizado:** SVG é texto e pode conter código executável; um logo
  SVG enviado por usuário precisa ter scripts e links externos removidos
  antes de ser exibido, ou o upload aceita só PNG/WebP.

## Subdomínios e console (ADR-0011)

* **Subdomínio:** a parte antes do domínio principal. Em `bt.mna.com.br`,
  `bt` é o subdomínio do tenant BT; em `admin.mna.com.br`, `admin` é o
  console da RGRUBER.
* **Subdomínio coringa (`*.mna.com.br`):** configuração de DNS que faz
  qualquer subdomínio apontar para a aplicação; assim, um tenant novo
  funciona sem mexer no DNS.
* **Uma aplicação, duas "portas":** console e tenants rodam no mesmo
  código; a aplicação olha o endereço digitado e decide qual área mostrar.
  Para o usuário, parecem sistemas separados.
* **"O endereço identifica, a sessão autoriza":** digitar `bt.mna.com.br`
  não dá acesso a nada; o sistema confere se a pessoa logada participa do
  tenant BT.
* **Cookie restrito ao host:** o "crachá" de login emitido em
  `bt.mna.com.br` não vale em `xyz.mna.com.br` nem em `admin.mna.com.br`.
* **Slug:** o nome curto do tenant usado no endereço (`bt`, `xyz`).

## Armazenamento de arquivos (ADR-0012)

* **Armazenamento de objetos:** serviço feito para guardar arquivos
  ("objetos") de qualquer tamanho, barato e durável. O banco guarda só as
  informações sobre o arquivo (nome, versão, quem enviou); o arquivo fica
  no armazenamento.
* **Protocolo S3:** a "língua" criada pela Amazon para conversar com
  armazenamento de objetos, hoje padrão de mercado. AWS S3, Cloudflare R2 e
  MinIO falam a mesma língua; por isso dá para trocar de um para outro só
  mudando a configuração.
* **AWS S3:** o serviço original da Amazon; tem região em São Paulo.
* **Cloudflare R2:** alternativa compatível com S3, com franquia gratuita e
  download sem custo de tráfego; sem região no Brasil.
* **RustFS:** armazenamento compatível com S3 que roda num contêiner Docker,
  usado no desenvolvimento local (substituiu a MinIO, que deixou de ser
  distribuída). É o "S3 de mentira" do computador do desenvolvedor.
* **Link temporário (URL pré-assinada):** endereço de download ou upload
  válido por poucos minutos, gerado pela aplicação depois de conferir a
  permissão. Quem recebe o link não precisa de senha, mas ele expira logo.
* **Upload direto do navegador:** o arquivo vai do computador do usuário
  direto ao armazenamento, sem passar pelo servidor da aplicação; evita o
  limite de ~4,5 MB por requisição das funções da Vercel.
* **Por que não guardar arquivos no banco:** deixa o banco lento, caro e
  com backups pesados.

## Modelo de permissões (ADR-0013)

* **Recurso e ação:** recurso é uma área do sistema (geralmente um item de
  menu, ex.: Documentos); ação é o que se faz nela (ver, criar, editar,
  excluir, baixar).
* **Matriz de permissões:** tabela recurso × ação com "sim" ou "não".
* **Perfil:** um nome para uma matriz (ex.: "Advisor da vendedora"),
  criado e ajustado pelo administrador do tenant.
* **Perfil no tenant × perfil no processo:** o primeiro vale para telas
  gerais (cadastros, configurações); o segundo, para o que está dentro de
  um processo (no MNA, um deal).
* **Participação:** o vínculo "esta pessoa, neste processo, com este
  perfil, neste alcance".
* **Alcance:** a parte do processo onde a participação vale (o processo
  inteiro ou etapas/subetapas específicas).
* **Soma de permissões:** quem tem duas participações no mesmo lugar recebe
  tudo o que cada uma concede.
* **Negado por padrão:** o que não foi concedido está proibido; por isso
  somar nunca abre uma brecha.
* **Verificador único:** uma só função decide "pode ou não pode", usada
  igualmente por telas, API e MCP. Esconder um botão na tela é
  conveniência; a segurança está no verificador.
* **RBAC:** sigla em inglês para controle de acesso baseado em papéis
  (perfis); o modelo adotado é um RBAC configurável com escopo por recurso.
* **Lista de acesso (ACL) por item:** além do perfil, um item específico
  (ex.: uma versão de documento) pode ter sua própria lista de quem o vê.
  Ela só restringe: funciona como uma porta trancada dentro de uma sala em
  que a pessoa já podia entrar.

## E-mail (ADR-0014)

* **E-mail transacional:** enviado um a um, disparado por uma ação (convite,
  link mágico, aviso de pendência). Diferente de e-mail marketing (envio em
  massa).
* **Entregabilidade:** a capacidade de o e-mail chegar à caixa de entrada,
  e não ao spam.
* **SPF, DKIM e DMARC:** registros no DNS do domínio que provam aos
  provedores (Gmail, Outlook) que o e-mail saiu de um servidor autorizado e
  não foi adulterado. Sem eles, os e-mails tendem a cair no spam.
* **Mailpit:** "carteiro falso" que roda no Docker; captura todos os
  e-mails enviados no desenvolvimento e mostra numa página local, sem
  entregar a ninguém.
* **Resend:** serviço de envio moderno, com franquia gratuita; usado na
  demonstração.
* **Amazon SES:** serviço de envio da AWS, muito barato e com região em São
  Paulo; usado em produção. Começa em "modo de teste" (só envia a endereços
  verificados) até a AWS liberar.
* **React Email:** forma de escrever e-mails como componentes TypeScript,
  reaproveitando a marca e as cores do tenant.
* **Bounce:** devolução de um e-mail (endereço inexistente, caixa cheia).
  Endereços que devolvem com frequência são bloqueados para não prejudicar
  a reputação do domínio.
* **Envio em segundo plano:** a tela registra o pedido e segue; o e-mail é
  enviado logo depois por uma tarefa separada, que tenta de novo se falhar.

## Tarefas em segundo plano (ADR-0015)

* **Síncrono × assíncrono:** síncrono é quando o usuário espera a tarefa
  terminar; assíncrono é quando a tela responde na hora e a tarefa roda
  logo depois, mostrando o status (enviando → enviado → falhou).
* **Por que precisa de peça extra na Vercel:** as funções da Vercel nascem
  para atender um pedido e terminam; não há programa sempre ligado
  esperando tarefas.
* **Inngest:** serviço que funciona como gerente da fila e despertador.
  Recebe "execute a tarefa X para o convite 123", guarda, agenda e chama de
  volta a nossa aplicação na hora certa, repetindo se falhar. **Quem
  executa é o nosso código, na Vercel**; o Inngest não acessa nosso banco.
* **Fluxo:** MNA envia "convite 123" ao Inngest → Inngest chama o MNA →
  MNA lê o convite no nosso banco e envia o e-mail → MNA responde
  "concluído" ou "falhou" → se falhou, o Inngest tenta de novo depois.
* **Só identificadores:** pelo Inngest passam apenas números de
  referência e status, nunca nomes, e-mails ou documentos.
* **Etapas:** tarefas longas (ex.: exportar um deal em PDF) são divididas em
  partes; se uma parte falhar, retoma-se dali, sem refazer tudo.
* **Idempotência:** propriedade de uma tarefa que pode rodar duas vezes sem
  causar efeito duplicado (ex.: o convite não chega em dobro).
* **Cron / agendamento:** tarefa que roda sozinha em horários definidos
  (ex.: limpeza diária de auditoria vencida).

## Antivírus nos uploads (ADR-0016)

* **AWS GuardDuty Malware Protection:** antivírus da AWS que escaneia
  automaticamente cada arquivo que chega ao S3, sem servidor nosso, e marca
  o resultado. O arquivo não sai da AWS.
* **ClamAV:** antivírus gratuito e de código aberto; exige um servidor
  sempre ligado. É a alternativa se a produção sair da AWS.
* **Por que não VirusTotal:** os arquivos enviados ficam acessíveis à
  comunidade de segurança; documentos confidenciais vazariam.
* **Arquivo EICAR:** "vírus de mentira" padronizado pela indústria,
  totalmente inofensivo, que todo antivírus reconhece. Serve para testar o
  bloqueio sem risco.
* **Quarentena:** o arquivo suspeito fica guardado, mas inacessível.
* **Tipo real do arquivo:** todo formato tem uma "assinatura" nos primeiros
  bytes; conferi-la impede que um programa renomeado para `.pdf` passe.
* **Macros:** pequenos programas embutidos em planilhas e documentos
  (`.xlsm`, `.docm`). Úteis em modelos financeiros, mas podem esconder
  código malicioso; por isso aparecem com aviso.
* **Download como anexo:** o navegador salva o arquivo em vez de abri-lo
  dentro do sistema, evitando que algo execute no contexto da aplicação.

## Gestão de chaves (ADR-0017)

* **Chave de dados:** a que embaralha e desembaralha os campos sensíveis.
* **Chave mestra:** a que protege as chaves de dados.
* **Criptografia em envelope:** o dado vai num "envelope" trancado pela
  chave de dados; a chave de dados fica guardada trancada pela chave
  mestra; a chave mestra fica num cofre (KMS) de onde nunca sai.
* **AWS KMS:** o cofre de chaves da AWS. A aplicação pede "destranque esta
  chave de dados" e o KMS faz isso sem nunca revelar a chave mestra; todo
  pedido fica registrado.
* **Rotação:** troca periódica da chave. Cada dado leva a "etiqueta" da
  versão da chave usada, então dados antigos continuam legíveis.
* **Destruição criptográfica:** apagar a chave de um tenant torna ilegíveis
  todos os dados sensíveis dele, até em backups antigos que não podem ser
  editados.
* **Período de espera na exclusão:** no KMS, apagar uma chave leva de 7 a
  30 dias; nesse prazo, um engano pode ser desfeito.
* **Segredo × chave de criptografia:** segredos (senhas de serviços, chaves
  de API) dão acesso a serviços; chaves de criptografia protegem dados.
  Ambos ficam fora do repositório.

## Ferramentas de desenvolvimento (ADR-0018)

* **ORM:** camada que traduz o código TypeScript em comandos do banco e
  descreve as tabelas no próprio código. **Drizzle** é o escolhido.
* **Migração:** arquivo que registra cada mudança na estrutura do banco
  (nova tabela, nova coluna), aplicada em ordem em todos os ambientes.
* **shadcn/ui:** coleção de componentes de interface (botões, tabelas,
  diálogos) que são **copiados para dentro do projeto**, em vez de
  instalados como pacote fechado; por isso podem ser alterados livremente.
* **Tailwind CSS:** forma de estilizar a interface com classes curtas
  (ex.: espaçamentos, cores por tokens), muito usada com shadcn/ui.
* **Vitest:** executa testes automatizados de código (regras de negócio,
  permissões).
* **Playwright:** abre um navegador de verdade e simula um usuário
  clicando, para testar fluxos completos.
* **ESLint:** aponta problemas e violações de regras no código; aqui também
  verifica regras dos ADRs (ex.: proibição de cor fixa).
* **Prettier:** formata o código automaticamente, sempre no mesmo padrão.
* **pnpm:** instalador de bibliotecas (pacotes), mais rápido e econômico
  que o npm padrão.

## Identidade e vínculo com tenants (ADR-0019)

* **Conta (identidade):** quem a pessoa é na plataforma: e-mail, senha,
  2FA e passkey. Existe uma só por pessoa, como um documento de identidade.
* **Vínculo:** a ligação da conta com um tenant, como um crachá de cada
  prédio. Cada tenant tem o seu crachá, que pode ser revogado sem afetar
  os outros.
* **Convite:** link de uso único que permite criar a conta (ou usar a
  existente) e ativar o vínculo; guardamos só um "resumo embaralhado"
  (hash) do link, para que um vazamento do banco não revele convites
  válidos.
* **Sessão:** o "estou logado" guardado num cookie; aqui ela também
  registra o endereço onde nasceu e não vale em nenhum outro.
