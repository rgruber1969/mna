import { z } from "zod";
import type { ErroDeServico } from "@/i18n/servidor";
import { estaLigada } from "@/config/funcionalidades";
import { totalNominal } from "@/config/ofertas";
import {
  resultadoDoValuation,
  VALUATION_DE_EXEMPLO,
  type DadosDoValuation,
  type ResultadoDoValuation,
} from "@/config/valuation";
import type { Acesso } from "./acesso";
import { auditar } from "./empresas";
import { paginaDeNegocios } from "./negocios";
import { ofertasDoNegocio } from "./ofertas";
import { exigirPermissao } from "./permissoes/verificador";

/**
 * Valuation (item 18, **simulado**; dominio.md, "Valuation"): na
 * demonstração há um único valuation fictício completo (premissas, 5
 * métodos, ponderação, cenários, sensibilidade, tese do setor, faixa
 * mínimo–máximo, rateio entre vendedoras e painel). A comparação usa as
 * **ofertas reais** de um negócio que a pessoa escolhe, só as que ela já vê,
 * contra os números fictícios (com aviso na tela). Exige "Valuations × ver";
 * a consulta é auditada (dado sensível).
 */

export type OfertaParaComparar = {
  id: string;
  compradora: string;
  rodada: number;
  data: string;
  total: number;
};

export type TelaDoValuation = {
  dados: DadosDoValuation;
  resultado: ResultadoDoValuation;
  negocios: { id: string; nome: string }[];
  /** Negócio escolhido para comparar e as ofertas dele que a pessoa vê. */
  comparacao: { dealId: string; negocio: string; ofertas: OfertaParaComparar[] } | null;
};

export async function telaDoValuation(
  acesso: Acesso | null,
  dealId?: string,
): Promise<TelaDoValuation | ErroDeServico> {
  const a = await exigirPermissao(acesso, "valuations", "ver");
  if (!estaLigada("valuation")) return { erro: "valuation.erros.funcionalidadeDesligada" };
  const pagina = await paginaDeNegocios(
    a,
    {},
    { pagina: 1, porPagina: 100, ordem: "numero", direcao: "desc" },
  ).catch(() => null);
  const negocios = (pagina?.itens ?? []).map((n) => ({ id: n.id, nome: n.nome }));
  let comparacao: TelaDoValuation["comparacao"] = null;
  const escolhido =
    dealId && z.uuid().safeParse(dealId).success ? negocios.find((n) => n.id === dealId) : undefined;
  if (escolhido) {
    const ofertas = await ofertasDoNegocio(a, escolhido.id);
    comparacao = {
      dealId: escolhido.id,
      negocio: escolhido.nome,
      ofertas: (ofertas?.ofertas ?? []).map((o) => ({
        id: o.id,
        compradora: o.compradora,
        rodada: o.rodada,
        data: o.data,
        total: totalNominal(o),
      })),
    };
  }
  await auditar(
    a,
    "valuation.visualizado",
    escolhido ? "deal" : "tenant",
    escolhido ? escolhido.id : a.tenant.id,
    { valuation: "demonstracao", simulada: true },
  );
  return {
    dados: VALUATION_DE_EXEMPLO,
    resultado: resultadoDoValuation(VALUATION_DE_EXEMPLO),
    negocios,
    comparacao,
  };
}
