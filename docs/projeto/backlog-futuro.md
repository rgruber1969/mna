# MNA: backlog para versões futuras

Checklist do que ficou fora da versão 1. Todo item declarado "fora da
versão 1" é anotado aqui.

## Documentos

- [ ] Integração com plataformas de assinatura digital/eletrônica
- [ ] Edição de templates DOCX no navegador (ex.: OnlyOffice, Collabora)
- [ ] Áreas restritas dentro de um deal (ex.: notas internas de advisors)

- [ ] E-book e OnePager em outros formatos além de PDF: apresentação
      (PPTX) e página web com link privado (o OnePager na V1 é só PDF)

## Cadastro a partir de documento (ADR-0021)

- [ ] Leitura por IA (contratos sociais, documentos de identidade, nomes,
      cargos e participações), quando houver provedor aprovado para dados
      pessoais
- [ ] Leitura de PDFs escaneados e imagens (OCR local)
- [ ] Leitura de outros formatos além de PDF (DOCX, imagens)

## Anonimização de clientes

- [ ] Substituição real em DOCX e PDF (na V1, simulada; em planilhas, real)
- [ ] Imagens e PDFs escaneados (reconhecimento de texto, OCR)
- [ ] Reconhecimento automático de nomes parecidos (erros de grafia não
      cadastrados como variação), com revisão pelo usuário antes de
      substituir (na V1, só as variações digitadas)

## Valuation

- [ ] Integração direta com sistemas contábeis para importar números
- [ ] Taxa de desconto (WACC) calculada a partir de componentes e dados de
      mercado (ex.: múltiplos setoriais, Damodaran) buscados automaticamente
- [ ] Ponte do valor da empresa (EV) ao valor das ações (equity): dívida
      líquida, capital de giro e contingências
- [ ] Valor presente das ofertas (à vista, parcelas, earnout) para comparação
- [ ] Saídas além da tela: relatório PDF, exportação Excel, gráfico "campo de
      futebol" comparando faixas dos métodos
- [ ] Campos específicos do valuation do lado comprador: sinergias, custos de
      integração, retorno exigido (TIR-alvo, prazo de retorno) e
      financiamento da compra (capital próprio × dívida e seu custo); na V1
      o comprador usa os campos comuns, com a faixa mínimo–máximo

## Tarefas

- [ ] Kanban de tarefas gerais (fora de deal), com colunas sugeridas:
      A fazer → Em andamento → Aguardando terceiros → Concluído

## Identidade visual e acesso

- [ ] Traduções para inglês e espanhol (a base de idiomas está pronta desde a
      V1, ADR-0020): traduzir os arquivos de mensagens e revisar com pessoa
      fluente
- [ ] Lançador de módulos no cabeçalho (ícone de grade de quadrados, com
      atalhos para outros módulos e aplicações); o botão de recolher o menu
      lateral usa o ícone padrão de três linhas
- [ ] Busca do cabeçalho também em registros (empresas, pessoas, deals),
      respeitando as permissões; na V1 ela procura só as opções do menu

- [ ] Login com Google e Microsoft (item 3 da V1, simulado na demonstração):
      contas OAuth nos consoles do Google e da Microsoft, só para e-mails
      já convidados (cadastro continua só por convite)

- [ ] Foto da conta: passar também pelo fluxo de antivírus (ADR-0016)
      quando ele existir; hoje o servidor recusa o que não é imagem real e
      grava uma imagem nova, sem guardar o original

- [ ] Domínio próprio do cliente (ex.: `mna.cliente.com.br`)
- [ ] Envio de e-mails pelo domínio do próprio cliente (exige DNS do lado
      dele)
- [ ] Editor completo de tema ("modo avançado" de white label)
- [ ] White label: logo em SVG (higienizado: sem scripts, eventos ou
      referências externas); na V1 só PNG, JPG ou WebP
- [ ] White label: título da aba com o nome de exibição do tenant (na V1
      só o ícone da aba muda)
- [ ] White label: imagens da marca pelo fluxo de antivírus (ADR-0016)
      quando ele existir
- [ ] Redefinição de 2FA aprovada pelos administradores dos outros tenants
      que exigem 2FA da pessoa, sem precisar da RGRUBER
- [ ] Modelos de perfis mantidos pela RGRUBER no console, que os tenants
      existentes podem importar ou atualizar (na V1, o conjunto padrão só é
      copiado na criação do tenant)

## Integrações

- [ ] **Servidor MCP** (pedido de 2026-11-25; a arquitetura já está
      preparada, mas o servidor não existe): primeiro só ferramentas de
      leitura (negócios, etapas, tarefas, documentos, pedidos, ofertas)
      chamando os mesmos serviços das telas, com autenticação por chave de
      API do usuário, as mesmas permissões e auditoria. Assim dá para
      perguntar ao sistema pelo Claude (Desktop ou Code). Estimativa: 6% a
      10% do limite semanal de uso.
- [ ] **"Pergunte ao sistema" com IA de verdade** (pedido de 2026-11-25;
      na V1 o bloco da tela principal é simulado, por palavras-chave): o
      bloco manda a pergunta à API da Anthropic, que responde usando as
      ferramentas do MCP. Antes de construir: ADR sobre envio de dados de
      negócios a uma IA externa (LGPD, contrato com o provedor, o que pode
      sair do servidor e o que fica) e uma chave paga da API. Estimativa:
      10% a 15% depois do MCP.
- [ ] Sistemas externos consumindo a API (a identificar)
- [ ] Anonimização: importar planilhas fora do modelo (e até PDF ou DOCX), interpretando colunas e formatos diferentes (resposta X3, 2026-11-19)

## Mensageria (depois da primeira entrega, 2026-11-19)

* Mensagens na exportação do negócio (junto com a exportação).
* Busca no texto das mensagens.
* Opção "Enviar também por e-mail" na tela da mensagem (pedido de
  2026-11-20): além de gravar a mensagem, manda o texto por e-mail às
  pessoas do canal (ou às escolhidas). Hoje o e-mail só avisa menções e o
  resumo, sem o texto. A decidir: o texto vai no e-mail (sai do sistema)
  ou só o link.

## Busca geral (depois da busca de documentos, 2026-11-20)

* A caixa de busca do topo vai reunir vários tipos de busca, inclusive com
  IA (ex.: perguntas em linguagem natural sobre os documentos de um
  negócio, busca por assunto em vez de palavra exata). A primeira, na V1,
  é a busca de documentos por nome e conteúdo (escopo-v1.md, item 35).
* Documentos escaneados (imagem, sem texto) entram na busca por conteúdo só
  com leitura de imagem (OCR), junto com a evolução do ADR-0021.

## LGPD

* Anonimização a pedido do titular (escopo-v1.md, item 23): saiu da V1 em
  2026-11-20; enquanto isso, pedidos de titulares são atendidos
  manualmente.


## Tela "Sobre" (pedido de 2026-11-25)

* **Tela "Sobre" com informações gerais, em abas**, aberta pelo menu do
  usuário ou pelo rodapé:
  * **Versão:** número e data da versão, novidades da versão (notas de
    lançamento), ambiente (demonstração ou produção), o copyright do
    rodapé repetido e os contatos de suporte. O nome do produto continua
    vindo de `PRODUCT_NAME`.
  * **Segurança:** como os dados são protegidos, em linguagem simples:
    conformidade com a LGPD (bases legais, direitos do titular e como
    pedir), quais dados pessoais são guardados e quais tabelas e campos
    são criptografados (CPF, RG, cônjuge, salário e anexos de cadastro,
    tirados do inventário `dados-pessoais.md`), isolamento por tenant,
    2FA, auditoria, antivírus nos envios e onde os dados ficam (região).
    Sem nenhum detalhe que ajude um ataque, como chaves, nomes de
    servidores ou configurações.
  * **Outras abas a definir:** por exemplo, Termos de uso e Política de
    privacidade, Componentes de código aberto e licenças, e Status das
    funcionalidades (reais e simuladas).

## Autenticação (pedido em 2026-11-22)

* **Reconhecimento facial:** entrar ou confirmar operações sensíveis pelo
  rosto. Antes de construir: decidir entre o reconhecimento do próprio
  aparelho (passkey com Face ID / Windows Hello, que já é suportado pelas
  chaves de acesso, sem guardar o rosto) e um serviço de biometria facial
  (dado pessoal sensível pela LGPD: base legal, consentimento, guarda e
  descarte, e inventário em dados-pessoais.md). Exige ADR.

## Primeiro acesso (pedido em 2026-11-22)

* **Tour guiado no primeiro acesso:** balões em passos ("Passo 1 de 7"),
  com título, explicação curta, "Próximo" e "Pular tour", apontando as
  áreas principais (painel, menu, negócios, documentos, mensagens).
  Aparece uma vez por pessoa; uma opção nas preferências da conta
  ("Ver o tour de novo", guardada como flag por usuário) o reapresenta.
  Textos nas mensagens (idiomas) e cores pelos tokens do tema.

## Layout (depois das propostas v3, 2026-11-23)

* **Grade de 8 em todas as telas:** as telas novas (painel, kanban, painel
  do negócio) já usam espaçamentos de 8/16/24; as demais ainda têm 6 e 12 px
  e passam para a grade quando forem revisitadas.
* **Bordas de campos no tema escuro com 3:1:** as bordas ficaram mais
  visíveis, mas os campos de formulário ainda não chegam a 3:1 sobre o
  fundo dos cartões.
* **"Concluir" direto no "Próximo passo":** hoje o botão abre a tarefa na aba
  Atividade.

## Contratos (depois dos honorários combinados, 2026-11-23)

* **Lançamento das apurações mensais dos honorários variáveis:** a cada
  fechamento, registrar horas ou base do mês, calcular o valor (respeitando o
  limite mensal) e avisar o financeiro. Hoje o contrato guarda só as regras.
* **Máscara de valor nas demais telas** (ofertas, valor estimado do
  negócio): hoje só nos contratos.

## Materiais e comunicação externa (pedido de 2026-11-24)

* **Criação estruturada do e-book e do OnePager:** montar os materiais no
  sistema a partir dos dados do negócio, do valuation e de seções editáveis
  (hoje, na demonstração, a versão é só um registro com PDF de exemplo).
* **Envio para fora do sistema:** mandar documentos, pedidos de documentos,
  e-book e OnePager por e-mail a quem não usa o sistema, com fluxo de
  aprovação antes do envio, registro do que foi enviado e a quem, e
  auditoria.
