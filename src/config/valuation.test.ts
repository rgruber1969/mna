import { describe, expect, it } from "vitest";
import {
  METODOS,
  VALUATION_DE_EXEMPLO,
  evPorFluxoDeCaixa,
  ponderar,
  resultadoDoValuation,
} from "./valuation";

describe("valuation de demonstração (item 18)", () => {
  const v = VALUATION_DE_EXEMPLO;
  const r = resultadoDoValuation(v);

  it("pesos somam 100% e o ponderado fica entre o menor e o maior método", () => {
    expect(r.somaDosPesos).toBe(100);
    const valores = METODOS.map((m) => r.valores[m]);
    expect(r.ponderado).toBeGreaterThan(Math.min(...valores));
    expect(r.ponderado).toBeLessThan(Math.max(...valores));
    expect(
      ponderar(r.valores, { dcf: 100, multiplos: 0, transacoes: 0, patrimonial: 0, regraDeBolso: 0 }),
    ).toBe(r.valores.dcf);
  });

  it("números fictícios coerentes: ponderado dentro da faixa mínimo–máximo", () => {
    expect(r.ponderado).toBeGreaterThan(v.faixa.minimo);
    expect(r.ponderado).toBeLessThan(v.faixa.maximo);
  });

  it("cenários em ordem e sensibilidade cai com WACC maior e sobe com crescimento maior", () => {
    expect(r.cenarios.pessimista).toBeLessThan(r.cenarios.base);
    expect(r.cenarios.base).toBeCloseTo(r.ponderado, 6);
    expect(r.cenarios.otimista).toBeGreaterThan(r.cenarios.base);
    const s = r.sensibilidade.valores;
    expect(s[0][2]).toBeGreaterThan(s[4][2]);
    expect(s[2][4]).toBeGreaterThan(s[2][0]);
    expect(s[2][2]).toBeCloseTo(evPorFluxoDeCaixa(v) - v.dividaLiquida - v.contingencias, 6);
  });

  it("rateio entre vendedoras soma o ponderado", () => {
    expect(r.rateio.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(r.ponderado, 6);
    expect(r.rateio.map((x) => x.percentual)).toEqual([70, 30]);
  });
});
