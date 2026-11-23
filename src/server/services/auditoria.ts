import { and, count, desc, eq, gte, inArray, like, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { limites, type Pagina, type PedidoDePagina } from "@/config/paginacao";
import { comTenant } from "@/server/db/cliente";
import { deal, eventoAuditoria, tenant, usuario, vinculoTenant } from "@/server/db/esquema";
import { banco } from "@/server/db/cliente";
import { exigirAdministrador, type Acesso } from "./acesso";
import { auditar } from "./empresas";
import { tradutor, type ErroDeServico } from "@/i18n/servidor";
import { estaLigada } from "@/config/funcionalidades";
import { pdfDeTexto } from "@/server/arquivos/pdf-simples";
import { planilhaSimples } from "@/server/arquivos/planilha-simples";
import { nomeVisivel } from "./negocios";
import { exigirPermissao } from "./permissoes/verificador";

/**
 * Consulta da auditoria (item 20; dados-pessoais.md, "Auditoria"): quem tem
 * a permissão "Auditoria × ver" (ou é administrador do tenant) consulta os
 * eventos do próprio tenant, do mais recente ao mais antigo, com filtros por
 * período, assunto, pessoa e negócio. Os eventos não guardam dados pessoais
 * no conteúdo (só IDs e códigos); a tela mostra o nome de quem fez e do
 * negócio a partir dos IDs, para quem já pode consultar.
 */

export const ORDENS_DA_AUDITORIA = ["ocorridoEm"] as const;
export type OrdemDaAuditoria = (typeof ORDENS_DA_AUDITORIA)[number];

export type EventoNaTela = {
  id: string;
  ocorridoEm: string;
  tipo: string;
  /** Assunto: a primeira parte do tipo (ex.: "negocio", "documento", "acesso"). */
  assunto: string;
  ator: string | null;
  alvoTipo: string | null;
  alvoId: string | null;
  /** Nome do negócio, quando o evento é de um negócio. */
  negocio: string | null;
  detalhes: Record<string, string | number | boolean | null>;
};

const uuid = z.uuid();
const dataValida = (v?: string) =>
  v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;

export type FiltroDaAuditoria = {
  de?: string;
  ate?: string;
  assunto?: string;
  ator?: string;
  negocio?: string;
};

function condicoes(f: FiltroDaAuditoria) {
  const de = dataValida(f.de);
  const ate = dataValida(f.ate);
  const assunto = f.assunto && /^[a-z_]+$/.test(f.assunto) ? f.assunto : null;
  return and(
    de ? gte(eventoAuditoria.ocorridoEm, new Date(`${de}T00:00:00-03:00`)) : undefined,
    ate
      ? lt(eventoAuditoria.ocorridoEm, new Date(new Date(`${ate}T00:00:00-03:00`).getTime() + 86_400_000))
      : undefined,
    assunto ? like(eventoAuditoria.tipo, `${assunto}.%`) : undefined,
    f.ator && uuid.safeParse(f.ator).success ? eq(eventoAuditoria.atorId, f.ator) : undefined,
    f.negocio && uuid.safeParse(f.negocio).success
      ? and(eq(eventoAuditoria.alvoTipo, "deal"), eq(eventoAuditoria.alvoId, f.negocio))
      : undefined,
  );
}

export async function paginaDaAuditoria(
  acesso: Acesso | null,
  filtro: FiltroDaAuditoria,
  pedido: PedidoDePagina<OrdemDaAuditoria>,
): Promise<Pagina<EventoNaTela>> {
  const a = await exigirPermissao(acesso, "auditoria", "ver");
  const onde = condicoes(filtro);
  return comTenant(a.tenant.id, async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(eventoAuditoria).where(onde);
    const { limite, deslocamento, pagina } = limites(pedido, total);
    const linhas = await tx
      .select()
      .from(eventoAuditoria)
      .where(onde)
      .orderBy(pedido.direcao === "asc" ? eventoAuditoria.ocorridoEm : desc(eventoAuditoria.ocorridoEm))
      .limit(limite)
      .offset(deslocamento);
    const atores = [...new Set(linhas.flatMap((l) => (l.atorId ? [l.atorId] : [])))];
    const negocios = [
      ...new Set(linhas.flatMap((l) => (l.alvoTipo === "deal" && l.alvoId ? [l.alvoId] : []))),
    ];
    const [nomes, deals] = await Promise.all([
      atores.length
        ? tx.select({ id: usuario.id, nome: usuario.name }).from(usuario).where(inArray(usuario.id, atores))
        : [],
      negocios.length
        ? tx
            .select({ id: deal.id, numero: deal.numero, codinome: deal.codinome })
            .from(deal)
            .where(inArray(deal.id, negocios))
        : [],
    ]);
    const nomeDe = new Map(nomes.map((n) => [n.id, n.nome]));
    const negocioDe = new Map(deals.map((d) => [d.id, nomeVisivel(d.numero, d.codinome)]));
    return {
      itens: linhas.map((l) => ({
        id: l.id,
        ocorridoEm: l.ocorridoEm.toISOString(),
        tipo: l.tipo,
        assunto: l.tipo.split(".")[0],
        ator: l.atorId ? (nomeDe.get(l.atorId) ?? null) : null,
        alvoTipo: l.alvoTipo,
        alvoId: l.alvoId,
        negocio: l.alvoTipo === "deal" && l.alvoId ? (negocioDe.get(l.alvoId) ?? null) : null,
        detalhes: l.detalhes ?? {},
      })),
      total,
      pagina,
      porPagina: limite,
    };
  });
}

/** Opções dos filtros: assuntos presentes, pessoas do tenant e negócios. */
export async function opcoesDaAuditoria(acesso: Acesso | null) {
  const a = await exigirPermissao(acesso, "auditoria", "ver");
  return comTenant(a.tenant.id, async (tx) => {
    const [assuntos, pessoas, negocios] = await Promise.all([
      tx
        .selectDistinct({ assunto: sql<string>`split_part(${eventoAuditoria.tipo}, '.', 1)` })
        .from(eventoAuditoria),
      tx
        .select({ id: usuario.id, nome: usuario.name })
        .from(vinculoTenant)
        .innerJoin(usuario, eq(usuario.id, vinculoTenant.usuarioId))
        .where(eq(vinculoTenant.tenantId, a.tenant.id))
        .orderBy(usuario.name),
      tx
        .select({ id: deal.id, numero: deal.numero, codinome: deal.codinome })
        .from(deal)
        .orderBy(deal.numero),
    ]);
    return {
      assuntos: assuntos.map((x) => x.assunto).sort(),
      pessoas,
      negocios: negocios.map((d) => ({ id: d.id, nome: nomeVisivel(d.numero, d.codinome) })),
    };
  });
}

/** Retenção da auditoria do tenant, em meses (definida pela RGRUBER no console). */
export async function retencaoDaAuditoria(
  acesso: Acesso | null,
): Promise<{ meses: number; antigos: number }> {
  const a = await exigirPermissao(acesso, "auditoria", "ver");
  const [t] = await banco()
    .select({ meses: tenant.retencaoAuditoriaMeses })
    .from(tenant)
    .where(eq(tenant.id, a.tenant.id));
  const meses = t?.meses ?? 60;
  const limite = new Date();
  limite.setMonth(limite.getMonth() - meses);
  const [{ antigos }] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ antigos: count() }).from(eventoAuditoria).where(lt(eventoAuditoria.ocorridoEm, limite)),
  );
  return { meses, antigos };
}

/**
 * Limpeza da auditoria com exportação (item 21, **simulada**): o
 * administrador exporta em PDF ou XLSX os eventos mais antigos que a
 * retenção, que seriam apagados. Na demonstração, a exportação traz esses
 * eventos (ou linhas de exemplo, se não houver), com a marca de
 * demonstração, e **nada é apagado**. Só administradores; auditado.
 */
export async function exportarLimpezaDaAuditoria(
  acesso: Acesso | null,
  formato: "pdf" | "xlsx",
): Promise<{ nome: string; conteudo: string; tipo: string } | ErroDeServico> {
  const a = exigirAdministrador(acesso);
  if (!estaLigada("limpezaDeAuditoria")) return { erro: "auditoria.erros.desligada" };
  const { meses } = await retencaoDaAuditoria(a);
  const limite = new Date();
  limite.setMonth(limite.getMonth() - meses);
  const antigos = await comTenant(a.tenant.id, (tx) =>
    tx
      .select()
      .from(eventoAuditoria)
      .where(lt(eventoAuditoria.ocorridoEm, limite))
      .orderBy(eventoAuditoria.ocorridoEm)
      .limit(500),
  );
  const tr = await tradutor();
  const t = (k: string, p?: Record<string, string | number>) => tr(`auditoria.exportacao.${k}`, p);
  const data = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const linhas: string[][] = antigos.length
    ? antigos.map((e) => [data(e.ocorridoEm), e.tipo, e.atorId ?? "", e.alvoTipo ?? "", e.alvoId ?? ""])
    : [[t("exemplo"), "negocio.criado", "—", "deal", "—"]];
  await auditar(a, "auditoria.exportada", "tenant", a.tenant.id, {
    formato,
    eventos: antigos.length,
    simulada: true,
  });
  const base = `auditoria-ate-${limite.toISOString().slice(0, 10)}-demonstracao`;
  if (formato === "xlsx") {
    const xlsx = planilhaSimples(t("aba"), [
      [t("demonstracao", { meses })],
      [t("colQuando"), t("colEvento"), t("colQuem"), t("colAlvo"), t("colId")],
      ...linhas,
    ]);
    return {
      nome: `${base}.xlsx`,
      conteudo: Buffer.from(xlsx).toString("base64"),
      tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
  const pdf = pdfDeTexto([
    [
      t("demonstracao", { meses }),
      t("periodo", { data: data(limite) }),
      "",
      ...linhas.slice(0, 45).map((l) => l.filter(Boolean).join("  ·  ")),
      ...(linhas.length > 45 ? ["", t("mais", { n: linhas.length - 45 })] : []),
    ],
  ]);
  return { nome: `${base}.pdf`, conteudo: Buffer.from(pdf).toString("base64"), tipo: "application/pdf" };
}
