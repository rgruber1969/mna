---
status: aceito
date: 2026-11-19
decision-makers: Ricardo Gruber
scope: plataforma
---

# Leitura de documentos para cadastro: local, sem IA, com conferência

## Contexto e problema

Cadastrar empresas, pessoas e seus vínculos à mão é lento e sujeito a erro.
Grande parte desses dados já está em documentos que o usuário tem em mãos
(comprovante de inscrição no CNPJ, contrato social, documentos de
identidade). Como a aplicação deve ler esses documentos para propor o
cadastro, sabendo que eles trazem dados pessoais sensíveis (CPF, RG)?

## Fatores de decisão

* Confidencialidade: documentos com dados pessoais não devem sair do
  servidor sem necessidade (ADR-0007; regra de local e demonstração sem
  envio a terceiros).
* Utilidade real já na primeira versão, inclusive na demonstração.
* Custo zero por documento fora da produção.
* Nada é gravado sem conferência humana.
* Caminho aberto para uma leitura mais inteligente depois, sem retrabalho.

## Alternativas consideradas

* (A) Leitura local sem IA, com conferência; IA e documentos escaneados
  depois, no mesmo módulo.
* (B) Leitura por IA já na primeira versão.
* (C) Funcionalidade simulada na primeira versão.

## Decisão

Alternativa escolhida: **(A) leitura local sem IA, com conferência**,
porque resolve o caso mais comum (comprovante de CNPJ) sem que o documento
saia do servidor, sem custo, e funciona na demonstração; a leitura por IA
fica atrás do mesmo módulo para quando houver provedor e contrato de
proteção de dados.

Regras:

1. **Módulo único de leitura** ("leitor de documentos") com uma
   implementação por configuração; na primeira versão, só a **local**.
   Uma implementação por IA pode ser acrescentada depois sem mudar as
   telas nem os serviços (como o módulo de resumos).
2. **Leitura local:** extrai a camada de texto do PDF no próprio servidor
   (biblioteca `unpdf`, sem serviço externo), encontra **CNPJs e CPFs
   válidos** (dígitos verificadores) e, para cada CNPJ, consulta a base
   pública já adotada (BrasilAPI: razão social, endereço, atividade e
   quadro de sócios). Só o **CNPJ**, dado público, sai do servidor.
3. **Proposta, nunca gravação direta:** o resultado é uma proposta de
   empresas, pessoas e vínculos que o usuário confere, corrige e confirma
   item a item. Itens que já existem no cadastro (mesmo CNPJ ou CPF) são
   indicados como "já cadastrado" e servem só para ligar vínculos.
4. **Documento de origem guardado como anexo** (opcional, marcado por
   padrão) da empresa ou da pessoa, com a proteção dos anexos (ADR-0017,
   adendo de 2026-11-19).
5. **Limites aceitos:** PDF escaneado (só imagem) não tem texto e não é
   lido; nomes e cargos no contrato social só aparecem se vierem do quadro
   de sócios público ou se o usuário completar. Formatos: PDF; outros
   formatos só como anexo.
6. **Permissões e auditoria:** usar a leitura exige "criar" no menu de
   empresas e pessoas; cada leitura e cada cadastro confirmado geram
   evento de auditoria, sem dados pessoais no conteúdo.
7. **Antivírus antes da leitura:** o arquivo passa pela verificação de
   uploads (ADR-0016) antes de ser lido.

### Consequências

* Positiva: o documento não sai do servidor; sem custo; funciona igual
  nos três ambientes.
* Positiva: a conferência obrigatória evita cadastros errados ou
  duplicados.
* Negativa: contratos sociais e documentos escaneados rendem pouco na
  primeira versão (o usuário completa à mão). Risco aceito pelo
  responsável.
* Negativa: depende da base pública para os dados da empresa; fora do ar,
  a proposta traz só os números encontrados.

### Confirmação

* Testes de unidade do leitor local com PDFs de exemplo fictícios
  (comprovante de CNPJ e contrato social), conferindo CNPJs e CPFs
  encontrados e a recusa de números inválidos.
* Teste de que nada é gravado sem a confirmação.
* Revisão: nenhuma chamada externa no leitor além da consulta de CNPJ.

## Prós e contras das alternativas

### (A) Leitura local sem IA, com conferência

* Prós: confidencialidade; custo zero; real na demonstração; ótima no
  comprovante de CNPJ; módulo pronto para IA depois.
* Contras: fraca em contratos sociais e escaneados.

### (B) Leitura por IA já na primeira versão

* Prós: entende contratos sociais, documentos de identidade e escaneados;
  extrai nomes, cargos e participações.
* Contras: o documento, com dados pessoais, sai do servidor para o
  provedor; contraria a regra de local e demonstração sem envio a
  terceiros; custo por documento; exige escolher provedor e contrato de
  proteção de dados.

### (C) Simulada na primeira versão

* Prós: rápida de fazer.
* Contras: não ajuda no cadastro real.

## Mais informações

* Relacionado: ADR-0007 (dados pessoais), ADR-0012 (armazenamento),
  ADR-0016 (antivírus), ADR-0017 (chaves; anexos criptografados).
* Revisitar quando houver provedor de IA aprovado para dados pessoais ou
  demanda forte por documentos escaneados (OCR local).
