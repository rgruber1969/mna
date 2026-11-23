import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { lerNumero } from "@/config/ofertas";
import type { ErroDeServico } from "@/i18n/servidor";
import { tradutor } from "@/i18n/servidor";
import {
  chaveDoArquivo,
  gerarLinkDeDownload,
  gerarLinkDeEnvio,
  lerArquivo,
} from "@/server/arquivos/armazenamento";
import { comTenant } from "@/server/db/cliente";
import {
  contaBancaria,
  contrato,
  contratoAcesso,
  contratoArquivo,
  contratoParte,
  deal,
  empresa,
  perfil,
  pessoa,
  usuario,
} from "@/server/db/esquema";
import { enviarEmail } from "@/server/email/enviar";
import { montarEmail } from "@/server/email/modelo";
import { urlDaArea } from "@/server/enderecos";
import { exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import { verificarArquivo } from "./antivirus";
import { descriptografar } from "./cripto/cripto";
import {
  contextoDoDataRoom,
  dataRoomDoNegocio,
  TAMANHO_MAXIMO_DOCUMENTO,
  tipoDoDocumento,
} from "./documentos";
import { auditar } from "./empresas";
import { marcaParaEmail } from "./marca";
import {
  empresasDoNegocio,
  empresaVisivel,
  negocioFechado,
  nomeVisivel,
  paginaDeNegocios,
  visaoDoNegocio,
} from "./negocios";
import type { Acao } from "./permissoes/catalogo";
import { pode } from "./permissoes/verificador";

/**
 * Contratos de serviço (item 17; dominio.md, "Contrato de serviço"; C1–C4).
 *
 * - Tipo (mandato do advisor, honorários advocatícios, outro), uma ou mais
 *   contratantes e contratadas, vigência, exclusividade, honorários fixos
 *   (retainer, descontados ou não do success fee) e/ou variáveis apurados
 *   mês a mês (por horas, percentual sobre uma base ou outro critério),
 *   success fee (percentual e mínimo), forma de pagamento e onde a contratada
 *   recebe (conta bancária ou chave PIX do cadastro); arquivos em versões.
 * - Pode nascer avulso e ser ligado a um negócio depois (C2).
 * - No negócio: permissões da matriz "Contratos"; quem vê é a lista de acesso
 *   de quem criou (pré-preenchida com o próprio lado), como nos documentos.
 *   Acesso por perfil só vale no grupo de quem criou (lado vendedor ou a
 *   mesma compradora).
 * - Avulso: cria quem pode criar negócios; vê quem criou, os administradores
 *   e os usuários da lista; edita quem vê e pode editar negócios; exclui quem
 *   criou ou administrador.
 * - Cobrança (C3): só registra as condições, estima o success fee e envia ao
 *   financeiro da contratada os dados para nota fiscal e cobrança.
 */

type Resultado = { ok: true } | ErroDeServico;
const uuidValido = (id: string) => z.uuid().safeParse(id).success;

export const TIPOS_DE_CONTRATO = ["mandato", "honorarios", "outro"] as const;
export const PERIODICIDADES = ["unico", "mensal", "trimestral", "semestral", "anual"] as const;
export type TipoDeContrato = (typeof TIPOS_DE_CONTRATO)[number];
export type Periodicidade = (typeof PERIODICIDADES)[number];
export const CRITERIOS_VARIAVEIS = ["horas", "percentual", "outro"] as const;
export type CriterioVariavel = (typeof CRITERIOS_VARIAVEIS)[number];

// --- Cálculo ---------------------------------------------------------------------------------

export { successFeeEstimado } from "@/config/success-fee";

// --- Contexto e visibilidade -----------------------------------------------------------------

type Linha = typeof contrato.$inferSelect;
type AcessoDoContrato = { perfilId: string | null; usuarioId: string | null };

/** O que a pessoa pode num negócio (cacheado por chamada). */
function contextoDosNegocios(a: AcessoTenant) {
  const porNegocio = new Map<string, Promise<CtxNegocio | null>>();
  let tenant: Promise<{ criar: boolean; editar: boolean }> | null = null;
  return {
    negocio(dealId: string) {
      if (!porNegocio.has(dealId)) porNegocio.set(dealId, contextoDoNegocio(a, dealId));
      return porNegocio.get(dealId)!;
    },
    avulso() {
      tenant ??= Promise.all([pode(a, "deals", "criar"), pode(a, "deals", "editar")]).then(
        ([criar, editar]) => ({ criar, editar }),
      );
      return tenant;
    },
  };
}

type CtxNegocio = {
  pode: (acao: Acao) => boolean;
  perfis: Set<string>;
  mesmoGrupo: (usuarioId: string | null) => boolean;
  fechado: boolean;
  nome: string;
};

async function contextoDoNegocio(a: AcessoTenant, dealId: string): Promise<CtxNegocio | null> {
  const [d] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ numero: deal.numero, codinome: deal.codinome }).from(deal).where(eq(deal.id, dealId)),
  );
  if (!d) return null;
  const acoes: Acao[] = ["ver", "criar", "editar", "excluir", "baixar"];
  const permitidas = new Set<Acao>();
  for (const acao of acoes) if (await pode(a, "contratos", acao, { dealId })) permitidas.add(acao);
  if (!permitidas.has("ver")) return null;
  const dr = await contextoDoDataRoom(a, dealId);
  return {
    pode: (acao) => permitidas.has(acao),
    perfis: dr.perfisNa(null),
    mesmoGrupo: dr.mesmoGrupo,
    fechado: Boolean(await negocioFechado(a, dealId)),
    nome: nomeVisivel(d.numero, d.codinome),
  };
}

function visivel(a: AcessoTenant, c: Linha, acessos: AcessoDoContrato[], ctx: CtxNegocio | null) {
  if (a.administrador || c.criadoPor === a.usuario.id) return true;
  if (c.dealId && !ctx) return false;
  if (acessos.some((x) => x.usuarioId === a.usuario.id)) return true;
  return Boolean(
    ctx &&
    ctx.mesmoGrupo(c.criadoPor) &&
    acessos.some((x) => x.perfilId !== null && ctx.perfis.has(x.perfilId)),
  );
}

type Capacidades = { editar: boolean; excluir: boolean; baixar: boolean };

async function capacidades(
  a: AcessoTenant,
  c: Linha,
  ctx: CtxNegocio | null,
  tenant: () => Promise<{ criar: boolean; editar: boolean }>,
): Promise<Capacidades> {
  if (c.dealId) {
    if (!ctx) return { editar: a.administrador, excluir: a.administrador, baixar: a.administrador };
    return {
      editar: !ctx.fechado && (a.administrador || ctx.pode("editar")),
      excluir: !ctx.fechado && (a.administrador || ctx.pode("excluir")),
      baixar: a.administrador || ctx.pode("baixar"),
    };
  }
  const dono = a.administrador || c.criadoPor === a.usuario.id;
  return { editar: dono || (await tenant()).editar, excluir: dono, baixar: true };
}

// --- Consulta --------------------------------------------------------------------------------

export type ParteDoContrato = { empresaId: string; nome: string; papel: "contratante" | "contratada" };

export type ContratoResumo = {
  id: string;
  titulo: string;
  tipo: TipoDeContrato;
  dealId: string | null;
  negocio: string | null;
  contratantes: string[];
  contratadas: string[];
  inicio: string | null;
  fim: string | null;
  vigente: boolean;
  arquivos: number;
};

export type ArquivoDoContrato = {
  id: string;
  numero: number;
  nomeArquivo: string;
  tamanho: number;
  situacao: "enviando" | "disponivel" | "bloqueado";
  comentario: string | null;
  enviadoPor: string | null;
  criadoEm: string;
};

export type ContratoDetalhe = ContratoResumo & {
  objeto: string | null;
  dataAssinatura: string | null;
  exclusivo: boolean;
  exclusividadeAte: string | null;
  honorarioFixo: string | null;
  periodicidade: Periodicidade | null;
  retainerDescontado: boolean;
  honorarioVariavel: boolean;
  variavelCriterio: CriterioVariavel | null;
  variavelValorHora: string | null;
  variavelPercentual: string | null;
  variavelBase: string | null;
  variavelTeto: string | null;
  variavelDiaApuracao: number | null;
  successFeePercentual: string | null;
  successFeeMinimo: string | null;
  formaPagamento: string | null;
  contaBancariaId: string | null;
  meioRecebimento: "conta" | "pix";
  /** Conta ou chave PIX mascarada (ex.: "Itaú · ag ***12 · c ***456" ou "PIX CNPJ ***-61"). */
  conta: string | null;
  observacoes: string | null;
  partes: ParteDoContrato[];
  acesso: string[];
  acessoIds: { perfis: string[]; usuarios: string[] };
  arquivosLista: ArquivoDoContrato[];
  criadoPor: string | null;
  financeiroAvisadoEm: string | null;
  podeEditar: boolean;
  podeExcluir: boolean;
  podeBaixar: boolean;
};

const hoje = () => new Date().toISOString().slice(0, 10);
const vigente = (c: { inicio: string | null; fim: string | null }) =>
  (!c.inicio || c.inicio <= hoje()) && (!c.fim || c.fim >= hoje());

async function partesDe(a: AcessoTenant, ids: string[]) {
  if (ids.length === 0) return new Map<string, ParteDoContrato[]>();
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        contratoId: contratoParte.contratoId,
        empresaId: contratoParte.empresaId,
        papel: contratoParte.papel,
        razaoSocial: empresa.razaoSocial,
        nomeFantasia: empresa.nomeFantasia,
      })
      .from(contratoParte)
      .innerJoin(empresa, eq(empresa.id, contratoParte.empresaId))
      .where(inArray(contratoParte.contratoId, ids))
      .orderBy(asc(empresa.razaoSocial)),
  );
  const por = new Map<string, ParteDoContrato[]>();
  for (const l of linhas)
    por.set(l.contratoId, [
      ...(por.get(l.contratoId) ?? []),
      { empresaId: l.empresaId, nome: l.nomeFantasia || l.razaoSocial, papel: l.papel },
    ]);
  return por;
}

async function acessosDe(a: AcessoTenant, ids: string[]) {
  if (ids.length === 0)
    return new Map<string, (AcessoDoContrato & { perfil: string | null; usuario: string | null })[]>();
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        contratoId: contratoAcesso.contratoId,
        perfilId: contratoAcesso.perfilId,
        usuarioId: contratoAcesso.usuarioId,
        perfil: perfil.nome,
        usuario: usuario.name,
      })
      .from(contratoAcesso)
      .leftJoin(perfil, eq(perfil.id, contratoAcesso.perfilId))
      .leftJoin(usuario, eq(usuario.id, contratoAcesso.usuarioId))
      .where(inArray(contratoAcesso.contratoId, ids)),
  );
  const por = new Map<string, (AcessoDoContrato & { perfil: string | null; usuario: string | null })[]>();
  for (const l of linhas) por.set(l.contratoId, [...(por.get(l.contratoId) ?? []), l]);
  return por;
}

/**
 * Contratos que a pessoa vê: os de um negócio, os avulsos (`dealId: null`)
 * ou todos (sem filtro).
 */
export async function listarContratos(
  acesso: Acesso | null,
  filtro: { dealId?: string | null } = {},
): Promise<ContratoResumo[]> {
  const a = exigirTenant(acesso);
  if (filtro.dealId && !uuidValido(filtro.dealId)) return [];
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select()
      .from(contrato)
      .where(
        filtro.dealId === undefined
          ? undefined
          : filtro.dealId === null
            ? isNull(contrato.dealId)
            : eq(contrato.dealId, filtro.dealId),
      )
      .orderBy(desc(contrato.criadoEm)),
  );
  const ids = linhas.map((c) => c.id);
  const [partes, acessos, arquivos] = await Promise.all([
    partesDe(a, ids),
    acessosDe(a, ids),
    ids.length
      ? comTenant(a.tenant.id, (tx) =>
          tx
            .select({ contratoId: contratoArquivo.contratoId })
            .from(contratoArquivo)
            .where(and(inArray(contratoArquivo.contratoId, ids), eq(contratoArquivo.situacao, "disponivel"))),
        )
      : [],
  ]);
  const ctxs = contextoDosNegocios(a);
  const visiveis: ContratoResumo[] = [];
  for (const c of linhas) {
    const ctx = c.dealId ? await ctxs.negocio(c.dealId) : null;
    if (!visivel(a, c, acessos.get(c.id) ?? [], ctx)) continue;
    const p = partes.get(c.id) ?? [];
    visiveis.push({
      id: c.id,
      titulo: c.titulo,
      tipo: c.tipo,
      dealId: c.dealId,
      negocio: ctx?.nome ?? null,
      contratantes: p.filter((x) => x.papel === "contratante").map((x) => x.nome),
      contratadas: p.filter((x) => x.papel === "contratada").map((x) => x.nome),
      inicio: c.inicio,
      fim: c.fim,
      vigente: vigente(c),
      arquivos: arquivos.filter((x) => x.contratoId === c.id).length,
    });
  }
  return visiveis;
}

async function linhaVisivel(a: AcessoTenant, id: string) {
  if (!uuidValido(id)) return null;
  const [c] = await comTenant(a.tenant.id, (tx) => tx.select().from(contrato).where(eq(contrato.id, id)));
  if (!c) return null;
  const ctxs = contextoDosNegocios(a);
  const ctx = c.dealId ? await ctxs.negocio(c.dealId) : null;
  const acessos = (await acessosDe(a, [id])).get(id) ?? [];
  if (!visivel(a, c, acessos, ctx)) return null;
  const pode = await capacidades(a, c, ctx, ctxs.avulso);
  return { c, ctx, acessos, pode };
}

const NOME_DA_CHAVE_PIX = {
  cnpj: "CNPJ",
  cpf: "CPF",
  email: "e-mail",
  telefone: "telefone",
  aleatoria: "chave aleatória",
} as const;

/** Conta mascarada (agência e conta) ou, com meio "pix", a chave PIX mascarada da mesma conta. */
async function descreverConta(
  a: AcessoTenant,
  contaId: string | null,
  meio: "conta" | "pix" = "conta",
): Promise<string | null> {
  if (!contaId) return null;
  const [x] = await comTenant(a.tenant.id, (tx) =>
    tx.select().from(contaBancaria).where(eq(contaBancaria.id, contaId)),
  );
  if (!x) return null;
  const mascarar = async (v: string | null) => {
    if (!v) return null;
    const s = await descriptografar(a.tenant.id, v);
    return s.length <= 3 ? "***" : `***${s.slice(-3)}`;
  };
  if (meio === "pix") {
    const chave = await mascarar(x.chavePixCifrada);
    if (!chave) return null;
    return ["PIX", x.tipoChavePix ? NOME_DA_CHAVE_PIX[x.tipoChavePix] : null, chave]
      .filter(Boolean)
      .join(" ");
  }
  const [ag, cc] = await Promise.all([mascarar(x.agenciaCifrada), mascarar(x.contaCifrada)]);
  return [x.bancoNome ?? x.bancoCodigo, ag && `ag ${ag}`, cc && `c ${cc}`].filter(Boolean).join(" · ");
}

export async function obterContrato(acesso: Acesso | null, id: string): Promise<ContratoDetalhe | null> {
  const a = exigirTenant(acesso);
  const v = await linhaVisivel(a, id);
  if (!v) return null;
  const { c, ctx, acessos, pode } = v;
  const [partes, arquivos, conta, criador] = await Promise.all([
    partesDe(a, [id]).then((m) => m.get(id) ?? []),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({
          id: contratoArquivo.id,
          numero: contratoArquivo.numero,
          nomeArquivo: contratoArquivo.nomeArquivo,
          tamanho: contratoArquivo.tamanho,
          situacao: contratoArquivo.situacao,
          comentario: contratoArquivo.comentario,
          enviadoPor: usuario.name,
          criadoEm: contratoArquivo.criadoEm,
        })
        .from(contratoArquivo)
        .leftJoin(usuario, eq(usuario.id, contratoArquivo.enviadoPor))
        .where(and(eq(contratoArquivo.contratoId, id)))
        .orderBy(desc(contratoArquivo.numero)),
    ),
    descreverConta(a, c.contaBancariaId, c.meioRecebimento),
    c.criadoPor
      ? comTenant(a.tenant.id, (tx) =>
          tx.select({ nome: usuario.name }).from(usuario).where(eq(usuario.id, c.criadoPor!)),
        ).then((l) => l[0]?.nome ?? null)
      : null,
  ]);
  const disponiveis = arquivos.filter((x) => x.situacao !== "enviando");
  return {
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    dealId: c.dealId,
    negocio: ctx?.nome ?? null,
    contratantes: partes.filter((x) => x.papel === "contratante").map((x) => x.nome),
    contratadas: partes.filter((x) => x.papel === "contratada").map((x) => x.nome),
    inicio: c.inicio,
    fim: c.fim,
    vigente: vigente(c),
    arquivos: disponiveis.filter((x) => x.situacao === "disponivel").length,
    objeto: c.objeto,
    dataAssinatura: c.dataAssinatura,
    exclusivo: c.exclusivo,
    exclusividadeAte: c.exclusividadeAte,
    honorarioFixo: c.honorarioFixo,
    periodicidade: c.periodicidade,
    retainerDescontado: c.retainerDescontado,
    honorarioVariavel: c.honorarioVariavel,
    variavelCriterio: c.variavelCriterio,
    variavelValorHora: c.variavelValorHora,
    variavelPercentual: c.variavelPercentual,
    variavelBase: c.variavelBase,
    variavelTeto: c.variavelTeto,
    variavelDiaApuracao: c.variavelDiaApuracao,
    successFeePercentual: c.successFeePercentual,
    successFeeMinimo: c.successFeeMinimo,
    formaPagamento: c.formaPagamento,
    contaBancariaId: c.contaBancariaId,
    meioRecebimento: c.meioRecebimento,
    conta,
    observacoes: c.observacoes,
    partes,
    acesso: acessos.map((x) => x.perfil ?? x.usuario ?? "—"),
    acessoIds: {
      perfis: acessos.flatMap((x) => (x.perfilId ? [x.perfilId] : [])),
      usuarios: acessos.flatMap((x) => (x.usuarioId ? [x.usuarioId] : [])),
    },
    arquivosLista: disponiveis.map((x) => ({ ...x, criadoEm: x.criadoEm.toISOString() })),
    criadoPor: criador,
    financeiroAvisadoEm: c.financeiroAvisadoEm?.toISOString() ?? null,
    podeEditar: pode.editar,
    podeExcluir: pode.excluir,
    podeBaixar: pode.baixar,
  };
}

// --- Opções do formulário --------------------------------------------------------------------

export type OpcoesDoContrato = {
  podeCriar: boolean;
  empresas: { id: string; nome: string }[];
  perfis: { id: string; nome: string }[];
  usuarios: { id: string; nome: string }[];
  /** Pré-preenchimento da lista de acesso: o próprio lado (C: "Quem vê"). */
  meuLado: string[];
};

/** Empresas que podem ser partes: no negócio, as que a pessoa vê nele; avulso, o cadastro. */
async function empresasPermitidas(a: AcessoTenant, dealId: string | null) {
  if (dealId) {
    const [empresas, visao] = await Promise.all([
      empresasDoNegocio(a, dealId),
      visaoDoNegocio(a, dealId).then((r) => r.visao),
    ]);
    const ids = [...new Set(empresas.filter((e) => empresaVisivel(visao, e)).map((e) => e.empresaId))];
    // A própria empresa do contratante (advisor) também pode ser parte.
    const proprias = await comTenant(a.tenant.id, (tx) =>
      tx.select({ id: empresa.id }).from(empresa).where(eq(empresa.doContratante, true)),
    );
    return new Set([...ids, ...proprias.map((x) => x.id)]);
  }
  return null; // avulso: qualquer empresa ativa do cadastro
}

export async function opcoesDoContrato(
  acesso: Acesso | null,
  dealId: string | null,
): Promise<OpcoesDoContrato> {
  const a = exigirTenant(acesso);
  const vazio = { podeCriar: false, empresas: [], perfis: [], usuarios: [], meuLado: [] };
  if (dealId && !uuidValido(dealId)) return vazio;
  const ctxs = contextoDosNegocios(a);
  const podeCriar = dealId
    ? await ctxs
        .negocio(dealId)
        .then((ctx) => Boolean(ctx && !ctx.fechado && (a.administrador || ctx.pode("criar"))))
    : a.administrador || (await ctxs.avulso()).criar;
  if (!podeCriar) return vazio;
  const permitidas = await empresasPermitidas(a, dealId);
  const empresas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: empresa.id, razaoSocial: empresa.razaoSocial, nomeFantasia: empresa.nomeFantasia })
      .from(empresa)
      .where(permitidas ? inArray(empresa.id, [...permitidas]) : isNull(empresa.inativaEm))
      .orderBy(asc(empresa.razaoSocial)),
  );
  const listaEmpresas = empresas.map((e) => ({
    id: e.id,
    nome: e.nomeFantasia ? `${e.razaoSocial} (${e.nomeFantasia})` : e.razaoSocial,
  }));
  if (dealId) {
    const dr = await dataRoomDoNegocio(a, dealId);
    return {
      podeCriar,
      empresas: listaEmpresas,
      perfis: dr?.opcoesDeAcesso.perfis ?? [],
      usuarios: (dr?.opcoesDeAcesso.usuarios ?? []).map((u) => ({ id: u.id, nome: u.nome })),
      meuLado: dr?.meuLado ?? [],
    };
  }
  // Avulso: lista de acesso só por usuário (perfis valem dentro de um negócio).
  const usuarios = await comTenant(a.tenant.id, (tx) =>
    tx
      .selectDistinct({ id: usuario.id, nome: usuario.name, email: usuario.email })
      .from(pessoa)
      .innerJoin(usuario, eq(usuario.id, pessoa.usuarioId))
      .orderBy(asc(usuario.name)),
  );
  return {
    podeCriar,
    empresas: listaEmpresas,
    perfis: [],
    usuarios: usuarios
      .filter((u) => u.id !== a.usuario.id && !u.email.endsWith(".invalid"))
      .map(({ id, nome }) => ({ id, nome })),
    meuLado: [],
  };
}

/** Contas das contratadas (mascaradas), para escolher onde recebem: conta ou chave PIX. */
export async function contasDasEmpresas(
  acesso: Acesso | null,
  dealId: string | null,
  empresaIds: string[],
): Promise<{ id: string; empresaId: string; descricao: string; pix: string | null; principal: boolean }[]> {
  const a = exigirTenant(acesso);
  const ids = empresaIds.filter(uuidValido).slice(0, 50);
  if (ids.length === 0) return [];
  const opcoes = await opcoesDoContrato(a, dealId);
  const permitidas = new Set(opcoes.empresas.map((e) => e.id));
  const validos = ids.filter((id) => permitidas.has(id));
  if (validos.length === 0) return [];
  const contas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        id: contaBancaria.id,
        empresaId: contaBancaria.empresaId,
        principal: contaBancaria.principal,
      })
      .from(contaBancaria)
      .where(inArray(contaBancaria.empresaId, validos))
      .orderBy(desc(contaBancaria.principal)),
  );
  return Promise.all(
    contas.map(async (x) => ({
      id: x.id,
      empresaId: x.empresaId!,
      principal: x.principal,
      descricao: (await descreverConta(a, x.id)) ?? "—",
      pix: await descreverConta(a, x.id, "pix"),
    })),
  );
}

// --- Gravação --------------------------------------------------------------------------------

const data = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine(
    (v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))),
    "contratos.erros.dataInvalida",
  );

const decimal = (maximo: number, erro: string) =>
  z
    .string()
    .trim()
    .transform((v) => lerNumero(v))
    .refine((v) => v === null || (/^\d+(\.\d{1,4})?$/.test(v) && Number(v) <= maximo), erro);

const DadosContrato = z.object({
  dealId: z.string().nullable().default(null),
  tipo: z.enum(TIPOS_DE_CONTRATO, "contratos.erros.tipoInvalido"),
  titulo: z
    .string()
    .trim()
    .min(2, "contratos.erros.tituloObrigatorio")
    .max(200, "contratos.erros.tituloLongo"),
  objeto: z.string().trim().max(5000).default(""),
  dataAssinatura: data.prefault(""),
  inicio: data.prefault(""),
  fim: data.prefault(""),
  exclusivo: z.boolean().default(false),
  exclusividadeAte: data.prefault(""),
  honorarioFixo: decimal(1e15, "contratos.erros.valorInvalido").prefault(""),
  periodicidade: z.enum([...PERIODICIDADES, ""], "contratos.erros.periodicidadeInvalida").prefault(""),
  retainerDescontado: z.boolean().default(false),
  honorarioVariavel: z.boolean().default(false),
  variavelCriterio: z.enum([...CRITERIOS_VARIAVEIS, ""], "contratos.erros.criterioInvalido").prefault(""),
  variavelValorHora: decimal(1e15, "contratos.erros.valorInvalido").prefault(""),
  variavelPercentual: decimal(100, "contratos.erros.percentualInvalido").prefault(""),
  variavelBase: z.string().trim().max(1000).default(""),
  variavelTeto: decimal(1e15, "contratos.erros.valorInvalido").prefault(""),
  variavelDiaApuracao: z
    .string()
    .trim()
    .default("")
    .refine(
      (v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 28),
      "contratos.erros.diaInvalido",
    ),
  successFeePercentual: decimal(100, "contratos.erros.percentualInvalido").prefault(""),
  successFeeMinimo: decimal(1e15, "contratos.erros.valorInvalido").prefault(""),
  formaPagamento: z.string().trim().max(1000).default(""),
  contaBancariaId: z.string().default(""),
  meioRecebimento: z.enum(["conta", "pix"]).default("conta"),
  observacoes: z.string().trim().max(5000).default(""),
  contratantes: z.array(z.string()).max(20).default([]),
  contratadas: z.array(z.string()).max(20).default([]),
  perfis: z.array(z.string()).max(50).default([]),
  usuarios: z.array(z.string()).max(200).default([]),
});
export type DadosContrato = z.input<typeof DadosContrato>;

type Validado = z.output<typeof DadosContrato>;

async function validar(
  a: AcessoTenant,
  entrada: unknown,
  dealId: string | null,
): Promise<{ d: Validado } | ErroDeServico> {
  const r = DadosContrato.safeParse(entrada);
  if (!r.success) {
    const i = r.error.issues[0];
    return {
      erro: i.message.startsWith("contratos.") ? i.message : "contratos.erros.dadosInvalidos",
      campo: String(i.path[0] ?? ""),
    };
  }
  const d = r.data;
  const contratantes = [...new Set(d.contratantes.filter(uuidValido))];
  const contratadas = [...new Set(d.contratadas.filter(uuidValido))];
  if (contratantes.length === 0)
    return { erro: "contratos.erros.contratanteObrigatoria", campo: "contratantes" };
  if (contratadas.length === 0)
    return { erro: "contratos.erros.contratadaObrigatoria", campo: "contratadas" };
  if (d.inicio && d.fim && d.fim < d.inicio)
    return { erro: "contratos.erros.fimAntesDoInicio", campo: "fim" };
  if (d.honorarioVariavel) {
    if (!d.variavelCriterio)
      return { erro: "contratos.erros.criterioObrigatorio", campo: "variavelCriterio" };
    if (d.variavelCriterio === "horas" && !d.variavelValorHora)
      return { erro: "contratos.erros.valorHoraObrigatorio", campo: "variavelValorHora" };
    if (d.variavelCriterio === "percentual" && !d.variavelPercentual)
      return { erro: "contratos.erros.percentualObrigatorio", campo: "variavelPercentual" };
    if (d.variavelCriterio !== "horas" && !d.variavelBase)
      return { erro: "contratos.erros.baseObrigatoria", campo: "variavelBase" };
  }
  const opcoes = await opcoesDoContrato(a, dealId);
  const empresas = new Set(opcoes.empresas.map((e) => e.id));
  if (![...contratantes, ...contratadas].every((id) => empresas.has(id)))
    return { erro: "contratos.erros.empresaInvalida", campo: "contratantes" };
  if (d.contaBancariaId) {
    if (!uuidValido(d.contaBancariaId))
      return { erro: "contratos.erros.contaInvalida", campo: "contaBancariaId" };
    const [conta] = await comTenant(a.tenant.id, (tx) =>
      tx
        .select({ empresaId: contaBancaria.empresaId, pix: contaBancaria.chavePixCifrada })
        .from(contaBancaria)
        .where(eq(contaBancaria.id, d.contaBancariaId)),
    );
    if (!conta?.empresaId || !contratadas.includes(conta.empresaId))
      return { erro: "contratos.erros.contaInvalida", campo: "contaBancariaId" };
    if (d.meioRecebimento === "pix" && !conta.pix)
      return { erro: "contratos.erros.contaSemPix", campo: "contaBancariaId" };
  }
  const perfisValidos = new Set(opcoes.perfis.map((p) => p.id));
  const usuariosValidos = new Set(opcoes.usuarios.map((u) => u.id));
  return {
    d: {
      ...d,
      contratantes,
      contratadas,
      perfis: [...new Set(d.perfis)].filter((p) => perfisValidos.has(p)),
      usuarios: [...new Set(d.usuarios)].filter((u) => usuariosValidos.has(u)),
    },
  };
}

const colunas = (d: Validado) => ({
  tipo: d.tipo,
  titulo: d.titulo,
  objeto: d.objeto || null,
  dataAssinatura: d.dataAssinatura,
  inicio: d.inicio,
  fim: d.fim,
  exclusivo: d.exclusivo,
  exclusividadeAte: d.exclusivo ? d.exclusividadeAte : null,
  honorarioFixo: d.honorarioFixo,
  periodicidade: d.honorarioFixo ? d.periodicidade || null : null,
  retainerDescontado: d.honorarioFixo ? d.retainerDescontado : false,
  honorarioVariavel: d.honorarioVariavel,
  variavelCriterio: d.honorarioVariavel ? d.variavelCriterio || null : null,
  variavelValorHora: d.honorarioVariavel && d.variavelCriterio === "horas" ? d.variavelValorHora : null,
  variavelPercentual:
    d.honorarioVariavel && d.variavelCriterio === "percentual" ? d.variavelPercentual : null,
  variavelBase: d.honorarioVariavel && d.variavelCriterio !== "horas" ? d.variavelBase || null : null,
  variavelTeto: d.honorarioVariavel ? d.variavelTeto : null,
  variavelDiaApuracao: d.honorarioVariavel && d.variavelDiaApuracao ? Number(d.variavelDiaApuracao) : null,
  successFeePercentual: d.successFeePercentual,
  successFeeMinimo: d.successFeeMinimo,
  formaPagamento: d.formaPagamento || null,
  contaBancariaId: d.contaBancariaId || null,
  meioRecebimento: d.contaBancariaId ? d.meioRecebimento : "conta",
  observacoes: d.observacoes || null,
});

async function gravarPartesEAcesso(
  tx: Parameters<Parameters<typeof comTenant>[1]>[0],
  tenantId: string,
  contratoId: string,
  d: Validado,
) {
  await tx.delete(contratoParte).where(eq(contratoParte.contratoId, contratoId));
  await tx.delete(contratoAcesso).where(eq(contratoAcesso.contratoId, contratoId));
  await tx.insert(contratoParte).values([
    ...d.contratantes.map((empresaId) => ({
      tenantId,
      contratoId,
      empresaId,
      papel: "contratante" as const,
    })),
    ...d.contratadas.map((empresaId) => ({
      tenantId,
      contratoId,
      empresaId,
      papel: "contratada" as const,
    })),
  ]);
  const acessos = [
    ...d.perfis.map((perfilId) => ({ tenantId, contratoId, perfilId })),
    ...d.usuarios.map((usuarioId) => ({ tenantId, contratoId, usuarioId })),
  ];
  if (acessos.length) await tx.insert(contratoAcesso).values(acessos);
}

export async function criarContrato(
  acesso: Acesso | null,
  entrada: DadosContrato,
): Promise<{ id: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const dealId = entrada.dealId ?? null;
  if (dealId && !uuidValido(dealId)) return { erro: "contratos.erros.naoEncontrado" };
  if (dealId) {
    const fechado = await negocioFechado(a, dealId);
    if (fechado) return fechado;
  }
  const opcoes = await opcoesDoContrato(a, dealId);
  if (!opcoes.podeCriar) return { erro: "erros.acessoNegado" };
  const v = await validar(a, entrada, dealId);
  if ("erro" in v) return v;
  const id = randomUUID();
  await comTenant(a.tenant.id, async (tx) => {
    await tx.insert(contrato).values({
      id,
      tenantId: a.tenant.id,
      dealId,
      criadoPor: a.usuario.id,
      ...colunas(v.d),
    });
    await gravarPartesEAcesso(tx, a.tenant.id, id, v.d);
  });
  await auditar(a, "contrato.criado", "contrato", id, dealId ? { dealId } : undefined);
  return { id };
}

/**
 * Edita o contrato. Um contrato avulso pode ser ligado a um negócio (C2), se a
 * pessoa puder criar contratos nele; depois de ligado, não muda de negócio.
 */
export async function editarContrato(
  acesso: Acesso | null,
  id: string,
  entrada: DadosContrato,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const v0 = await linhaVisivel(a, id);
  if (!v0) return { erro: "contratos.erros.naoEncontrado" };
  if (!v0.pode.editar) return { erro: "erros.acessoNegado" };
  let dealId = v0.c.dealId;
  const novoNegocio = entrada.dealId ?? null;
  if (novoNegocio !== dealId) {
    if (dealId || !novoNegocio || !uuidValido(novoNegocio)) return { erro: "contratos.erros.negocioNaoMuda" };
    const opcoes = await opcoesDoContrato(a, novoNegocio);
    if (!opcoes.podeCriar) return { erro: "erros.acessoNegado" };
    dealId = novoNegocio;
  }
  const v = await validar(a, entrada, dealId);
  if ("erro" in v) return v;
  // Quem cria define o acesso; ao ligar a um negócio, mantém os usuários e soma os perfis escolhidos.
  await comTenant(a.tenant.id, async (tx) => {
    await tx
      .update(contrato)
      .set({ ...colunas(v.d), dealId })
      .where(eq(contrato.id, id));
    await gravarPartesEAcesso(tx, a.tenant.id, id, v.d);
  });
  await auditar(a, "contrato.editado", "contrato", id, dealId ? { dealId } : undefined);
  return { ok: true };
}

export async function excluirContrato(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const v = await linhaVisivel(a, id);
  if (!v) return { erro: "contratos.erros.naoEncontrado" };
  if (!v.pode.excluir) return { erro: "erros.acessoNegado" };
  await comTenant(a.tenant.id, (tx) => tx.delete(contrato).where(eq(contrato.id, id)));
  await auditar(a, "contrato.excluido", "contrato", id, v.c.dealId ? { dealId: v.c.dealId } : undefined);
  return { ok: true };
}

// --- Arquivos (versões) ----------------------------------------------------------------------

export async function iniciarArquivoDoContrato(
  acesso: Acesso | null,
  contratoId: string,
  dados: { nomeArquivo: string; tamanho: number; comentario?: string },
): Promise<{ arquivoId: string; url: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const v = await linhaVisivel(a, contratoId);
  if (!v) return { erro: "contratos.erros.naoEncontrado" };
  if (!v.pode.editar) return { erro: "erros.acessoNegado" };
  const nome = String(dados.nomeArquivo ?? "")
    .trim()
    .slice(0, 200);
  if (!nome) return { erro: "documentos.erros.envioIncompleto" };
  if (!Number.isInteger(dados.tamanho) || dados.tamanho <= 0)
    return { erro: "documentos.erros.envioIncompleto" };
  if (dados.tamanho > TAMANHO_MAXIMO_DOCUMENTO) return { erro: "documentos.erros.grande" };
  const id = randomUUID();
  const chave = chaveDoArquivo(a.tenant.id, "contratos", contratoId, id);
  await comTenant(a.tenant.id, async (tx) => {
    const [m] = await tx
      .select({ n: max(contratoArquivo.numero) })
      .from(contratoArquivo)
      .where(eq(contratoArquivo.contratoId, contratoId));
    await tx.insert(contratoArquivo).values({
      id,
      tenantId: a.tenant.id,
      contratoId,
      numero: (m?.n ?? 0) + 1,
      nomeArquivo: nome,
      tamanho: dados.tamanho,
      chave,
      comentario: dados.comentario?.trim().slice(0, 1000) || null,
      enviadoPor: a.usuario.id,
    });
  });
  return { arquivoId: id, url: await gerarLinkDeEnvio(chave, "application/octet-stream") };
}

/** Confere tamanho, tipo real e antivírus (ADR-0016) antes de liberar a versão. */
export async function concluirArquivoDoContrato(
  acesso: Acesso | null,
  arquivoId: string,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  if (!uuidValido(arquivoId)) return { erro: "contratos.erros.naoEncontrado" };
  const [x] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select()
      .from(contratoArquivo)
      .where(and(eq(contratoArquivo.id, arquivoId), eq(contratoArquivo.enviadoPor, a.usuario.id))),
  );
  if (!x || x.situacao !== "enviando") return { erro: "contratos.erros.naoEncontrado" };
  const conteudo = await lerArquivo(x.chave);
  const recusar = async (erro: string, bloquear = false) => {
    await comTenant(a.tenant.id, (tx) =>
      bloquear
        ? tx.update(contratoArquivo).set({ situacao: "bloqueado" }).where(eq(contratoArquivo.id, arquivoId))
        : tx.delete(contratoArquivo).where(eq(contratoArquivo.id, arquivoId)),
    );
    return { erro };
  };
  if (!conteudo || conteudo.length !== x.tamanho) return recusar("documentos.erros.envioIncompleto");
  const tipo = tipoDoDocumento(conteudo, x.nomeArquivo);
  if (!tipo) return recusar("documentos.erros.formato");
  if ((await verificarArquivo(conteudo)) === "bloqueado") {
    await auditar(a, "contrato.arquivo_bloqueado", "contrato", x.contratoId, { arquivoId });
    return recusar("documentos.erros.bloqueado", true);
  }
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(contratoArquivo)
      .set({ situacao: "disponivel", tipoDeConteudo: tipo })
      .where(eq(contratoArquivo.id, arquivoId)),
  );
  await auditar(a, "contrato.arquivo_enviado", "contrato", x.contratoId, { arquivoId, numero: x.numero });
  return { ok: true };
}

/** Link temporário de download de uma versão (auditado). */
export async function linkDoArquivoDoContrato(
  acesso: Acesso | null,
  arquivoId: string,
): Promise<{ url: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  if (!uuidValido(arquivoId)) return { erro: "contratos.erros.naoEncontrado" };
  const [x] = await comTenant(a.tenant.id, (tx) =>
    tx.select().from(contratoArquivo).where(eq(contratoArquivo.id, arquivoId)),
  );
  if (!x || x.situacao !== "disponivel") return { erro: "contratos.erros.naoEncontrado" };
  const v = await linhaVisivel(a, x.contratoId);
  if (!v) return { erro: "contratos.erros.naoEncontrado" };
  if (!v.pode.baixar) return { erro: "erros.acessoNegado" };
  await auditar(a, "contrato.arquivo_baixado", "contrato", x.contratoId, { arquivoId, numero: x.numero });
  return { url: await gerarLinkDeDownload(x.chave, x.nomeArquivo) };
}

// --- Financeiro (C3) -------------------------------------------------------------------------

const moeda = (v: string | null) =>
  v === null ? null : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Envia ao financeiro de cada contratada (e-mail do setor financeiro no
 * cadastro da empresa) os dados para nota fiscal e cobrança: contratantes
 * (razão social, CNPJ, endereço), condições e a conta escolhida (mascarada).
 */
export async function avisarFinanceiro(
  acesso: Acesso | null,
  id: string,
): Promise<{ enviados: number } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const v = await linhaVisivel(a, id);
  if (!v) return { erro: "contratos.erros.naoEncontrado" };
  if (!v.pode.editar) return { erro: "erros.acessoNegado" };
  const partes = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ papel: contratoParte.papel, e: empresa })
      .from(contratoParte)
      .innerJoin(empresa, eq(empresa.id, contratoParte.empresaId))
      .where(eq(contratoParte.contratoId, id)),
  );
  const destinos = [
    ...new Set(
      partes
        .filter((p) => p.papel === "contratada" && p.e.emailFinanceiro)
        .map((p) => p.e.emailFinanceiro!.trim().toLowerCase()),
    ),
  ];
  if (destinos.length === 0) return { erro: "contratos.erros.semEmailFinanceiro" };
  const [tr, marca, conta] = await Promise.all([
    tradutor(),
    marcaParaEmail(a.tenant.id),
    descreverConta(a, v.c.contaBancariaId, v.c.meioRecebimento),
  ]);
  const c = v.c;
  const endereco = (e: typeof empresa.$inferSelect) =>
    [e.logradouro, e.numero, e.complemento, e.bairro, e.cidade && `${e.cidade}/${e.uf ?? ""}`, e.cep]
      .filter(Boolean)
      .join(", ");
  const contratantes = partes
    .filter((p) => p.papel === "contratante")
    .map((p) =>
      [p.e.razaoSocial, p.e.cnpj && `CNPJ ${p.e.cnpj}`, endereco(p.e), p.e.email].filter(Boolean).join(" · "),
    );
  const linhas = [
    tr("emails.contratos.contrato", { titulo: c.titulo, tipo: tr(`contratos.tipos.${c.tipo}`) }),
    ...(v.ctx ? [tr("emails.contratos.negocio", { nome: v.ctx.nome })] : []),
    tr("emails.contratos.contratantes", { lista: contratantes.join(" | ") }),
    ...(c.honorarioFixo
      ? [
          tr("emails.contratos.fixo", {
            valor: moeda(c.honorarioFixo)!,
            periodicidade: c.periodicidade ? tr(`contratos.periodicidades.${c.periodicidade}`) : "—",
          }),
        ]
      : []),
    ...(c.successFeePercentual || c.successFeeMinimo
      ? [
          tr("emails.contratos.successFee", {
            percentual: c.successFeePercentual
              ? `${Number(c.successFeePercentual).toLocaleString("pt-BR")}%`
              : "—",
            minimo: moeda(c.successFeeMinimo) ?? "—",
          }),
        ]
      : []),
    ...(c.formaPagamento ? [tr("emails.contratos.pagamento", { texto: c.formaPagamento })] : []),
    ...(conta ? [tr("emails.contratos.conta", { conta })] : []),
  ];
  let enviados = 0;
  for (const para of destinos) {
    try {
      await enviarEmail(
        montarEmail({
          para,
          assunto: tr("emails.contratos.assunto", { titulo: c.titulo }),
          saudacao: tr("emails.contratos.saudacao"),
          paragrafos: [tr("emails.contratos.intro", { nome: a.usuario.nome }), ...linhas],
          link: {
            texto: tr("emails.contratos.botao"),
            url: urlDaArea({ tipo: "tenant", slug: a.tenant.slug }, `/contratos/${id}`),
          },
          linkAlternativo: tr("emails.linkAlternativo"),
          marca,
        }),
      );
      enviados++;
    } catch {
      // Sem log do destinatário nem do conteúdo (ADR-0007).
    }
  }
  await comTenant(a.tenant.id, (tx) =>
    tx.update(contrato).set({ financeiroAvisadoEm: new Date() }).where(eq(contrato.id, id)),
  );
  await auditar(a, "contrato.financeiro_avisado", "contrato", id, { enviados });
  return { enviados };
}

/** Negócios aos quais a pessoa pode ligar um contrato avulso (C2). */
export async function negociosParaLigar(acesso: Acesso | null): Promise<{ id: string; nome: string }[]> {
  const a = exigirTenant(acesso);
  const pagina = await paginaDeNegocios(
    a,
    { situacao: "andamento" },
    { pagina: 1, porPagina: 100, ordem: "numero", direcao: "desc" },
  ).catch(() => null);
  if (!pagina) return [];
  const ctxs = contextoDosNegocios(a);
  const lista: { id: string; nome: string }[] = [];
  for (const n of pagina.itens) {
    const ctx = await ctxs.negocio(n.id);
    if (ctx && !ctx.fechado && (a.administrador || ctx.pode("criar"))) lista.push({ id: n.id, nome: n.nome });
  }
  return lista;
}
