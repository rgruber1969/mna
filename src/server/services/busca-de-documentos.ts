import { sql } from "drizzle-orm";
import { z } from "zod";
import type { ErroDeServico } from "@/i18n/servidor";
import { comTenant } from "@/server/db/cliente";
import { exigirTenant, type Acesso } from "./acesso";
import { dataRoomDoNegocio } from "./documentos";
import { auditar } from "./empresas";
import { nomeVisivel } from "./negocios";

/**
 * Busca de documentos (escopo-v1.md, item 35; ADR-0022): pelo nome (título
 * ou arquivo, parte do texto, sem acentos) ou pelo conteúdo (índice em
 * português), no geral ou num negócio. O banco acha os candidatos; o
 * resultado passa pelas mesmas regras de visibilidade da lista de
 * documentos (versão por versão).
 */

export type ResultadoDaBusca = {
  dealId: string;
  negocio: string;
  documentoId: string;
  titulo: string;
  versaoId: string;
  numero: number;
  nomeArquivo: string;
  etapa: string | null;
  /** Achou no nome (título/arquivo) e/ou no conteúdo. */
  noNome: boolean;
  noConteudo: boolean;
  /** Trecho do conteúdo com o termo entre « e ». */
  trecho: string | null;
  criadoEm: string;
};

const MAXIMO_DE_CANDIDATOS = 300;
const uuidValido = (id: string) => z.uuid().safeParse(id).success;

type Linha = {
  versao_id: string;
  numero: number;
  nome_arquivo: string;
  criado_em: Date;
  documento_id: string;
  titulo: string;
  deal_id: string;
  deal_numero: number;
  codinome: string;
  no_nome: boolean;
  no_conteudo: boolean;
  trecho: string | null;
};

export async function buscarDocumentos(
  acesso: Acesso | null,
  pedido: { termo: string; dealId?: string | null },
): Promise<{ resultados: ResultadoDaBusca[] } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const termo = pedido.termo.trim().slice(0, 200);
  if (termo.length < 2) return { erro: "busca.erros.termoCurto" };
  const dealId = pedido.dealId && uuidValido(pedido.dealId) ? pedido.dealId : null;
  const parte = `%${termo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx.execute<Linha>(sql`
      with q as (select websearch_to_tsquery('portuguese', unaccent(${termo})) as q)
      select v.id as versao_id, v.numero, v.nome_arquivo, v.criado_em,
        d.id as documento_id, d.titulo, d.deal_id, n.numero as deal_numero, n.codinome,
        (unaccent(d.titulo) ilike unaccent(${parte}) or unaccent(v.nome_arquivo) ilike unaccent(${parte})) as no_nome,
        coalesce(t.busca @@ q.q, false) as no_conteudo,
        case when t.busca @@ q.q then ts_headline('portuguese', t.texto, q.q,
          'StartSel=«, StopSel=», MaxWords=30, MinWords=12, MaxFragments=2, FragmentDelimiter=" … "') end as trecho
      from documento_versao v
      join documento d on d.id = v.documento_id
      join deal n on n.id = d.deal_id
      left join documento_texto t on t.versao_id = v.id
      cross join q
      where v.situacao = 'disponivel'
        and (${dealId}::uuid is null or d.deal_id = ${dealId}::uuid)
        and (unaccent(d.titulo) ilike unaccent(${parte})
          or unaccent(v.nome_arquivo) ilike unaccent(${parte})
          or t.busca @@ q.q)
      order by no_nome desc, coalesce(ts_rank(t.busca, q.q), 0) desc, v.criado_em desc
      limit ${MAXIMO_DE_CANDIDATOS}`),
  );
  // Visibilidade: só as versões que a pessoa vê na lista de documentos de cada negócio.
  const porNegocio = new Map<string, { versoes: Set<string>; etapa: Map<string, string | null> } | null>();
  for (const id of new Set(linhas.rows.map((l) => l.deal_id))) {
    const dr = await dataRoomDoNegocio(a, id).catch(() => null);
    porNegocio.set(
      id,
      dr && {
        versoes: new Set(dr.documentos.flatMap((d) => d.versoes.map((v) => v.id))),
        etapa: new Map(dr.documentos.map((d) => [d.id, d.etapa])),
      },
    );
  }
  const resultados = linhas.rows
    .filter((l) => porNegocio.get(l.deal_id)?.versoes.has(l.versao_id))
    .map((l) => ({
      dealId: l.deal_id,
      negocio: nomeVisivel(l.deal_numero, l.codinome),
      documentoId: l.documento_id,
      titulo: l.titulo,
      versaoId: l.versao_id,
      numero: l.numero,
      nomeArquivo: l.nome_arquivo,
      etapa: porNegocio.get(l.deal_id)?.etapa.get(l.documento_id) ?? null,
      noNome: Boolean(l.no_nome),
      noConteudo: Boolean(l.no_conteudo),
      trecho: l.trecho,
      criadoEm: new Date(l.criado_em).toISOString(),
    }));
  // Sem o termo na auditoria: pode conter nome ou CPF (ADR-0022, regra 4).
  await auditar(a, "documentos.busca", "tenant", a.tenant.id, {
    resultados: resultados.length,
    porNegocio: Boolean(dealId),
  });
  return { resultados };
}
