"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import { etapasDoNegocio } from "@/server/services/etapas";
import { dataRoomDoNegocio } from "@/server/services/documentos";
import { andamentoDoNegocio } from "@/server/services/negocios-andamento";
import { moverNegocioParaEtapa } from "@/server/services/negocios-kanban";

/** Kanban de negócios: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));

export async function moverNegocioParaEtapaAcao(
  dealId: string,
  etapaPadraoId: string,
): Promise<{ erro?: string }> {
  const r = await moverNegocioParaEtapa(await acesso(), dealId, etapaPadraoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

/** Dados do painel lateral do cartão: etapas do negócio e os últimos eventos. */
export async function painelDoNegocioAcao(dealId: string) {
  const a = await acesso();
  const [etapas, andamento, dataRoom] = await Promise.all([
    etapasDoNegocio(a, dealId),
    andamentoDoNegocio(a, dealId),
    dataRoomDoNegocio(a, dealId),
  ]);
  if (!andamento) return null;
  // Chave montada em tempo de execução (tipo do evento): tradutor sem tipagem estrita.
  const th = (await getTranslations("negocios.historico")) as unknown as {
    has(k: string): boolean;
    (k: string, p?: Record<string, string>): string;
  };
  const ts = await getTranslations("negocios.situacoes");
  const tf = await getTranslations("negocios.funil");
  const historico = andamento.historico.slice(0, 8).map((h) => {
    const chave = `tipos.${h.tipo.replaceAll(".", "_")}`;
    const p: Record<string, string> = { ...h.parametros };
    if (h.tipo === "negocio.situacao" && p.para) p.para = ts(p.para as never);
    if (h.tipo === "negocio.funil" && p.para) p.para = tf(p.para as never);
    return {
      texto: th.has(chave) ? th(chave, p) : h.tipo,
      detalhe: [h.ator, h.quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })]
        .filter(Boolean)
        .join(" · "),
    };
  });
  return { etapas, historico, dataRoom };
}
