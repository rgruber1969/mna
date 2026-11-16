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
