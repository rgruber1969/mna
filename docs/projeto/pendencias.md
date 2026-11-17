# MNA: pendências em ordem

Lista de trabalho das decisões pendentes, na ordem combinada com o
responsável. Ao concluir um item, marcar `[x]` e indicar onde ficou
registrado.

## Em ordem

- [x] **1. Skill "registrar ADR"**: aprovada e criada em
      `.claude/skills/registrar-adr/SKILL.md`.
- [ ] **2. Checklist ASVS nível 2**: curadoria pelo Claude; aprovação da
      lista final e dos itens "não se aplica".
- [ ] **3. Questionários de definição** (um por tema, no formato de
      `perguntas-mna.md`):
  - [ ] 3a. E-book
  - [ ] 3b. Kanban de tarefas
  - [ ] 3c. Mensageria
  - [ ] 3d. Áreas restritas dentro do deal
- [ ] **4. Relembrar o conceito da decisão "Neon em São Paulo na
      produção"** (ADR-0012, decisões menores do README).
- [ ] **5. Escopo da versão 1**: marcar a coluna "V1?" em `escopo-v1.md`,
      revisando as estimativas de valor e esforço (que são do Claude) e
      considerando que os itens 21 e 22 podem ficar para depois sem risco.
- [ ] **6. Valuation**: detalhar a funcionalidade (questionário próprio).

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
