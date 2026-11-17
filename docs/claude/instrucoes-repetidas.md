# Registro de instruções repetidas

Mantido pelo Claude Code (ADR-0008 e preferências pessoais). Anota
instruções que o responsável precisou repetir e procedimentos que se
repetem durante o trabalho. Ao atingir 2–3 ocorrências, o Claude propõe
transformar o item em rule, skill ou hook; a criação só ocorre após
aprovação.

**Situação:** `observando` → `proposto` → `aprovado` (com link para o
arquivo criado) ou `recusado`.

## Itens

| # | Instrução ou procedimento | Ocorrências | Proposta | Situação |
|---|---|---|---|---|
| 1 | Ao gravar um ADR, atualizar o README das decisões e, se houver conceito novo, as notas explicativas | 16 (ADR-0003 a 0018) | Skill "registrar ADR" (template MADR, numeração, README, notas, commit) | aprovado: [.claude/skills/registrar-adr](../../.claude/skills/registrar-adr/SKILL.md) |
| 2 | Explicar em linguagem simples cada ferramenta ou conceito novo adotado | 5 | Já coberto pelo `~/.claude/CLAUDE.md` | observando |

## Histórico de propostas

| Data | Item | Proposta | Resultado |
|---|---|---|---|
| 2026-11-17 | 1 | Skill `registrar-adr` (12 passos, inclusive escolha explícita obrigatória) | Aprovada e criada |
