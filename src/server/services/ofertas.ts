import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { lerNumero } from "@/config/ofertas";
import type { ErroDeServico } from "@/i18n/servidor";
import {
  chaveDoArquivo,
  gerarLinkDeDownload,
  gerarLinkDeEnvio,
  lerArquivo,
} from "@/server/arquivos/armazenamento";
import { comTenant } from "@/server/db/cliente";
import {
  deal,
  dealEmpresa,
  empresa,
  oferta,
  ofertaAcesso,
  ofertaArquivo,
  papelEmpresa,
  perfil,
  usuario,
  type ParcelaDaOferta,
  type RateioDaOferta,
} from "@/server/db/esquema";
import { exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import { verificarArquivo } from "./antivirus";
import {
  contextoDoDataRoom,
  dataRoomDoNegocio,
  TAMANHO_MAXIMO_DOCUMENTO,
  tipoDoDocumento,
} from "./documentos";
import { auditar } from "./empresas";
import { negocioFechado, visaoDoNegocio } from "./negocios";
import type { Acao } from "./permissoes/catalogo";
import { pode } from "./permissoes/verificador";

/**
 * Ofertas recebidas (item 32; dominio.md, "Ofertas"; O1–O4).
 *
 * - Cada oferta é de uma compradora do negócio; contraproposta é outra
 *   oferta ligada à anterior (rodada 2, 3…), e a lista mostra a evolução.
 * - Registrar uma oferta leva a compradora a "Proposta recebida" no funil,
 *   se ela ainda estava antes disso (prospectada, teaser ou NDA).
 * - Quem vê: matriz "Ofertas" e a lista de acesso de quem registrou
 *   (pré-preenchida com o próprio lado); por perfil, só no grupo de quem
 *   registrou. Do lado comprador, nunca a oferta de outra compradora.
 * - Rateio entre vendedoras (O4): percentuais do negócio, ajustáveis numa
 *   oferta (com o critério registrado). Só para quem vê as vendedoras.
 * - Comparação (O3): só para quem vê todas as ofertas do negócio.
 */

type Resultado = { ok: true } | ErroDeServico;
const uuidValido = (id: string) => z.uuid().safeParse(id).success;
export const INSTRUMENTOS = ["informal", "term_sheet", "loi", "mou"] as const;

// --- Contexto --------------------------------------------------------------------------------

async function contexto(a: AcessoTenant, dealId: string) {
  if (!uuidValido(dealId)) return null;
  const acoes: Acao[] = ["ver", "criar", "editar", "excluir"];
  const permitidas = new Set<Acao>();
  for (const acao of acoes) if (await pode(a, "ofertas", acao, { dealId })) permitidas.add(acao);
  if (!permitidas.has("ver")) return null;
  const [dr, visao, fechado] = await Promise.all([
    contextoDoDataRoom(a, dealId),
    visaoDoNegocio(a, dealId).then((r) => r.visao),
    negocioFechado(a, dealId),
  ]);
  const vendedor = a.administrador || visao.lados.has("vendedor");
  return {
    pode: (acao: Acao) => a.administrador || permitidas.has(acao),
    perfis: dr.perfisNa(null),
    mesmoGrupo: dr.mesmoGrupo,
    fechado: Boolean(fechado),
    vendedor,
    podeVerVendedora: visao.podeVerVendedora,
    /** Lado comprador: só as compradoras que a pessoa representa ou para quem trabalha. */
    compradoraPermitida: (id: string) => vendedor || visao.minhasCompradoras.has(id),
  };
}
type Ctx = NonNullable<Awaited<ReturnType<typeof contexto>>>;
type Linha = typeof oferta.$inferSelect;
type AcessoDaOferta = { perfilId: string | null; usuarioId: string | null };

function visivel(a: AcessoTenant, ctx: Ctx, o: Linha, acessos: AcessoDaOferta[]) {
  if (!ctx.compradoraPermitida(o.compradoraId)) return false;
  if (a.administrador || o.criadoPor === a.usuario.id) return true;
  if (acessos.some((x) => x.usuarioId === a.usuario.id)) return true;
  return (
    ctx.mesmoGrupo(o.criadoPor) && acessos.some((x) => x.perfilId !== null && ctx.perfis.has(x.perfilId))
  );
}

async function vendedorasDoNegocio(a: AcessoTenant, dealId: string) {
  return comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        empresaId: dealEmpresa.empresaId,
        nome: empresa.razaoSocial,
        percentual: dealEmpresa.percentualRateio,
      })
      .from(dealEmpresa)
      .innerJoin(papelEmpresa, eq(papelEmpresa.id, dealEmpresa.papelId))
      .innerJoin(empresa, eq(empresa.id, dealEmpresa.empresaId))
      .where(and(eq(dealEmpresa.dealId, dealId), eq(papelEmpresa.padrao, "vendedora")))
      .orderBy(asc(empresa.razaoSocial)),
  );
}

// --- Consulta --------------------------------------------------------------------------------

export type OfertaNaTela = {
  id: string;
  compradoraId: string;
  compradora: string;
  anteriorId: string | null;
  rodada: number;
  data: string;
  instrumento: (typeof INSTRUMENTOS)[number];
  enterpriseValue: string | null;
  equityValue: string | null;
  parcelaVista: string | null;
  parcelas: ParcelaDaOferta[];
  earnout: string | null;
  earnoutValor: string | null;
  retencao: string | null;
  retencaoValor: string | null;
  condicoesPrecedentes: string | null;
  validade: string | null;
  garantiasCompradora: string | null;
  garantiasVendedora: string | null;
  correcaoParcelas: string | null;
  condicoesTransicao: string | null;
  exclusividade: string | null;
  naoConcorrencia: string | null;
  observacoes: string | null;
  /** Rateio efetivo (o da oferta ou o do negócio); vazio para quem não vê as vendedoras. */
  rateio: { empresaId: string; nome: string; percentual: string }[];
  rateioProprio: boolean;
  criterioRateio: string | null;
  acesso: string[];
  acessoIds: { perfis: string[]; usuarios: string[] };
  arquivos: { id: string; nomeArquivo: string; tamanho: number; situacao: string }[];
  criadoPor: string | null;
  criadoEm: string;
  podeEditar: boolean;
  podeExcluir: boolean;
};

export type OfertasDoNegocio = {
  ofertas: OfertaNaTela[];
  /** A pessoa vê todas as ofertas do negócio (pode comparar, O3). */
  completa: boolean;
  podeCriar: boolean;
  podeEditarRateio: boolean;
  rateioDoNegocio: { empresaId: string; nome: string; percentual: string | null }[] | null;
  criterioDoNegocio: string | null;
};

export async function ofertasDoNegocio(
  acesso: Acesso | null,
  dealId: string,
): Promise<OfertasDoNegocio | null> {
  const a = exigirTenant(acesso);
  const ctx = await contexto(a, dealId);
  if (!ctx) return null;
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ o: oferta, compradora: empresa.razaoSocial, autor: usuario.name })
      .from(oferta)
      .innerJoin(empresa, eq(empresa.id, oferta.compradoraId))
      .leftJoin(usuario, eq(usuario.id, oferta.criadoPor))
      .where(eq(oferta.dealId, dealId))
      .orderBy(desc(oferta.data), desc(oferta.criadoEm)),
  );
  const ids = linhas.map((l) => l.o.id);
  const [acessos, arquivos, vendedoras, [d]] = await Promise.all([
    ids.length
      ? comTenant(a.tenant.id, (tx) =>
          tx
            .select({
              ofertaId: ofertaAcesso.ofertaId,
              perfilId: ofertaAcesso.perfilId,
              usuarioId: ofertaAcesso.usuarioId,
              perfil: perfil.nome,
              usuario: usuario.name,
            })
            .from(ofertaAcesso)
            .leftJoin(perfil, eq(perfil.id, ofertaAcesso.perfilId))
            .leftJoin(usuario, eq(usuario.id, ofertaAcesso.usuarioId))
            .where(inArray(ofertaAcesso.ofertaId, ids)),
        )
      : [],
    ids.length
      ? comTenant(a.tenant.id, (tx) =>
          tx
            .select({
              id: ofertaArquivo.id,
              ofertaId: ofertaArquivo.ofertaId,
              nomeArquivo: ofertaArquivo.nomeArquivo,
              tamanho: ofertaArquivo.tamanho,
              situacao: ofertaArquivo.situacao,
            })
            .from(ofertaArquivo)
            .where(inArray(ofertaArquivo.ofertaId, ids))
            .orderBy(asc(ofertaArquivo.criadoEm)),
        )
      : [],
    vendedorasDoNegocio(a, dealId),
    comTenant(a.tenant.id, (tx) =>
      tx.select({ criterio: deal.criterioRateio }).from(deal).where(eq(deal.id, dealId)),
    ),
  ]);
  const nomeVendedora = new Map(vendedoras.map((v) => [v.empresaId, v.nome]));
  const rateioDoNegocio = vendedoras
    .filter((v) => v.percentual !== null)
    .map((v) => ({ empresaId: v.empresaId, percentual: v.percentual! }));
  const visiveis = linhas.filter((l) =>
    visivel(
      a,
      ctx,
      l.o,
      acessos.filter((x) => x.ofertaId === l.o.id),
    ),
  );
  const ofertas: OfertaNaTela[] = visiveis.map(({ o, compradora, autor }) => {
    const meus = acessos.filter((x) => x.ofertaId === o.id);
    const efetivo: RateioDaOferta[] = o.rateio.length ? o.rateio : rateioDoNegocio;
    const dono = a.administrador || o.criadoPor === a.usuario.id;
    return {
      id: o.id,
      compradoraId: o.compradoraId,
      compradora,
      anteriorId: o.anteriorId,
      rodada: o.rodada,
      data: o.data,
      instrumento: o.instrumento,
      enterpriseValue: o.enterpriseValue,
      equityValue: o.equityValue,
      parcelaVista: o.parcelaVista,
      parcelas: o.parcelas,
      earnout: o.earnout,
      earnoutValor: o.earnoutValor,
      retencao: o.retencao,
      retencaoValor: o.retencaoValor,
      condicoesPrecedentes: o.condicoesPrecedentes,
      validade: o.validade,
      garantiasCompradora: o.garantiasCompradora,
      garantiasVendedora: o.garantiasVendedora,
      correcaoParcelas: o.correcaoParcelas,
      condicoesTransicao: o.condicoesTransicao,
      exclusividade: o.exclusividade,
      naoConcorrencia: o.naoConcorrencia,
      observacoes: o.observacoes,
      rateio: ctx.podeVerVendedora
        ? efetivo.map((r) => ({ ...r, nome: nomeVendedora.get(r.empresaId) ?? "—" }))
        : [],
      rateioProprio: o.rateio.length > 0,
      criterioRateio: ctx.podeVerVendedora
        ? o.rateio.length
          ? o.criterioRateio
          : (d?.criterio ?? null)
        : null,
      acesso: meus.map((x) => x.perfil ?? x.usuario ?? "—"),
      acessoIds: {
        perfis: meus.flatMap((x) => (x.perfilId ? [x.perfilId] : [])),
        usuarios: meus.flatMap((x) => (x.usuarioId ? [x.usuarioId] : [])),
      },
      arquivos: arquivos.filter((x) => x.ofertaId === o.id && x.situacao !== "enviando"),
      criadoPor: autor,
      criadoEm: o.criadoEm.toISOString(),
      podeEditar: !ctx.fechado && (dono || ctx.pode("editar")),
      podeExcluir: !ctx.fechado && (dono || ctx.pode("excluir")),
    };
  });
  return {
    ofertas,
    completa: visiveis.length === linhas.length,
    podeCriar: !ctx.fechado && ctx.pode("criar"),
    podeEditarRateio: !ctx.fechado && ctx.vendedor && ctx.pode("editar"),
    rateioDoNegocio: ctx.podeVerVendedora
      ? vendedoras.map((v) => ({ empresaId: v.empresaId, nome: v.nome, percentual: v.percentual }))
      : null,
    criterioDoNegocio: ctx.podeVerVendedora ? (d?.criterio ?? null) : null,
  };
}

// --- Opções do formulário --------------------------------------------------------------------

export type OpcoesDaOferta = {
  compradoras: { id: string; nome: string }[];
  vendedoras: { id: string; nome: string }[];
  perfis: { id: string; nome: string }[];
  usuarios: { id: string; nome: string }[];
  meuLado: string[];
};

export async function opcoesDaOferta(acesso: Acesso | null, dealId: string): Promise<OpcoesDaOferta | null> {
  const a = exigirTenant(acesso);
  const ctx = await contexto(a, dealId);
  if (!ctx || !ctx.pode("criar")) return null;
  const [compradoras, vendedoras, dr] = await Promise.all([
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ id: empresa.id, nome: empresa.razaoSocial })
        .from(dealEmpresa)
        .innerJoin(papelEmpresa, eq(papelEmpresa.id, dealEmpresa.papelId))
        .innerJoin(empresa, eq(empresa.id, dealEmpresa.empresaId))
        .where(and(eq(dealEmpresa.dealId, dealId), eq(papelEmpresa.padrao, "compradora")))
        .orderBy(asc(empresa.razaoSocial)),
    ),
    vendedorasDoNegocio(a, dealId),
    dataRoomDoNegocio(a, dealId),
  ]);
  return {
    compradoras: compradoras.filter((c) => ctx.compradoraPermitida(c.id)),
    vendedoras: ctx.podeVerVendedora ? vendedoras.map((v) => ({ id: v.empresaId, nome: v.nome })) : [],
    perfis: dr?.opcoesDeAcesso.perfis ?? [],
    usuarios: (dr?.opcoesDeAcesso.usuarios ?? []).map((u) => ({ id: u.id, nome: u.nome })),
    meuLado: dr?.meuLado ?? [],
  };
}

// --- Gravação --------------------------------------------------------------------------------

const data = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine(
    (v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))),
    "ofertas.erros.dataInvalida",
  );
const decimal = (maximo: number, erro: string) =>
  z
    .string()
    .trim()
    .transform((v) => lerNumero(v))
    .refine((v) => v === null || (/^\d+(\.\d{1,4})?$/.test(v) && Number(v) <= maximo), erro);
const valor = () => decimal(1e15, "ofertas.erros.valorInvalido").prefault("");
const texto = (max = 3000) => z.string().trim().max(max).default("");

const DadosOferta = z.object({
  compradoraId: z.string(),
  anteriorId: z.string().default(""),
  data: data.prefault(""),
  instrumento: z.enum(INSTRUMENTOS, "ofertas.erros.instrumentoInvalido"),
  enterpriseValue: valor(),
  equityValue: valor(),
  parcelaVista: valor(),
  parcelas: z
    .array(z.object({ valor: decimal(1e15, "ofertas.erros.valorInvalido"), data: data }))
    .max(120)
    .default([]),
  earnout: texto(),
  earnoutValor: valor(),
  retencao: texto(),
  retencaoValor: valor(),
  condicoesPrecedentes: texto(),
  validade: data.prefault(""),
  garantiasCompradora: texto(),
  garantiasVendedora: texto(),
  correcaoParcelas: texto(),
  condicoesTransicao: texto(),
  exclusividade: texto(500),
  naoConcorrencia: texto(500),
  observacoes: texto(5000),
  rateio: z
    .array(z.object({ empresaId: z.string(), percentual: decimal(100, "ofertas.erros.percentualInvalido") }))
    .max(50)
    .default([]),
  criterioRateio: texto(500),
  perfis: z.array(z.string()).max(50).default([]),
  usuarios: z.array(z.string()).max(200).default([]),
});
export type DadosOferta = z.input<typeof DadosOferta>;
type Validado = z.output<typeof DadosOferta>;

/** Percentuais somam 100 (com tolerância de arredondamento). */
const somaCem = (lista: { percentual: string | null }[]) =>
  Math.abs(lista.reduce((s, x) => s + Number(x.percentual ?? 0), 0) - 100) < 0.01;

async function validar(
  a: AcessoTenant,
  dealId: string,
  entrada: unknown,
  ignorar?: string,
): Promise<{ d: Validado; rodada: number } | ErroDeServico> {
  const r = DadosOferta.safeParse(entrada);
  if (!r.success) {
    const i = r.error.issues[0];
    return {
      erro: i.message.startsWith("ofertas.") ? i.message : "ofertas.erros.dadosInvalidos",
      campo: String(i.path[0] ?? ""),
    };
  }
  const d = r.data;
  if (!d.data) return { erro: "ofertas.erros.dataObrigatoria", campo: "data" };
  const opcoes = await opcoesDaOferta(a, dealId);
  if (!opcoes) return { erro: "erros.acessoNegado" };
  if (!opcoes.compradoras.some((c) => c.id === d.compradoraId))
    return { erro: "ofertas.erros.compradoraInvalida", campo: "compradoraId" };
  if (d.parcelas.some((p) => !p.valor || !p.data))
    return { erro: "ofertas.erros.parcelaIncompleta", campo: "parcelas" };
  const rateio = d.rateio.filter((x) => x.percentual !== null);
  if (rateio.length) {
    const vendedoras = new Set(opcoes.vendedoras.map((v) => v.id));
    if (!rateio.every((x) => vendedoras.has(x.empresaId)) || !somaCem(rateio))
      return { erro: "ofertas.erros.rateioInvalido", campo: "rateio" };
  }
  let rodada = 1;
  if (d.anteriorId) {
    const lista = await ofertasDoNegocio(a, dealId);
    const anterior = lista?.ofertas.find((o) => o.id === d.anteriorId && o.id !== ignorar);
    if (!anterior || anterior.compradoraId !== d.compradoraId)
      return { erro: "ofertas.erros.anteriorInvalida", campo: "anteriorId" };
    rodada = anterior.rodada + 1;
  }
  const perfis = new Set(opcoes.perfis.map((p) => p.id));
  const usuarios = new Set(opcoes.usuarios.map((u) => u.id));
  return {
    d: {
      ...d,
      rateio: rateio as { empresaId: string; percentual: string }[],
      perfis: [...new Set(d.perfis)].filter((p) => perfis.has(p)),
      usuarios: [...new Set(d.usuarios)].filter((u) => usuarios.has(u)),
    },
    rodada,
  };
}

const colunas = (d: Validado, rodada: number) => ({
  compradoraId: d.compradoraId,
  anteriorId: d.anteriorId || null,
  rodada,
  data: d.data!,
  instrumento: d.instrumento,
  enterpriseValue: d.enterpriseValue,
  equityValue: d.equityValue,
  parcelaVista: d.parcelaVista,
  parcelas: d.parcelas.map((p) => ({ valor: p.valor!, data: p.data! })),
  earnout: d.earnout || null,
  earnoutValor: d.earnoutValor,
  retencao: d.retencao || null,
  retencaoValor: d.retencaoValor,
  condicoesPrecedentes: d.condicoesPrecedentes || null,
  validade: d.validade,
  garantiasCompradora: d.garantiasCompradora || null,
  garantiasVendedora: d.garantiasVendedora || null,
  correcaoParcelas: d.correcaoParcelas || null,
  condicoesTransicao: d.condicoesTransicao || null,
  exclusividade: d.exclusividade || null,
  naoConcorrencia: d.naoConcorrencia || null,
  observacoes: d.observacoes || null,
  rateio: d.rateio as RateioDaOferta[],
  criterioRateio: d.rateio.length ? d.criterioRateio || null : null,
});

async function gravarAcesso(
  tx: Parameters<Parameters<typeof comTenant>[1]>[0],
  tenantId: string,
  ofertaId: string,
  d: Validado,
) {
  await tx.delete(ofertaAcesso).where(eq(ofertaAcesso.ofertaId, ofertaId));
  const linhas = [
    ...d.perfis.map((perfilId) => ({ tenantId, ofertaId, perfilId })),
    ...d.usuarios.map((usuarioId) => ({ tenantId, ofertaId, usuarioId })),
  ];
  if (linhas.length) await tx.insert(ofertaAcesso).values(linhas);
}

export async function criarOferta(
  acesso: Acesso | null,
  dealId: string,
  entrada: DadosOferta,
): Promise<{ id: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  if (!uuidValido(dealId)) return { erro: "ofertas.erros.naoEncontrada" };
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const v = await validar(a, dealId, entrada);
  if ("erro" in v) return v;
  const id = randomUUID();
  const mudanca = await comTenant(a.tenant.id, async (tx) => {
    await tx.insert(oferta).values({
      id,
      tenantId: a.tenant.id,
      dealId,
      criadoPor: a.usuario.id,
      ...colunas(v.d, v.rodada),
    });
    await gravarAcesso(tx, a.tenant.id, id, v.d);
    // A compradora passa a "Proposta recebida" se ainda estava antes disso no funil.
    const [linha] = await tx
      .select({ id: dealEmpresa.id, situacao: dealEmpresa.situacaoFunil })
      .from(dealEmpresa)
      .innerJoin(papelEmpresa, eq(papelEmpresa.id, dealEmpresa.papelId))
      .where(
        and(
          eq(dealEmpresa.dealId, dealId),
          eq(dealEmpresa.empresaId, v.d.compradoraId),
          eq(papelEmpresa.padrao, "compradora"),
        ),
      );
    if (linha && ["prospectada", "teaser", "nda"].includes(linha.situacao ?? "")) {
      await tx.update(dealEmpresa).set({ situacaoFunil: "proposta" }).where(eq(dealEmpresa.id, linha.id));
      return { empresaId: v.d.compradoraId, de: linha.situacao ?? "", para: "proposta" };
    }
    return null;
  });
  await auditar(a, "oferta.registrada", "deal", dealId, { ofertaId: id, rodada: v.rodada });
  if (mudanca) await auditar(a, "negocio.funil", "deal", dealId, mudanca);
  return { id };
}

async function linhaVisivel(a: AcessoTenant, id: string) {
  if (!uuidValido(id)) return null;
  const [o] = await comTenant(a.tenant.id, (tx) => tx.select().from(oferta).where(eq(oferta.id, id)));
  if (!o) return null;
  const lista = await ofertasDoNegocio(a, o.dealId);
  const tela = lista?.ofertas.find((x) => x.id === id);
  return tela ? { o, tela } : null;
}

export async function editarOferta(
  acesso: Acesso | null,
  id: string,
  entrada: DadosOferta,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const v0 = await linhaVisivel(a, id);
  if (!v0) return { erro: "ofertas.erros.naoEncontrada" };
  if (!v0.tela.podeEditar) return { erro: "erros.acessoNegado" };
  const v = await validar(a, v0.o.dealId, entrada, id);
  if ("erro" in v) return v;
  if (v.d.anteriorId === id) return { erro: "ofertas.erros.anteriorInvalida", campo: "anteriorId" };
  await comTenant(a.tenant.id, async (tx) => {
    await tx.update(oferta).set(colunas(v.d, v.rodada)).where(eq(oferta.id, id));
    await gravarAcesso(tx, a.tenant.id, id, v.d);
  });
  await auditar(a, "oferta.editada", "deal", v0.o.dealId, { ofertaId: id });
  return { ok: true };
}

export async function excluirOferta(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const v = await linhaVisivel(a, id);
  if (!v) return { erro: "ofertas.erros.naoEncontrada" };
  if (!v.tela.podeExcluir) return { erro: "erros.acessoNegado" };
  await comTenant(a.tenant.id, (tx) => tx.delete(oferta).where(eq(oferta.id, id)));
  await auditar(a, "oferta.excluida", "deal", v.o.dealId, { ofertaId: id });
  return { ok: true };
}

/** Percentuais das vendedoras no negócio e o critério (O4); só o lado vendedor com "Ofertas × editar". */
export async function salvarRateioDoNegocio(
  acesso: Acesso | null,
  dealId: string,
  dados: { percentuais: { empresaId: string; percentual: string }[]; criterio: string },
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const lista = await ofertasDoNegocio(a, dealId);
  if (!lista) return { erro: "ofertas.erros.naoEncontrada" };
  if (!lista.podeEditarRateio || !lista.rateioDoNegocio) return { erro: "erros.acessoNegado" };
  const conv = decimal(100, "ofertas.erros.percentualInvalido");
  const percentuais: { empresaId: string; percentual: string | null }[] = [];
  for (const p of dados.percentuais) {
    const r = conv.safeParse(p.percentual ?? "");
    if (!r.success) return { erro: "ofertas.erros.percentualInvalido" };
    percentuais.push({ empresaId: p.empresaId, percentual: r.data });
  }
  const ids = new Set(lista.rateioDoNegocio.map((v) => v.empresaId));
  if (!percentuais.every((p) => ids.has(p.empresaId))) return { erro: "ofertas.erros.rateioInvalido" };
  const preenchidos = percentuais.filter((p) => p.percentual !== null);
  if (preenchidos.length && !somaCem(preenchidos)) return { erro: "ofertas.erros.rateioInvalido" };
  await comTenant(a.tenant.id, async (tx) => {
    for (const p of percentuais)
      await tx
        .update(dealEmpresa)
        .set({ percentualRateio: p.percentual })
        .where(and(eq(dealEmpresa.dealId, dealId), eq(dealEmpresa.empresaId, p.empresaId)));
    await tx
      .update(deal)
      .set({
        criterioRateio:
          String(dados.criterio ?? "")
            .trim()
            .slice(0, 500) || null,
      })
      .where(eq(deal.id, dealId));
  });
  await auditar(a, "oferta.rateio_do_negocio", "deal", dealId);
  return { ok: true };
}

// --- Arquivos --------------------------------------------------------------------------------

export async function iniciarArquivoDaOferta(
  acesso: Acesso | null,
  ofertaId: string,
  dados: { nomeArquivo: string; tamanho: number },
): Promise<{ arquivoId: string; url: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const v = await linhaVisivel(a, ofertaId);
  if (!v) return { erro: "ofertas.erros.naoEncontrada" };
  if (!v.tela.podeEditar) return { erro: "erros.acessoNegado" };
  const nome = String(dados.nomeArquivo ?? "")
    .trim()
    .slice(0, 200);
  if (!nome || !Number.isInteger(dados.tamanho) || dados.tamanho <= 0)
    return { erro: "documentos.erros.envioIncompleto" };
  if (dados.tamanho > TAMANHO_MAXIMO_DOCUMENTO) return { erro: "documentos.erros.grande" };
  const id = randomUUID();
  const chave = chaveDoArquivo(a.tenant.id, "ofertas", ofertaId, id);
  await comTenant(a.tenant.id, (tx) =>
    tx.insert(ofertaArquivo).values({
      id,
      tenantId: a.tenant.id,
      ofertaId,
      nomeArquivo: nome,
      tamanho: dados.tamanho,
      chave,
      enviadoPor: a.usuario.id,
    }),
  );
  return { arquivoId: id, url: await gerarLinkDeEnvio(chave, "application/octet-stream") };
}

export async function concluirArquivoDaOferta(acesso: Acesso | null, arquivoId: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  if (!uuidValido(arquivoId)) return { erro: "ofertas.erros.naoEncontrada" };
  const [x] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select()
      .from(ofertaArquivo)
      .where(and(eq(ofertaArquivo.id, arquivoId), eq(ofertaArquivo.enviadoPor, a.usuario.id))),
  );
  if (!x || x.situacao !== "enviando") return { erro: "ofertas.erros.naoEncontrada" };
  const conteudo = await lerArquivo(x.chave);
  const recusar = async (erro: string, bloquear = false) => {
    await comTenant(a.tenant.id, (tx) =>
      bloquear
        ? tx.update(ofertaArquivo).set({ situacao: "bloqueado" }).where(eq(ofertaArquivo.id, arquivoId))
        : tx.delete(ofertaArquivo).where(eq(ofertaArquivo.id, arquivoId)),
    );
    return { erro };
  };
  if (!conteudo || conteudo.length !== x.tamanho) return recusar("documentos.erros.envioIncompleto");
  const tipo = tipoDoDocumento(conteudo, x.nomeArquivo);
  if (!tipo) return recusar("documentos.erros.formato");
  if ((await verificarArquivo(conteudo)) === "bloqueado") return recusar("documentos.erros.bloqueado", true);
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(ofertaArquivo)
      .set({ situacao: "disponivel", tipoDeConteudo: tipo })
      .where(eq(ofertaArquivo.id, arquivoId)),
  );
  return { ok: true };
}

export async function linkDoArquivoDaOferta(
  acesso: Acesso | null,
  arquivoId: string,
): Promise<{ url: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  if (!uuidValido(arquivoId)) return { erro: "ofertas.erros.naoEncontrada" };
  const [x] = await comTenant(a.tenant.id, (tx) =>
    tx.select().from(ofertaArquivo).where(eq(ofertaArquivo.id, arquivoId)),
  );
  if (!x || x.situacao !== "disponivel") return { erro: "ofertas.erros.naoEncontrada" };
  const v = await linhaVisivel(a, x.ofertaId);
  if (!v) return { erro: "ofertas.erros.naoEncontrada" };
  await auditar(a, "oferta.arquivo_baixado", "deal", v.o.dealId, { ofertaId: x.ofertaId, arquivoId });
  return { url: await gerarLinkDeDownload(x.chave, x.nomeArquivo) };
}
