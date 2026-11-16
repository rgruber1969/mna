# Decisões de arquitetura

Estado atual das decisões do projeto. Cada linha aponta para o ADR com o
contexto, as alternativas e os prós e contras (formato MADR,
ver [ADR-0001](0001-registrar-decisoes-de-arquitetura-com-adrs.md)).

**Escopo:** `plataforma` = reaproveitado no template e em futuras aplicações;
`MNA` = específico desta aplicação.

## Decisões em vigor

| Tema | Decisão | Escopo | ADR |
|---|---|---|---|
| Registro de decisões | ADRs MADR em `docs/decisions/` + este resumo | plataforma | [0001](0001-registrar-decisoes-de-arquitetura-com-adrs.md) |
| Pasta e backup | Projetos em `C:\dev\<nome>`; git com commits frequentes; backup manual no Google Drive | plataforma | [0002](0002-pasta-de-trabalho-local-e-backup.md) |

## Em discussão

| Tema | Situação |
|---|---|
| Banco de dados | Alternativas apresentadas; aguardando decisão |
| Linguagem / framework | Depois do banco de dados |
| Autenticação | Depois da linguagem |

## Decisões menores (sem ADR próprio)

Escolhas de baixo impacto e fáceis de reverter ficam só aqui.

| Tema | Decisão | Data |
|---|---|---|
| Finais de linha | LF em todos os arquivos (`.gitattributes`) | 2026-11-16 |

## Substituídas

Nenhuma até o momento.

## Como manter

* Novo ADR aceito → adicionar linha em "Decisões em vigor" no mesmo commit.
* ADR substituído → mover a linha para "Substituídas", com link para o novo.
* O CLAUDE.md referencia este arquivo com `@docs/decisions/README.md`, não os
  ADRs individuais.
