# MNA: pendências em ordem

Lista de trabalho das decisões pendentes, na ordem combinada com o
responsável. Ao concluir um item, marcar `[x]` e indicar onde ficou
registrado.

## Em ordem

- [x] **1. Skill "registrar ADR"**: aprovada e criada em
      `.claude/skills/registrar-adr/SKILL.md`.
- [x] **2. Checklist ASVS nível 2**: aprovado em
      `docs/seguranca/asvs-checklist.md` (215 aplica, 18 n/a, 20 futuro
      MCP; WebSocket descartado no questionário 2).
- [x] **3. Questionários de definição**: respondidos em
      `perguntas-fase2.md` e incorporados a `dominio.md`,
      `perfis-e-permissoes.md` (lista de acesso por versão), ADR-0013
      (adendo), `escopo-v1.md` e `backlog-futuro.md`.
- [x] **4. Relembrar o conceito da decisão "Neon em São Paulo na
      produção"**: explicado em 2026-11-17 (região = local físico do
      servidor; motivos: LGPD, latência, coerência com AWS São Paulo;
      escolhida na criação do banco).
- [ ] **5. Escopo da versão 1**: marcar a coluna "V1?" em `escopo-v1.md`,
      revisando as estimativas de valor e esforço (que são do Claude) e
      considerando que os itens 21 e 22 podem ficar para depois sem risco.
- [ ] **6. Valuation**: detalhar a funcionalidade (questionário próprio).

## Antes da produção

- [ ] **Resumos automáticos com IA ou sem IA** (mensagens e histórico de
      documento): decidir provedor de IA e confidencialidade, ou adotar
      resumo local sem IA. Até lá, texto simulado na demonstração.

## Dependem de terceiros ou de tempo

- [ ] **Nome comercial, marca (INPI) e domínio do produto**: pesquisa do
      responsável; prazo: antes da produção com usuários reais
      (`ambientes-e-dominios.md`).
- [ ] **Base legal dos dados de funcionários das empresas-alvo** (hoje
      "contrato, a validar"): confirmar com o jurídico, por exemplo a BT
      (`dados-pessoais.md`).
- [ ] **Sistemas externos que vão consumir a API**: a identificar.
- [ ] **DMARC em `rgruber.com.br`**: configurar no Registro.br ao montar a
      demonstração (passo a passo pelo Claude).

## Resolvidas

- [x] **Perfil global no tenant, por deal, ou ambos**: ambos, com alcance
      obrigatório por etapa/subetapa (ADR-0013;
      `perfis-e-permissoes.md`).
