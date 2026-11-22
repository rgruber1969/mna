---
status: aceito
date: 2026-11-22
decision-makers: Ricardo Gruber
scope: plataforma
---

# Busca por conteúdo dos documentos: texto extraído no banco com índice de busca

## Contexto e problema

Os usuários precisam achar documentos não só pelo nome, mas pelo que está
escrito neles (ex.: "multa" deve trazer todos os documentos que citam
multa), no geral ou dentro de um processo, sempre respeitando o que cada
pessoa pode ver. Os arquivos ficam no armazenamento de objetos (ADR-0012);
para buscar no conteúdo é preciso extrair o texto e guardá-lo num lugar
pesquisável. Onde e como guardar esse texto?

## Fatores de decisão

* Resultado útil: rápido, tolerante a plural e acentos, em português.
* Confidencialidade: o texto dos documentos é tão sigiloso quanto os
  próprios arquivos (ADR-0006, ADR-0007).
* Isolamento por tenant (ADR-0009) e permissões por versão (ADR-0013).
* Esforço compatível com a primeira versão e caminho aberto para buscas
  com IA depois.

## Alternativas consideradas

* (A) Texto extraído no envio, guardado no banco, com o índice de busca em
  português do PostgreSQL (busca textual completa).
* (B) Texto criptografado com a chave do tenant (ADR-0017) e
  descriptografado na hora de cada busca.
* (C) Busca pelo nome real e busca por conteúdo simulada.

## Decisão

Alternativa escolhida: "(A) texto no banco com índice de busca", porque
entrega uma busca rápida e boa em português com esforço médio, mantendo o
texto no mesmo nível de proteção que os arquivos já têm.

Regras:

1. O texto é extraído no servidor quando a versão fica disponível (depois
   do antivírus), sem enviar o arquivo a terceiros: PDF com texto, DOCX,
   XLSX, CSV e TXT. Documentos escaneados (só imagem) ficam fora até
   existir leitura de imagem (OCR).
2. O texto fica numa tabela própria com `tenant_id` e RLS, ligada à versão,
   com um índice de busca em português (sem acentos), e um limite de
   tamanho por versão.
3. Toda busca passa pela camada de serviços e só devolve versões que a
   pessoa pode ver pelas mesmas regras da lista de documentos; o filtro de
   permissão nunca é deixado para a tela.
4. O texto extraído nunca vai para logs nem para a auditoria; a busca é
   auditada só com a quantidade de resultados, sem o termo (ele pode
   conter nome ou CPF).
5. Versão excluída, documento excluído ou tenant excluído levam o texto
   junto (exclusão em cascata).
6. O texto não é criptografado campo a campo (diferente de CPF e RG); a
   proteção é a mesma dos arquivos do data room: isolamento por tenant,
   acesso só pela aplicação e disco criptografado no provedor.

### Consequências

* Positiva: busca rápida mesmo com milhares de documentos; entende plural
  e ignora acentos; filtros por processo e por permissão no mesmo lugar.
* Positiva: base para buscas futuras (inclusive com IA) sem reprocessar os
  arquivos.
* Negativa (risco aceito pelo responsável): o conteúdo dos documentos
  passa a existir também no banco, em texto, protegido pelas mesmas
  camadas dos arquivos, mas sem criptografia por campo; um vazamento do
  banco exporia esse texto.
* Negativa: documentos escaneados não aparecem na busca por conteúdo.

### Confirmação

* Testes automáticos: a busca não devolve versões que a pessoa não vê
  (outra compradora, outro lado, outro tenant).
* Revisão: nenhum log ou evento de auditoria com o texto extraído.

## Prós e contras das alternativas

### (A) Texto no banco com índice de busca

* Prós: rápido; entende português; esforço médio; reaproveitável.
* Contras: texto no banco sem criptografia por campo.

### (B) Texto criptografado, descriptografado na busca

* Prós: proteção máxima, igual à dos campos sensíveis.
* Contras: fica lento conforme o volume cresce (cada busca abre e varre
  todos os textos); sem índice, não entende plural; esforço maior.

### (C) Conteúdo simulado

* Prós: pouco esforço.
* Contras: a busca por conteúdo não funciona de verdade na demonstração.

## Mais informações

* Relacionados: ADR-0007, ADR-0009, ADR-0012, ADR-0013, ADR-0016,
  ADR-0017, ADR-0021 (leitura de PDF já usada no cadastro).
* Revisitar se surgir exigência contratual de criptografia do conteúdo ou
  quando entrar a busca com IA (índice semântico).
