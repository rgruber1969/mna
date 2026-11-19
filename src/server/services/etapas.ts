import { and, asc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { z } from "zod";
import type { ErroDeServico } from "@/i18n/servidor";
import { comTenant } from "@/server/db/cliente";
import {
  deal,
  dealEtapa,
  etapaPadrao,
  eventoAuditoria,
  matrizUsuario,
  participacaoDeal,
  perfil,
  pessoa,
} from "@/server/db/esquema";
import { AcessoNegado, exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import { auditar } from "./empresas";
import { negocioFechado, nomeVisivel, visaoDoNegocio } from "./negocios";
import { notificar } from "./notificacoes";
import { concede, normalizarMatriz, somarMatrizes, type Acao, type Matriz } from "./permissoes/catalogo";
import { exigirPermissao } from "./permissoes/verificador";

/**
 * Etapas do negócio (itens 9 e 10; dominio.md, "Etapas"; respostas E1–E7):
 * cadastro padrão do tenant copiado para cada negócio novo e adaptável por
 * negócio; um nível de subetapas; dependência que só avisa; etapa principal
 * (a em andamento mais avançada); alcance por etapa nas participações.
 */

type Resultado = { ok: true } | ErroDeServico;
type Tx = Parameters<Parameters<typeof comTenant>[1]>[0];
export type SituacaoDaEtapa = "nao_iniciada" | "andamento" | "concluida" | "pulada";
export const SITUACOES_DA_ETAPA: SituacaoDaEtapa[] = ["nao_iniciada", "andamento", "concluida", "pulada"];

const uuidValido = (id: string) => z.uuid().safeParse(id).success;
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const Nome = z.string().trim().min(2, "etapas.erros.nomeObrigatorio").max(120, "etapas.erros.nomeLongo");

/** Etapas padrão de todo tenant novo (dominio.md), com as subetapas da diligência. */
export const ETAPAS_PADRAO: {
  codigo: string;
  nome: string;
  escala?: number;
  subetapas?: { codigo: string; nome: string }[];
}[] = [
  { codigo: "prospeccao", nome: "Prospecção" },
  { codigo: "negociacao", nome: "Negociação informal" },
  { codigo: "term-sheet", nome: "Term Sheet" },
  {
    codigo: "diligencia",
    nome: "Diligência",
    subetapas: [
      { codigo: "diligencia-juridica", nome: "Diligência jurídica" },
      { codigo: "diligencia-contabil", nome: "Diligência contábil e financeira" },
      { codigo: "diligencia-fiscal", nome: "Diligência fiscal" },
      { codigo: "diligencia-trabalhista", nome: "Diligência trabalhista" },
    ],
  },
  { codigo: "qpa", nome: "QPA" },
  { codigo: "condicoes", nome: "QPA → Closing" },
  { codigo: "closing", nome: "Closing" },
  { codigo: "pos-closing", nome: "Pós-closing", escala: 20 },
];

/** Cria as etapas padrão do tenant, se ele não tiver nenhuma (cadastros padrão). */
export async function completarEtapasPadrao(tx: Tx, tenantId: string): Promise<void> {
  const [ja] = await tx.select({ id: etapaPadrao.id }).from(etapaPadrao).limit(1);
  if (ja) return;
  let ordem = 1;
  for (const e of ETAPAS_PADRAO) {
    const [pai] = await tx
      .insert(etapaPadrao)
      .values({ tenantId, nome: e.nome, ordem: ordem++, padrao: e.codigo, escala: e.escala ?? 100 })
      .returning({ id: etapaPadrao.id });
    let o = 1;
    for (const s of e.subetapas ?? [])
      await tx
        .insert(etapaPadrao)
        .values({ tenantId, paiId: pai.id, nome: s.nome, ordem: o++, padrao: s.codigo });
  }
}

/** Copia as etapas padrão ativas para um negócio novo (sequenciais: cada uma depende da anterior). */
export async function copiarEtapasParaNegocio(tx: Tx, tenantId: string, dealId: string): Promise<void> {
  const padroes = await tx
    .select()
    .from(etapaPadrao)
    .where(eq(etapaPadrao.ativa, true))
    .orderBy(asc(etapaPadrao.ordem));
  let anterior: string | null = null;
  for (const p of padroes.filter((x) => !x.paiId)) {
    const [nova]: { id: string }[] = await tx
      .insert(dealEtapa)
      .values({
        tenantId,
        dealId,
        etapaPadraoId: p.id,
        nome: p.nome,
        ordem: p.ordem,
        escala: p.escala,
        dependeDeId: anterior,
      })
      .returning({ id: dealEtapa.id });
    anterior = nova.id;
    for (const s of padroes.filter((x) => x.paiId === p.id))
      await tx
        .insert(dealEtapa)
        .values({ tenantId, dealId, paiId: nova.id, etapaPadraoId: s.id, nome: s.nome, ordem: s.ordem });
  }
}

// --- Cadastro de etapas padrão (cadastros auxiliares) ---------------------------------

export type EtapaPadrao = {
  id: string;
  nome: string;
  ordem: number;
  ativa: boolean;
  escala: number;
  subetapas: EtapaPadrao[];
};

export async function listarEtapasPadrao(acesso: Acesso | null): Promise<EtapaPadrao[]> {
  const a = await exigirPermissao(acesso, "cadastros", "ver");
  const todas = await comTenant(a.tenant.id, (tx) =>
    tx.select().from(etapaPadrao).orderBy(asc(etapaPadrao.ordem)),
  );
  const montar = (paiId: string | null): EtapaPadrao[] =>
    todas
      .filter((e) => e.paiId === paiId)
      .map((e) => ({
        id: e.id,
        nome: e.nome,
        ordem: e.ordem,
        ativa: e.ativa,
        escala: e.escala,
        subetapas: montar(e.id),
      }));
  return montar(null);
}

/** Inclui ou renomeia uma etapa (ou subetapa, com `paiId`) padrão. Negócios existentes não mudam. */
export async function salvarEtapaPadrao(
  acesso: Acesso | null,
  dados: { id?: string; nome: string; paiId?: string; escala?: string },
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "cadastros", dados.id ? "editar" : "criar");
  const escala = dados.escala === undefined || dados.escala === "" ? undefined : Number(dados.escala);
  if (escala !== undefined && !(Number.isInteger(escala) && escala >= 5 && escala <= 100))
    return { erro: "etapas.erros.escalaInvalida", campo: "escala" };
  const nome = Nome.safeParse(dados.nome);
  if (!nome.success) return { erro: nome.error.issues[0]?.message ?? "etapas.erros.nomeObrigatorio" };
  const paiId = dados.paiId && uuidValido(dados.paiId) ? dados.paiId : null;
  const r = await comTenant(a.tenant.id, async (tx): Promise<Resultado> => {
    if (dados.id) {
      if (!uuidValido(dados.id)) return { erro: "etapas.erros.naoEncontrada" };
      const [antes] = await tx
        .select({ escala: etapaPadrao.escala })
        .from(etapaPadrao)
        .where(eq(etapaPadrao.id, dados.id));
      if (!antes) return { erro: "etapas.erros.naoEncontrada" };
      await tx
        .update(etapaPadrao)
        .set({ nome: nome.data, ...(escala !== undefined ? { escala } : {}) })
        .where(eq(etapaPadrao.id, dados.id));
      // A nova escala vale também nos negócios em que ela não foi ajustada à mão.
      if (escala !== undefined && escala !== antes.escala)
        await tx
          .update(dealEtapa)
          .set({ escala })
          .where(and(eq(dealEtapa.etapaPadraoId, dados.id), eq(dealEtapa.escala, antes.escala)));
      return { ok: true };
    }
    if (paiId) {
      const [pai] = await tx
        .select({ paiId: etapaPadrao.paiId })
        .from(etapaPadrao)
        .where(eq(etapaPadrao.id, paiId));
      if (!pai || pai.paiId) return { erro: "etapas.erros.umNivel" };
    }
    const [{ ultima }] = await tx
      .select({ ultima: max(etapaPadrao.ordem) })
      .from(etapaPadrao)
      .where(paiId ? eq(etapaPadrao.paiId, paiId) : isNull(etapaPadrao.paiId));
    await tx
      .insert(etapaPadrao)
      .values({ tenantId: a.tenant.id, paiId, nome: nome.data, ordem: (ultima ?? 0) + 1 });
    return { ok: true };
  });
  if ("erro" in r) return r;
  await auditar(a, dados.id ? "etapa_padrao.editada" : "etapa_padrao.criada", "tenant", a.tenant.id, {
    nome: nome.data,
  });
  return { ok: true };
}

/** Sobe ou desce uma etapa padrão entre as irmãs. */
export async function moverEtapaPadrao(
  acesso: Acesso | null,
  id: string,
  direcao: "subir" | "descer",
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "cadastros", "editar");
  if (!uuidValido(id)) return { erro: "etapas.erros.naoEncontrada" };
  return comTenant(a.tenant.id, async (tx) => {
    const [e] = await tx.select().from(etapaPadrao).where(eq(etapaPadrao.id, id));
    if (!e) return { erro: "etapas.erros.naoEncontrada" };
    const irmas = await tx
      .select()
      .from(etapaPadrao)
      .where(e.paiId ? eq(etapaPadrao.paiId, e.paiId) : isNull(etapaPadrao.paiId))
      .orderBy(asc(etapaPadrao.ordem));
    const i = irmas.findIndex((x) => x.id === id);
    const outra = irmas[direcao === "subir" ? i - 1 : i + 1];
    if (!outra) return { ok: true } as const;
    await tx.update(etapaPadrao).set({ ordem: outra.ordem }).where(eq(etapaPadrao.id, e.id));
    await tx.update(etapaPadrao).set({ ordem: e.ordem }).where(eq(etapaPadrao.id, outra.id));
    return { ok: true } as const;
  });
}

/**
 * Exclui uma etapa padrão (com as subetapas). Os negócios guardam cópias
 * próprias das etapas, então nada muda neles (só perdem a ligação com a
 * origem, usada para agrupar no kanban).
 */
export async function excluirEtapaPadrao(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "cadastros", "excluir");
  if (!uuidValido(id)) return { erro: "etapas.erros.naoEncontrada" };
  const nome = await comTenant(a.tenant.id, async (tx) => {
    const [e] = await tx.select().from(etapaPadrao).where(eq(etapaPadrao.id, id));
    if (!e) return null;
    const ids = [
      id,
      ...(await tx.select({ id: etapaPadrao.id }).from(etapaPadrao).where(eq(etapaPadrao.paiId, id))).map(
        (x) => x.id,
      ),
    ];
    await tx.update(dealEtapa).set({ etapaPadraoId: null }).where(inArray(dealEtapa.etapaPadraoId, ids));
    await tx.delete(etapaPadrao).where(inArray(etapaPadrao.id, ids));
    return e.nome;
  });
  if (!nome) return { erro: "etapas.erros.naoEncontrada" };
  await auditar(a, "etapa_padrao.excluida", "tenant", a.tenant.id, { nome });
  return { ok: true };
}

/** Desativa (não entra em negócios novos) ou reativa uma etapa padrão. */
export async function definirEtapaPadraoAtiva(
  acesso: Acesso | null,
  id: string,
  ativa: boolean,
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "cadastros", "editar");
  if (!uuidValido(id)) return { erro: "etapas.erros.naoEncontrada" };
  const feito = await comTenant(a.tenant.id, (tx) =>
    tx.update(etapaPadrao).set({ ativa }).where(eq(etapaPadrao.id, id)).returning({ id: etapaPadrao.id }),
  );
  if (!feito.length) return { erro: "etapas.erros.naoEncontrada" };
  await auditar(a, ativa ? "etapa_padrao.reativada" : "etapa_padrao.desativada", "tenant", a.tenant.id);
  return { ok: true };
}

// --- Permissão por etapa (alcance das participações, E7) ----------------------------------

type Linha = typeof dealEtapa.$inferSelect;

/** Matriz da pessoa numa etapa: soma das participações que alcançam a etapa (ou a etapa-mãe). */
export async function contextoDeEtapas(a: AcessoTenant, dealId: string) {
  const [etapas, minhas] = await comTenant(a.tenant.id, async (tx) => [
    await tx.select().from(dealEtapa).where(eq(dealEtapa.dealId, dealId)).orderBy(asc(dealEtapa.ordem)),
    a.administrador
      ? []
      : await tx
          .select({
            alcance: participacaoDeal.alcance,
            etapaIds: participacaoDeal.etapaIds,
            perfilId: perfil.id,
            matriz: perfil.matriz,
          })
          .from(participacaoDeal)
          .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
          .innerJoin(perfil, eq(perfil.id, participacaoDeal.perfilId))
          .where(
            and(
              eq(participacaoDeal.dealId, dealId),
              eq(pessoa.usuarioId, a.usuario.id),
              sql`(${participacaoDeal.prazo} is null or ${participacaoDeal.prazo} >= current_date)`,
            ),
          ),
  ]);
  const individuais =
    a.tenant.modoPermissoes === "usuario" && minhas.length
      ? await comTenant(a.tenant.id, (tx) =>
          tx
            .select({ perfilId: matrizUsuario.perfilId, matriz: matrizUsuario.matriz })
            .from(matrizUsuario)
            .where(eq(matrizUsuario.usuarioId, a.usuario.id)),
        )
      : [];
  const individualDe = new Map(individuais.map((i) => [i.perfilId, i.matriz]));
  const paiDe = new Map(etapas.map((e) => [e.id, e.paiId]));
  const matrizNa = (etapaId: string | null): Matriz => {
    if (a.administrador) return { etapas: ["ver", "criar", "editar", "excluir"] };
    return somarMatrizes(
      minhas
        .filter(
          (p) =>
            p.alcance === "deal" ||
            (etapaId !== null &&
              (p.etapaIds.includes(etapaId) || p.etapaIds.includes(paiDe.get(etapaId) ?? ""))),
        )
        .map((p) => normalizarMatriz(individualDe.get(p.perfilId) ?? p.matriz, "deal")),
    );
  };
  // Lado comprador (sem participação do lado vendedor): alterar as etapas exige também
  // "Alterar (lado comprador)", desmarcada por padrão em todos os perfis.
  const lados = await visaoDoNegocio(a, dealId)
    .then((r) => r.visao.lados)
    .catch(() => new Set<string>());
  const soComprador = !a.administrador && lados.has("comprador") && !lados.has("vendedor");
  const podeNa = (etapaId: string | null, acao: Acao) => {
    const m = matrizNa(etapaId);
    if (!concede(m, "etapas", acao)) return false;
    if (soComprador && (acao === "criar" || acao === "editar" || acao === "excluir"))
      return concede(m, "etapas", "alterarComprador");
    return true;
  };
  return {
    etapas,
    matrizNa,
    podeNa,
    alcanceTotal: a.administrador || minhas.some((p) => p.alcance === "deal"),
  };
}

async function exigirNaEtapa(acesso: Acesso | null, dealId: string, etapaId: string | null, acao: Acao) {
  const a = exigirTenant(acesso);
  if (!uuidValido(dealId)) throw new Error("negócio inválido");
  const ctx = await contextoDeEtapas(a, dealId);
  if (!ctx.podeNa(etapaId, acao)) {
    // Negado por padrão, com a negação na auditoria (ADR-0013).
    await comTenant(a.tenant.id, (tx) =>
      tx.insert(eventoAuditoria).values({
        tenantId: a.tenant.id,
        tipo: "acesso.negado",
        atorId: a.usuario.id,
        alvoTipo: "recurso",
        detalhes: { recurso: "etapas", acao, dealId, etapaId },
      }),
    );
    throw new AcessoNegado();
  }
  return { a, ctx };
}

// --- Etapas do negócio --------------------------------------------------------------------

export type EtapaDoNegocio = {
  id: string;
  nome: string;
  ordem: number;
  situacao: SituacaoDaEtapa;
  inicioPrevisto: string | null;
  fimPrevisto: string | null;
  inicioReal: string | null;
  fimReal: string | null;
  dependeDeId: string | null;
  dependeDe: string | null;
  escala: number;
  responsaveis: string[];
  observacoes: string | null;
  podeEditar: boolean;
  subetapas: EtapaDoNegocio[];
};

/** Etapa principal: a em andamento mais avançada; as outras em andamento contam como paralelas (E4). */
export function etapaPrincipal(
  etapas: { paiId: string | null; nome: string; ordem: number; situacao: string }[],
) {
  const emAndamento = etapas
    .filter((e) => !e.paiId && e.situacao === "andamento")
    .sort((x, y) => y.ordem - x.ordem);
  return emAndamento.length ? { nome: emAndamento[0].nome, paralelas: emAndamento.length - 1 } : null;
}

/** Etapas que a pessoa vê (alcance), com o que pode editar em cada uma. */
export async function etapasDoNegocio(
  acesso: Acesso | null,
  dealId: string,
): Promise<{
  etapas: EtapaDoNegocio[];
  principal: { nome: string; paralelas: number } | null;
  podeIncluir: boolean;
  podeExcluir: boolean;
  fechado: boolean;
} | null> {
  const a = exigirTenant(acesso);
  if (!uuidValido(dealId)) return null;
  const ctx = await contextoDeEtapas(a, dealId);
  const fechado = Boolean(await negocioFechado(a, dealId));
  const nomeDe = new Map(ctx.etapas.map((e) => [e.id, e.nome]));
  const vê = (e: Linha) => concede(ctx.matrizNa(e.id), "etapas", "ver");
  const montar = (e: Linha): EtapaDoNegocio => ({
    id: e.id,
    nome: e.nome,
    ordem: e.ordem,
    situacao: e.situacao,
    inicioPrevisto: e.inicioPrevisto,
    fimPrevisto: e.fimPrevisto,
    inicioReal: e.inicioReal,
    fimReal: e.fimReal,
    dependeDeId: e.dependeDeId,
    dependeDe: e.dependeDeId ? (nomeDe.get(e.dependeDeId) ?? null) : null,
    escala: e.escala,
    responsaveis: e.responsaveis,
    observacoes: e.observacoes,
    podeEditar: !fechado && ctx.podeNa(e.id, "editar"),
    subetapas: ctx.etapas.filter((s) => s.paiId === e.id && vê(s)).map(montar),
  });
  const etapas = ctx.etapas
    .filter((e) => !e.paiId && (vê(e) || ctx.etapas.some((s) => s.paiId === e.id && vê(s))))
    .map(montar);
  if (etapas.length === 0 && !concede(ctx.matrizNa(null), "etapas", "ver")) return null;
  return {
    etapas,
    principal: etapaPrincipal(ctx.etapas),
    podeIncluir: !fechado && ctx.podeNa(null, "criar"),
    podeExcluir: !fechado && ctx.podeNa(null, "excluir"),
    fechado,
  };
}

const dataOuNulo = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "etapas.erros.dataInvalida");

const DadosEtapa = z.object({
  nome: Nome,
  inicioPrevisto: dataOuNulo,
  fimPrevisto: dataOuNulo,
  inicioReal: dataOuNulo,
  fimReal: dataOuNulo,
  dependeDeId: z
    .string()
    .trim()
    .transform((v) => (v && uuidValido(v) ? v : null)),
  observacoes: z
    .string()
    .trim()
    .max(2000, "etapas.erros.textoLongo")
    .transform((v) => v || null),
  escala: z
    .string()
    .trim()
    .default("")
    .transform((v) => (v ? Number(v) : undefined))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= 5 && v <= 100),
      "etapas.erros.escalaInvalida",
    ),
});

/** Edita nome, datas, dependência e observações da etapa ("Etapas × editar" naquela etapa). */
export async function editarEtapa(
  acesso: Acesso | null,
  dealId: string,
  etapaId: string,
  dados: z.input<typeof DadosEtapa>,
): Promise<Resultado> {
  if (!uuidValido(etapaId)) return { erro: "etapas.erros.naoEncontrada" };
  const { a, ctx } = await exigirNaEtapa(acesso, dealId, etapaId, "editar");
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const r = DadosEtapa.safeParse(dados);
  if (!r.success) {
    const p = r.error.issues[0];
    return {
      erro: p?.message ?? "etapas.erros.dadosInvalidos",
      campo: p?.path[0] !== undefined ? String(p.path[0]) : undefined,
    };
  }
  const d = r.data;
  const etapa = ctx.etapas.find((e) => e.id === etapaId);
  if (!etapa) return { erro: "etapas.erros.naoEncontrada" };
  if (
    d.dependeDeId &&
    (d.dependeDeId === etapaId || !ctx.etapas.some((e) => e.id === d.dependeDeId && e.paiId === etapa.paiId))
  )
    return { erro: "etapas.erros.dependenciaInvalida", campo: "dependeDeId" };
  if (d.inicioPrevisto && d.fimPrevisto && d.fimPrevisto < d.inicioPrevisto)
    return { erro: "etapas.erros.fimAntesDoInicio", campo: "fimPrevisto" };
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(dealEtapa)
      .set({ ...d, atualizadoEm: new Date() })
      .where(and(eq(dealEtapa.id, etapaId), eq(dealEtapa.dealId, dealId))),
  );
  await auditar(a, "negocio.etapa_editada", "deal", dealId, { etapa: d.nome });
  return { ok: true };
}

/**
 * Muda a situação da etapa. Iniciar antes de a etapa de que ela depende
 * terminar só avisa (E6): devolve `aviso` e espera a confirmação. Troca da
 * etapa principal avisa os participantes (sino).
 */
export async function mudarSituacaoDaEtapa(
  acesso: Acesso | null,
  dealId: string,
  etapaId: string,
  situacao: string,
  confirmado = false,
): Promise<Resultado | { aviso: "dependencia"; etapa: string }> {
  if (!uuidValido(etapaId)) return { erro: "etapas.erros.naoEncontrada" };
  const nova = situacao as SituacaoDaEtapa;
  if (!SITUACOES_DA_ETAPA.includes(nova)) return { erro: "etapas.erros.situacaoInvalida" };
  const { a, ctx } = await exigirNaEtapa(acesso, dealId, etapaId, "editar");
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const etapa = ctx.etapas.find((e) => e.id === etapaId);
  if (!etapa) return { erro: "etapas.erros.naoEncontrada" };
  if (etapa.situacao === nova) return { ok: true };
  const anterior = etapa.dependeDeId ? ctx.etapas.find((e) => e.id === etapa.dependeDeId) : null;
  if (nova === "andamento" && anterior && !["concluida", "pulada"].includes(anterior.situacao) && !confirmado)
    return { aviso: "dependencia", etapa: anterior.nome };
  const antes = etapaPrincipal(ctx.etapas);
  const depois = etapaPrincipal(ctx.etapas.map((e) => (e.id === etapaId ? { ...e, situacao: nova } : e)));
  await comTenant(a.tenant.id, async (tx) => {
    await tx
      .update(dealEtapa)
      .set({
        situacao: nova,
        inicioReal:
          nova === "andamento" || nova === "concluida" ? (etapa.inicioReal ?? hoje()) : etapa.inicioReal,
        fimReal:
          nova === "concluida" ? (etapa.fimReal ?? hoje()) : nova === "andamento" ? null : etapa.fimReal,
        atualizadoEm: new Date(),
      })
      .where(eq(dealEtapa.id, etapaId));
    if (depois && depois.nome !== antes?.nome) {
      const [n] = await tx
        .select({ numero: deal.numero, codinome: deal.codinome })
        .from(deal)
        .where(eq(deal.id, dealId));
      const usuarios = await tx
        .selectDistinct({ id: pessoa.usuarioId })
        .from(participacaoDeal)
        .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
        .where(
          and(
            eq(participacaoDeal.dealId, dealId),
            sql`${participacaoDeal.perfilId} is not null`,
            sql`(${participacaoDeal.prazo} is null or ${participacaoDeal.prazo} >= current_date)`,
          ),
        );
      for (const u of usuarios)
        if (u.id && u.id !== a.usuario.id && n)
          await notificar(
            tx,
            a.tenant.id,
            u.id,
            "negocio_etapa",
            { negocio: nomeVisivel(n.numero, n.codinome), etapa: depois.nome },
            `/negocios/${dealId}?aba=etapas`,
          );
    }
  });
  await auditar(a, "negocio.etapa_situacao", "deal", dealId, {
    etapa: etapa.nome,
    de: etapa.situacao,
    para: nova,
  });
  return { ok: true };
}

/** Inclui uma etapa (ou subetapa) no negócio ("Etapas × criar", alcance no negócio inteiro). */
export async function incluirEtapa(
  acesso: Acesso | null,
  dealId: string,
  dados: { nome: string; paiId?: string },
): Promise<Resultado> {
  const { a, ctx } = await exigirNaEtapa(acesso, dealId, null, "criar");
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const nome = Nome.safeParse(dados.nome);
  if (!nome.success) return { erro: nome.error.issues[0]?.message ?? "etapas.erros.nomeObrigatorio" };
  const paiId = dados.paiId && uuidValido(dados.paiId) ? dados.paiId : null;
  if (paiId && !ctx.etapas.some((e) => e.id === paiId && !e.paiId)) return { erro: "etapas.erros.umNivel" };
  const irmas = ctx.etapas.filter((e) => e.paiId === paiId);
  await comTenant(a.tenant.id, (tx) =>
    tx.insert(dealEtapa).values({
      tenantId: a.tenant.id,
      dealId,
      paiId,
      nome: nome.data,
      ordem: Math.max(0, ...irmas.map((e) => e.ordem)) + 1,
    }),
  );
  await auditar(a, "negocio.etapa_incluida", "deal", dealId, { etapa: nome.data });
  return { ok: true };
}

/** Remove uma etapa não iniciada (com as subetapas) ("Etapas × excluir"). */
export async function removerEtapa(
  acesso: Acesso | null,
  dealId: string,
  etapaId: string,
): Promise<Resultado> {
  if (!uuidValido(etapaId)) return { erro: "etapas.erros.naoEncontrada" };
  const { a, ctx } = await exigirNaEtapa(acesso, dealId, null, "excluir");
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const etapa = ctx.etapas.find((e) => e.id === etapaId);
  if (!etapa) return { erro: "etapas.erros.naoEncontrada" };
  const ids = [etapaId, ...ctx.etapas.filter((e) => e.paiId === etapaId).map((e) => e.id)];
  if (ctx.etapas.some((e) => ids.includes(e.id) && e.situacao !== "nao_iniciada"))
    return { erro: "etapas.erros.soNaoIniciada" };
  await comTenant(a.tenant.id, async (tx) => {
    await tx
      .update(dealEtapa)
      .set({ dependeDeId: etapa.dependeDeId })
      .where(and(eq(dealEtapa.dealId, dealId), eq(dealEtapa.dependeDeId, etapaId)));
    await tx.delete(dealEtapa).where(inArray(dealEtapa.id, ids));
    // Participações com alcance nessas etapas perdem a referência.
    for (const id of ids)
      await tx
        .update(participacaoDeal)
        .set({ etapaIds: sql`${participacaoDeal.etapaIds} - ${id}` })
        .where(and(eq(participacaoDeal.dealId, dealId), sql`${participacaoDeal.etapaIds} ? ${id}`));
  });
  await auditar(a, "negocio.etapa_removida", "deal", dealId, { etapa: etapa.nome });
  return { ok: true };
}

/** Sobe ou desce a etapa entre as irmãs ("Etapas × editar"). */
export async function moverEtapa(
  acesso: Acesso | null,
  dealId: string,
  etapaId: string,
  direcao: "subir" | "descer",
): Promise<Resultado> {
  if (!uuidValido(etapaId)) return { erro: "etapas.erros.naoEncontrada" };
  const { a, ctx } = await exigirNaEtapa(acesso, dealId, null, "editar");
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const etapa = ctx.etapas.find((e) => e.id === etapaId);
  if (!etapa) return { erro: "etapas.erros.naoEncontrada" };
  const irmas = ctx.etapas.filter((e) => e.paiId === etapa.paiId).sort((x, y) => x.ordem - y.ordem);
  const i = irmas.findIndex((e) => e.id === etapaId);
  const outra = irmas[direcao === "subir" ? i - 1 : i + 1];
  if (!outra) return { ok: true };
  await comTenant(a.tenant.id, async (tx) => {
    await tx.update(dealEtapa).set({ ordem: outra.ordem }).where(eq(dealEtapa.id, etapa.id));
    await tx.update(dealEtapa).set({ ordem: etapa.ordem }).where(eq(dealEtapa.id, outra.id));
  });
  return { ok: true };
}

/** Etapas do negócio para escolher o alcance de uma participação. */
export async function opcoesDeAlcance(acesso: Acesso | null, dealId: string) {
  const a = await exigirPermissao(acesso, "deal", "editar", { dealId });
  const etapas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: dealEtapa.id, nome: dealEtapa.nome, paiId: dealEtapa.paiId, ordem: dealEtapa.ordem })
      .from(dealEtapa)
      .where(eq(dealEtapa.dealId, dealId))
      .orderBy(asc(dealEtapa.ordem)),
  );
  return etapas
    .filter((e) => !e.paiId)
    .flatMap((e) => [
      { id: e.id, nome: e.nome },
      ...etapas.filter((s) => s.paiId === e.id).map((s) => ({ id: s.id, nome: `${e.nome} › ${s.nome}` })),
    ]);
}
