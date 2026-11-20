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

- [ ] Servidor MCP (arquitetura já preparada)
- [ ] Sistemas externos consumindo a API (a identificar)
- [ ] Anonimização: importar planilhas fora do modelo (e até PDF ou DOCX), interpretando colunas e formatos diferentes (resposta X3, 2026-11-19)

## Mensageria (depois da primeira entrega, 2026-11-19)

* Anexos nas mensagens e botão "transformar em documento do negócio"
  (dominio.md; previsto na V1, ficou para a próxima entrega).
* Mensagens na exportação do negócio (junto com a exportação).
* Busca no texto das mensagens.
