import { describe, expect, it } from "vitest";
import { compararTextos } from "./resumos";

/** Resumo local do histórico de documento: o que mudou entre versões (item 31). */
describe("comparar versões", () => {
  it("conta linhas novas e retiradas e aponta as cláusulas", () => {
    const v1 =
      "Cláusula 1 Objeto\nVenda de quotas.\nCláusula 4 Preço\nR$ 10 milhões.\nCláusula 7 Multa\nMulta de 10%.";
    const v2 =
      "Cláusula 1 Objeto\nVenda de quotas.\nCláusula 4 Preço\nR$ 12 milhões.\nCláusula 7 Multa\nMulta de 20%.\nCláusula 8 Foro\nSão Paulo.";
    const r = compararTextos(v1, v2);
    expect(r.adicionadas).toBe(4);
    expect(r.removidas).toBe(2);
    expect(r.secoes).toEqual(["Cláusula 4", "Cláusula 7", "Cláusula 8"]);
  });

  it("itens numerados também viram seção", () => {
    const r = compararTextos("4.1 Prazo de 30 dias", "4.1 Prazo de 60 dias");
    expect(r.secoes).toEqual(["4.1"]);
  });
});
