import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import type { ErroDeServico } from "@/i18n/servidor";
import { comTenant } from "@/server/db/cliente";
import {
  deal,
  dealEmpresa,
  dealEtapa,
  empresa,
  etapaPadrao,
  participacaoDeal,
  pessoa,
  usuario,
} from "@/server/db/esquema";
import { enderecoDaFoto } from "./foto-da-conta";
import { hojeEmSaoPaulo } from "./negocios-andamento";
import type { Acesso } from "./acesso";
import { mudarSituacaoDaEtapa } from "./etapas";
import { paginaDeNegocios, visaoDoNegocio, type FiltroDeNegocios, type NegocioResumo } from "./negocios";
import { concede } from "./permissoes/catalogo";
import { exigirPermissao, permissoesNoDeal } from "./permissoes/verificador";

/**
 * Kanban de negócios (item 15; dominio.md, "Kanban de deals"): colunas = etapas
 * padrão do tenant; cada negócio fica na coluna da sua etapa principal (pela
 * etapa padrão de origem; etapa criada só no negócio conta pela etapa padrão
 * anterior a ela). Arrastar o cartão muda a etapa do negócio.
 */

export type CartaoDoQuadro = NegocioResumo & {
  colunaId: string;
  podeMover: boolean;
  /** Compradoras por situação do funil (só para quem o vê). */
  funil: Record<string, string[]> | null;
  /** Pessoas envolvidas (miniaturas no cartão). */
  pessoas: { nome: string; foto: string | null }[];
  /** Prazo estimado: fim previsto da etapa atual (ou a previsão de fechamento). */
  prazo: string | null;
  /** Cor pelo prazo: atrasado, próximo (até 7 dias), atenção (até 15), em dia; null = sem prazo. */
  nivelDoPrazo: "atrasado" | "proximo" | "atencao" | "emDia" | null;
  /** Etapas concluídas ou puladas / total (sem as subetapas). */
  progresso: { feitas: number; total: number };
};

export type Quadro = { colunas: { id: string; nome: string }[]; cartoes: CartaoDoQuadro[] };

/** Coluna dos negócios ainda sem etapa em andamento. */
export const COLUNA_A_INICIAR = "a-iniciar";

export async function quadroDeNegocios(acesso: Acesso | null, filtro: FiltroDeNegocios): Promise<Quadro> {
  const a = await exigirPermissao(acesso, "deals", "ver");
  const lista = await paginaDeNegocios(a, filtro, {
    pagina: 1,
    porPagina: 1000,
    ordem: "numero",
    direcao: "asc",
  });
  const ids = lista.itens.map((n) => n.id);
  const [padroes, etapas, compradoras] = await comTenant(a.tenant.id, async (tx) => [
    await tx
      .select({ id: etapaPadrao.id, nome: etapaPadrao.nome })
      .from(etapaPadrao)
      .where(and(isNull(etapaPadrao.paiId), eq(etapaPadrao.ativa, true)))
      .orderBy(asc(etapaPadrao.ordem)),
    ids.length
      ? await tx
          .select({
            dealId: dealEtapa.dealId,
            ordem: dealEtapa.ordem,
            situacao: dealEtapa.situacao,
            etapaPadraoId: dealEtapa.etapaPadraoId,
            fimPrevisto: dealEtapa.fimPrevisto,
          })
          .from(dealEtapa)
          .where(and(inArray(dealEtapa.dealId, ids), isNull(dealEtapa.paiId)))
          .orderBy(asc(dealEtapa.ordem))
      : [],
    ids.length
      ? await tx
          .select({
            dealId: dealEmpresa.dealId,
            situacao: dealEmpresa.situacaoFunil,
            nome: empresa.razaoSocial,
          })
          .from(dealEmpresa)
          .innerJoin(empresa, eq(empresa.id, dealEmpresa.empresaId))
          .where(and(inArray(dealEmpresa.dealId, ids), isNotNull(dealEmpresa.situacaoFunil)))
      : [],
  ]);
  const [pessoasDosNegocios, previsoes] = ids.length
    ? await comTenant(a.tenant.id, async (tx) => [
        await tx
          .selectDistinct({
            dealId: participacaoDeal.dealId,
            nome: pessoa.nome,
            usuarioId: pessoa.usuarioId,
            imagem: usuario.image,
          })
          .from(participacaoDeal)
          .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
          .leftJoin(usuario, eq(usuario.id, pessoa.usuarioId))
          .where(and(inArray(participacaoDeal.dealId, ids), isNull(participacaoDeal.cortadaEm))),
        await tx
          .select({ id: deal.id, previsao: deal.previsaoFechamento })
          .from(deal)
          .where(inArray(deal.id, ids)),
      ])
    : [[], []];
  const pessoasPor = Map.groupBy(pessoasDosNegocios, (p) => p.dealId);
  const previsaoDe = new Map(previsoes.map((p) => [p.id, p.previsao]));
  const hoje = hojeEmSaoPaulo();
  const nivel = (prazo: string | null): CartaoDoQuadro["nivelDoPrazo"] => {
    if (!prazo) return null;
    const dias = Math.round(
      (Date.parse(`${prazo}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000,
    );
    return dias < 0 ? "atrasado" : dias <= 7 ? "proximo" : dias <= 15 ? "atencao" : "emDia";
  };
  const ativas = new Set(padroes.map((p) => p.id));
  const etapasPor = Map.groupBy(etapas, (e) => e.dealId);
  const funilPor = Map.groupBy(compradoras, (c) => c.dealId);
  const cartoes: CartaoDoQuadro[] = [];
  for (const n of lista.itens) {
    const doNegocio = etapasPor.get(n.id) ?? [];
    const emAndamento = doNegocio
      .filter((e) => e.situacao === "andamento")
      .sort((x, y) => y.ordem - x.ordem)[0];
    // Etapa principal → etapa padrão de origem (ou a anterior que tenha origem ativa).
    let colunaId = COLUNA_A_INICIAR;
    if (emAndamento) {
      const ate = doNegocio.filter((e) => e.ordem <= emAndamento.ordem).reverse();
      colunaId =
        ate.find((e) => e.etapaPadraoId && ativas.has(e.etapaPadraoId))?.etapaPadraoId ?? COLUNA_A_INICIAR;
    }
    const matriz = a.administrador ? null : await permissoesNoDeal(a, n.id);
    const { visao } = await visaoDoNegocio(a, n.id);
    const soComprador = !a.administrador && visao.lados.has("comprador") && !visao.lados.has("vendedor");
    let funil: Record<string, string[]> | null = null;
    const doFunil = funilPor.get(n.id) ?? [];
    if (doFunil.length) {
      if (visao.administrador || (visao.lados.has("vendedor") && concede(visao.matriz, "funil", "ver"))) {
        funil = {};
        for (const c of doFunil) (funil[c.situacao!] ??= []).push(c.nome);
      }
    }
    // Para quem vê só o codinome (antes do NDA), o cartão não mostra as pessoas.
    const pessoas =
      n.nomeInterno === null && !a.administrador
        ? []
        : (pessoasPor.get(n.id) ?? []).map((p) => ({
            nome: p.nome,
            foto: p.usuarioId ? enderecoDaFoto(p.usuarioId, p.imagem) : null,
          }));
    const prazo = emAndamento?.fimPrevisto ?? previsaoDe.get(n.id) ?? null;
    cartoes.push({
      ...n,
      colunaId,
      pessoas,
      prazo,
      nivelDoPrazo: n.situacao === "andamento" ? nivel(prazo) : null,
      progresso: {
        feitas: doNegocio.filter((e) => e.situacao === "concluida" || e.situacao === "pulada").length,
        total: doNegocio.length,
      },
      podeMover:
        (n.situacao === "andamento" || n.situacao === "suspenso") &&
        (a.administrador ||
          (concede(matriz ?? {}, "etapas", "editar") &&
            (!soComprador || concede(matriz ?? {}, "etapas", "alterarComprador")))),
      funil,
    });
  }
  return { colunas: padroes, cartoes };
}

/**
 * Arrastar o cartão para a coluna de uma etapa padrão: inicia a etapa
 * correspondente do negócio e conclui a principal atual, se ela estiver
 * antes (para trás, a atual volta a "não iniciada"). Pede confirmação na tela.
 */
export async function moverNegocioParaEtapa(
  acesso: Acesso | null,
  dealId: string,
  etapaPadraoId: string,
): Promise<{ ok: true } | ErroDeServico> {
  if (!z.uuid().safeParse(dealId).success || !z.uuid().safeParse(etapaPadraoId).success)
    return { erro: "etapas.erros.naoEncontrada" };
  const a = await exigirPermissao(acesso, "etapas", "editar", { dealId });
  const etapas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select()
      .from(dealEtapa)
      .where(and(eq(dealEtapa.dealId, dealId), isNull(dealEtapa.paiId)))
      .orderBy(asc(dealEtapa.ordem)),
  );
  const alvo = etapas.find((e) => e.etapaPadraoId === etapaPadraoId);
  if (!alvo) return { erro: "etapas.erros.etapaForaDoNegocio" };
  const atual = etapas.filter((e) => e.situacao === "andamento").sort((x, y) => y.ordem - x.ordem)[0];
  if (atual?.id === alvo.id) return { ok: true };
  if (atual) {
    const r = await mudarSituacaoDaEtapa(
      a,
      dealId,
      atual.id,
      atual.ordem < alvo.ordem ? "concluida" : "nao_iniciada",
    );
    if ("erro" in r) return r;
  }
  const r = await mudarSituacaoDaEtapa(a, dealId, alvo.id, "andamento", true);
  return "erro" in r ? r : { ok: true };
}
