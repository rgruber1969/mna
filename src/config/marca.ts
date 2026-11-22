/**
 * Identidade visual por tenant (white label, ADR-0010): cálculos puros, usados
 * no servidor (validação, CSS, e-mails) e no navegador (prévia ao vivo).
 *
 * O tenant escolhe só a cor primária, a cor de destaque e a fonte; os demais
 * tons são derivados aqui, e a legibilidade é verificada (WCAG AA) ao salvar.
 */

import type { ErroDeServico } from "@/i18n/servidor";

/** Tokens do tema padrão (identidade RGRUBER); espelham `src/app/globals.css`. */
export const TOKENS_PADRAO = {
  primaria: "#123e7a",
  destaque: "#5e8fd3",
  fundo: "#ffffff",
  texto: "#0f172a",
  textoClaro: "#ffffff",
  fundoDeDestaque: "#021b3a",
} as const;

/** Fontes testadas, carregadas em `src/app/layout.tsx` (lista curta, ADR-0010). */
export const FONTES = [
  { id: "manrope", nome: "Manrope", variavel: "--font-manrope" },
  { id: "inter", nome: "Inter", variavel: "--font-inter" },
  { id: "roboto", nome: "Roboto", variavel: "--font-roboto" },
  { id: "open-sans", nome: "Open Sans", variavel: "--font-open-sans" },
  { id: "montserrat", nome: "Montserrat", variavel: "--font-montserrat" },
  { id: "lato", nome: "Lato", variavel: "--font-lato" },
] as const;

export type FonteId = (typeof FONTES)[number]["id"];

export const fonteValida = (id: string | null | undefined): id is FonteId => FONTES.some((f) => f.id === id);

/** Contraste mínimo de texto normal (WCAG AA). */
export const CONTRASTE_TEXTO = 4.5;
/** Contraste mínimo de elementos gráficos e destaques (WCAG AA, 1.4.11). */
export const CONTRASTE_GRAFICO = 3;

export const corValida = (cor: string | null | undefined): cor is string =>
  typeof cor === "string" && /^#[0-9a-f]{6}$/i.test(cor);

type Rgb = [number, number, number];

function paraRgb(cor: string): Rgb {
  const n = parseInt(cor.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function paraHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Mistura `cor` com `outra` (0 = só `cor`; 1 = só `outra`). */
export function misturar(cor: string, outra: string, quanto: number): string {
  const a = paraRgb(cor);
  const b = paraRgb(outra);
  return paraHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * quanto) as Rgb);
}

function luminancia(cor: string): number {
  const [r, g, b] = paraRgb(cor).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste entre duas cores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Texto mais legível sobre a cor: branco ou o texto escuro do tema. */
export function textoSobre(cor: string): string {
  return contraste(cor, TOKENS_PADRAO.textoClaro) >= contraste(cor, TOKENS_PADRAO.texto)
    ? TOKENS_PADRAO.textoClaro
    : TOKENS_PADRAO.texto;
}

export type Cores = { primaria: string; destaque: string };

/**
 * Problemas de legibilidade das cores escolhidas (vazio = aceitas). Cada um é
 * uma chave das mensagens (traduzida onde é exibida) com seus parâmetros.
 */
export function problemasDeContraste({ primaria, destaque }: Cores): ErroDeServico[] {
  const problemas: ErroDeServico[] = [];
  if (!corValida(primaria) || !corValida(destaque)) return [{ erro: "administracao.erros.formatoDeCor" }];
  const primariaNoFundo = contraste(primaria, TOKENS_PADRAO.fundo);
  if (primariaNoFundo < CONTRASTE_TEXTO)
    problemas.push({
      erro: "administracao.erros.contrastePrimaria",
      parametros: { razao: primariaNoFundo.toFixed(1), minimo: String(CONTRASTE_TEXTO) },
    });
  if (contraste(primaria, textoSobre(primaria)) < CONTRASTE_TEXTO)
    problemas.push({ erro: "administracao.erros.contrasteSemTexto" });
  const destaqueNoFundo = contraste(destaque, TOKENS_PADRAO.fundo);
  if (destaqueNoFundo < CONTRASTE_GRAFICO)
    problemas.push({
      erro: "administracao.erros.contrasteDestaque",
      parametros: { razao: destaqueNoFundo.toFixed(1), minimo: String(CONTRASTE_GRAFICO) },
    });
  return problemas;
}

/** Variáveis CSS do tema do tenant (sobrescrevem as de `globals.css`). */
export function variaveisDoTema(cores: Partial<Cores>, fonte?: string | null): Record<string, string> {
  const v: Record<string, string> = {};
  if (corValida(cores.primaria)) {
    v["--primary"] = cores.primaria;
    v["--primary-foreground"] = textoSobre(cores.primaria);
    // Fundo das telas de destaque (login): a primária bem escurecida.
    v["--backdrop"] = misturar(cores.primaria, "#000000", 0.7);
    v["--backdrop-foreground"] = TOKENS_PADRAO.textoClaro;
  }
  if (corValida(cores.destaque)) {
    v["--accent"] = cores.destaque;
    v["--accent-foreground"] = textoSobre(cores.destaque);
  }
  const f = FONTES.find((x) => x.id === fonte);
  if (f && f.id !== "manrope") v["--fonte-marca"] = `var(${f.variavel})`;
  return v;
}

/** Fundo dos cartões no tema escuro (espelha `--background` escuro de globals.css). */
export const FUNDO_ESCURO = "#151c2c";

/** Clareia a cor até ter contraste de texto sobre o fundo escuro (tema escuro). */
export function clarearParaFundoEscuro(cor: string, minimo = CONTRASTE_TEXTO): string {
  for (let q = 0; q <= 1; q += 0.05) {
    const c = misturar(cor, "#ffffff", q);
    if (contraste(c, FUNDO_ESCURO) >= minimo) return c;
  }
  return "#ffffff";
}

/** Variáveis do tenant no tema escuro: as mesmas cores, clareadas para manter a legibilidade. */
export function variaveisDoTemaEscuro(cores: Partial<Cores>): Record<string, string> {
  const v: Record<string, string> = {};
  if (corValida(cores.primaria)) {
    const p = clarearParaFundoEscuro(cores.primaria);
    v["--primary"] = p;
    v["--primary-foreground"] = textoSobre(p);
    v["--backdrop"] = misturar(cores.primaria, "#000000", 0.82);
  }
  if (corValida(cores.destaque)) {
    const d = clarearParaFundoEscuro(cores.destaque, CONTRASTE_GRAFICO);
    v["--accent"] = d;
    v["--accent-foreground"] = textoSobre(d);
  }
  return v;
}

const bloco = (seletor: string, v: Record<string, string>) => {
  const linhas = Object.entries(v).map(([k, valor]) => `${k}:${valor}`);
  return linhas.length ? `${seletor}{${linhas.join(";")}}` : "";
};

/** CSS com as variáveis do tenant nos dois temas (vazio = tema padrão). */
export function cssDoTema(cores: Partial<Cores>, fonte?: string | null): string {
  return (
    bloco(
      ':root,:root[data-tema="escuro"][data-menu-invertido="sim"] [data-menu-lateral]',
      variaveisDoTema(cores, fonte),
    ) +
    bloco(
      ':root[data-tema="escuro"],:root[data-tema="claro"][data-menu-invertido="sim"] [data-menu-lateral]',
      variaveisDoTemaEscuro(cores),
    )
  );
}

/** Endereço público de uma imagem da marca; o nome do arquivo muda a cada envio (sem cache antigo). */
export function enderecoDaImagem(tenantId: string, chave: string | null): string | null {
  if (!chave) return null;
  return `/api/marca/${tenantId}/${chave.split("/").pop()}`;
}
