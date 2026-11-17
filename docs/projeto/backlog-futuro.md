# MNA: backlog para versões futuras

Checklist do que ficou fora da versão 1. Todo item declarado "fora da
versão 1" é anotado aqui.

## Documentos

- [ ] Integração com plataformas de assinatura digital/eletrônica
- [ ] Edição de templates DOCX no navegador (ex.: OnlyOffice, Collabora)
- [ ] Áreas restritas dentro de um deal (ex.: notas internas de advisors)

- [ ] E-book e OnePager em outros formatos além de PDF: apresentação
      (PPTX) e página web com link privado (o OnePager na V1 é só PDF)

## Valuation

- [ ] Integração direta com sistemas contábeis para importar números
- [ ] Taxa de desconto (WACC) calculada a partir de componentes e dados de
      mercado (ex.: múltiplos setoriais, Damodaran) buscados automaticamente
- [ ] Ponte do valor da empresa (EV) ao valor das ações (equity): dívida
      líquida, capital de giro e contingências
- [ ] Valor presente das ofertas (à vista, parcelas, earnout) para comparação
- [ ] Saídas além da tela: relatório PDF, exportação Excel, gráfico "campo de
      futebol" comparando faixas dos métodos

## Tarefas

- [ ] Kanban de tarefas gerais (fora de deal), com colunas sugeridas:
      A fazer → Em andamento → Aguardando terceiros → Concluído

## Identidade visual e acesso

- [ ] Domínio próprio do cliente (ex.: `mna.cliente.com.br`)
- [ ] Envio de e-mails pelo domínio do próprio cliente (exige DNS do lado
      dele)
- [ ] Editor completo de tema ("modo avançado" de white label)
- [ ] Redefinição de 2FA aprovada pelos administradores dos outros tenants
      que exigem 2FA da pessoa, sem precisar da RGRUBER

## Integrações

- [ ] Servidor MCP (arquitetura já preparada)
- [ ] Sistemas externos consumindo a API (a identificar)
