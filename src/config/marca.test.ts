import { describe, expect, it } from "vitest";
import {
  TOKENS_PADRAO,
  contraste,
  cssDoTema,
  enderecoDaImagem,
  problemasDeContraste,
  textoSobre,
  variaveisDoTema,
  variaveisDoTemaEscuro,
  FUNDO_ESCURO,
} from "./marca";

/** Cálculos do white label (ADR-0010): contraste WCAG e tons derivados. */
describe("contraste", () => {
  it("segue a fórmula da WCAG", () => {
    expect(contraste("#ffffff", "#000000")).toBeCloseTo(21, 1);
    expect(contraste("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contraste("#123e7a", "#ffffff")).toBeGreaterThan(10);
  });

  it("escolhe o texto mais legível sobre a cor", () => {
    expect(textoSobre("#123e7a")).toBe(TOKENS_PADRAO.textoClaro);
    expect(textoSobre("#ffd60a")).toBe(TOKENS_PADRAO.texto);
  });
});

describe("validação das cores", () => {
  it("aceita o tema padrão", () => {
    expect(
      problemasDeContraste({ primaria: TOKENS_PADRAO.primaria, destaque: TOKENS_PADRAO.destaque }),
    ).toEqual([]);
  });

  it("recusa primária clara demais para textos e links, com explicação", () => {
    const p = problemasDeContraste({ primaria: "#ffd60a", destaque: TOKENS_PADRAO.destaque });
    expect(p).toHaveLength(1);
    expect(p[0].erro).toBe("administracao.erros.contrastePrimaria");
    expect(p[0].parametros).toMatchObject({ minimo: "4.5" });
  });

  it("recusa destaque quase invisível sobre o branco", () => {
    expect(problemasDeContraste({ primaria: TOKENS_PADRAO.primaria, destaque: "#f1f5f9" })[0].erro).toBe(
      "administracao.erros.contrasteDestaque",
    );
  });

  it("recusa formato inválido", () => {
    expect(problemasDeContraste({ primaria: "red", destaque: "#123" })).toEqual([
      { erro: "administracao.erros.formatoDeCor" },
    ]);
  });
});

describe("tema gerado", () => {
  it("deriva texto sobre a cor, fundo de destaque e fonte", () => {
    const v = variaveisDoTema({ primaria: "#7a1238", destaque: "#c2410c" }, "inter");
    expect(v).toMatchObject({
      "--primary": "#7a1238",
      "--primary-foreground": TOKENS_PADRAO.textoClaro,
      "--accent": "#c2410c",
      "--fonte-marca": "var(--font-inter)",
    });
    expect(contraste(v["--backdrop"], v["--backdrop-foreground"])).toBeGreaterThan(10);
  });

  it("aceita a Lato (fonte do site do tenant piloto)", () => {
    expect(variaveisDoTema({}, "lato")).toEqual({ "--fonte-marca": "var(--font-lato)" });
  });

  it("no tema escuro, clareia as cores do tenant até ficarem legíveis", () => {
    const css = cssDoTema({ primaria: "#7a1238", destaque: "#c2410c" });
    expect(css).toContain(':root[data-tema="escuro"]{--primary:');
    const escura = variaveisDoTemaEscuro({ primaria: "#7a1238" })["--primary"];
    expect(contraste(escura, FUNDO_ESCURO)).toBeGreaterThanOrEqual(4.5);
  });

  it("ignora valores inválidos: o CSS só leva cores #RRGGBB e fontes da lista", () => {
    expect(cssDoTema({ primaria: "red;}body{display:none" }, "comic-sans")).toBe("");
    expect(cssDoTema({}, null)).toBe("");
  });

  it("monta o endereço público da imagem só com o nome do arquivo", () => {
    expect(enderecoDaImagem("t1", "tenant/t1/marca/logo-claro-0123456789abcdef.png")).toBe(
      "/api/marca/t1/logo-claro-0123456789abcdef.png",
    );
    expect(enderecoDaImagem("t1", null)).toBeNull();
  });
});
