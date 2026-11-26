import { and, asc, count, eq, inArray, max, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  emAberto,
  lerData,
  lerSituacao,
  lerTipo,
  linhaDoCabecalho,
  mapearColunas,
  painelDoPedido,
  diasEmAberto,
  PRIORIDADES_PADRAO,
  SEM_PERIODO,
  SITUACOES_DO_ITEM,
  situacaoGeral,
  situacoesPorPeriodo,
  type CampoDoItem,
  type SituacaoDoItem,
} from "@/config/pedidos";
import { FONTES_PADRAO } from "@/config/fontes-de-documentos";
import { tradutor, type ErroDeServico } from "@/i18n/servidor";
import { lerPlanilha } from "@/server/arquivos/planilha-leitura";
import { planilhaComAbas } from "@/server/arquivos/planilha-simples";
import { banco, comTenant } from "@/server/db/cliente";
import {
  deal,
  dealEmpresa,
  documento,
  empresa,
  fonteDeDocumento,
  papelEmpresa,
  participacaoDeal,
  pedidoDocumentos,
  pedidoItem,
  pedidoItemDocumento,
  pedidoRodada,
  perfil,
  pessoa,
  tenant,
  usuario,
  categoriaDocumento,
  documentoVersao,
  versaoAcesso,
} from "@/server/db/esquema";
import { exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import { dataRoomDoNegocio } from "./documentos";
import { auditar } from "./empresas";
import { hojeEmSaoPaulo } from "./negocios-andamento";
import {
  compradoraDaEmpresa,
  empresasDoNegocio,
  ladoDaParticipacao,
  negocioFechado,
  nomeVisivel,
  visaoDoNegocio,
} from "./negocios";
import type { Acao } from "./permissoes/catalogo";
import { exigirPermissao, pode } from "./permissoes/verificador";

/**
 * Pedidos de documentos (D4; dominio.md, "Pedido de documentos" e "estrutura
 * observada em listas reais").
 *
 * - O pedido é a lista de um solicitante (auditoria, advogados da
 *   compradora), com rodadas (lista inicial, complementares), assuntos (as
 *   abas da planilha) e itens (documento ou pergunta) com situação por período.
 * - Sigilo entre compradoras: o pedido pertence a uma compradora (ou a
 *   nenhuma, pedido interno do lado vendedor); do lado comprador, só quem é
 *   daquela compradora o vê. Pedido interno só o lado vendedor vê.
 * - Permissões: matriz "Pedidos de documentos" (ver, criar, editar, excluir,
 *   baixar = exportar a planilha), por negócio. Documentos ligados aparecem
 *   só para quem vê alguma versão deles no data room.
 * - A conversa de cada item fica na mensageria (alvo "pedidoItem").
 */

type Resultado = { ok: true } | ErroDeServico;
type ResultadoComId = { ok: true; id: string } | ErroDeServico;
const uuidValido = (id: string | null | undefined): id is string =>
  Boolean(id && z.uuid().safeParse(id).success);
const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "pedidos.erros.textoLongo")
    .transform((v) => v || null)
    .nullable()
    .optional();
const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "pedidos.erros.dataInvalida")
  .refine((v) => !Number.isNaN(Date.parse(v)), "pedidos.erros.dataInvalida");
const dataOpcional = z
  .union([data, z.literal("")])
  .transform((v) => v || null)
  .nullable()
  .optional();
const idOpcional = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => v || null)
  .nullable()
  .optional();

// --- Contexto --------------------------------------------------------------------------------

async function contexto(a: AcessoTenant, dealId: string) {
  if (!uuidValido(dealId)) return null;
  const acoes: Acao[] = ["ver", "criar", "editar", "excluir", "baixar"];
  const permitidas = new Set<Acao>();
  for (const acao of acoes) if (await pode(a, "pedidos", acao, { dealId })) permitidas.add(acao);
  if (!permitidas.has("ver")) return null;
  let visao;
  try {
    visao = (await visaoDoNegocio(a, dealId)).visao;
  } catch {
    return null;
  }
  const fechado = Boolean(await negocioFechado(a, dealId));
  const vendedor = a.administrador || visao.lados.has("vendedor");
  return {
    pode: (acao: Acao) => (acao === "ver" ? true : !fechado && permitidas.has(acao)),
    fechado,
    vendedor,
    /** Do lado comprador, só os pedidos das compradoras que a pessoa representa (ou para quem trabalha). */
    vePedido: (compradoraId: string | null) =>
      vendedor || (compradoraId !== null && visao.minhasCompradoras.has(compradoraId)),
    minhasCompradoras: visao.minhasCompradoras,
  };
}
type Ctx = NonNullable<Awaited<ReturnType<typeof contexto>>>;

/** O pedido (com o contexto), se a pessoa o vê. */
async function pedidoVisivel(a: AcessoTenant, pedidoId: string) {
  if (!uuidValido(pedidoId)) return null;
  const [p] = await comTenant(a.tenant.id, (tx) =>
    tx.select().from(pedidoDocumentos).where(eq(pedidoDocumentos.id, pedidoId)),
  );
  if (!p) return null;
  const ctx = await contexto(a, p.dealId);
  if (!ctx || !ctx.vePedido(p.compradoraId)) return null;
  return { p, ctx };
}

async function itemVisivel(a: AcessoTenant, itemId: string) {
  if (!uuidValido(itemId)) return null;
  const [i] = await comTenant(a.tenant.id, (tx) =>
    tx.select().from(pedidoItem).where(eq(pedidoItem.id, itemId)),
  );
  if (!i) return null;
  const r = await pedidoVisivel(a, i.pedidoId);
  return r ? { ...r, i } : null;
}

/** Nome do item para a mensageria (null se a pessoa não vê o item). */
export async function rotuloDoItemDoPedido(
  a: AcessoTenant,
  dealId: string,
  itemId: string,
): Promise<string | null> {
  const r = await itemVisivel(a, itemId);
  if (!r || r.p.dealId !== dealId) return null;
  return `${r.p.titulo} · ${r.i.codigo ? `${r.i.codigo} ` : ""}${r.i.descricao.slice(0, 80)}`;
}

// --- Consulta --------------------------------------------------------------------------------

export type PedidoResumo = {
  id: string;
  numero: number;
  titulo: string;
  compradora: string | null;
  solicitante: string | null;
  data: string;
  itens: number;
  abertos: number;
  entregues: number;
  podeEditar: boolean;
  podeExcluir: boolean;
};

export type PedidosDoNegocio = {
  pedidos: PedidoResumo[];
  podeCriar: boolean;
  /** Compradoras que a pessoa pode escolher ao criar (do lado comprador, só as dela). */
  compradoras: { id: string; nome: string }[];
  /** Empresas do negócio, para o solicitante. */
  empresas: { id: string; nome: string }[];
  /** Pedidos de outros negócios da mesma vendedora (rediligência). */
  anteriores: { id: string; nome: string }[];
  vendedor: boolean;
};

const nomeDaEmpresa = sql<string>`coalesce(${empresa.nomeFantasia}, ${empresa.razaoSocial})`;

export async function pedidosDoNegocio(
  acesso: Acesso | null,
  dealId: string,
): Promise<PedidosDoNegocio | null> {
  const a = exigirTenant(acesso);
  const ctx = await contexto(a, dealId);
  if (!ctx) return null;
  const [linhas, totais, empresas] = await Promise.all([
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({
          p: pedidoDocumentos,
          compradora: sql<
            string | null
          >`(select coalesce(e.nome_fantasia, e.razao_social) from empresa e where e.id = ${pedidoDocumentos.compradoraId})`,
          solicitante: sql<
            string | null
          >`(select coalesce(e.nome_fantasia, e.razao_social) from empresa e where e.id = ${pedidoDocumentos.solicitanteId})`,
        })
        .from(pedidoDocumentos)
        .where(eq(pedidoDocumentos.dealId, dealId))
        .orderBy(asc(pedidoDocumentos.numero)),
    ),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ pedidoId: pedidoItem.pedidoId, situacao: pedidoItem.situacao, n: count() })
        .from(pedidoItem)
        .innerJoin(pedidoDocumentos, eq(pedidoDocumentos.id, pedidoItem.pedidoId))
        .where(eq(pedidoDocumentos.dealId, dealId))
        .groupBy(pedidoItem.pedidoId, pedidoItem.situacao),
    ),
    empresasDoNegocio(a, dealId),
  ]);
  const nomes = await nomesDasEmpresas(
    a,
    empresas.map((e) => e.empresaId),
  );
  const visiveis = linhas.filter((l) => ctx.vePedido(l.p.compradoraId));
  const compradoras = empresas
    .filter((e) => e.compradora && (ctx.vendedor || ctx.minhasCompradoras.has(e.empresaId)))
    .map((e) => ({ id: e.empresaId, nome: nomes.get(e.empresaId) ?? "—" }));
  // Do lado comprador, o solicitante é da própria equipe (a compradora ou quem trabalha para ela).
  const empresasVisiveis = empresas
    .filter(
      (e) =>
        ctx.vendedor ||
        ctx.minhasCompradoras.has(e.empresaId) ||
        (e.atuaParaId !== null && ctx.minhasCompradoras.has(e.atuaParaId)),
    )
    .map((e) => ({ id: e.empresaId, nome: nomes.get(e.empresaId) ?? "—" }));
  return {
    pedidos: visiveis.map(({ p, compradora, solicitante }) => {
      const meus = totais.filter((t) => t.pedidoId === p.id);
      const soma = (f: (s: SituacaoDoItem) => boolean) =>
        meus.filter((t) => f(t.situacao)).reduce((s, t) => s + t.n, 0);
      return {
        id: p.id,
        numero: p.numero,
        titulo: p.titulo,
        compradora,
        solicitante,
        data: p.data,
        itens: soma(() => true),
        abertos: soma(emAberto),
        entregues: soma((s) => s === "entregue" || s === "aprovado"),
        podeEditar: ctx.pode("editar"),
        podeExcluir: ctx.pode("excluir"),
      };
    }),
    podeCriar: ctx.pode("criar") && (ctx.vendedor || compradoras.length > 0),
    compradoras,
    empresas: empresasVisiveis,
    anteriores: ctx.vendedor && ctx.pode("criar") ? await pedidosAnteriores(a, dealId) : [],
    vendedor: ctx.vendedor,
  };
}

async function nomesDasEmpresas(a: AcessoTenant, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx.select({ id: empresa.id, nome: nomeDaEmpresa }).from(empresa).where(inArray(empresa.id, ids)),
  );
  return new Map(linhas.map((l) => [l.id, l.nome]));
}

/** Pedidos de outros negócios com alguma vendedora em comum, que a pessoa vê (rediligência). */
async function pedidosAnteriores(a: AcessoTenant, dealId: string) {
  const vendedorasDe = (ids: string[]) =>
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ dealId: dealEmpresa.dealId, empresaId: dealEmpresa.empresaId })
        .from(dealEmpresa)
        .innerJoin(papelEmpresa, eq(papelEmpresa.id, dealEmpresa.papelId))
        .where(and(eq(papelEmpresa.padrao, "vendedora"), inArray(dealEmpresa.dealId, ids))),
    );
  const minhas = (await vendedorasDe([dealId])).map((v) => v.empresaId);
  if (minhas.length === 0) return [];
  const outros = await comTenant(a.tenant.id, (tx) =>
    tx
      .selectDistinct({ dealId: dealEmpresa.dealId })
      .from(dealEmpresa)
      .innerJoin(papelEmpresa, eq(papelEmpresa.id, dealEmpresa.papelId))
      .where(
        and(
          eq(papelEmpresa.padrao, "vendedora"),
          inArray(dealEmpresa.empresaId, minhas),
          ne(dealEmpresa.dealId, dealId),
        ),
      ),
  );
  if (outros.length === 0) return [];
  const pedidos = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        id: pedidoDocumentos.id,
        dealId: pedidoDocumentos.dealId,
        compradoraId: pedidoDocumentos.compradoraId,
        titulo: pedidoDocumentos.titulo,
        numeroNegocio: deal.numero,
        codinome: deal.codinome,
      })
      .from(pedidoDocumentos)
      .innerJoin(deal, eq(deal.id, pedidoDocumentos.dealId))
      .where(
        inArray(
          pedidoDocumentos.dealId,
          outros.map((o) => o.dealId),
        ),
      )
      .orderBy(asc(deal.numero), asc(pedidoDocumentos.numero)),
  );
  const ctxDe = new Map<string, Ctx | null>();
  const resultado: { id: string; nome: string }[] = [];
  for (const p of pedidos) {
    if (!ctxDe.has(p.dealId)) ctxDe.set(p.dealId, await contexto(a, p.dealId));
    const c = ctxDe.get(p.dealId);
    if (c?.vePedido(p.compradoraId))
      resultado.push({ id: p.id, nome: `${nomeVisivel(p.numeroNegocio, p.codinome)} · ${p.titulo}` });
  }
  return resultado;
}

export type ItemNaTela = {
  id: string;
  rodadaId: string;
  assunto: string;
  codigo: string | null;
  grupo: string | null;
  subgrupo: string | null;
  prioridade: string | null;
  descricao: string;
  formato: string | null;
  tipo: "documento" | "pergunta";
  dataPedido: string;
  dataEntrega: string | null;
  diasEmAberto: number | null;
  departamento: string | null;
  responsavelId: string | null;
  responsavel: string | null;
  observacaoSolicitante: string | null;
  resposta: string | null;
  ondeObter: string | null;
  fonteId: string | null;
  situacoes: Record<string, SituacaoDoItem>;
  situacao: SituacaoDoItem;
  documentos: { id: string; titulo: string; aguardandoAprovacao?: boolean }[];
};

export type PedidoDetalhe = {
  id: string;
  dealId: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  compradoraId: string | null;
  compradora: string | null;
  solicitanteId: string | null;
  solicitante: string | null;
  solicitantePessoas: string | null;
  data: string;
  dataBase: string | null;
  periodos: string[];
  amostragem: string | null;
  origem: string | null;
  rodadas: { id: string; numero: number; nome: string; data: string }[];
  itens: ItemNaTela[];
  painel: ReturnType<typeof painelDoPedido>;
  /** Documentos do data room que a pessoa vê (para ligar aos itens). */
  documentos: { id: string; titulo: string }[];
  /** Pessoas do lado vendedor no negócio (responsável pelo item). */
  responsaveis: { id: string; nome: string }[];
  fontes: { id: string; nome: string; orgao: string; link: string | null; gratuito: boolean }[];
  prioridades: string[];
  podeEditar: boolean;
  podeExcluir: boolean;
  podeBaixar: boolean;
  vendedor: boolean;
  /** Coordenador do negócio (ou administrador): aprova envio a compradora sem NDA. */
  podeAprovarSemNda: boolean;
};

export async function obterPedido(acesso: Acesso | null, pedidoId: string): Promise<PedidoDetalhe | null> {
  const a = exigirTenant(acesso);
  const r = await pedidoVisivel(a, pedidoId);
  if (!r) return null;
  const { p, ctx } = r;
  const [rodadas, itens, ligacoes, dataRoom, participantes, empresas, fontes, [t], nomes, origem] =
    await Promise.all([
      comTenant(a.tenant.id, (tx) =>
        tx
          .select()
          .from(pedidoRodada)
          .where(eq(pedidoRodada.pedidoId, p.id))
          .orderBy(asc(pedidoRodada.numero)),
      ),
      comTenant(a.tenant.id, (tx) =>
        tx
          .select({ i: pedidoItem, responsavel: usuario.name })
          .from(pedidoItem)
          .leftJoin(usuario, eq(usuario.id, pedidoItem.responsavelId))
          .where(eq(pedidoItem.pedidoId, p.id))
          .orderBy(asc(pedidoItem.ordem), asc(pedidoItem.criadoEm)),
      ),
      comTenant(a.tenant.id, (tx) =>
        tx
          .select({
            itemId: pedidoItemDocumento.itemId,
            documentoId: pedidoItemDocumento.documentoId,
            aguardandoAprovacao: pedidoItemDocumento.aguardandoAprovacao,
          })
          .from(pedidoItemDocumento)
          .innerJoin(pedidoItem, eq(pedidoItem.id, pedidoItemDocumento.itemId))
          .where(eq(pedidoItem.pedidoId, p.id)),
      ),
      dataRoomDoNegocio(a, p.dealId).catch(() => null),
      comTenant(a.tenant.id, (tx) =>
        tx
          .select({
            usuarioId: pessoa.usuarioId,
            nome: pessoa.nome,
            empresaId: participacaoDeal.empresaId,
            lado: participacaoDeal.lado,
          })
          .from(participacaoDeal)
          .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
          .where(and(eq(participacaoDeal.dealId, p.dealId), sql`${pessoa.usuarioId} is not null`)),
      ),
      empresasDoNegocio(a, p.dealId),
      comTenant(a.tenant.id, (tx) =>
        tx
          .select({
            id: fonteDeDocumento.id,
            nome: fonteDeDocumento.nome,
            orgao: fonteDeDocumento.orgao,
            link: fonteDeDocumento.link,
            gratuito: fonteDeDocumento.gratuito,
          })
          .from(fonteDeDocumento)
          .orderBy(asc(fonteDeDocumento.nome)),
      ),
      banco()
        .select({ prioridades: tenant.prioridadesPedido })
        .from(tenant)
        .where(eq(tenant.id, a.tenant.id)),
      nomesDasEmpresas(
        a,
        [p.compradoraId, p.solicitanteId].filter((x): x is string => Boolean(x)),
      ),
      p.origemId ? tituloDaOrigem(a, p.origemId) : null,
    ]);
  const visiveis = new Map((dataRoom?.documentos ?? []).map((d) => [d.id, d.titulo]));
  const docsDoItem = Map.groupBy(
    // O lado comprador não vê o envio que ainda espera o Coordenador.
    ligacoes.filter((l) => visiveis.has(l.documentoId) && (ctx.vendedor || !l.aguardandoAprovacao)),
    (l) => l.itemId,
  );
  const hoje = hojeEmSaoPaulo();
  const vistos = new Set<string>();
  const responsaveis = participantes
    .filter((x) => ladoDaParticipacao(empresas, x) === "vendedor" && x.usuarioId)
    .filter((x) => !vistos.has(x.usuarioId!) && vistos.add(x.usuarioId!))
    .map((x) => ({ id: x.usuarioId!, nome: x.nome }))
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  const lista: ItemNaTela[] = itens.map(({ i, responsavel }) => ({
    id: i.id,
    rodadaId: i.rodadaId,
    assunto: i.assunto,
    codigo: i.codigo,
    grupo: i.grupo,
    subgrupo: i.subgrupo,
    prioridade: i.prioridade,
    descricao: i.descricao,
    formato: i.formato,
    tipo: i.tipo,
    dataPedido: i.dataPedido,
    dataEntrega: i.dataEntrega,
    diasEmAberto: i.situacao === "nao_aplicavel" ? null : diasEmAberto(i.dataPedido, i.dataEntrega, hoje),
    departamento: i.departamento,
    responsavelId: i.responsavelId,
    responsavel,
    observacaoSolicitante: i.observacaoSolicitante,
    resposta: i.resposta,
    ondeObter: i.ondeObter,
    fonteId: i.fonteId,
    situacoes: i.situacoes,
    situacao: i.situacao,
    documentos: (docsDoItem.get(i.id) ?? []).map((d) => ({
      id: d.documentoId,
      titulo: visiveis.get(d.documentoId)!,
      aguardandoAprovacao: d.aguardandoAprovacao,
    })),
  }));
  return {
    id: p.id,
    dealId: p.dealId,
    numero: p.numero,
    titulo: p.titulo,
    descricao: p.descricao,
    compradoraId: p.compradoraId,
    compradora: p.compradoraId ? (nomes.get(p.compradoraId) ?? null) : null,
    solicitanteId: p.solicitanteId,
    solicitante: p.solicitanteId ? (nomes.get(p.solicitanteId) ?? null) : null,
    solicitantePessoas: p.solicitantePessoas,
    data: p.data,
    dataBase: p.dataBase,
    periodos: p.periodos,
    amostragem: p.amostragem,
    origem,
    rodadas: rodadas.map((x) => ({ id: x.id, numero: x.numero, nome: x.nome, data: x.data })),
    itens: lista,
    painel: painelDoPedido(lista),
    documentos: [...visiveis].map(([id, titulo]) => ({ id, titulo })),
    responsaveis,
    fontes,
    prioridades: t?.prioridades?.length ? t.prioridades : PRIORIDADES_PADRAO,
    podeEditar: ctx.pode("editar"),
    podeExcluir: ctx.pode("excluir"),
    podeBaixar: ctx.pode("baixar"),
    vendedor: ctx.vendedor,
    podeAprovarSemNda: ctx.vendedor && !ctx.fechado && (await eCoordenador(a, p.dealId)),
  };
}

async function tituloDaOrigem(a: AcessoTenant, origemId: string) {
  const [o] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ titulo: pedidoDocumentos.titulo, numero: deal.numero, codinome: deal.codinome })
      .from(pedidoDocumentos)
      .innerJoin(deal, eq(deal.id, pedidoDocumentos.dealId))
      .where(eq(pedidoDocumentos.id, origemId)),
  );
  return o ? `${nomeVisivel(o.numero, o.codinome)} · ${o.titulo}` : null;
}

// --- Pedido ----------------------------------------------------------------------------------

const DadosDoPedido = z.object({
  titulo: z.string().trim().min(2, "pedidos.erros.tituloObrigatorio").max(160, "pedidos.erros.textoLongo"),
  descricao: texto(2000),
  compradoraId: idOpcional,
  solicitanteId: idOpcional,
  solicitantePessoas: texto(500),
  data,
  dataBase: dataOpcional,
  /** Períodos separados por vírgula ou ponto e vírgula (ex.: "2022, 2023, 2024, Data-base"). */
  periodos: z.string().max(300, "pedidos.erros.textoLongo").optional(),
  amostragem: texto(300),
});
export type DadosDoPedidoEntrada = z.input<typeof DadosDoPedido>;

const lerPeriodos = (t?: string) =>
  [
    ...new Set(
      (t ?? "")
        .split(/[;,]/)
        .map((p) => p.trim().slice(0, 30))
        .filter(Boolean),
    ),
  ].slice(0, 15);

function erroDe(r: z.ZodSafeParseError<unknown>): ErroDeServico {
  const i = r.error.issues[0];
  return {
    erro: i?.message?.startsWith("pedidos.") ? i.message : "pedidos.erros.dadosInvalidos",
    campo: String(i?.path[0] ?? ""),
  };
}

/** Compradora válida para quem cria: do lado comprador, sempre uma das suas. */
async function conferirCompradora(a: AcessoTenant, ctx: Ctx, dealId: string, compradoraId: string | null) {
  if (!compradoraId)
    return ctx.vendedor ? null : { erro: "pedidos.erros.compradoraObrigatoria", campo: "compradoraId" };
  const empresas = await empresasDoNegocio(a, dealId);
  if (!empresas.some((e) => e.compradora && e.empresaId === compradoraId))
    return { erro: "pedidos.erros.compradoraInvalida", campo: "compradoraId" };
  if (!ctx.vePedido(compradoraId)) return { erro: "pedidos.erros.compradoraInvalida", campo: "compradoraId" };
  return null;
}

export async function criarPedido(
  acesso: Acesso | null,
  dealId: string,
  entrada: DadosDoPedidoEntrada,
  origemId?: string,
): Promise<ResultadoComId> {
  const a = exigirTenant(acesso);
  const ctx = await contexto(a, dealId);
  if (!ctx) return { erro: "pedidos.erros.naoEncontrado" };
  if (!ctx.pode("criar"))
    return { erro: ctx.fechado ? "negocios.erros.fechado" : "pedidos.erros.semPermissao" };
  const r = DadosDoPedido.safeParse(entrada);
  if (!r.success) return erroDe(r);
  const d = r.data;
  const erroCompradora = await conferirCompradora(a, ctx, dealId, d.compradoraId ?? null);
  if (erroCompradora) return erroCompradora;
  const id = await comTenant(a.tenant.id, async (tx) => {
    const [{ ultimo }] = await tx
      .select({ ultimo: max(pedidoDocumentos.numero) })
      .from(pedidoDocumentos)
      .where(eq(pedidoDocumentos.dealId, dealId));
    const [novo] = await tx
      .insert(pedidoDocumentos)
      .values({
        tenantId: a.tenant.id,
        dealId,
        numero: (ultimo ?? 0) + 1,
        titulo: d.titulo,
        descricao: d.descricao ?? null,
        compradoraId: d.compradoraId ?? null,
        solicitanteId: d.solicitanteId ?? null,
        solicitantePessoas: d.solicitantePessoas ?? null,
        data: d.data,
        dataBase: d.dataBase ?? null,
        periodos: lerPeriodos(d.periodos),
        amostragem: d.amostragem ?? null,
        origemId: origemId ?? null,
        criadoPor: a.usuario.id,
      })
      .returning({ id: pedidoDocumentos.id });
    await tx
      .insert(pedidoRodada)
      .values({ tenantId: a.tenant.id, pedidoId: novo.id, numero: 1, nome: "Lista inicial", data: d.data });
    return novo.id;
  });
  await auditar(a, "negocio.pedido_criado", "deal", dealId, {
    titulo: d.titulo,
    ...(origemId ? { rediligencia: true } : {}),
  });
  return { ok: true, id };
}

export async function editarPedido(
  acesso: Acesso | null,
  pedidoId: string,
  entrada: DadosDoPedidoEntrada,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const v = await pedidoVisivel(a, pedidoId);
  if (!v) return { erro: "pedidos.erros.naoEncontrado" };
  if (!v.ctx.pode("editar"))
    return { erro: v.ctx.fechado ? "negocios.erros.fechado" : "pedidos.erros.semPermissao" };
  const r = DadosDoPedido.safeParse(entrada);
  if (!r.success) return erroDe(r);
  const d = r.data;
  // Do lado comprador, a compradora do pedido não muda.
  const compradoraId = v.ctx.vendedor ? (d.compradoraId ?? null) : v.p.compradoraId;
  const erroCompradora = await conferirCompradora(a, v.ctx, v.p.dealId, compradoraId);
  if (erroCompradora) return erroCompradora;
  const periodos = lerPeriodos(d.periodos);
  await comTenant(a.tenant.id, async (tx) => {
    await tx
      .update(pedidoDocumentos)
      .set({
        titulo: d.titulo,
        descricao: d.descricao ?? null,
        compradoraId,
        solicitanteId: d.solicitanteId ?? null,
        solicitantePessoas: d.solicitantePessoas ?? null,
        data: d.data,
        dataBase: d.dataBase ?? null,
        periodos,
        amostragem: d.amostragem ?? null,
        atualizadoEm: new Date(),
      })
      .where(eq(pedidoDocumentos.id, pedidoId));
    // Os períodos mudaram: a situação geral de cada item é recalculada.
    if (periodos.join("|") !== v.p.periodos.join("|")) {
      const itens = await tx
        .select({ id: pedidoItem.id, situacoes: pedidoItem.situacoes })
        .from(pedidoItem)
        .where(eq(pedidoItem.pedidoId, pedidoId));
      for (const i of itens)
        await tx
          .update(pedidoItem)
          .set({ situacao: situacaoGeral(i.situacoes, periodos) })
          .where(eq(pedidoItem.id, i.id));
    }
  });
  await auditar(a, "negocio.pedido_editado", "deal", v.p.dealId, { titulo: d.titulo });
  return { ok: true };
}

export async function excluirPedido(acesso: Acesso | null, pedidoId: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const v = await pedidoVisivel(a, pedidoId);
  if (!v) return { erro: "pedidos.erros.naoEncontrado" };
  if (!v.ctx.pode("excluir"))
    return { erro: v.ctx.fechado ? "negocios.erros.fechado" : "pedidos.erros.semPermissao" };
  await comTenant(a.tenant.id, (tx) => tx.delete(pedidoDocumentos).where(eq(pedidoDocumentos.id, pedidoId)));
  await auditar(a, "negocio.pedido_excluido", "deal", v.p.dealId, { titulo: v.p.titulo });
  return { ok: true };
}

export async function criarRodada(
  acesso: Acesso | null,
  pedidoId: string,
  nome: string,
  dataDaRodada: string,
): Promise<ResultadoComId> {
  const a = exigirTenant(acesso);
  const v = await pedidoVisivel(a, pedidoId);
  if (!v) return { erro: "pedidos.erros.naoEncontrado" };
  if (!v.ctx.pode("editar")) return { erro: "pedidos.erros.semPermissao" };
  const n = z
    .string()
    .trim()
    .min(2, "pedidos.erros.nomeObrigatorio")
    .max(80, "pedidos.erros.textoLongo")
    .safeParse(nome);
  if (!n.success) return erroDe(n);
  const dt = data.safeParse(dataDaRodada);
  if (!dt.success) return { erro: "pedidos.erros.dataInvalida", campo: "data" };
  const id = await novaRodada(a, pedidoId, n.data, dt.data);
  await auditar(a, "negocio.pedido_rodada", "deal", v.p.dealId, { titulo: v.p.titulo, rodada: n.data });
  return { ok: true, id };
}

async function novaRodada(a: AcessoTenant, pedidoId: string, nome: string, dataDaRodada: string) {
  return comTenant(a.tenant.id, async (tx) => {
    const [{ ultimo }] = await tx
      .select({ ultimo: max(pedidoRodada.numero) })
      .from(pedidoRodada)
      .where(eq(pedidoRodada.pedidoId, pedidoId));
    const [r] = await tx
      .insert(pedidoRodada)
      .values({ tenantId: a.tenant.id, pedidoId, numero: (ultimo ?? 0) + 1, nome, data: dataDaRodada })
      .returning({ id: pedidoRodada.id });
    return r.id;
  });
}

// --- Itens -----------------------------------------------------------------------------------

const DadosDoItem = z.object({
  rodadaId: z.uuid("pedidos.erros.rodadaInvalida"),
  assunto: z.string().trim().min(2, "pedidos.erros.assuntoObrigatorio").max(80, "pedidos.erros.textoLongo"),
  codigo: texto(40),
  grupo: texto(160),
  subgrupo: texto(160),
  prioridade: texto(40),
  descricao: z
    .string()
    .trim()
    .min(2, "pedidos.erros.descricaoObrigatoria")
    .max(4000, "pedidos.erros.textoLongo"),
  formato: texto(80),
  tipo: z.enum(["documento", "pergunta"]).default("documento"),
  dataPedido: data,
  dataEntrega: dataOpcional,
  departamento: texto(120),
  responsavelId: idOpcional,
  observacaoSolicitante: texto(4000),
  resposta: texto(4000),
  ondeObter: texto(1000),
  fonteId: idOpcional,
  situacoes: z.record(z.string().max(30), z.enum(SITUACOES_DO_ITEM)).default({}),
});
export type DadosDoItemEntrada = z.input<typeof DadosDoItem>;

/** Inclui (sem `itemId`) ou altera um item do pedido. */
export async function salvarItem(
  acesso: Acesso | null,
  pedidoId: string,
  itemId: string | null,
  entrada: DadosDoItemEntrada,
): Promise<ResultadoComId> {
  const a = exigirTenant(acesso);
  const v = await pedidoVisivel(a, pedidoId);
  if (!v) return { erro: "pedidos.erros.naoEncontrado" };
  if (!v.ctx.pode(itemId ? "editar" : "criar") && !v.ctx.pode("editar"))
    return { erro: v.ctx.fechado ? "negocios.erros.fechado" : "pedidos.erros.semPermissao" };
  const r = DadosDoItem.safeParse(entrada);
  if (!r.success) return erroDe(r);
  const d = r.data;
  const [rodada] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: pedidoRodada.id })
      .from(pedidoRodada)
      .where(and(eq(pedidoRodada.id, d.rodadaId), eq(pedidoRodada.pedidoId, pedidoId))),
  );
  if (!rodada) return { erro: "pedidos.erros.rodadaInvalida", campo: "rodadaId" };
  // Só os períodos do pedido (ou a chave única, sem períodos).
  const chaves = new Set(v.p.periodos.length ? v.p.periodos : [SEM_PERIODO]);
  const situacoes = Object.fromEntries(Object.entries(d.situacoes).filter(([k]) => chaves.has(k)));
  const situacao = situacaoGeral(situacoes, v.p.periodos);
  const anterior = itemId
    ? (
        await comTenant(a.tenant.id, (tx) =>
          tx
            .select()
            .from(pedidoItem)
            .where(and(eq(pedidoItem.id, itemId), eq(pedidoItem.pedidoId, pedidoId))),
        )
      )[0]
    : null;
  if (itemId && !anterior) return { erro: "pedidos.erros.naoEncontrado" };
  // Entregue (ou aprovado) pela primeira vez: a data de entrega é hoje, se não foi informada.
  const entregue = situacao === "entregue" || situacao === "aprovado";
  const dataEntrega = d.dataEntrega ?? (entregue ? (anterior?.dataEntrega ?? hojeEmSaoPaulo()) : null);
  const valores = {
    rodadaId: d.rodadaId,
    assunto: d.assunto,
    codigo: d.codigo ?? null,
    grupo: d.grupo ?? null,
    subgrupo: d.subgrupo ?? null,
    prioridade: d.prioridade ?? null,
    descricao: d.descricao,
    formato: d.formato ?? null,
    tipo: d.tipo,
    dataPedido: d.dataPedido,
    dataEntrega,
    departamento: d.departamento ?? null,
    responsavelId: d.responsavelId ?? null,
    observacaoSolicitante: d.observacaoSolicitante ?? null,
    resposta: d.resposta ?? null,
    ondeObter: d.ondeObter ?? null,
    fonteId: d.fonteId ?? null,
    situacoes,
    situacao,
  };
  const id = await comTenant(a.tenant.id, async (tx) => {
    if (anterior) {
      await tx
        .update(pedidoItem)
        .set({ ...valores, atualizadoEm: new Date() })
        .where(eq(pedidoItem.id, anterior.id));
      return anterior.id;
    }
    const [{ ultima }] = await tx
      .select({ ultima: max(pedidoItem.ordem) })
      .from(pedidoItem)
      .where(eq(pedidoItem.pedidoId, pedidoId));
    const [novo] = await tx
      .insert(pedidoItem)
      .values({ tenantId: a.tenant.id, pedidoId, ordem: (ultima ?? 0) + 1, ...valores })
      .returning({ id: pedidoItem.id });
    return novo.id;
  });
  await auditar(
    a,
    anterior ? "negocio.pedido_item_editado" : "negocio.pedido_item_criado",
    "deal",
    v.p.dealId,
    {
      titulo: v.p.titulo,
      codigo: d.codigo ?? "",
      situacao,
    },
  );
  return { ok: true, id };
}

/** Muda só a situação de um período do item (atalho da lista). */
export async function definirSituacaoDoItem(
  acesso: Acesso | null,
  itemId: string,
  periodo: string,
  situacao: SituacaoDoItem,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const v = await itemVisivel(a, itemId);
  if (!v) return { erro: "pedidos.erros.naoEncontrado" };
  if (!v.ctx.pode("editar"))
    return { erro: v.ctx.fechado ? "negocios.erros.fechado" : "pedidos.erros.semPermissao" };
  if (!SITUACOES_DO_ITEM.includes(situacao)) return { erro: "pedidos.erros.dadosInvalidos" };
  const chaves = v.p.periodos.length ? v.p.periodos : [SEM_PERIODO];
  if (!chaves.includes(periodo)) return { erro: "pedidos.erros.dadosInvalidos" };
  const situacoes = { ...v.i.situacoes, [periodo]: situacao };
  const geral = situacaoGeral(situacoes, v.p.periodos);
  const entregue = geral === "entregue" || geral === "aprovado";
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(pedidoItem)
      .set({
        situacoes,
        situacao: geral,
        dataEntrega: v.i.dataEntrega ?? (entregue ? hojeEmSaoPaulo() : null),
        atualizadoEm: new Date(),
      })
      .where(eq(pedidoItem.id, itemId)),
  );
  await auditar(a, "negocio.pedido_item_editado", "deal", v.p.dealId, {
    titulo: v.p.titulo,
    codigo: v.i.codigo ?? "",
    situacao: geral,
  });
  return { ok: true };
}

export async function excluirItem(acesso: Acesso | null, itemId: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const v = await itemVisivel(a, itemId);
  if (!v) return { erro: "pedidos.erros.naoEncontrado" };
  if (!v.ctx.pode("excluir") && !v.ctx.pode("editar"))
    return { erro: v.ctx.fechado ? "negocios.erros.fechado" : "pedidos.erros.semPermissao" };
  await comTenant(a.tenant.id, (tx) => tx.delete(pedidoItem).where(eq(pedidoItem.id, itemId)));
  await auditar(a, "negocio.pedido_item_excluido", "deal", v.p.dealId, {
    titulo: v.p.titulo,
    codigo: v.i.codigo ?? "",
  });
  return { ok: true };
}

/** Liga (ou desliga) um documento do data room ao item; só documentos que a pessoa vê. */
export async function ligarDocumentoAoItem(
  acesso: Acesso | null,
  itemId: string,
  documentoId: string,
  ligar: boolean,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const v = await itemVisivel(a, itemId);
  if (!v) return { erro: "pedidos.erros.naoEncontrado" };
  if (!v.ctx.pode("editar"))
    return { erro: v.ctx.fechado ? "negocios.erros.fechado" : "pedidos.erros.semPermissao" };
  if (!uuidValido(documentoId)) return { erro: "pedidos.erros.documentoInvalido" };
  const dr = await dataRoomDoNegocio(a, v.p.dealId).catch(() => null);
  const doc = dr?.documentos.find((d) => d.id === documentoId);
  if (!doc) return { erro: "pedidos.erros.documentoInvalido" };
  // Compradora sem NDA: só categorias "pode ir sem NDA", e o envio espera o Coordenador.
  let aguardandoAprovacao = false;
  if (ligar && v.p.compradoraId && !(await compradoraPassouDoNda(a, v.p.dealId, v.p.compradoraId))) {
    if (!(await categoriaPodeIrSemNda(a, documentoId))) return { erro: "pedidos.erros.categoriaSemNda" };
    aguardandoAprovacao = true;
  }
  await comTenant(a.tenant.id, (tx) =>
    ligar
      ? tx
          .insert(pedidoItemDocumento)
          .values({ tenantId: a.tenant.id, itemId, documentoId, aguardandoAprovacao })
          .onConflictDoNothing()
      : tx
          .delete(pedidoItemDocumento)
          .where(
            and(eq(pedidoItemDocumento.itemId, itemId), eq(pedidoItemDocumento.documentoId, documentoId)),
          ),
  );
  await auditar(
    a,
    aguardandoAprovacao
      ? "negocio.pedido_documento_aguardando_aprovacao"
      : ligar
        ? "negocio.pedido_documento_ligado"
        : "negocio.pedido_documento_desligado",
    "deal",
    v.p.dealId,
    {
      titulo: v.p.titulo,
      codigo: v.i.codigo ?? "",
      documento: doc.titulo,
    },
  );
  return { ok: true };
}

// --- Envio a compradora sem NDA (pedido de 2026-11-26) ---------------------------------------

const DEPOIS_DO_NDA = new Set(["nda", "proposta", "escolhida"]);

async function compradoraPassouDoNda(a: AcessoTenant, dealId: string, compradoraId: string) {
  const empresas = await empresasDoNegocio(a, dealId);
  return empresas.some((e) => e.empresaId === compradoraId && DEPOIS_DO_NDA.has(e.situacaoFunil ?? ""));
}

async function categoriaPodeIrSemNda(a: AcessoTenant, documentoId: string) {
  const [c] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ semNda: categoriaDocumento.semNda })
      .from(documento)
      .innerJoin(categoriaDocumento, eq(categoriaDocumento.id, documento.categoriaId))
      .where(eq(documento.id, documentoId)),
  );
  return Boolean(c?.semNda);
}

/** Coordenador do negócio (perfil padrão "coordenador-deal") ou administrador do tenant. */
async function eCoordenador(a: AcessoTenant, dealId: string) {
  if (a.administrador) return true;
  const [c] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: participacaoDeal.id })
      .from(participacaoDeal)
      .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
      .innerJoin(perfil, eq(perfil.id, participacaoDeal.perfilId))
      .where(
        and(
          eq(participacaoDeal.dealId, dealId),
          eq(pessoa.usuarioId, a.usuario.id),
          eq(perfil.padrao, "coordenador-deal"),
        ),
      )
      .limit(1),
  );
  return Boolean(c);
}

/**
 * O Coordenador aprova o envio de um documento a compradora sem NDA: a
 * ligação fica visível ao lado comprador e as pessoas daquela compradora
 * passam a ver a versão atual do documento no data room. Auditado.
 */
export async function aprovarEnvioSemNda(
  acesso: Acesso | null,
  itemId: string,
  documentoId: string,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const v = await itemVisivel(a, itemId);
  if (!v || !uuidValido(documentoId)) return { erro: "pedidos.erros.naoEncontrado" };
  if (v.ctx.fechado) return { erro: "negocios.erros.fechado" };
  if (!v.ctx.vendedor || !(await eCoordenador(a, v.p.dealId))) return { erro: "pedidos.erros.soCoordenador" };
  const compradoraId = v.p.compradoraId;
  const empresas = await empresasDoNegocio(a, v.p.dealId);
  const aprovado = await comTenant(a.tenant.id, async (tx) => {
    const r = await tx
      .update(pedidoItemDocumento)
      .set({ aguardandoAprovacao: false, aprovadoPor: a.usuario.id, aprovadoEm: new Date() })
      .where(
        and(
          eq(pedidoItemDocumento.itemId, itemId),
          eq(pedidoItemDocumento.documentoId, documentoId),
          eq(pedidoItemDocumento.aguardandoAprovacao, true),
        ),
      )
      .returning({ id: pedidoItemDocumento.id });
    if (!r.length) return false;
    const [atual] = await tx
      .select({ id: documentoVersao.id })
      .from(documentoVersao)
      .where(eq(documentoVersao.documentoId, documentoId))
      .orderBy(sql`${documentoVersao.numero} desc`)
      .limit(1);
    if (atual && compradoraId) {
      const participantes = await tx
        .select({
          usuarioId: pessoa.usuarioId,
          empresaId: participacaoDeal.empresaId,
          lado: participacaoDeal.lado,
        })
        .from(participacaoDeal)
        .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
        .where(and(eq(participacaoDeal.dealId, v.p.dealId), sql`${pessoa.usuarioId} is not null`));
      const usuarios = new Set(
        participantes
          .filter(
            (p) =>
              p.usuarioId &&
              ladoDaParticipacao(empresas, p) === "comprador" &&
              compradoraDaEmpresa(empresas, p.empresaId) === compradoraId,
          )
          .map((p) => p.usuarioId!),
      );
      const ja = new Set(
        (
          await tx
            .select({ usuarioId: versaoAcesso.usuarioId })
            .from(versaoAcesso)
            .where(eq(versaoAcesso.versaoId, atual.id))
        ).map((x) => x.usuarioId),
      );
      const novos = [...usuarios].filter((u) => !ja.has(u));
      if (novos.length)
        await tx
          .insert(versaoAcesso)
          .values(novos.map((usuarioId) => ({ tenantId: a.tenant.id, versaoId: atual.id, usuarioId })));
    }
    return true;
  });
  if (!aprovado) return { erro: "pedidos.erros.naoEncontrado" };
  await auditar(a, "negocio.pedido_documento_aprovado_sem_nda", "deal", v.p.dealId, {
    titulo: v.p.titulo,
    codigo: v.i.codigo ?? "",
  });
  return { ok: true };
}

// --- Importação da planilha do solicitante ---------------------------------------------------

export type AbaImportada = {
  aba: string;
  itens: number;
  existentes: number;
  colunas: CampoDoItem[];
  periodos: string[];
  ignorada: boolean;
};
export type ResultadoDaImportacao = { ok: true; abas: AbaImportada[]; total: number } | ErroDeServico;

const TAMANHO_MAXIMO_PLANILHA = 10 * 1024 * 1024;
const LIMITE_DE_ITENS = 3000;

/**
 * Importa a planilha do solicitante: cada aba vira um assunto; a linha do
 * cabeçalho é achada sozinha; colunas de ano ou "Data-base" viram períodos
 * com situação. Itens já existentes (mesmo assunto e código) não se repetem.
 * Com `simular`, só devolve o que seria importado.
 */
export async function importarPlanilhaDoPedido(
  acesso: Acesso | null,
  pedidoId: string,
  conteudoBase64: string,
  opcoes: { simular: boolean; rodada: "nova" | string; nomeDaRodada?: string },
): Promise<ResultadoDaImportacao> {
  const a = exigirTenant(acesso);
  const v = await pedidoVisivel(a, pedidoId);
  if (!v) return { erro: "pedidos.erros.naoEncontrado" };
  if (!v.ctx.pode("editar") && !v.ctx.pode("criar")) return { erro: "pedidos.erros.semPermissao" };
  const bytes = Buffer.from(conteudoBase64, "base64");
  if (bytes.length === 0 || bytes.length > TAMANHO_MAXIMO_PLANILHA)
    return { erro: "pedidos.erros.planilhaGrande" };
  let abas;
  try {
    abas = lerPlanilha(new Uint8Array(bytes));
  } catch {
    return { erro: "pedidos.erros.planilhaInvalida" };
  }
  const existentes = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ assunto: pedidoItem.assunto, codigo: pedidoItem.codigo })
      .from(pedidoItem)
      .where(eq(pedidoItem.pedidoId, pedidoId)),
  );
  const jaExiste = new Set(existentes.filter((e) => e.codigo).map((e) => `${e.assunto}|${e.codigo}`));
  const hoje = hojeEmSaoPaulo();
  const periodosDoPedido = [...v.p.periodos];
  const colunasDoPedido = { ...v.p.colunas };
  type Novo = Omit<typeof pedidoItem.$inferInsert, "tenantId" | "pedidoId" | "rodadaId" | "ordem">;
  const novos: Novo[] = [];
  const resumo: AbaImportada[] = [];
  for (const aba of abas) {
    const assunto = aba.nome.trim().slice(0, 80) || "Geral";
    const ini = linhaDoCabecalho(aba.linhas);
    if (ini < 0) {
      resumo.push({ aba: aba.nome, itens: 0, existentes: 0, colunas: [], periodos: [], ignorada: true });
      continue;
    }
    const cabecalho = aba.linhas[ini].map((c) => (c ?? "").trim());
    const { campos, periodos } = mapearColunas(cabecalho);
    for (const p of Object.values(periodos)) if (!periodosDoPedido.includes(p)) periodosDoPedido.push(p);
    colunasDoPedido[assunto] = cabecalho;
    const valor = (linha: string[], campo: CampoDoItem) => {
      const i = campos[campo];
      return i === undefined ? "" : (linha[i] ?? "").trim();
    };
    let itens = 0;
    let repetidos = 0;
    let grupoAtual: string | null = null;
    for (const linha of aba.linhas.slice(ini + 1)) {
      const descricao = valor(linha, "descricao");
      const codigo = valor(linha, "codigo");
      if (!descricao) {
        // Linha de seção ("B - Contábil"): vira o grupo dos itens seguintes, se não houver coluna de grupo.
        if (codigo && campos.grupo === undefined) grupoAtual = codigo.slice(0, 160);
        continue;
      }
      if (codigo && jaExiste.has(`${assunto}|${codigo}`)) {
        repetidos++;
        continue;
      }
      if (novos.length >= LIMITE_DE_ITENS) break;
      jaExiste.add(`${assunto}|${codigo}`);
      const situacoes: Record<string, SituacaoDoItem> = {};
      for (const [i, p] of Object.entries(periodos)) {
        const s = lerSituacao(linha[Number(i)]);
        if (s) situacoes[p] = s;
      }
      const geral = lerSituacao(valor(linha, "situacao"));
      // Aba sem colunas de período: a situação geral vale para todos os períodos do pedido.
      if (geral && Object.keys(periodos).length === 0)
        for (const p of periodosDoPedido.length ? periodosDoPedido : [SEM_PERIODO]) situacoes[p] = geral;
      novos.push({
        assunto,
        codigo: codigo.slice(0, 40) || null,
        grupo: (valor(linha, "grupo") || grupoAtual || "").slice(0, 160) || null,
        subgrupo: valor(linha, "subgrupo").slice(0, 160) || null,
        prioridade: valor(linha, "prioridade").slice(0, 40) || null,
        descricao: descricao.slice(0, 4000),
        formato: valor(linha, "formato").slice(0, 80) || null,
        tipo: lerTipo(valor(linha, "tipo"), descricao),
        dataPedido: lerData(valor(linha, "dataPedido")) ?? v.p.data ?? hoje,
        dataEntrega: lerData(valor(linha, "dataEntrega")),
        departamento: valor(linha, "departamento").slice(0, 120) || null,
        observacaoSolicitante: valor(linha, "observacaoSolicitante").slice(0, 4000) || null,
        resposta: valor(linha, "resposta").slice(0, 4000) || null,
        ondeObter: valor(linha, "ondeObter").slice(0, 1000) || null,
        situacoes,
        original: Object.fromEntries(
          cabecalho.flatMap((c, i) => (c && linha[i] ? [[c, String(linha[i]).slice(0, 4000)]] : [])),
        ),
      });
      itens++;
    }
    resumo.push({
      aba: aba.nome,
      itens,
      existentes: repetidos,
      colunas: Object.keys(campos) as CampoDoItem[],
      periodos: Object.values(periodos),
      ignorada: false,
    });
  }
  if (opcoes.simular) return { ok: true, abas: resumo, total: novos.length };
  if (novos.length === 0) return { erro: "pedidos.erros.planilhaSemItens" };
  let rodadaId = opcoes.rodada;
  if (rodadaId === "nova") {
    const nome = (opcoes.nomeDaRodada ?? "").trim().slice(0, 80) || "Lista complementar";
    rodadaId = await novaRodada(a, pedidoId, nome, hoje);
  } else {
    const [r] = await comTenant(a.tenant.id, (tx) =>
      tx
        .select({ id: pedidoRodada.id })
        .from(pedidoRodada)
        .where(and(eq(pedidoRodada.id, rodadaId), eq(pedidoRodada.pedidoId, pedidoId))),
    );
    if (!r) return { erro: "pedidos.erros.rodadaInvalida" };
  }
  await comTenant(a.tenant.id, async (tx) => {
    const [{ ultima }] = await tx
      .select({ ultima: max(pedidoItem.ordem) })
      .from(pedidoItem)
      .where(eq(pedidoItem.pedidoId, pedidoId));
    const base = ultima ?? 0;
    for (let k = 0; k < novos.length; k += 500)
      await tx.insert(pedidoItem).values(
        novos.slice(k, k + 500).map((n, j) => ({
          ...n,
          situacao: situacaoGeral(n.situacoes ?? {}, periodosDoPedido),
          tenantId: a.tenant.id,
          pedidoId,
          rodadaId,
          ordem: base + k + j + 1,
        })),
      );
    await tx
      .update(pedidoDocumentos)
      .set({ periodos: periodosDoPedido.slice(0, 15), colunas: colunasDoPedido, atualizadoEm: new Date() })
      .where(eq(pedidoDocumentos.id, pedidoId));
  });
  await auditar(a, "negocio.pedido_importado", "deal", v.p.dealId, {
    titulo: v.p.titulo,
    itens: novos.length,
  });
  return { ok: true, abas: resumo, total: novos.length };
}

// --- Exportação (a lista respondida, no formato do solicitante) -------------------------------

export async function exportarPedido(
  acesso: Acesso | null,
  pedidoId: string,
): Promise<{ ok: true; nome: string; conteudo: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const d = await obterPedido(a, pedidoId);
  if (!d) return { erro: "pedidos.erros.naoEncontrado" };
  if (!d.podeBaixar) return { erro: "pedidos.erros.semPermissao" };
  const tr = await tradutor();
  const t = (k: string, p?: Record<string, string | number>) => tr(`pedidos.exportacao.${k}`, p);
  const ts = (s: SituacaoDoItem) => tr(`pedidos.situacoes.${s}`);
  const br = (x: string | null) => (x ? x.split("-").reverse().join("/") : "");
  const rodadaDe = new Map(d.rodadas.map((r) => [r.id, r.nome]));
  const [registro] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ colunas: pedidoDocumentos.colunas })
      .from(pedidoDocumentos)
      .where(eq(pedidoDocumentos.id, pedidoId)),
  );
  const originais = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: pedidoItem.id, original: pedidoItem.original })
      .from(pedidoItem)
      .where(eq(pedidoItem.pedidoId, pedidoId)),
  );
  const originalDe = new Map(originais.map((o) => [o.id, o.original]));
  const respostas = (i: ItemNaTela) => [
    rodadaDe.get(i.rodadaId) ?? "",
    ts(i.situacao),
    ...(d.periodos.length ? situacoesPorPeriodo(i.situacoes, d.periodos).map(([, s]) => ts(s)) : []),
    i.resposta ?? "",
    i.ondeObter ?? "",
    i.documentos.map((x) => x.titulo).join("; "),
    i.responsavel ?? "",
    br(i.dataPedido),
    br(i.dataEntrega),
    i.diasEmAberto === null ? "" : String(i.diasEmAberto),
  ];
  const cabecalhoDasRespostas = [
    t("rodada"),
    t("situacao"),
    ...d.periodos.map((p) => t("situacaoDoPeriodo", { periodo: p })),
    t("resposta"),
    t("ondeObter"),
    t("documentos"),
    t("responsavel"),
    t("dataPedido"),
    t("dataEntrega"),
    t("diasEmAberto"),
  ];
  const padrao = [
    t("codigo"),
    t("grupo"),
    t("subgrupo"),
    t("descricao"),
    t("prioridade"),
    t("formato"),
    t("tipo"),
    t("observacao"),
  ];
  const abasDoPedido = d.painel.assuntos.map((assunto) => {
    const itens = d.itens.filter((i) => i.assunto === assunto);
    const colunas = registro?.colunas?.[assunto];
    if (colunas?.length) {
      // Formato do solicitante: as colunas dele, com as que respondemos atualizadas, e as nossas no fim.
      const { campos, periodos } = mapearColunas(colunas);
      const atual = (i: ItemNaTela, col: number): string | null => {
        if (periodos[col]) return ts(i.situacoes[periodos[col]] ?? "pendente");
        if (campos.situacao === col) return ts(i.situacao);
        if (campos.resposta === col) return i.resposta ?? "";
        if (campos.ondeObter === col) return i.ondeObter ?? "";
        if (campos.dataEntrega === col) return br(i.dataEntrega);
        if (campos.responsavel === col) return i.responsavel ?? "";
        return null;
      };
      return {
        nome: assunto,
        linhas: [
          [...colunas, ...cabecalhoDasRespostas],
          ...itens.map((i) => {
            const o = originalDe.get(i.id) ?? {};
            const base = colunas.map((c, k) => atual(i, k) ?? (c ? (o[c] ?? "") : ""));
            if (!colunas.some(Boolean) || Object.keys(o).length === 0) {
              // Item incluído depois da importação: preenche as colunas reconhecidas.
              const porCampo: Partial<Record<CampoDoItem, string>> = {
                codigo: i.codigo ?? "",
                grupo: i.grupo ?? "",
                subgrupo: i.subgrupo ?? "",
                descricao: i.descricao,
                prioridade: i.prioridade ?? "",
                formato: i.formato ?? "",
                observacaoSolicitante: i.observacaoSolicitante ?? "",
              };
              for (const [campo, col] of Object.entries(campos))
                if (porCampo[campo as CampoDoItem] !== undefined && !base[col])
                  base[col] = porCampo[campo as CampoDoItem]!;
            }
            return [...base, ...respostas(i)];
          }),
        ],
      };
    }
    return {
      nome: assunto,
      linhas: [
        [...padrao, ...cabecalhoDasRespostas],
        ...itens.map((i) => [
          i.codigo ?? "",
          i.grupo ?? "",
          i.subgrupo ?? "",
          i.descricao,
          i.prioridade ?? "",
          i.formato ?? "",
          tr(`pedidos.tipos.${i.tipo}`),
          i.observacaoSolicitante ?? "",
          ...respostas(i),
        ]),
      ],
    };
  });
  const situacoes = SITUACOES_DO_ITEM;
  const painel = [
    [d.titulo],
    [t("geradoEm", { data: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) })],
    [],
    [t("assunto"), ...situacoes.map(ts), t("total")],
    ...d.painel.assuntos.map((as) => [
      as,
      ...situacoes.map((s) => String(d.painel.porAssunto[as][s])),
      String(Object.values(d.painel.porAssunto[as]).reduce((x, y) => x + y, 0)),
    ]),
    [t("total"), ...situacoes.map((s) => String(d.painel.total[s])), String(d.painel.itens)],
  ];
  const xlsx = planilhaComAbas([{ nome: t("painel"), linhas: painel }, ...abasDoPedido]);
  await auditar(a, "negocio.pedido_exportado", "deal", d.dealId, { titulo: d.titulo });
  const nome = `${d.titulo.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-respondido.xlsx`;
  return { ok: true, nome, conteudo: Buffer.from(xlsx).toString("base64") };
}

// --- Rediligência ----------------------------------------------------------------------------

/**
 * Começa um pedido a partir de um pedido anterior (de outro negócio da mesma
 * vendedora): copia rodada inicial, assuntos, itens e respostas; as situações
 * voltam a pendente (a validade de cada documento precisa ser conferida) e a
 * resposta registra quais documentos atendiam o item no pedido anterior (os
 * arquivos ficam no outro negócio: precisam ser enviados de novo neste).
 */
export async function criarPedidoPorRediligencia(
  acesso: Acesso | null,
  dealId: string,
  origemId: string,
  entrada: DadosDoPedidoEntrada,
): Promise<ResultadoComId> {
  const a = exigirTenant(acesso);
  const ctx = await contexto(a, dealId);
  if (!ctx) return { erro: "pedidos.erros.naoEncontrado" };
  if (!ctx.vendedor || !ctx.pode("criar")) return { erro: "pedidos.erros.semPermissao" };
  const permitidos = await pedidosAnteriores(a, dealId);
  if (!permitidos.some((p) => p.id === origemId))
    return { erro: "pedidos.erros.origemInvalida", campo: "origemId" };
  const origem = await obterPedido(a, origemId);
  if (!origem) return { erro: "pedidos.erros.origemInvalida", campo: "origemId" };
  const criado = await criarPedido(
    a,
    dealId,
    { ...entrada, periodos: entrada.periodos || origem.periodos.join(", ") },
    origemId,
  );
  if (!("ok" in criado)) return criado;
  const tr = await tradutor();
  const [rodada] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ id: pedidoRodada.id }).from(pedidoRodada).where(eq(pedidoRodada.pedidoId, criado.id)),
  );
  const [registro] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ colunas: pedidoDocumentos.colunas, periodos: pedidoDocumentos.periodos })
      .from(pedidoDocumentos)
      .where(eq(pedidoDocumentos.id, origemId)),
  );
  const originais = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: pedidoItem.id, original: pedidoItem.original })
      .from(pedidoItem)
      .where(eq(pedidoItem.pedidoId, origemId)),
  );
  const originalDe = new Map(originais.map((o) => [o.id, o.original]));
  const hoje = hojeEmSaoPaulo();
  await comTenant(a.tenant.id, async (tx) => {
    if (origem.itens.length)
      for (let k = 0; k < origem.itens.length; k += 500)
        await tx.insert(pedidoItem).values(
          origem.itens.slice(k, k + 500).map((i, j) => {
            const anteriores = i.documentos.map((x) => x.titulo).join("; ");
            const nota = anteriores
              ? tr("pedidos.rediligencia.documentosAnteriores", { documentos: anteriores })
              : "";
            return {
              tenantId: a.tenant.id,
              pedidoId: criado.id,
              rodadaId: rodada.id,
              assunto: i.assunto,
              codigo: i.codigo,
              grupo: i.grupo,
              subgrupo: i.subgrupo,
              prioridade: i.prioridade,
              descricao: i.descricao,
              formato: i.formato,
              tipo: i.tipo,
              dataPedido: hoje,
              departamento: i.departamento,
              observacaoSolicitante: i.observacaoSolicitante,
              resposta: [i.resposta, nota].filter(Boolean).join("\n") || null,
              ondeObter: i.ondeObter,
              fonteId: i.fonteId,
              situacoes: {},
              situacao: "pendente" as const,
              original: originalDe.get(i.id) ?? {},
              ordem: k + j + 1,
            };
          }),
        );
    await tx
      .update(pedidoDocumentos)
      .set({ colunas: registro?.colunas ?? {} })
      .where(eq(pedidoDocumentos.id, criado.id));
  });
  return criado;
}

// --- Catálogo "onde obter" e escala de prioridades (Configurações) -----------------------------

export type FonteNaTela = {
  id: string;
  nome: string;
  orgao: string;
  link: string | null;
  abrangencia: "federal" | "estadual" | "municipal";
  gratuito: boolean;
  observacao: string | null;
};

export async function listarFontes(acesso: Acesso | null): Promise<FonteNaTela[]> {
  const a = await exigirPermissao(acesso, "cadastros", "ver");
  return comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        id: fonteDeDocumento.id,
        nome: fonteDeDocumento.nome,
        orgao: fonteDeDocumento.orgao,
        link: fonteDeDocumento.link,
        abrangencia: fonteDeDocumento.abrangencia,
        gratuito: fonteDeDocumento.gratuito,
        observacao: fonteDeDocumento.observacao,
      })
      .from(fonteDeDocumento)
      .orderBy(
        sql`case ${fonteDeDocumento.abrangencia} when 'federal' then 1 when 'estadual' then 2 else 3 end`,
        asc(fonteDeDocumento.nome),
      ),
  );
}

const DadosDaFonte = z.object({
  nome: z.string().trim().min(2, "pedidos.erros.nomeObrigatorio").max(200, "pedidos.erros.textoLongo"),
  orgao: z.string().trim().min(2, "pedidos.erros.orgaoObrigatorio").max(160, "pedidos.erros.textoLongo"),
  link: z
    .union([z.url({ protocol: /^https?$/, error: "pedidos.erros.linkInvalido" }), z.literal("")])
    .transform((v) => v || null)
    .nullable()
    .optional(),
  abrangencia: z.enum(["federal", "estadual", "municipal"]),
  gratuito: z.boolean(),
  observacao: texto(500),
});
export type DadosDaFonteEntrada = z.input<typeof DadosDaFonte>;

export async function salvarFonte(
  acesso: Acesso | null,
  id: string | null,
  entrada: DadosDaFonteEntrada,
): Promise<ResultadoComId> {
  const a = await exigirPermissao(acesso, "cadastros", id ? "editar" : "criar");
  const r = DadosDaFonte.safeParse(entrada);
  if (!r.success) return erroDe(r);
  const d = r.data;
  const valores = { ...d, link: d.link ?? null, observacao: d.observacao ?? null };
  if (id && !uuidValido(id)) return { erro: "pedidos.erros.naoEncontrado" };
  const novoId = await comTenant(a.tenant.id, async (tx) => {
    if (id) {
      const [x] = await tx
        .update(fonteDeDocumento)
        .set(valores)
        .where(eq(fonteDeDocumento.id, id))
        .returning({ id: fonteDeDocumento.id });
      return x?.id ?? null;
    }
    const [x] = await tx
      .insert(fonteDeDocumento)
      .values({ tenantId: a.tenant.id, ...valores })
      .returning({ id: fonteDeDocumento.id });
    return x.id;
  });
  if (!novoId) return { erro: "pedidos.erros.naoEncontrado" };
  await auditar(a, id ? "cadastro.fonte_editada" : "cadastro.fonte_criada", "fonte_de_documento", novoId, {});
  return { ok: true, id: novoId };
}

export async function excluirFonte(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "cadastros", "excluir");
  if (!uuidValido(id)) return { erro: "pedidos.erros.naoEncontrado" };
  await comTenant(a.tenant.id, (tx) => tx.delete(fonteDeDocumento).where(eq(fonteDeDocumento.id, id)));
  await auditar(a, "cadastro.fonte_excluida", "fonte_de_documento", id, {});
  return { ok: true };
}

/** Catálogo padrão para o tenant que ainda não tem nenhuma fonte (cadastros padrão). */
export async function completarFontesPadrao(
  tx: Parameters<Parameters<typeof comTenant>[1]>[0],
  tenantId: string,
): Promise<void> {
  const [{ n }] = await tx.select({ n: count() }).from(fonteDeDocumento);
  if (n > 0) return;
  await tx
    .insert(fonteDeDocumento)
    .values(FONTES_PADRAO.map((f) => ({ tenantId, ...f, observacao: f.observacao ?? null })));
}

export async function obterPrioridades(acesso: Acesso | null): Promise<string[]> {
  const a = await exigirPermissao(acesso, "cadastros", "ver");
  const [t] = await banco()
    .select({ p: tenant.prioridadesPedido })
    .from(tenant)
    .where(eq(tenant.id, a.tenant.id));
  return t?.p?.length ? t.p : PRIORIDADES_PADRAO;
}

export async function definirPrioridades(acesso: Acesso | null, prioridades: string[]): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "cadastros", "editar");
  const lista = [...new Set(prioridades.map((p) => p.trim().slice(0, 40)).filter(Boolean))];
  if (lista.length < 2 || lista.length > 10) return { erro: "pedidos.erros.prioridades" };
  await banco().update(tenant).set({ prioridadesPedido: lista }).where(eq(tenant.id, a.tenant.id));
  await auditar(a, "cadastro.prioridades_definidas", "tenant", a.tenant.id, { quantidade: lista.length });
  return { ok: true };
}

// Usado pela tela de documentos: em quais itens de pedido cada documento entra.
export async function itensDoDocumento(acesso: Acesso | null, documentoId: string) {
  const a = exigirTenant(acesso);
  if (!uuidValido(documentoId)) return [];
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        itemId: pedidoItem.id,
        pedidoId: pedidoItem.pedidoId,
        codigo: pedidoItem.codigo,
        dealId: documento.dealId,
      })
      .from(pedidoItemDocumento)
      .innerJoin(pedidoItem, eq(pedidoItem.id, pedidoItemDocumento.itemId))
      .innerJoin(documento, eq(documento.id, pedidoItemDocumento.documentoId))
      .where(eq(pedidoItemDocumento.documentoId, documentoId)),
  );
  const visiveis = [];
  for (const l of linhas) if (await pedidoVisivel(a, l.pedidoId)) visiveis.push(l);
  return visiveis;
}
