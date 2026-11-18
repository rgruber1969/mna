---
status: aceito
date: 2026-11-16
decision-makers: Ricardo Gruber
scope: plataforma
---

# White label: identidade visual por tenant com tokens limitados, aplicados em tempo real

## Contexto e problema

As aplicações são multi-tenant (ADR-0009) e cada tenant contratante quer ver
a própria marca no sistema. O tema padrão é a identidade RGRUBER
(`docs/marca/rgruber/`). O administrador de cada tenant precisa configurar,
em "Configurações gerais", a logomarca e os elementos básicos da identidade
visual, sem comprometer a legibilidade, a acessibilidade e a consistência da
aplicação. Como implementar a personalização visual por tenant?

## Fatores de decisão

* Marca do tenant visível (logo, nome, cores, e-mails, login)
* Legibilidade e acessibilidade garantidas (contraste WCAG AA)
* Mudanças aplicadas na hora, sem novo deploy
* Layout e usabilidade consistentes entre tenants
* Baixa manutenção e possibilidade de ampliar a personalização no futuro
* Segurança no upload de arquivos de imagem

## Alternativas consideradas

* (A) Tokens limitados editáveis pelo admin do tenant, demais tons
  calculados, aplicados em tempo real por variáveis CSS
* (B) Tema compilado por tenant (um build por cliente)
* (C) Editor completo de tema (todos os tokens editáveis)

## Decisão

Alternativa escolhida: "(A) tokens limitados, aplicados em tempo real",
porque mostra a marca do cliente mantendo o sistema legível e consistente,
sem deploy por cliente, e permite evoluir para (C) sem reescrever
componentes.

Regras:

1. **Configurações do tenant (versão 1)**, em "Configurações gerais →
   Identidade visual", editáveis pelo administrador do tenant:
   * logomarca para fundo claro e para fundo escuro;
   * ícone/símbolo (favicon e menu recolhido);
   * nome de exibição;
   * cor primária e cor de destaque;
   * fonte, escolhida numa lista curta e testada (padrão: Manrope).
2. **Tons derivados automaticamente** (hover, foco, bordas, fundos suaves,
   texto sobre a cor) a partir das cores escolhidas.
3. **Verificação de contraste (WCAG AA)** ao salvar: combinações ilegíveis
   são recusadas com explicação; a cor de texto sobre cada cor é escolhida
   automaticamente.
4. **Tema padrão RGRUBER** para tenants sem personalização e como base de
   "restaurar padrão".
5. **Aplicação em tempo real:** as configurações ficam no banco (por
   tenant) e são injetadas como variáveis CSS ao renderizar a página, com
   cache; nenhum deploy é necessário.
6. **Tokens semânticos obrigatórios:** nenhum componente usa cor fixa
   (ex.: `#123E7A`, `bg-blue-700`); todos usam tokens com significado
   (`primary`, `primary-hover`, `accent`, `surface`, `text`, `text-muted`,
   `border` etc.). É a condição para a evolução descrita no item 9.
7. **Marca do tenant também em:** tela de login, e-mails transacionais
   (convites, link mágico, notificações) e título/favicon da aba do
   navegador.
8. **Rodapé:** "Desenvolvido por RGRUBER Consultoria", discreto, presente em
   todos os tenants.
9. **Evolução prevista para (C):** ampliar o conjunto de tokens editáveis
   (eventualmente como "modo avançado" para alguns planos), mantendo
   verificação de contraste para todos os tokens editáveis e a opção
   "restaurar padrão". Não exige mudança nos componentes.
10. **Segurança do upload:** logomarcas aceitas em PNG ou WebP; SVG só se
    higienizado (sem scripts, eventos ou referências externas). Limite de
    tamanho e de dimensões. Armazenamento conforme ADR de arquivos
    (pendente).
11. **Depois da versão 1:** subdomínio por tenant e domínio próprio do
    cliente.

### Consequências

* Positiva: marca do cliente aplicada imediatamente, sem deploy.
* Positiva: acessibilidade e consistência preservadas.
* Positiva: evolução para personalização ampla sem reescrever componentes.
* Positiva: mecanismo reaproveitável em qualquer aplicação da plataforma.
* Negativa: personalização limitada pode não satisfazer clientes que
  queiram controle total (mitigado pela evolução prevista).
* Negativa: disciplina obrigatória de tokens semânticos em todos os
  componentes.
* Negativa: dependência da decisão de armazenamento de arquivos para os
  uploads.

### Confirmação

* Regra automatizada (lint) proibindo cores fixas nos componentes.
* Testes da verificação de contraste (combinações aceitas e recusadas).
* Teste visual com o tema padrão e com ao menos um tema de tenant
  fictício.
* Teste de upload recusando SVG com script e arquivos fora do limite.

## Prós e contras das alternativas

### (A) Tokens limitados em tempo real (escolhida)

* Prós: rápido de aplicar; acessível; consistente; baixa manutenção;
  evolui para (C).
* Contras: personalização limitada na versão 1; exige disciplina de tokens.

### (B) Tema compilado por tenant

* Prós: controle total sobre cada tema; sem cálculo em tempo de execução.
* Contras: um build e deploy por cliente; mudanças lentas; manutenção alta.

### (C) Editor completo de tema

* Prós: liberdade total para o cliente.
* Contras: alto risco de telas ilegíveis e inconsistentes; mais suporte;
  difícil garantir acessibilidade.

## Mais informações

* Relacionado: ADR-0009 (multi-tenant), ADR-0006 (baseline de segurança),
  identidade padrão em `docs/marca/rgruber/README.md`.
* Pendente: ADR de armazenamento de arquivos (logos e documentos).
* Adendo (2026-11-18): **implementação na V1**, com escolhas do responsável
  entre alternativas com prós e contras:
  1. **Escopo:** item 6 completo numa etapa (nome de exibição, logos para
     fundo claro e escuro, ícone da aba, cores com contraste e fonte).
  2. **Formatos de imagem:** só PNG, JPG ou WebP, decodificados e
     regravados pelo servidor em PNG (transparência mantida, sem metadados,
     tamanho limitado). **SVG fica para depois** (backlog), por exigir
     higienização. PNG porque a imagem também vai embutida nos e-mails.
  3. **Tela de entrada do tenant:** logo do tenant no topo, nome do produto
     grande e o nome de exibição menor embaixo. Sem logo para fundo escuro,
     a de fundo claro aparece sobre uma placa clara.
  4. **E-mails:** nome de exibição, cor primária no botão e **logo embutido
     no próprio e-mail** (anexo "inline", sem link externo); sempre com
     versão em texto puro.
  * Detalhes: as imagens da marca são públicas (aparecem antes do login),
    servidas só se forem as atuais de um tenant ativo; o nome de exibição
    prevalece sobre o nome do cadastro (que só a RGRUBER altera); a cor
    primária precisa de contraste 4,5:1 sobre o branco e a de destaque,
    3:1; os demais tons (texto sobre a cor, fundo da tela de entrada) são
    derivados; a fonte é escolhida entre Manrope (padrão), Inter, Roboto,
    Open Sans, Montserrat e Lato
    (acrescentada a pedido, por ser a do site do tenant piloto); "restaurar padrão" volta cores e fonte.
  * Rodapé: a regra 8 foi ajustada em 2026-11-18 para "Copyright by" +
    logo discreta da RGRUBER, a mesma em todos os tenants.
  * Fica para depois: título da aba com o nome do tenant (hoje só o ícone
    muda) e logo em SVG.
