import { describe, expect, it } from "vitest";
import { lerPlanilha } from "@/server/arquivos/planilha-leitura";
import { planilhaComAbas } from "@/server/arquivos/planilha-simples";
import {
  diasEmAberto,
  lerData,
  lerSituacao,
  lerTipo,
  linhaDoCabecalho,
  mapearColunas,
  painelDoPedido,
  situacaoGeral,
} from "./pedidos";

describe("pedidos de documentos", () => {
  it("situação geral a partir das situações por período", () => {
    const p = ["2023", "2024"];
    expect(situacaoGeral({}, p)).toBe("pendente");
    expect(situacaoGeral({ "2023": "entregue" }, p)).toBe("parcial");
    expect(situacaoGeral({ "2023": "entregue", "2024": "aprovado" }, p)).toBe("entregue");
    expect(situacaoGeral({ "2023": "aprovado", "2024": "nao_aplicavel" }, p)).toBe("aprovado");
    expect(situacaoGeral({ "2023": "em_analise", "2024": "entregue" }, p)).toBe("em_analise");
    expect(situacaoGeral({ "2023": "nao_aplicavel", "2024": "nao_aplicavel" }, p)).toBe("nao_aplicavel");
    expect(situacaoGeral({ "": "entregue" }, [])).toBe("entregue");
  });

  it("dias em aberto e painel por assunto", () => {
    expect(diasEmAberto("2026-11-01", null, "2026-11-11")).toBe(10);
    expect(diasEmAberto("2026-11-01", "2026-11-03", "2026-11-11")).toBe(2);
    const p = painelDoPedido([
      { assunto: "Fiscal", situacao: "pendente" },
      { assunto: "Fiscal", situacao: "entregue" },
      { assunto: "Contábil", situacao: "pendente" },
    ]);
    expect(p.assuntos).toEqual(["Fiscal", "Contábil"]);
    expect(p.porAssunto.Fiscal.pendente).toBe(1);
    expect(p.total.pendente).toBe(2);
  });

  it("reconhece colunas, períodos, situações, tipos e datas da planilha do solicitante", () => {
    const m = mapearColunas([
      "Item",
      "Grupo",
      "Documento solicitado",
      "Prioridade",
      "2023",
      "Data-base",
      "Observações",
    ]);
    expect(m.campos).toMatchObject({
      codigo: 0,
      grupo: 1,
      descricao: 2,
      prioridade: 3,
      observacaoSolicitante: 6,
    });
    expect(m.periodos).toEqual({ 4: "2023", 5: "Data-base" });
    expect(linhaDoCabecalho([["Lista de diligência"], [], ["Nº", "Descrição", "Status"]])).toBe(2);
    expect(lerSituacao("N/A")).toBe("nao_aplicavel");
    expect(lerSituacao("Entregue")).toBe("entregue");
    expect(lerSituacao("Parcialmente pendente")).toBe("parcial");
    expect(lerSituacao("Pendente")).toBe("pendente");
    expect(lerTipo("", "Há processos judiciais?")).toBe("pergunta");
    expect(lerData("05/03/2026")).toBe("2026-03-05");
    expect(lerData("46000")).toBe("2025-12-09");
  });

  it("grava e lê de volta uma planilha com várias abas", () => {
    const xlsx = planilhaComAbas([
      {
        nome: "Fiscal",
        linhas: [
          ["Item", "Descrição"],
          ["1.1", "Certidão & CND <federal>"],
        ],
      },
      {
        nome: "Contábil",
        linhas: [
          ["Item", "Descrição"],
          ["2.1", "Balancetes"],
        ],
      },
    ]);
    const abas = lerPlanilha(xlsx);
    expect(abas.map((a) => a.nome)).toEqual(["Fiscal", "Contábil"]);
    expect(abas[0].linhas[1]).toEqual(["1.1", "Certidão & CND <federal>"]);
  });
});
