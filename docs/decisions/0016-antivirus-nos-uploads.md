---
status: aceito
date: 2026-11-17
decision-makers: Ricardo Gruber
scope: plataforma
---

# Antivírus nos uploads: verificador simulado fora da produção, AWS GuardDuty em produção, com proteções complementares

## Contexto e problema

Usuários de várias empresas externas enviam documentos (XLSX, PDF, DOCX) que
outros usuários baixam. Um arquivo infectado poderia atingir todos os
participantes. Os documentos são confidenciais e não podem ser entregues a
terceiros para análise. Os arquivos ficam em armazenamento S3 (ADR-0012) e o
trabalho assíncrono roda via Inngest (ADR-0015). Como verificar os arquivos
antes de liberar o download?

## Fatores de decisão

* Nenhum download antes do resultado da verificação
* Documentos confidenciais nunca enviados a terceiros
* Qualidade de detecção em produção
* Sem infraestrutura adicional para manter
* Fluxo testável localmente e na demonstração, inclusive o bloqueio
* Custo proporcional ao volume

## Alternativas consideradas

* (A) AWS GuardDuty Malware Protection para S3
* (B) ClamAV hospedado por nós
* (C) API comercial de antivírus de terceiros
* (D) VirusTotal

## Decisão

Alternativa escolhida: **um módulo único de verificação, com um verificador
por ambiente**:

| Ambiente | Verificador |
|---|---|
| Local | **Simulado**: aprova tudo, exceto o arquivo de teste EICAR, que bloqueia |
| Demonstração | **Simulado** (só dados fictícios) |
| Produção | **AWS GuardDuty Malware Protection** no S3 São Paulo |

Motivos: em produção, detecção comercial sem infraestrutura e sem o arquivo
sair da AWS no Brasil; fora da produção, o fluxo completo (incluindo
bloqueio) é exercitado sem custo. O ClamAV (B) fica como substituto se a
produção sair da AWS. (C) e (D) são descartadas por confidencialidade; o
VirusTotal compartilha os arquivos com a comunidade de segurança.

Regras:

1. **Fluxo de status:** upload → "Verificando" → "Disponível" (limpo) ou
   "Bloqueado" (ameaça). Nenhum link de download é emitido antes de
   "Disponível".
2. **Bloqueio:** arquivo em quarentena (inacessível), aviso a quem enviou e
   aos administradores do tenant, evento de auditoria.
3. **Verificação como tarefa em segundo plano** (ADR-0015), com status
   visível na interface.
4. **Proteções complementares, em todos os ambientes:**
   * conferência do tipo real do arquivo pelo conteúdo, não só pela
     extensão;
   * lista de tipos permitidos por categoria; executáveis e scripts
     recusados;
   * **arquivos com macros** (ex.: `.xlsm`, `.docm`) **aceitos com aviso**
     visível de "contém macros" na listagem e antes do download, além da
     verificação antivírus;
   * download sempre como anexo (`Content-Disposition: attachment`), nunca
     exibido dentro do navegador da aplicação;
   * limite de tamanho por categoria.
5. **Falha do verificador** (indisponível, erro): o arquivo permanece em
   "Verificando" e a tarefa é repetida; nunca é liberado por omissão.

### Consequências

* Positiva: arquivos confidenciais nunca saem do nosso ambiente.
* Positiva: produção sem servidor de antivírus para manter.
* Positiva: fluxo completo testável com o arquivo EICAR.
* Negativa: local e demonstração não detectam ameaças reais (aceitável com
  dados fictícios).
* Negativa: o usuário espera alguns segundos até o arquivo ficar
  disponível.
* Negativa: arquivos com macros dependem de o usuário respeitar o aviso.

### Confirmação

* Testes: arquivo EICAR fica "Bloqueado" e sem link de download; arquivo
  com extensão falsa é recusado; arquivo com macro exibe aviso; arquivo em
  "Verificando" não pode ser baixado.
* Nenhum link de download emitido sem status "Disponível" (verificado na
  camada de serviços).

## Prós e contras das alternativas

### (A) AWS GuardDuty

* Prós: detecção comercial; nenhuma infraestrutura; dados na AWS São
  Paulo.
* Contras: só funciona com S3; custo por volume escaneado.

### (B) ClamAV

* Prós: gratuito; funciona em qualquer ambiente; dados no nosso ambiente.
* Contras: servidor sempre ligado; detecção inferior aos comerciais.

### (C) API comercial de terceiros

* Prós: detecção alta; sem infraestrutura.
* Contras: documentos confidenciais enviados a terceiros.

### (D) VirusTotal

* Prós: detecção altíssima.
* Contras: arquivos compartilhados com a comunidade de segurança;
  inaceitável para documentos confidenciais.

## Mais informações

* Relacionado: ADR-0006 (baseline de segurança), ADR-0012 (armazenamento),
  ADR-0015 (tarefas em segundo plano).
