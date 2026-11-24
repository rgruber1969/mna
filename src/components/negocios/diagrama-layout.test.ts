import { describe, expect, it } from "vitest";
import { CABECALHO, montarDiagrama, type EtapaDoDiagrama } from "./diagrama-layout";

const etapa = (
  id: string,
  dependeDeId: string | null,
  subetapas: EtapaDoDiagrama[] = [],
): EtapaDoDiagrama => ({
  id,
  nome: id,
  situacao: "nao_iniciada",
  inicioPrevisto: null,
  fimPrevisto: null,
  inicioReal: null,
  fimReal: null,
  dependeDeId,
  dependeDe: null,
  subetapas,
});

describe("diagrama das etapas (item 10)", () => {
  it("depende da anterior → próxima coluna; sem dependência → em paralelo, na mesma coluna", () => {
    const { caixas, largura, altura } = montarDiagrama([
      etapa("a", null),
      etapa("b", "a"),
      etapa("c", null),
      etapa("d", "b", [etapa("d1", null), etapa("d2", null)]),
    ]);
    expect(caixas.map((c) => c.coluna)).toEqual([0, 1, 1, 2]);
    const [, b, c, d] = caixas;
    expect(c.x).toBe(b.x);
    expect(c.y).toBeGreaterThan(b.y + b.altura);
    expect(d.altura).toBeGreaterThan(CABECALHO);
    expect(largura).toBeGreaterThan(d.x);
    expect(altura).toBeGreaterThan(c.y + c.altura);
  });

  it("dependência de etapa que vem depois não quebra o desenho", () => {
    const { caixas } = montarDiagrama([etapa("a", null), etapa("b", "z")]);
    expect(caixas.map((c) => c.coluna)).toEqual([0, 1]);
  });
});
