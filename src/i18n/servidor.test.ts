import { describe, expect, it } from "vitest";
import { tradutor, traduzirErro } from "./servidor";

describe("tradução no servidor", () => {
  it("traduz chaves das mensagens e devolve a própria chave se ela não existir", async () => {
    const t = await tradutor();
    expect(t("comum.salvar")).toBe("Salvar");
    expect(
      await traduzirErro({ erro: "notificacoes.tipos.convite_aceito", parametros: { nome: "Ana" } }),
    ).toBe("Ana aceitou o convite");
    expect(await traduzirErro({ erro: "chave.que.nao.existe" })).toBe("chave.que.nao.existe");
  });
});
