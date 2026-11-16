---
status: aceito
date: 2026-11-16
decision-makers: Ricardo Gruber
scope: plataforma
---

# Pasta de trabalho local em C:\dev, git como histórico e backup manual no Google Drive

## Contexto e problema

O projeto foi iniciado dentro do Google Drive (`G:\Meu Drive\...`). Pastas
sincronizadas por nuvem não combinam com projetos de software: o
`node_modules` e os artefatos de build têm dezenas de milhares de arquivos
que o Drive sincroniza continuamente, e a sincronização pode corromper o
`.git` durante um commit. Onde ficam os projetos e como eles são protegidos
contra perda?

## Fatores de decisão

* Desempenho e integridade do git e das ferramentas de build
* Padrão único e previsível para todos os projetos profissionais
* Proteção contra perda de trabalho
* Simplicidade: nada que dependa de configuração frágil por máquina
* Compatível com a futura publicação no GitHub

## Alternativas consideradas

* Manter o projeto no Google Drive
* Pasta local + hook `post-commit` que espelha os arquivos (robocopy) e grava
  um `git bundle` no Drive
* Pasta local + repositório git "bare" no Drive como remote
* Pasta local + tarefa agendada do Windows copiando para o Drive
* Pasta local + git com commits frequentes + backup manual no Drive quando
  desejado

## Decisão

Alternativa escolhida: "pasta local + git com commits frequentes + backup
manual no Drive", porque é a mais simples, não acrescenta automação a manter
e o histórico git (com commits frequentes) já protege contra perda de
trabalho por erro de edição.

Convenções:

* Todo projeto profissional fica em `C:\dev\<nome-do-projeto>` (minúsculas,
  kebab-case). O MNA fica em `C:\dev\mna`.
* O Claude Code faz commits pequenos e frequentes ao concluir cada etapa
  coerente de trabalho, para que o histórico funcione como ponto de
  restauração.
* O backup no Google Drive é manual, feito pelo responsável quando desejar,
  na pasta correspondente do Drive. Ao copiar, excluir `node_modules`,
  `.next`, `.vercel` e demais pastas geradas.
* Segredos (`.env*`) não vão para o git; ficam guardados em gerenciador de
  senhas.
* Quando o projeto for publicado no GitHub, o remote passa a ser o backup
  externo principal.

### Consequências

* Positiva: git e ferramentas rodam em disco local, sem interferência da
  sincronização.
* Positiva: nenhuma automação de backup para manter ou replicar no template.
* Negativa: até a publicação no GitHub, o histórico git fica no mesmo disco
  que o projeto. Uma falha de disco, roubo ou perda da máquina leva junto
  tudo o que não tiver sido copiado manualmente para o Drive.
* Negativa: a frequência do backup externo depende de disciplina manual.

### Confirmação

* `git log` mostra commits frequentes ao longo de cada sessão de trabalho.
* Revisitar esta decisão se a publicação no GitHub demorar ou se houver
  perda de trabalho; nesse caso, adotar o hook `post-commit` com
  `git bundle` (alternativa 2).

## Prós e contras das alternativas

### Manter no Google Drive

* Prós: backup externo automático, sem mudança de hábito.
* Contras: lentidão e conflitos com `node_modules` e builds; risco de
  corromper o `.git`.

### Hook `post-commit` com espelho + `git bundle` no Drive

* Prós: backup externo automático a cada commit; histórico completo em um
  único arquivo; versionável no template.
* Contras: automação extra; o espelho propaga exclusões; depende do caminho
  do Drive configurado em cada máquina.

### Repositório "bare" no Drive

* Prós: histórico completo fora do disco local.
* Contras: muitos arquivos pequenos sincronizando; nenhuma cópia legível.

### Tarefa agendada do Windows

* Prós: protege também trabalho não commitado.
* Contras: configuração por máquina, fora do template; pode copiar arquivos
  no meio de uma edição.

### Git local + backup manual (escolhida)

* Prós: simples; sem automação; padrão fácil de repetir.
* Contras: sem cópia externa automática até existir o remote no GitHub.

## Mais informações

* Relacionado: ADR-0001 (registro de decisões).
* A publicação no GitHub, prevista para depois, encerra a principal
  consequência negativa desta decisão.
