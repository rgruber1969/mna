---
status: aceito
date: 2026-11-17
decision-makers: Ricardo Gruber
scope: plataforma
---

# Tarefas em segundo plano com Inngest, lógica separada da orquestração

## Contexto e problema

Na Vercel, o código roda em funções que atendem um pedido e terminam; não há
processo sempre ligado para executar trabalho em segundo plano. As
aplicações precisam de tarefas assíncronas e agendadas: envio de e-mails com
novas tentativas (ADR-0014), antivírus após upload, exportações demoradas
(PDF/XLSX), limpezas de retenção e lembretes de prazos. A demonstração deve
ter custo zero e o desenvolvimento deve funcionar localmente. Como executar
essas tarefas?

## Fatores de decisão

* Novas tentativas automáticas e tarefas longas
* Agendamentos confiáveis (diários e frequentes)
* Custo zero na demonstração
* Desenvolvimento local
* Visibilidade de falhas e reexecução
* Nenhum dado pessoal em serviços externos
* Facilidade de mudar uma tarefa para execução síncrona ou de trocar de
  serviço

## Alternativas consideradas

* (A) Fila no próprio banco + agendador (Cron) da Vercel
* (B) Inngest
* (C) Upstash QStash
* (D) Servidor de tarefas separado (ex.: Railway/Fly com pg-boss)

## Decisão

Alternativa escolhida: "(B) Inngest", porque oferece nativamente novas
tentativas, agendamentos, tarefas longas em etapas e painel de falhas, com
franquia gratuita e servidor local de desenvolvimento, sem exigir o plano
pago da Vercel nem servidor próprio.

Funcionamento: a aplicação envia um evento ao Inngest; o Inngest agenda e
chama de volta uma função da **própria aplicação na Vercel**, que executa a
tarefa com acesso ao nosso banco e serviços. O Inngest orquestra; quem
executa é o nosso código.

Regras:

1. **Lógica separada da orquestração.** Cada tarefa é uma função comum da
   camada de serviços (ex.: `enviarConvite(conviteId)`). Um **módulo único
   de tarefas** decide como dispará-la; a mesma função pode ser chamada de
   forma síncrona quando fizer sentido, mudando apenas a chamada.
2. **Só identificadores** nos eventos enviados ao Inngest **e nos retornos
   das etapas** (que o Inngest armazena para retomar tarefas). Nunca dados
   pessoais ou conteúdo de documentos.
3. **Idempotência:** toda tarefa pode rodar mais de uma vez sem efeito
   duplicado (ex.: não enviar o mesmo convite duas vezes).
4. **Status visível na interface:** ações assíncronas mostram estado
   (ex.: enviando → enviado → falhou, com motivo e opção de reenviar).
5. **Falha definitiva** após as tentativas: registro de auditoria e
   notificação a quem disparou ou ao administrador.
6. **Agendamentos** (limpezas, retenção, lembretes) declarados em código,
   versionados no repositório.
7. **Contexto de tenant** sempre carregado a partir dos identificadores
   dentro da tarefa, aplicando o mesmo isolamento (RLS) e permissões das
   operações síncronas.
8. **Desenvolvimento local** com o servidor de desenvolvimento do Inngest,
   sem conexão com o serviço real.

### Consequências

* Positiva: tentativas, agendamentos, etapas e painel prontos.
* Positiva: custo zero na demonstração; sem servidor próprio.
* Positiva: troca para síncrono ou para outro serviço concentrada no
  módulo de tarefas.
* Positiva: nenhum dado pessoal no serviço externo.
* Negativa: dependência de serviço externo (mitigada: SDK aberto, opção de
  auto-hospedagem, módulo único).
* Negativa: disciplina de idempotência e de retornos sem dados pessoais.
* Negativa: custo quando o volume ultrapassar a franquia gratuita.

### Confirmação

* Nenhuma importação do SDK do Inngest fora do módulo de tarefas.
* Testes: tarefa executada duas vezes não duplica efeito; evento e retornos
  contêm apenas identificadores.
* Toda ação assíncrona da interface exibe status.

## Prós e contras das alternativas

### (A) Fila no banco + Cron da Vercel

* Prós: nenhum serviço externo.
* Contras: no plano gratuito, o agendador roda só uma vez por dia;
  tentativas e painel feitos à mão; exige plano pago para frequência útil.

### (B) Inngest (escolhida)

* Prós: tentativas, agendamentos, etapas e painel nativos; franquia
  gratuita; servidor local.
* Contras: serviço externo; regras de payload e idempotência.

### (C) Upstash QStash

* Prós: simples; Marketplace da Vercel; tentativas nativas.
* Contras: tarefas em etapas exigem recurso adicional; franquia gratuita
  com limite diário.

### (D) Servidor de tarefas separado

* Prós: controle total.
* Contras: mais infraestrutura e custo; painel e alertas feitos à mão.

## Mais informações

* Relacionado: ADR-0004 (camada de serviços), ADR-0007 (dados pessoais),
  ADR-0009 (isolamento), ADR-0014 (e-mail).
* Para o ADR de antivírus: em produção, a AWS oferece verificação nativa de
  malware para arquivos no S3 (GuardDuty Malware Protection).
