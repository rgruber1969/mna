---
status: aceito
date: 2026-11-16
decision-makers: Ricardo Gruber
scope: plataforma
---

# Organização das instruções do Claude Code: CLAUDE.md enxuto, documentos de projeto, rules com paths e skills

## Contexto e problema

Cada projeto terá regras de negócio detalhadas (perfis, permissões,
autenticação, dados pessoais, domínio) que o Claude Code precisa seguir. Tudo
o que é carregado em toda sessão disputa atenção com a tarefa do momento, e
regras demais carregadas sempre tendem a ser menos seguidas. Importar
arquivos com `@` no CLAUDE.md organiza o texto, mas não reduz o contexto: o
conteúdo importado é carregado junto, em toda sessão. Como organizar as
instruções para que o CLAUDE.md fique curto (~80 linhas) e continue curto à
medida que as regras crescem?

## Fatores de decisão

* Contexto carregado sempre limitado ao essencial
* Regras detalhadas disponíveis quando a tarefa exigir
* Fonte da verdade legível por pessoas, separada das instruções ao Claude
* Estrutura repetível no template de projeto e no plugin pessoal
* Controle do tamanho que não dependa de memória

## Alternativas consideradas

* CLAUDE.md único, crescendo conforme as regras
* CLAUDE.md com `@` importando arquivos de detalhe
* CLAUDE.md enxuto como índice + documentos de projeto + rules com `paths:`
  + skills

## Decisão

Alternativa escolhida: "CLAUDE.md enxuto como índice + documentos de projeto
+ rules com `paths:` + skills", porque é a única que reduz de fato o
contexto carregado sempre, mantendo as regras detalhadas acessíveis quando a
tarefa as exige.

Convenções:

1. **`CLAUDE.md` do projeto (meta: até ~80 linhas)** contém apenas o que vale
   para qualquer tarefa: o que é o projeto em poucas linhas, regras
   inegociáveis transversais, comandos do dia a dia, estrutura de pastas,
   `@docs/decisions/README.md` e links simples (sem `@`) para os documentos
   de projeto.
2. **`docs/projeto/*.md`**: fonte da verdade das regras de negócio, escrita
   para pessoas (ex.: `dominio.md`, `perfis-e-permissoes.md`,
   `autenticacao-e-sessao.md`, `dados-pessoais.md`). Não importados com `@`.
3. **`.claude/rules/*.md` com `paths:`**: versões curtas e imperativas das
   regras ("sempre…", "nunca…"), carregadas apenas quando o Claude trabalha
   em arquivos daqueles caminhos, com link para o documento detalhado em
   `docs/projeto/`.
4. **Skills** para procedimentos repetitivos (ex.: "criar rota protegida",
   "adicionar campo com dado pessoal").
5. **Preferências pessoais** que valem para todos os projetos ficam em
   `~/.claude/CLAUDE.md`, não no CLAUDE.md do projeto.
6. **Critério de corte:** uma regra só fica no CLAUDE.md se precisar estar
   presente em *qualquer* tarefa. Caso contrário, vai para rule, documento
   ou skill.
7. **Controle de tamanho:** a cada alteração no CLAUDE.md, o tamanho é
   conferido; ao passar de ~80 linhas, o Claude avisa e propõe o que mover e
   para onde, antes de mover. Um hook de verificação automática será
   adicionado junto com os hooks de lint e testes.

### Consequências

* Positiva: contexto de cada sessão enxuto e focado na tarefa.
* Positiva: regras de negócio legíveis por pessoas em `docs/projeto/`.
* Positiva: estrutura pronta para virar template e plugin.
* Negativa: a mesma regra pode existir em dois lugares (documento detalhado
  e rule resumida), exigindo atualizar ambos.
* Negativa: rules dependem de os `paths:` corresponderem à estrutura real
  de pastas; mudanças de estrutura exigem revisar as rules.

### Confirmação

* `CLAUDE.md` com até ~80 linhas (verificado a cada alteração e, depois,
  por hook).
* Nenhum `@` no CLAUDE.md além de `@docs/decisions/README.md`, salvo
  decisão explícita.
* Toda rule em `.claude/rules/` aponta para seu documento em
  `docs/projeto/`.

## Prós e contras das alternativas

### CLAUDE.md único

* Prós: tudo num lugar só.
* Contras: cresce sem limite; todo o conteúdo carregado em toda sessão;
  regras menos seguidas.

### CLAUDE.md com `@` importando detalhes

* Prós: arquivos menores e organizados.
* Contras: não economiza contexto (o conteúdo importado é carregado
  sempre); falsa sensação de enxugamento.

### Índice + documentos + rules com `paths:` + skills (escolhida)

* Prós: contexto mínimo sempre; detalhe sob demanda; legível por pessoas;
  reaproveitável.
* Contras: duplicação entre documento e rule; manutenção dos `paths:`.

## Mais informações

* Relacionado: ADR-0001 (registro de decisões e resumo referenciado pelo
  CLAUDE.md).
* Documentação do Claude Code sobre memória, imports e rules:
  <https://docs.claude.com/en/docs/claude-code/memory>
