import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { ErroDeServico } from "@/i18n/servidor";
import { comTenant } from "@/server/db/cliente";
import {
  documento,
  eventoAuditoria,
  participacaoDeal,
  perfil,
  pessoa,
  tarefa,
  tarefaDocumento,
  tarefaItem,
  tarefaResponsavel,
  usuario,
} from "@/server/db/esquema";
import { AcessoNegado, exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import { dataRoomDoNegocio } from "./documentos";
import { auditar } from "./empresas";
import { contextoDeEtapas } from "./etapas";
import { empresasDoNegocio, ladoDaParticipacao, negocioFechado, visaoDoNegocio } from "./negocios";
import { concede, type Acao } from "./permissoes/catalogo";

/**
 * Tarefas do negócio (item 27; dominio.md, "Tarefas e pendências"; T1–T5).
 *
 * - Situações (T1): A fazer · Em andamento · Aguardando terceiros ·
 *   Concluída · Cancelada. Prioridade (T2) só para ordenar e filtrar.
 * - Responsáveis: usuários e/ou perfis; com perfil, qualquer pessoa com
 *   aquele perfil no negócio conclui, e fica registrado quem (T3).
 * - Permissões pela matriz "Tarefas" na etapa (alcance das participações).
 *   Responsável sempre muda a situação e o checklist da própria tarefa.
 * - Quem vê (decidido em 2026-11-19): o lado de quem criou, os
 *   responsáveis e os administradores; tarefas internas de um lado não
 *   aparecem para o outro.
 */

type Resultado = { ok: true } | ErroDeServico;

/** Etapas na ordem do negócio: cada etapa seguida das suas subetapas. */
export function ordenarEtapas<T extends { id: string; paiId: string | null; ordem: number }>(
  etapas: T[],
): T[] {
  return etapas
    .filter((e) => !e.paiId)
    .sort((x, y) => x.ordem - y.ordem)
    .flatMap((e) => [e, ...etapas.filter((s) => s.paiId === e.id).sort((x, y) => x.ordem - y.ordem)]);
}
export type SituacaoDaTarefa = "a_fazer" | "andamento" | "aguardando" | "concluida" | "cancelada";
export const SITUACOES_DA_TAREFA: SituacaoDaTarefa[] = [
  "a_fazer",
  "andamento",
  "aguardando",
  "concluida",
  "cancelada",
];
export const PRIORIDADES = ["baixa", "normal", "alta", "urgente"] as const;
const uuidValido = (id: string) => z.uuid().safeParse(id).success;

async function negar(a: AcessoTenant, acao: Acao, dealId: string): Promise<never> {
  await comTenant(a.tenant.id, (tx) =>
    tx.insert(eventoAuditoria).values({
      tenantId: a.tenant.id,
      tipo: "acesso.negado",
      atorId: a.usuario.id,
      alvoTipo: "recurso",
      detalhes: { recurso: "tarefas", acao, dealId },
    }),
  );
  throw new AcessoNegado();
}

/** O que a pessoa pode no negócio: matriz por etapa, lados e perfis. */
async function contexto(a: AcessoTenant, dealId: string) {
  const ctx = await contextoDeEtapas(a, dealId);
  const [lados, meusPerfis] = await Promise.all([
    visaoDoNegocio(a, dealId)
      .then((r) => r.visao.lados as Set<string>)
      .catch(() => new Set<string>()),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ perfilId: participacaoDeal.perfilId })
        .from(participacaoDeal)
        .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
        .where(
          and(
            eq(participacaoDeal.dealId, dealId),
            eq(pessoa.usuarioId, a.usuario.id),
            sql`${participacaoDeal.perfilId} is not null`,
            sql`(${participacaoDeal.prazo} is null or ${participacaoDeal.prazo} >= current_date)`,
          ),
        ),
    ).then((l) => new Set(l.map((x) => x.perfilId!))),
  ]);
  const pode = (etapaId: string | null, acao: Acao) => concede(ctx.matrizNa(etapaId), "tarefas", acao);
  return { ...ctx, lados, meusPerfis, pode };
}

type Ctx = Awaited<ReturnType<typeof contexto>>;
type Responsavel = { usuarioId: string | null; perfilId: string | null };

/**
 * Responsável: o próprio usuário, ou um perfil que a pessoa tem no negócio
 * do mesmo lado da tarefa ("Advogado" do lado vendedor não inclui o advogado
 * da compradora).
 */
function souResponsavel(a: AcessoTenant, ctx: Ctx, resp: Responsavel[], lado: string | null) {
  const mesmoLado = lado === null || ctx.lados.has(lado);
  return resp.some(
    (r) =>
      r.usuarioId === a.usuario.id || (mesmoLado && r.perfilId !== null && ctx.meusPerfis.has(r.perfilId)),
  );
}

function tarefaVisivel(
  a: AcessoTenant,
  ctx: Ctx,
  t: { criadoPor: string | null; lado: string | null; etapaId: string | null },
  resp: Responsavel[],
) {
  if (a.administrador || t.criadoPor === a.usuario.id || souResponsavel(a, ctx, resp, t.lado)) return true;
  if (!ctx.pode(t.etapaId, "ver")) return false;
  return t.lado === null || ctx.lados.has(t.lado);
}

// --- Consulta ------------------------------------------------------------------------------

export type TarefaNaTela = {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: (typeof PRIORIDADES)[number];
  prazo: string | null;
  situacao: SituacaoDaTarefa;
  etapaId: string | null;
  etapa: string | null;
  responsaveis: string[];
  responsavelIds: { usuarios: string[]; perfis: string[] };
  semResponsavel: boolean;
  concluidaPor: string | null;
  automatica: boolean;
  checklist: { id: string; texto: string; feito: boolean }[];
  documentos: { id: string; titulo: string }[];
  souResponsavel: boolean;
  podeEditar: boolean;
  podeMudarSituacao: boolean;
  podeExcluir: boolean;
};

export type QuadroDeTarefas = {
  tarefas: TarefaNaTela[];
  destinos: { id: string | null; nome: string }[];
  /** Todas as etapas do negócio (para o filtro). */
  etapas: { id: string; nome: string }[];
  opcoes: {
    usuarios: { id: string; nome: string; lado: string | null }[];
    perfis: { id: string; nome: string }[];
  };
  documentos: { id: string; titulo: string }[];
  fechado: boolean;
};

export async function tarefasDoNegocio(
  acesso: Acesso | null,
  dealId: string,
): Promise<QuadroDeTarefas | null> {
  const a = exigirTenant(acesso);
  if (!uuidValido(dealId)) return null;
  const ctx = await contexto(a, dealId);
  const fechado = Boolean(await negocioFechado(a, dealId));
  const nomeEtapa = new Map(
    ctx.etapas.map((e) => [
      e.id,
      e.paiId ? `${ctx.etapas.find((p) => p.id === e.paiId)?.nome ?? ""} › ${e.nome}` : e.nome,
    ]),
  );
  const [linhas, responsaveis, itens, docsLigados, participantes, empresas, dataRoom] = await Promise.all([
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ t: tarefa, quemConcluiu: usuario.name })
        .from(tarefa)
        .leftJoin(usuario, eq(usuario.id, tarefa.concluidaPor))
        .where(eq(tarefa.dealId, dealId)),
    ),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({
          tarefaId: tarefaResponsavel.tarefaId,
          usuarioId: tarefaResponsavel.usuarioId,
          perfilId: tarefaResponsavel.perfilId,
          usuario: usuario.name,
          perfil: perfil.nome,
        })
        .from(tarefaResponsavel)
        .innerJoin(tarefa, eq(tarefa.id, tarefaResponsavel.tarefaId))
        .leftJoin(usuario, eq(usuario.id, tarefaResponsavel.usuarioId))
        .leftJoin(perfil, eq(perfil.id, tarefaResponsavel.perfilId))
        .where(eq(tarefa.dealId, dealId)),
    ),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({
          tarefaId: tarefaItem.tarefaId,
          id: tarefaItem.id,
          texto: tarefaItem.texto,
          feito: tarefaItem.feito,
          ordem: tarefaItem.ordem,
        })
        .from(tarefaItem)
        .innerJoin(tarefa, eq(tarefa.id, tarefaItem.tarefaId))
        .where(eq(tarefa.dealId, dealId))
        .orderBy(asc(tarefaItem.ordem)),
    ),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ tarefaId: tarefaDocumento.tarefaId, documentoId: tarefaDocumento.documentoId })
        .from(tarefaDocumento)
        .innerJoin(tarefa, eq(tarefa.id, tarefaDocumento.tarefaId))
        .where(eq(tarefa.dealId, dealId)),
    ),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({
          usuarioId: pessoa.usuarioId,
          nome: pessoa.nome,
          perfilId: participacaoDeal.perfilId,
          perfil: perfil.nome,
          empresaId: participacaoDeal.empresaId,
          lado: participacaoDeal.lado,
        })
        .from(participacaoDeal)
        .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
        .innerJoin(perfil, eq(perfil.id, participacaoDeal.perfilId))
        .where(and(eq(participacaoDeal.dealId, dealId), sql`${pessoa.usuarioId} is not null`)),
    ),
    empresasDoNegocio(a, dealId),
    dataRoomDoNegocio(a, dealId),
  ]);
  const visiveisDocs = new Map((dataRoom?.documentos ?? []).map((d) => [d.id, d.titulo]));
  const respPor = Map.groupBy(responsaveis, (r) => r.tarefaId);
  const itensPor = Map.groupBy(itens, (i) => i.tarefaId);
  const docsPor = Map.groupBy(docsLigados, (d) => d.tarefaId);
  const ordem = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
  const tarefas = linhas
    .filter(({ t }) => tarefaVisivel(a, ctx, t, respPor.get(t.id) ?? []))
    .map(({ t, quemConcluiu }) => {
      const resp = respPor.get(t.id) ?? [];
      const responsavel = souResponsavel(a, ctx, resp, t.lado);
      const editar = !fechado && (a.administrador || ctx.pode(t.etapaId, "editar"));
      return {
        id: t.id,
        titulo: t.titulo,
        descricao: t.descricao,
        prioridade: t.prioridade,
        prazo: t.prazo,
        situacao: t.situacao,
        etapaId: t.etapaId,
        etapa: t.etapaId ? (nomeEtapa.get(t.etapaId) ?? null) : null,
        responsaveis: resp.map((r) => r.usuario ?? r.perfil ?? "—"),
        responsavelIds: {
          usuarios: resp.flatMap((r) => (r.usuarioId ? [r.usuarioId] : [])),
          perfis: resp.flatMap((r) => (r.perfilId ? [r.perfilId] : [])),
        },
        semResponsavel: resp.length === 0,
        concluidaPor: quemConcluiu,
        automatica: t.automatica,
        checklist: (itensPor.get(t.id) ?? []).map((i) => ({ id: i.id, texto: i.texto, feito: i.feito })),
        documentos: (docsPor.get(t.id) ?? []).flatMap((d) =>
          visiveisDocs.has(d.documentoId)
            ? [{ id: d.documentoId, titulo: visiveisDocs.get(d.documentoId)! }]
            : [],
        ),
        souResponsavel: responsavel,
        podeEditar: editar,
        podeMudarSituacao: !fechado && (editar || responsavel),
        podeExcluir: !fechado && (a.administrador || ctx.pode(t.etapaId, "excluir")),
      };
    })
    .sort(
      (x, y) =>
        Number(["concluida", "cancelada"].includes(x.situacao)) -
          Number(["concluida", "cancelada"].includes(y.situacao)) ||
        (x.prazo ?? "9999").localeCompare(y.prazo ?? "9999") ||
        ordem[x.prioridade] - ordem[y.prioridade],
    );
  const destinos = [
    ...(a.administrador || ctx.pode(null, "criar") ? [{ id: null, nome: "" }] : []),
    ...ctx.etapas
      .filter((e) => a.administrador || ctx.pode(e.id, "criar"))
      .map((e) => ({
        id: e.id as string | null,
        nome: nomeEtapa.get(e.id) ?? e.nome,
        ordem: e.paiId ? 0 : e.ordem,
      })),
  ];
  return {
    tarefas,
    destinos: destinos.map((d) => ({ id: d.id, nome: d.nome })),
    etapas: ordenarEtapas(ctx.etapas).map((e) => ({ id: e.id, nome: nomeEtapa.get(e.id) ?? e.nome })),
    opcoes: {
      usuarios: [
        ...new Map(
          participantes.map((p) => [
            p.usuarioId!,
            { id: p.usuarioId!, nome: p.nome, lado: ladoDaParticipacao(empresas, p) },
          ]),
        ).values(),
      ].sort((x, y) => x.nome.localeCompare(y.nome)),
      perfis: [
        ...new Map(participantes.map((p) => [p.perfilId!, { id: p.perfilId!, nome: p.perfil }])).values(),
      ].sort((x, y) => x.nome.localeCompare(y.nome)),
    },
    documentos: [...visiveisDocs.entries()].map(([id, titulo]) => ({ id, titulo })),
    fechado,
  };
}

// --- Gravação ------------------------------------------------------------------------------

const Dados = z.object({
  titulo: z.string().trim().min(2, "tarefas.erros.tituloObrigatorio").max(200, "tarefas.erros.textoLongo"),
  descricao: z
    .string()
    .trim()
    .max(4000, "tarefas.erros.textoLongo")
    .transform((v) => v || null),
  etapaId: z
    .string()
    .trim()
    .transform((v) => (v && uuidValido(v) ? v : null)),
  prioridade: z.enum(PRIORIDADES).default("normal"),
  prazo: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "tarefas.erros.dataInvalida"),
  usuarios: z.array(z.string()).default([]),
  perfis: z.array(z.string()).default([]),
  checklist: z.array(z.string()).default([]),
  documentos: z.array(z.string()).default([]),
});
export type DadosTarefa = z.input<typeof Dados>;

async function gravarRelacoes(
  a: AcessoTenant,
  dealId: string,
  tarefaId: string,
  d: z.output<typeof Dados>,
  substituir: boolean,
) {
  const [validos, docs] = await Promise.all([
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ perfilId: participacaoDeal.perfilId, usuarioId: pessoa.usuarioId })
        .from(participacaoDeal)
        .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
        .where(eq(participacaoDeal.dealId, dealId)),
    ),
    d.documentos.length
      ? comTenant(a.tenant.id, (tx) =>
          tx
            .select({ id: documento.id })
            .from(documento)
            .where(and(eq(documento.dealId, dealId), inArray(documento.id, d.documentos.filter(uuidValido)))),
        )
      : [],
  ]);
  const usuarios = [...new Set(d.usuarios)].filter((u) => validos.some((v) => v.usuarioId === u));
  const perfis = [...new Set(d.perfis)].filter((p) => validos.some((v) => v.perfilId === p));
  await comTenant(a.tenant.id, async (tx) => {
    if (substituir) {
      await tx.delete(tarefaResponsavel).where(eq(tarefaResponsavel.tarefaId, tarefaId));
      await tx.delete(tarefaDocumento).where(eq(tarefaDocumento.tarefaId, tarefaId));
    }
    const resp = [
      ...usuarios.map((usuarioId) => ({ tenantId: a.tenant.id, tarefaId, usuarioId })),
      ...perfis.map((perfilId) => ({ tenantId: a.tenant.id, tarefaId, perfilId })),
    ];
    if (resp.length) await tx.insert(tarefaResponsavel).values(resp);
    if (docs.length)
      await tx
        .insert(tarefaDocumento)
        .values(docs.map((x) => ({ tenantId: a.tenant.id, tarefaId, documentoId: x.id })));
  });
}

export async function criarTarefa(
  acesso: Acesso | null,
  dealId: string,
  dados: DadosTarefa,
): Promise<{ id: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  if (!uuidValido(dealId)) return { erro: "tarefas.erros.naoEncontrada" };
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const r = Dados.safeParse(dados);
  if (!r.success) {
    const p = r.error.issues[0];
    return {
      erro: p?.message ?? "tarefas.erros.dadosInvalidos",
      campo: p?.path[0] !== undefined ? String(p.path[0]) : undefined,
    };
  }
  const d = r.data;
  const ctx = await contexto(a, dealId);
  if (d.etapaId && !ctx.etapas.some((e) => e.id === d.etapaId))
    return { erro: "tarefas.erros.etapaInvalida" };
  if (!a.administrador && !ctx.pode(d.etapaId, "criar")) await negar(a, "criar", dealId);
  const lado = ctx.lados.has("vendedor") ? "vendedor" : ctx.lados.has("comprador") ? "comprador" : null;
  const [nova] = await comTenant(a.tenant.id, async (tx) => {
    const criada = await tx
      .insert(tarefa)
      .values({
        tenantId: a.tenant.id,
        dealId,
        etapaId: d.etapaId,
        titulo: d.titulo,
        descricao: d.descricao,
        prioridade: d.prioridade,
        prazo: d.prazo,
        lado,
        criadoPor: a.usuario.id,
      })
      .returning({ id: tarefa.id });
    const itens = d.checklist
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (itens.length)
      await tx.insert(tarefaItem).values(
        itens.map((texto, ordem) => ({
          tenantId: a.tenant.id,
          tarefaId: criada[0].id,
          texto: texto.slice(0, 300),
          ordem,
        })),
      );
    return criada;
  });
  await gravarRelacoes(a, dealId, nova.id, d, false);
  await auditar(a, "negocio.tarefa_criada", "deal", dealId, { titulo: d.titulo });
  return { id: nova.id };
}

/** Linha da tarefa com o que a pessoa pode nela (nega quem não a vê). */
async function tarefaDoContexto(a: AcessoTenant, tarefaId: string) {
  if (!uuidValido(tarefaId)) return null;
  const [t] = await comTenant(a.tenant.id, (tx) => tx.select().from(tarefa).where(eq(tarefa.id, tarefaId)));
  if (!t) return null;
  const ctx = await contexto(a, t.dealId);
  const resp = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ usuarioId: tarefaResponsavel.usuarioId, perfilId: tarefaResponsavel.perfilId })
      .from(tarefaResponsavel)
      .where(eq(tarefaResponsavel.tarefaId, tarefaId)),
  );
  if (!tarefaVisivel(a, ctx, t, resp)) return null;
  return { t, ctx, responsavel: souResponsavel(a, ctx, resp, t.lado) };
}

export async function editarTarefa(
  acesso: Acesso | null,
  tarefaId: string,
  dados: DadosTarefa,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const x = await tarefaDoContexto(a, tarefaId);
  if (!x) return { erro: "tarefas.erros.naoEncontrada" };
  const fechado = await negocioFechado(a, x.t.dealId);
  if (fechado) return fechado;
  if (!a.administrador && !x.ctx.pode(x.t.etapaId, "editar")) await negar(a, "editar", x.t.dealId);
  const r = Dados.safeParse(dados);
  if (!r.success) {
    const p = r.error.issues[0];
    return {
      erro: p?.message ?? "tarefas.erros.dadosInvalidos",
      campo: p?.path[0] !== undefined ? String(p.path[0]) : undefined,
    };
  }
  const d = r.data;
  if (d.etapaId && !x.ctx.etapas.some((e) => e.id === d.etapaId))
    return { erro: "tarefas.erros.etapaInvalida" };
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(tarefa)
      .set({
        titulo: d.titulo,
        descricao: d.descricao,
        etapaId: d.etapaId,
        prioridade: d.prioridade,
        prazo: d.prazo,
        // Novo prazo: os lembretes recomeçam.
        ...(d.prazo !== x.t.prazo ? { lembretesEnviados: [] } : {}),
        atualizadoEm: new Date(),
      })
      .where(eq(tarefa.id, tarefaId)),
  );
  await gravarRelacoes(a, x.t.dealId, tarefaId, d, true);
  await auditar(a, "negocio.tarefa_editada", "deal", x.t.dealId, { titulo: d.titulo });
  return { ok: true };
}

/** Situação da tarefa: quem edita tarefas na etapa ou um responsável (T3: fica registrado quem concluiu). */
export async function mudarSituacaoDaTarefa(
  acesso: Acesso | null,
  tarefaId: string,
  situacao: string,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const nova = situacao as SituacaoDaTarefa;
  if (!SITUACOES_DA_TAREFA.includes(nova)) return { erro: "tarefas.erros.situacaoInvalida" };
  const x = await tarefaDoContexto(a, tarefaId);
  if (!x) return { erro: "tarefas.erros.naoEncontrada" };
  const fechado = await negocioFechado(a, x.t.dealId);
  if (fechado) return fechado;
  if (!a.administrador && !x.responsavel && !x.ctx.pode(x.t.etapaId, "editar"))
    await negar(a, "editar", x.t.dealId);
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(tarefa)
      .set({
        situacao: nova,
        concluidaPor: nova === "concluida" ? a.usuario.id : null,
        concluidaEm: nova === "concluida" ? new Date() : null,
        atualizadoEm: new Date(),
      })
      .where(eq(tarefa.id, tarefaId)),
  );
  await auditar(a, "negocio.tarefa_situacao", "deal", x.t.dealId, { titulo: x.t.titulo, para: nova });
  return { ok: true };
}

/** Marca ou desmarca um item do checklist (responsável ou quem edita). */
export async function marcarItem(acesso: Acesso | null, itemId: string, feito: boolean): Promise<Resultado> {
  const a = exigirTenant(acesso);
  if (!uuidValido(itemId)) return { erro: "tarefas.erros.naoEncontrada" };
  const [item] = await comTenant(a.tenant.id, (tx) =>
    tx.select().from(tarefaItem).where(eq(tarefaItem.id, itemId)),
  );
  if (!item) return { erro: "tarefas.erros.naoEncontrada" };
  const x = await tarefaDoContexto(a, item.tarefaId);
  if (!x) return { erro: "tarefas.erros.naoEncontrada" };
  const fechado = await negocioFechado(a, x.t.dealId);
  if (fechado) return fechado;
  if (!a.administrador && !x.responsavel && !x.ctx.pode(x.t.etapaId, "editar"))
    await negar(a, "editar", x.t.dealId);
  await comTenant(a.tenant.id, (tx) => tx.update(tarefaItem).set({ feito }).where(eq(tarefaItem.id, itemId)));
  return { ok: true };
}

export async function excluirTarefa(acesso: Acesso | null, tarefaId: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const x = await tarefaDoContexto(a, tarefaId);
  if (!x) return { erro: "tarefas.erros.naoEncontrada" };
  const fechado = await negocioFechado(a, x.t.dealId);
  if (fechado) return fechado;
  if (!a.administrador && !x.ctx.pode(x.t.etapaId, "excluir")) await negar(a, "excluir", x.t.dealId);
  await comTenant(a.tenant.id, (tx) => tx.delete(tarefa).where(eq(tarefa.id, tarefaId)));
  await auditar(a, "negocio.tarefa_excluida", "deal", x.t.dealId, { titulo: x.t.titulo });
  return { ok: true };
}
