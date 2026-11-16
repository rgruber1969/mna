# Identidade visual RGRUBER (tema padrão)

Tema padrão das aplicações da RGRUBER Consultoria. Em aplicações white
label, cada tenant pode sobrescrever logomarca, nome e cores dentro dos
limites definidos pela plataforma.

**Fonte oficial (decidida em 2026-11-16):** paleta dos arquivos vetoriais
da marca (v2) e do site rgruber.com.br, com tipografia Manrope. O
`manual_marca_rgruber.pdf` (paleta `#0F172A`/`#0284C7`) **não** é a
referência.

## Cores

| Token | Nome | HEX | Uso | Contraste sobre branco |
|---|---|---|---|---|
| `brand-primary` | Azul principal | `#123E7A` | Marca, cabeçalhos, botões principais, texto de destaque | 10,5:1 (AA e AAA) |
| `brand-secondary` | Azul secundário | `#5E8FD3` | Destaques, ícones, elementos gráficos, foco | **3,3:1: não usar em texto normal**; só texto grande (≥ 24 px, ou ≥ 19 px negrito) e elementos não textuais |
| `brand-gray` | Cinza | `#5E6470` | Texto secundário, legendas | 6,0:1 (AA) |
| `brand-white` | Branco | `#FFFFFF` | Fundos | n/a |
| `brand-navy-dark` | Azul noite (site) | `#021B3A` | Fundos escuros pontuais (login, telas de destaque) | n/a |

Escalas de tons (hover, bordas, fundos suaves) são derivadas dessas cores
no design system; não acrescentar cores fora da paleta sem decisão.

## Tipografia

* **Manrope** (Google Fonts, licença SIL Open Font License, uso comercial
  livre) para interface e títulos.
* Espaçamento entre linhas de 1,25× a 1,5× em blocos de texto.
* O logotipo é vetorizado (curvas); não depende de fonte instalada.

## Regras de aplicação

* **Sem degradês** em qualquer elemento da identidade: cores em blocos
  sólidos.
* **Fundo predominantemente claro** nas telas de trabalho; o azul principal
  dá peso e o secundário funciona como foco.
* **Área de proteção do logotipo:** margem livre igual à altura do "R".
* **Tamanho mínimo do logotipo:** 120 px de largura em tela.
* **Não** alterar cores, distorcer, aplicar efeitos, trocar a tipografia ou
  remontar o logotipo; o símbolo isolado é a única parte permitida sozinha.

## Arquivos

| Situação | Arquivo |
|---|---|
| Logotipo sobre fundo claro | `svg/rgruber-horizontal-positiva.svg` |
| Logotipo sobre fundo escuro | `svg/rgruber-horizontal-negativa.svg` |
| Uma cor só | `svg/rgruber-horizontal-{azul-solido,branca,preta,cinza}.svg` |
| Ícone de aplicativo, avatar | `svg/rgruber-icone-fundo-azul.svg`, `svg/rgruber-icone-transparente.svg` |
| Símbolo "R" isolado (menu recolhido, marca d'água) | `svg/rgruber-simbolo-{azul,branco,cinza,preto}.svg` |
| Favicon e ícone iOS | `icone/favicon.ico`, `icone/apple-touch-icon-180px.png` |

Os arquivos são o redesenho vetorial v2 da marca (curvas puras, logotipo em
Urbanist no lugar da Avenir Next, que é licenciada). Origem: pacote
`Marca.zip` da RGRUBER (pasta `Vetorial/`). Na criação do projeto, os
arquivos usados pela aplicação são copiados para `public/`.
