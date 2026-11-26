# MNA: backlog para versões futuras

Checklist do que ficou fora da versão 1. Todo item declarado "fora da
versão 1" é anotado aqui.

Feitos em 2026-11-26 e retirados daqui: "Esqueci minha senha", tela
"Sobre", título da aba com o nome do tenant, "Concluir" no "Próximo
passo", bordas dos campos com 3:1 no tema escuro, antivírus na foto da
conta e nas logos entrada com rosto, digital ou PIN (passkey) explicada
nas telas, máscara de valor nas ofertas e no valor estimado do negócio e
lançador de módulos no cabeçalho (os dois últimos eram da V3).

Classificação do responsável (2026-11-25): **V2** entra na próxima
versão; **V3** fica para depois (os itens que estavam em dúvida, V?,
foram classificados em 2026-11-25). Dentro de cada grupo, os itens estão em ordem de esforço
estimado, na mesma escala do `escopo-v1.md`: **P** (pequeno), **M**
(médio) e **G** (grande). Entre colchetes, o assunto.

## V2

### Esforço P

- [ ] [Acesso] Login com Google e Microsoft (item 3 da V1, simulado na
      demonstração): contas OAuth nos consoles do Google e da Microsoft,
      só para e-mails já convidados (cadastro continua só por convite).
      Depende de o responsável criar as contas de desenvolvedor.
- [ ] [Sobre] Outras abas da tela "Sobre" (a de Versão, Segurança e
      Funcionalidades foi feita em 2026-11-26): Termos de uso e Política de
      privacidade, Componentes de código aberto e licenças; versão também
      no console.

### Esforço M

- [ ] [Layout] Grade de 8 em todas as telas: as telas novas (painel,
      kanban, painel do negócio) já usam 8/16/24; as demais ainda têm 6 e
      12 px.
- [ ] [Primeiro acesso] **Tour guiado no primeiro acesso:** balões em
      passos ("Passo 1 de 7"), com título, explicação curta, "Próximo" e
      "Pular tour", apontando as áreas principais (painel, menu, negócios,
      documentos, mensagens). Aparece uma vez por pessoa; "Ver o tour de
      novo" nas preferências da conta o reapresenta. Textos nas mensagens
      (idiomas) e cores pelos tokens do tema.
- [ ] [Tarefas] Kanban de tarefas gerais (fora de deal), com colunas
      sugeridas: A fazer → Em andamento → Aguardando terceiros → Concluído.
- [ ] [Busca] Busca do cabeçalho também em registros (empresas, pessoas,
      negócios), respeitando as permissões; na V1 ela procura só as opções
      do menu.
- [ ] [Pedidos] **Pedidos de documentos antes da Diligência e por
      qualquer comprador** (pedido de 2026-11-26): hoje os pedidos ficam
      na fase de Diligência. Devem poder ser feitos bem antes, por
      qualquer compradora do funil, inclusive sem NDA assinado, para
      pedidos simples. A definir: o que pode ser pedido e liberado sem NDA
      (ex.: só material público ou do teaser) e quem aprova.
- [ ] [Documentos] Áreas restritas dentro de um negócio (ex.: notas
      internas dos assessores).
- [ ] [Autenticação] **Confirmar operações sensíveis com rosto, digital
      ou PIN (passkey)** (resto do item de reconhecimento facial, cuja
      entrada pelo aparelho foi feita em 2026-11-26): antes de excluir,
      baixar ou mostrar dados sensíveis e trocar permissões, pedir a passkey
      de novo (confirmação recente), com auditoria.
- [ ] [Integrações] **Servidor MCP** (pedido de 2026-11-25; a arquitetura
      já está preparada, mas o servidor não existe): primeiro só
      ferramentas de leitura (negócios, etapas, tarefas, documentos,
      pedidos, ofertas) chamando os mesmos serviços das telas, com
      autenticação por chave de API do usuário, as mesmas permissões e
      auditoria. Assim dá para perguntar ao sistema pelo Claude (Desktop ou
      Code). Estimativa: 6% a 10% do limite semanal de uso.
- [ ] [Integrações] **"Pergunte ao sistema" com IA de verdade** (pedido de
      2026-11-25; na V1 o bloco da tela principal é simulado, por
      palavras-chave): o bloco manda a pergunta à API da Anthropic, que
      responde usando as ferramentas do MCP. Antes de construir: ADR sobre
      envio de dados de negócios a uma IA externa (LGPD, contrato com o
      provedor, o que pode sair do servidor e o que fica) e uma chave paga
      da API. Estimativa: 10% a 15% depois do MCP.
- [ ] [Materiais] **Envio para fora do sistema:** mandar documentos,
      pedidos de documentos, e-book e OnePager por e-mail a quem não usa o
      sistema, com aprovação antes do envio, registro do que foi enviado e
      a quem, e auditoria.
- [ ] [Valuation] Ponte do valor da empresa (EV) ao valor das ações
      (equity): dívida líquida, capital de giro e contingências.
- [ ] [Valuation] Valor presente das ofertas (à vista, parcelas, earnout)
      para comparação.
- [ ] [Valuation] Campos específicos do lado comprador: sinergias, custos
      de integração, retorno exigido (TIR-alvo, prazo de retorno) e
      financiamento da compra (capital próprio × dívida e seu custo); na V1
      o comprador usa os campos comuns, com a faixa mínimo–máximo.
- [ ] [Valuation] Saídas além da tela: relatório PDF, exportação Excel,
      gráfico "campo de futebol" comparando as faixas dos métodos.
- [ ] [Cadastro por documento, ADR-0021] Leitura de outros formatos além de
      PDF (DOCX; imagens dependem do OCR, abaixo).
- [ ] [Cadastro por documento, ADR-0021] Leitura por IA (contratos sociais,
      documentos de identidade, nomes, cargos e participações), quando
      houver provedor aprovado para dados pessoais (mesma decisão de IA
      externa do "Pergunte ao sistema").
- [ ] [Anonimização] Reconhecimento automático de nomes parecidos (erros
      de grafia não cadastrados como variação), com revisão pelo usuário
      antes de substituir (na V1, só as variações digitadas).
- [ ] [Anonimização] Importar planilhas fora do modelo (e até PDF ou DOCX),
      interpretando colunas e formatos diferentes (resposta X3,
      2026-11-19).
- [ ] [OCR] **Leitura de PDFs escaneados e imagens (OCR local)**, feita uma
      vez e aproveitada por três funções: cadastro por documento
      (ADR-0021), busca por conteúdo dos escaneados (ADR-0022) e
      anonimização de imagens e escaneados.
- [ ] [Integrações] Sistemas externos consumindo a API (a identificar; o
      esforço depende de quais forem).

### Esforço G

- [ ] [Busca] Busca do topo com IA: perguntas em linguagem natural sobre os
      documentos de um negócio, busca por assunto em vez de palavra exata
      (a primeira busca, na V1, é por nome e conteúdo, item 35). Depende da
      decisão sobre IA externa.
- [ ] [Valuation] Taxa de desconto (WACC) calculada a partir de componentes
      e dados de mercado (ex.: múltiplos setoriais, Damodaran) buscados
      automaticamente.
- [ ] [Valuation] Integração direta com sistemas contábeis para importar
      números.
- [ ] [Anonimização] Substituição real em DOCX e PDF (na V1, simulada; em
      planilhas, real). PDF é a parte mais difícil.
- [ ] [Documentos] Edição de modelos DOCX no navegador (ex.: OnlyOffice,
      Collabora).
- [ ] [Materiais] **Criação estruturada do e-book e do OnePager:** montar
      os materiais no sistema a partir dos dados do negócio, do valuation e
      de seções editáveis (hoje, na demonstração, a versão é só um registro
      com PDF de exemplo).

## V3

### V3: esforço P

- [ ] [Mensagens] Busca no texto das mensagens.
- [ ] [Mensagens] Mensagens na exportação do negócio.
- [ ] [Mensagens] Opção "Enviar também por e-mail" na tela da mensagem:
      além de gravar a mensagem, manda o texto às pessoas do canal (ou às
      escolhidas). Hoje o e-mail só avisa menções e o resumo, sem o texto.
      A decidir: o texto vai no e-mail (sai do sistema) ou só o link.
- [ ] [White label] Logo em SVG (higienizado: sem scripts, eventos ou
      referências externas); na V1 só PNG, JPG ou WebP.
### V3: esforço M

- [ ] [Contratos] Lançamento das apurações mensais dos honorários
      variáveis: a cada fechamento, registrar horas ou base do mês,
      calcular o valor (respeitando o limite mensal) e avisar o financeiro.
      Hoje o contrato guarda só as regras.
- [ ] [Acesso] Redefinição de 2FA aprovada pelos administradores dos outros
      tenants que exigem 2FA da pessoa, sem precisar da RGRUBER.
- [ ] [Acesso] Modelos de perfis mantidos pela RGRUBER no console, que os
      tenants existentes podem importar ou atualizar (na V1, o conjunto
      padrão só é copiado na criação do tenant).
- [ ] [White label] Envio de e-mails pelo domínio do próprio cliente (exige
      configuração de DNS do lado dele).
- [ ] [White label] Editor completo de tema ("modo avançado").
- [ ] [Idiomas] Traduções para inglês e espanhol (a base de idiomas está
      pronta desde a V1, ADR-0020): traduzir os arquivos de mensagens e
      revisar com pessoa fluente.
- [ ] [Materiais] E-book e OnePager em outros formatos além de PDF:
      apresentação (PPTX) e página web com link privado.
- [ ] [White label] Domínio próprio do cliente (ex.: `mna.cliente.com.br`).
      Hoje cada tenant usa um subdomínio do nosso domínio (`bt.<domínio>`);
      seria o próprio endereço do escritório, com o certificado e o DNS do
      lado dele.
- [ ] [LGPD] Anonimização a pedido do titular (escopo-v1.md, item 23; saiu
      da V1 em 2026-11-20). É diferente da "anonimização de clientes"
      (item 33), que troca os nomes dos clientes por códigos nos
      documentos, por sigilo: esta atende ao direito do titular pela LGPD.
      Quando uma pessoa pede, apagar ou tornar irreconhecíveis os dados
      pessoais dela em todo o sistema (respeitando o que a lei manda
      guardar), com registro do pedido. Até lá, os pedidos são atendidos
      manualmente.

### V3: esforço G

- [ ] [Documentos] Integração com plataformas de assinatura digital ou
      eletrônica.
