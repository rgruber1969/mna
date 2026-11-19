import { describe, expect, it } from "vitest";
import { enderecoDaLista, lerPedido, limites, paginarEmMemoria } from "./paginacao";

describe("paginação das listas", () => {
  it("lê o pedido do endereço, sempre com valores válidos", () => {
    expect(lerPedido({}, ["nome", "email"] as const, "nome")).toEqual({
      pagina: 1,
      porPagina: 25,
      ordem: "nome",
      direcao: "asc",
    });
    expect(
      lerPedido(
        { pagina: "3", porPagina: "50", ordem: "email", direcao: "desc" },
        ["nome", "email"] as const,
        "nome",
      ),
    ).toEqual({ pagina: 3, porPagina: 50, ordem: "email", direcao: "desc" });
    expect(
      lerPedido({ pagina: "-2", porPagina: "7", ordem: "senha; drop" }, ["nome"] as const, "nome"),
    ).toEqual({
      pagina: 1,
      porPagina: 25,
      ordem: "nome",
      direcao: "asc",
    });
  });

  it("página além do fim volta para a última", () => {
    expect(limites({ pagina: 9, porPagina: 10, ordem: "x", direcao: "asc" }, 25)).toEqual({
      limite: 10,
      deslocamento: 20,
      pagina: 3,
    });
    const p = paginarEmMemoria([1, 2, 3, 4, 5], { pagina: 2, porPagina: 10, ordem: "x", direcao: "asc" });
    expect(p).toEqual({ itens: [1, 2, 3, 4, 5], total: 5, pagina: 1, porPagina: 10 });
  });

  it("monta o endereço mantendo busca e filtros", () => {
    expect(
      enderecoDaLista("/empresas", { busca: "tigre", pagina: "2" }, { pagina: null, ordem: "cnpj" }),
    ).toBe("/empresas?busca=tigre&ordem=cnpj");
  });
});
