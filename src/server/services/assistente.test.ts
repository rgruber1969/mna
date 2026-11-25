import { describe, expect, it } from "vitest";
import { termoDaBusca, tipoDaPergunta } from "./assistente";

describe("assistente simulado: entender a pergunta", () => {
  it.each([
    ["Quais negócios estão atrasados?", "atrasados"],
    ["Quais são as minhas tarefas?", "tarefas"],
    ["Há pedidos de documentos pendentes?", "pedidos"],
    ["Qual o valor da carteira?", "carteira"],
    ["Documentos sobre receita", "documentos"],
    ["ofertas do Jatobá", "ofertas"],
    ["quando é o closing do N-0001?", "closing"],
    ["Como está o Cedro?", "negocio"],
    ["bom dia", "ajuda"],
  ])("%s → %s", (pergunta, tipo) => {
    expect(tipoDaPergunta(pergunta)).toBe(tipo);
  });

  it("extrai o termo procurado como foi digitado, sem o negócio citado", () => {
    expect(termoDaBusca("Documentos sobre balanço")).toBe("balanço");
    expect(termoDaBusca("documentos que citam multa no Jatobá?")).toBe("multa");
    expect(termoDaBusca("quais são as tarefas")).toBe("");
  });
});
