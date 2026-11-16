---
status: aceito
date: 2026-11-16
decision-makers: Ricardo Gruber
scope: plataforma
---

# Proteção de dados pessoais: classificação, criptografia por campo, logs sem dados pessoais e ambientes de teste anonimizados

## Contexto e problema

O baseline de segurança (ADR-0006) inclui a LGPD, mas não define como os
dados pessoais são tratados no banco, nos logs e nos ambientes de teste. Por
padrão, a stack protege apenas senhas (hash pelo Better Auth), o disco
(criptografia em repouso do Neon) e o tráfego (TLS); nome, e-mail, CPF e
outros dados pessoais ficam legíveis para quem acessa o banco ou seus
backups. Além disso, os branches de preview do Neon copiam o banco de
produção, levando dados pessoais reais para ambientes de teste. Que medidas
adotar como padrão da plataforma?

## Fatores de decisão

* Medidas de segurança adequadas ao risco (LGPD, art. 46)
* Minimização: coletar e expor só o necessário
* Não quebrar operação, busca e envio de e-mails
* Reduzir o impacto de vazamento de banco, backup ou logs
* Atender aos direitos do titular, inclusive exclusão
* Reaproveitável em qualquer projeto da plataforma

## Alternativas consideradas

* (a) Apenas as proteções padrão da stack (hash de senha, criptografia em
  repouso e em trânsito)
* (b) Proteção proporcional por classificação: inventário de dados,
  criptografia por campo para dados sensíveis, logs sem dados pessoais,
  ambientes de teste anonimizados e política de retenção e exclusão
* (c) Criptografia por campo de todos os dados pessoais

## Decisão

Alternativa escolhida: "(b) proteção proporcional por classificação",
porque aplica a técnica adequada a cada tipo de dado, reduz de fato o
impacto de vazamentos (onde o risco é maior: dados sensíveis, logs e cópias
de teste) e mantém o sistema operável.

Regras:

1. **Inventário e classificação.** Todo campo com dado pessoal é registrado
   num inventário do projeto, com finalidade, base legal, nível de
   classificação e prazo de retenção. Níveis de referência:
   * **Público:** pode ser exibido livremente (ex.: nome da empresa).
   * **Pessoal:** identifica uma pessoa e é necessário à operação (ex.:
     nome, e-mail de login, telefone). Legível no banco, acesso controlado
     pela camada de serviços.
   * **Sensível:** dano relevante se vazar (ex.: CPF, documentos de
     identidade, dados financeiros pessoais, dados pessoais sensíveis do
     art. 5º, II da LGPD). Criptografado por campo.
2. **Criptografia por campo para dados sensíveis.** A aplicação criptografa
   antes de gravar e descriptografa ao ler (algoritmo autenticado, ex.:
   AES-256-GCM), com chave em variável de ambiente, nunca no banco nem no
   repositório. Busca exata por campo criptografado via índice cego (HMAC
   com chave própria). Rotação de chave prevista.
3. **Logs e auditoria sem dados pessoais.** Registrar identificadores
   internos (ID do usuário, do registro), nunca e-mail, CPF, telefone,
   tokens ou conteúdo de documentos. Mascarar o que for indispensável
   (ex.: `r***@dominio.com`). Mensagens de erro enviadas a serviços externos
   também passam por esse filtro.
4. **Ambientes de teste sem dados reais.** Banco local e branches de
   preview usam dados fictícios (seed) ou dados anonimizados, nunca cópia
   pura de produção. A forma de anonimizar branches do Neon é definida na
   implementação.
5. **Retenção e exclusão.** Cada tipo de dado tem prazo de retenção no
   inventário. O pedido de exclusão do titular é atendido apagando ou, se
   houver obrigação de manter histórico (ex.: auditoria), anonimizando o
   registro.

### Consequências

* Positiva: vazamento do banco ou de backups não expõe dados sensíveis.
* Positiva: logs e ambientes de teste deixam de ser fonte de vazamento.
* Positiva: o inventário serve como registro das operações de tratamento
  exigido pela LGPD.
* Positiva: busca, ordenação e operação seguem normais para dados não
  sensíveis.
* Negativa: campos sensíveis não permitem busca parcial nem ordenação no
  banco.
* Negativa: gestão de chaves (guarda, backup, rotação) passa a ser crítica;
  perder a chave significa perder os dados criptografados.
* Negativa: esforço de manter o inventário atualizado e de gerar dados de
  teste realistas.

### Confirmação

* Inventário de dados pessoais presente no repositório e atualizado no mesmo
  commit que cria ou altera campos pessoais.
* Testes verificando que campos sensíveis são gravados criptografados.
* Revisão (e, futuramente, regra automatizada) proibindo dados pessoais em
  chamadas de log.
* Nenhum branch de preview ou banco local criado a partir de cópia pura de
  produção.

## Prós e contras das alternativas

### (a) Apenas o padrão da stack

* Prós: nenhum esforço adicional.
* Contras: dados pessoais legíveis para qualquer acesso ao banco, backups e
  logs; previews com dados reais; proteção insuficiente para dados
  confidenciais.

### (b) Proteção proporcional por classificação (escolhida)

* Prós: proporcional ao risco; protege os pontos de maior exposição; mantém
  a operação; atende à LGPD.
* Contras: gestão de chaves; inventário a manter; limites de busca em
  campos sensíveis.

### (c) Criptografia de todos os dados pessoais

* Prós: máxima proteção no banco.
* Contras: quebra busca e ordenação por nome e e-mail; complica envio de
  e-mails e integrações; custo de desempenho e manutenção desproporcional.

## Mais informações

* Relacionado: ADR-0003 (Neon, branches de preview), ADR-0005 (Better Auth,
  hash de senhas), ADR-0006 (baseline de segurança).
* LGPD: Lei nº 13.709/2018, arts. 5º (definições), 6º (princípios),
  13 (pseudonimização em estudos), 18 (direitos do titular), 37
  (registro das operações) e 46 (medidas de segurança).
* Pendente: decisão sobre armazenamento de arquivos, que deve seguir as
  mesmas regras para documentos com dados pessoais.
