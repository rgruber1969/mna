---
status: aceito
date: 2026-11-16
decision-makers: Ricardo Gruber
scope: plataforma
---

# Registrar decisões de arquitetura com ADRs no formato MADR

## Contexto e problema

O MNA é a primeira de uma série de aplicações que devem reaproveitar a mesma
arquitetura (linguagem, banco de dados, autenticação etc.). As decisões
precisam ficar registradas com o porquê, em local versionado junto ao código,
para que (a) futuras aplicações e o template derivado herdem o raciocínio e
não só o resultado, e (b) o Claude Code consulte as decisões sem que elas
sejam copiadas para o CLAUDE.md.

## Fatores de decisão

* Decisões versionadas no git, ao lado do código
* Texto simples (Markdown), legível por pessoas e pelo Claude Code
* Registro do contexto, das alternativas e das consequências, não só da escolha
* Baixo custo de manutenção para um desenvolvedor individual
* Reaproveitável no template de projeto e referenciável via `@` no CLAUDE.md

## Alternativas consideradas

* ADRs em Markdown no formato MADR, em `docs/decisions/`
* ADRs no formato de Michael Nygard (mais enxuto)
* Seção de decisões dentro do CLAUDE.md ou de um README
* Wiki ou documento externo (Notion, Google Docs)
* Não registrar formalmente

## Decisão

Alternativa escolhida: "ADRs em Markdown no formato MADR, em
`docs/decisions/`", porque é o único formato considerado que registra
alternativas e prós/contras de forma estruturada, permanece no repositório e
pode ser referenciado pelo CLAUDE.md sem duplicação.

Convenções:

* Arquivos `NNNN-titulo-em-kebab-case.md`, numeração sequencial de 4 dígitos,
  nunca reutilizada.
* Partir de `docs/decisions/adr-template.md` (MADR 4 simplificado, em
  português).
* Front matter com `status`, `date`, `decision-makers` e `scope`:
  `plataforma` (vai para o template e futuras aplicações) ou `MNA`
  (específico desta aplicação).
* ADR aceito não é reescrito: mudanças de decisão geram novo ADR, e o antigo
  passa a `substituído por ADR-NNNN`. Correções de texto são permitidas.
* Antes de gravar um ADR, as alternativas e seus prós e contras são
  apresentados para decisão do responsável.
* O CLAUDE.md referencia os ADRs com `@docs/decisions/...` em vez de copiar
  seu conteúdo.

### Consequências

* Positiva: histórico do porquê de cada escolha, consultável por pessoas e
  pelo Claude Code.
* Positiva: o campo `scope` separa o que vai para o template do que é
  específico do MNA.
* Positiva: ADRs `plataforma` podem ser copiados como estão para o template.
* Negativa: custo de escrever um documento por decisão relevante.
* Negativa: ADRs podem ficar desatualizados se mudanças forem feitas sem novo
  registro.

### Confirmação

* Toda mudança de stack (linguagem, framework, banco, autenticação,
  hospedagem, bibliotecas estruturais) é acompanhada de um ADR no mesmo
  commit ou em commit anterior.
* Revisão periódica de `docs/decisions/` ao extrair o template.

## Prós e contras das alternativas

### MADR em `docs/decisions/`

* Prós: estrutura explícita para alternativas e prós/contras; padrão
  difundido; Markdown versionado; template pronto.
* Contras: mais longo que o formato Nygard.

### Formato Nygard

* Prós: muito curto (contexto, decisão, consequências).
* Contras: não estrutura alternativas nem prós/contras, que são justamente o
  que se quer preservar para futuras aplicações.

### Seção no CLAUDE.md ou README

* Prós: zero estrutura extra.
* Contras: incha o CLAUDE.md (carregado em toda sessão); mistura instruções
  com histórico; difícil marcar decisões substituídas.

### Wiki ou documento externo

* Prós: edição rica, comentários.
* Contras: fora do repositório e do controle de versão; inacessível ao
  Claude Code sem integração; não acompanha o template.

### Não registrar

* Prós: nenhum esforço imediato.
* Contras: o raciocínio se perde; o reuso em futuras aplicações vira cópia
  sem entendimento.

## Adendo (2026-11-16): resumo das decisões

Complementa a decisão sem substituí-la:

* `docs/decisions/README.md` mantém a tabela das decisões em vigor, em
  discussão e substituídas, atualizada no mesmo commit de cada ADR.
* O CLAUDE.md referencia apenas esse resumo (`@docs/decisions/README.md`),
  não cada ADR, para não carregar todos os ADRs em toda sessão. O Claude abre
  o ADR completo quando precisar do contexto.
* Decisões de baixo impacto e fáceis de reverter podem ficar só na tabela de
  "decisões menores" do resumo, sem ADR próprio.
* O valor de escopo `MNA` passa a ser `projeto` (específico da aplicação
  atual), para que o template sirva a qualquer projeto.
* O resumo contém apenas decisões e premissas de plataforma; regras e
  premissas específicas da aplicação ficam no `CLAUDE.md` do projeto.

## Mais informações

* MADR: <https://adr.github.io/madr/>
* Próximos ADRs previstos: linguagem/framework, banco de dados, autenticação.
