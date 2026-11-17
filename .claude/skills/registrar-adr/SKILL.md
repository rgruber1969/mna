---
name: registrar-adr
description: Registra como ADR (formato MADR) uma decisão de arquitetura
  que o responsável JÁ escolheu, atualizando o resumo de decisões, as notas
  explicativas, os documentos do projeto afetados e o registro de
  repetições, e fazendo o commit. Use depois da escolha explícita do
  responsável; não use para apresentar alternativas.
---

# Registrar ADR

## Antes de começar
- Confirme na conversa: alternativas com prós e contras foram apresentadas
  E o responsável escolheu uma explicitamente. Sem escolha explícita, pare
  e pergunte.
- Classifique a decisão:
  - Plataforma (reaproveitável) → ADR com `scope: plataforma`.
  - Específica do projeto → pergunte se vira ADR `scope: projeto` ou regra
    em `docs/projeto/`.
  - Pequena e fácil de reverter → só uma linha em "Decisões menores" do
    `docs/decisions/README.md`, sem ADR.

## Passos
1. Número: o próximo após o maior `NNNN` em `docs/decisions/` (nunca
   reutilizar números).
2. Crie `docs/decisions/NNNN-titulo-em-kebab-case.md` a partir de
   `docs/decisions/adr-template.md`, com `status: aceito`, data de hoje,
   `decision-makers` e `scope`.
3. Preencha: contexto e problema; fatores de decisão; TODAS as
   alternativas apresentadas; decisão com motivos e regras numeradas;
   consequências positivas e negativas (inclusive riscos aceitos pelo
   responsável); confirmação verificável (testes, lint, revisão); prós e
   contras de cada alternativa; ADRs relacionados.
4. Em ADR de plataforma, use termos genéricos ("aplicação", "processo",
   "tenant"), nunca o nome do produto. Nunca inclua dados pessoais ou
   segredos.
5. `docs/decisions/README.md`: nova linha em "Decisões em vigor" (frase
   curta); remova o tema de "Em discussão"; acrescente pendências novas
   que surgiram.
6. `docs/decisions/notas-explicativas.md`: seção `## <Tema> (ADR-NNNN)`
   explicando, em linguagem simples, os conceitos e ferramentas novos.
7. Atualize os documentos de `docs/projeto/` afetados (regras de negócio,
   tabela de ambientes, backlog, `pendencias.md`).
8. ADR anterior afetado: não reescreva. Acrescente um adendo datado em
   "Mais informações" ou, se a decisão mudou, marque-o como substituído e
   mova sua linha para "Substituídas".
9. `docs/claude/instrucoes-repetidas.md`: some 1 à ocorrência do item
   correspondente.
10. Confira os tamanhos: avise se `docs/decisions/README.md` passar de ~70
    linhas ou o `CLAUDE.md` de ~80, e proponha o que mover, antes de mover.
11. Commit único: `docs: ADR-NNNN <título curto>`, seguindo a convenção de
    commits do projeto.
12. Responda com: o que foi decidido (regras principais), os arquivos
    atualizados com links e as pendências restantes.
