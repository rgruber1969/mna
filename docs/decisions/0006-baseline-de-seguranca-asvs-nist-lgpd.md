---
status: aceito
date: 2026-11-16
decision-makers: Ricardo Gruber
scope: plataforma
---

# Baseline de segurança: OWASP ASVS 5.0 nível 2, NIST SP 800-63B e LGPD

## Contexto e problema

As aplicações da plataforma lidam com dados confidenciais e pessoais, têm
muitos usuários externos e expõem interface web, API e, futuramente, MCP.
A autenticação usa Better Auth (ADR-0005), mas a biblioteca não define
sozinha o que é "seguro o suficiente": duração de sessão, política de
senhas, 2FA, recuperação de conta, autorização, auditoria e tratamento de
dados pessoais. Criar regras próprias do zero tende a deixar lacunas. Qual
referência adotar como requisito mínimo de segurança?

## Fatores de decisão

* Cobertura completa (autenticação, sessão, autorização, dados, auditoria)
* Requisitos verificáveis, utilizáveis como checklist e em revisões
* Padrões abertos, gratuitos e reconhecidos por clientes e auditorias
* Adequação à legislação brasileira de dados pessoais
* Esforço proporcional ao risco (dados confidenciais, não infraestrutura
  crítica)

## Alternativas consideradas

* OWASP ASVS 5.0 nível 1 + LGPD
* OWASP ASVS 5.0 nível 2 + NIST SP 800-63B + LGPD
* OWASP ASVS 5.0 nível 3 + NIST SP 800-63B + LGPD
* Apenas OWASP Top 10 como referência
* Regras próprias, sem padrão de mercado
* Certificação ISO 27001 / SOC 2 desde o início

## Decisão

Alternativa escolhida: "OWASP ASVS 5.0 nível 2 + NIST SP 800-63B + LGPD",
porque o nível 2 é o indicado pelo próprio ASVS para aplicações com dados
sensíveis, o NIST detalha senhas, 2FA e recuperação de conta, e a LGPD é
obrigatória para dados pessoais no Brasil.

Diretrizes:

* **OWASP ASVS 5.0, nível 2:** requisito mínimo para autenticação, sessão,
  autorização, validação de entrada, criptografia, logs, API e
  configuração. Itens não aplicáveis são marcados como tal, com motivo.
* **NIST SP 800-63B:** referência para senhas (longas, sem regras de
  composição obrigatórias, sem troca periódica forçada, bloqueio de senhas
  vazadas), 2FA (aplicativo autenticador ou passkey; SMS desaconselhado) e
  recuperação de conta.
* **LGPD:** minimização de dados pessoais, base legal e finalidade
  definidas, atendimento aos direitos do titular, registro de acessos e
  plano de resposta a incidentes.
* **OWASP Cheat Sheets** como guia prático de implementação.
* **Política × padrão:** os padrões definem *como* implementar com
  segurança; as políticas de negócio (quem convida, quais perfis exigem 2FA,
  duração de sessão, retenção de auditoria, matriz de permissões) são
  definidas por projeto, no `CLAUDE.md` do projeto, dentro dos limites
  deste baseline.

### Consequências

* Positiva: checklist objetivo, reduzindo o risco de esquecer controles.
* Positiva: linguagem comum com clientes e auditorias de segurança.
* Positiva: reaproveitável integralmente em futuras aplicações (vira skill
  e rule do template).
* Negativa: esforço adicional de implementação e verificação em relação ao
  nível 1.
* Negativa: o ASVS é extenso; exige curadoria dos itens aplicáveis.
* Negativa: não substitui certificações formais (ISO 27001, SOC 2), que
  podem ser exigidas por clientes no futuro.

### Confirmação

* Checklist dos itens ASVS nível 2 aplicáveis mantido no repositório e
  revisado antes de cada publicação.
* Revisão automatizada de segurança no fluxo de trabalho (plugins de
  segurança do Claude Code e `/security-review`).
* Testes automatizados para controles críticos: login, 2FA, expiração de
  sessão, acesso negado por falta de permissão.

## Prós e contras das alternativas

### ASVS nível 1 + LGPD

* Prós: menor esforço.
* Contras: insuficiente para dados confidenciais; deixa de fora controles
  importantes de sessão, autorização e auditoria.

### ASVS nível 2 + NIST 800-63B + LGPD (escolhida)

* Prós: proporcional ao risco; cobertura ampla; verificável; reconhecido.
* Contras: esforço moderado; requer curadoria.

### ASVS nível 3 + NIST 800-63B + LGPD

* Prós: máxima robustez.
* Contras: desproporcional (pensado para sistemas críticos, como bancos e
  saúde); custo alto de implementação e verificação.

### Apenas OWASP Top 10

* Prós: curto, conhecido.
* Contras: é lista de conscientização, não checklist verificável; cobertura
  incompleta.

### Regras próprias

* Prós: sob medida.
* Contras: alto risco de lacunas; sem reconhecimento externo.

### ISO 27001 / SOC 2 desde o início

* Prós: reconhecimento formal por clientes corporativos.
* Contras: custo e burocracia desproporcionais ao estágio atual; tratam de
  processos da organização, não de requisitos técnicos da aplicação.

## Mais informações

* Relacionado: ADR-0005 (autenticação).
* OWASP ASVS: <https://owasp.org/www-project-application-security-verification-standard/>
* NIST SP 800-63B: <https://pages.nist.gov/800-63-4/sp800-63b.html>
* OWASP Cheat Sheet Series: <https://cheatsheetseries.owasp.org/>
* LGPD: Lei nº 13.709/2018.
* Revisitar se clientes exigirem certificação formal ou se o perfil de
  risco mudar.
