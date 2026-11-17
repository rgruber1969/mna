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
| 1 | Ao gravar um ADR, atualizar o README das decisões e, se houver conceito novo, as notas explicativas | 17 (ADR-0003 a 0019) | Skill "registrar ADR" (template MADR, numeração, README, notas, commit) | aprovado: [.claude/skills/registrar-adr](../../.claude/skills/registrar-adr/SKILL.md) |
| 2 | Explicar em linguagem simples cada ferramenta ou conceito novo adotado | 5 | Já coberto pelo `~/.claude/CLAUDE.md` | observando |
| 3 | Reiniciar o servidor de desenvolvimento (encerrar o processo da porta e subir `pnpm dev`) | 4 | Script `pnpm dev:reiniciar` | aprovado: [scripts/dev-reiniciar.mjs](../../scripts/dev-reiniciar.mjs) |
| 4 | Ao instalar pacote, conferir builds bloqueados pelo pnpm e registrar em `pnpm-workspace.yaml` | 3 | Hook após `pnpm add` | aprovado: [.claude/hooks/apos-instalar.mjs](../../.claude/hooks/apos-instalar.mjs) |
| 5 | Usar `/c/Users/suporte/AppData/Roaming/npm` no PATH do Bash para achar o `pnpm` | 20+ | Hook `SessionStart` local (`.claude/settings.local.json`, fora do git) | aprovado |

## Histórico de propostas

| Data | Item | Proposta | Resultado |
|---|---|---|---|
| 2026-11-17 | 1 | Skill `registrar-adr` (12 passos, inclusive escolha explícita obrigatória) | Aprovada e criada |
| 2026-11-17 | 3, 4, 5 | Script `dev:reiniciar`; hook de builds bloqueados após `pnpm add`; PATH do pnpm no Bash | Aprovadas e criadas |
