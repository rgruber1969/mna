import { cache } from "react";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { paginarEmMemoria, type Pagina, type PedidoDePagina } from "@/config/paginacao";
import type { ErroDeServico } from "@/i18n/servidor";
import { comTenant } from "@/server/db/cliente";
import {
  deal,
  dealEmpresa,
  dealEtapa,
  empresa,
  grupoEconomico,
  papelEmpresa,
  participacaoDeal,
  perfil,
  pessoa,
  tipoOperacao,
  vinculoPessoaEmpresa,
  documento,
  mensagem,
  tarefa,
  usuario,
} from "@/server/db/esquema";
import { AcessoNegado, exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import { enderecoDaFoto } from "./foto-da-conta";
import { auditar } from "./empresas";
import { notificar } from "./notificacoes";
import { avisarPorEmail } from "./negocios-avisos";
import { copiarEtapasParaNegocio, etapaPrincipal } from "./etapas";
import { exigirPermissao, permissoesNoDeal, pode } from "./permissoes/verificador";
import { concede, type Matriz } from "./permissoes/catalogo";

/**
 * Negócios (deals; dominio.md, "Deal (Negócio)", item 8). Nas telas e
 * e-mails, "Negócio"; no código, deal.
 *
 * - Criar e listar: permissão do tenant "deals" (Negócios). Dentro do
 *   negócio: permissões de deal pela participação (verificador).
 * - Cada pessoa vê só os negócios de que participa; administradores do
 *   tenant veem todos, com o acesso auditado.
 * - O lado de cada pessoa vem do papel da empresa que ela representa (ou do
 *   lado escolhido, para quem não tem empresa). Uma empresa fica num só lado.
 * - Sigilo do lado comprador: antes do NDA, a compradora vê o negócio só pelo
 *   número e codinome; quem é do lado comprador não vê as outras compradoras.
 */

type Resultado = { ok: true } | ErroDeServico;
export type Lado = "vendedor" | "comprador";
export type SituacaoDoNegocio = "andamento" | "suspenso" | "concluido" | "encerrado";
export type SituacaoNoFunil = "prospectada" | "teaser" | "nda" | "proposta" | "escolhida" | "descartada";
export const SITUACOES_NO_FUNIL: SituacaoNoFunil[] = [
  "prospectada",
  "teaser",
  "nda",
  "proposta",
  "escolhida",
  "descartada",
];
/** A partir destas, a compradora já pode ver quem vende. */
const FUNIL_APOS_NDA: SituacaoNoFunil[] = ["nda", "proposta", "escolhida"];

const uuidValido = (id: string) => z.uuid().safeParse(id).success;
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "negocios.erros.textoLongo")
    .transform((v) => v || null);
const dataOpcional = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "negocios.erros.dataInvalida");
const decimal = (max: number, erro: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\./g, "").replace(",", ".") || null)
    .refine((v) => v === null || (/^\d+(\.\d{1,4})?$/.test(v) && Number(v) <= max), erro);

/** Concluído ou encerrado: só para consulta (reabrir é com os administradores). */
export async function negocioFechado(a: AcessoTenant, dealId: string): Promise<ErroDeServico | null> {
  if (!uuidValido(dealId)) return null;
  const [d] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ situacao: deal.situacao }).from(deal).where(eq(deal.id, dealId)),
  );
  return d && (d.situacao === "concluido" || d.situacao === "encerrado")
    ? { erro: "negocios.erros.negocioFechado" }
    : null;
}

/** "N-0001 Projeto Gadol": o nome que todos veem. */
export function nomeVisivel(numero: number, codinome: string): string {
  return `N-${String(numero).padStart(4, "0")} ${codinome}`;
}

// --- Cadastros auxiliares usados no negócio -----------------------------------------

export type TipoDeOperacao = { id: string; nome: string; comPercentual: boolean; emUso: number };

/** Tipos de operação (para criar negócios e no cadastro auxiliar). */
export async function listarTiposDeOperacao(acesso: Acesso | null): Promise<TipoDeOperacao[]> {
  const recurso = (await pode(acesso, "deals", "ver")) ? "deals" : "cadastros";
  const a = await exigirPermissao(acesso, recurso, "ver");
  return comTenant(a.tenant.id, async (tx) => {
    const tipos = await tx
      .select({ id: tipoOperacao.id, nome: tipoOperacao.nome, comPercentual: tipoOperacao.comPercentual })
      .from(tipoOperacao)
      .orderBy(asc(tipoOperacao.nome));
    const uso = await tx
      .select({ id: deal.tipoOperacaoId, n: sql<number>`count(*)::int` })
      .from(deal)
      .groupBy(deal.tipoOperacaoId);
    const n = new Map(uso.map((u) => [u.id, u.n]));
    return tipos.map((t) => ({ ...t, emUso: n.get(t.id) ?? 0 }));
  });
}

const Nome = z
  .string()
  .trim()
  .min(2, "cadastros.erros.nomeObrigatorio")
  .max(120, "cadastros.erros.nomeLongo");

export async function salvarTipoDeOperacao(
  acesso: Acesso | null,
  dados: { id?: string; nome: string; comPercentual: boolean },
): Promise<{ id: string } | ErroDeServico> {
  const a = await exigirPermissao(acesso, "cadastros", dados.id ? "editar" : "criar");
  const nome = Nome.safeParse(dados.nome);
  if (!nome.success) return { erro: nome.error.issues[0]?.message ?? "cadastros.erros.nomeInvalido" };
  const r = await comTenant(a.tenant.id, async (tx) => {
    if (dados.id) {
      if (!uuidValido(dados.id)) return [];
      return tx
        .update(tipoOperacao)
        .set({ nome: nome.data, comPercentual: dados.comPercentual })
        .where(eq(tipoOperacao.id, dados.id))
        .returning({ id: tipoOperacao.id });
    }
    return tx
      .insert(tipoOperacao)
      .values({ tenantId: a.tenant.id, nome: nome.data, comPercentual: dados.comPercentual })
      .returning({ id: tipoOperacao.id });
  }).catch(() => "duplicado" as const);
  if (r === "duplicado") return { erro: "negocios.erros.tipoJaExiste" };
  if (!r[0]) return { erro: "negocios.erros.tipoNaoEncontrado" };
  await auditar(a, dados.id ? "tipo_operacao.editado" : "tipo_operacao.criado", "tipo_operacao", r[0].id);
  return { id: r[0].id };
}

/** Tipo em uso em algum negócio não pode ser excluído. */
export async function excluirTipoDeOperacao(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "cadastros", "excluir");
  if (!uuidValido(id)) return { erro: "negocios.erros.tipoNaoEncontrado" };
  const r = await comTenant(a.tenant.id, (tx) =>
    tx.delete(tipoOperacao).where(eq(tipoOperacao.id, id)).returning({ id: tipoOperacao.id }),
  ).catch(() => "emUso" as const);
  if (r === "emUso") return { erro: "negocios.erros.tipoEmUso" };
  if (r.length === 0) return { erro: "negocios.erros.tipoNaoEncontrado" };
  await auditar(a, "tipo_operacao.excluido", "tipo_operacao", id);
  return { ok: true };
}

export type PapelComLado = {
  id: string;
  nome: string;
  lado: Lado | null;
  perfilSugeridoId: string | null;
  padrao: string | null;
};

async function papeisComLado(a: AcessoTenant): Promise<PapelComLado[]> {
  return comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        id: papelEmpresa.id,
        nome: papelEmpresa.nome,
        lado: papelEmpresa.lado,
        perfilSugeridoId: papelEmpresa.perfilSugeridoId,
        padrao: papelEmpresa.padrao,
      })
      .from(papelEmpresa)
      .orderBy(asc(papelEmpresa.nome)),
  );
}

/** O que a tela de novo negócio precisa para as caixas de seleção. */
export async function opcoesParaNovoNegocio(acesso: Acesso | null) {
  const a = await exigirPermissao(acesso, "deals", "criar");
  const [tipos, papeis, empresas, grupos] = await Promise.all([
    listarTiposDeOperacao(a),
    papeisComLado(a),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ id: empresa.id, nome: empresa.razaoSocial, doContratante: empresa.doContratante })
        .from(empresa)
        .where(isNull(empresa.inativaEm))
        .orderBy(asc(empresa.razaoSocial)),
    ),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ id: grupoEconomico.id, nome: grupoEconomico.nome })
        .from(grupoEconomico)
        .orderBy(asc(grupoEconomico.nome)),
    ),
  ]);
  return { tipos, papeis: papeis.filter((p) => p.lado), empresas, grupos };
}

// --- Visão da pessoa sobre um negócio ----------------------------------------------------

type Participacao = typeof participacaoDeal.$inferSelect;
export type EmpresaNoNegocio = {
  id: string;
  empresaId: string;
  papelId: string;
  lado: Lado | null;
  situacaoFunil: SituacaoNoFunil | null;
  /** Papel "Compradora" (compradora potencial, com funil). */
  compradora: boolean;
  /** Compradora para quem esta empresa trabalha (lado comprador). */
  atuaParaId: string | null;
};

/** Como a pessoa enxerga o negócio: se participa, de que lado e o que pode ver. */
export type Visao = {
  administrador: boolean;
  participa: boolean;
  lados: Set<Lado>;
  /** Empresas que a pessoa representa no negócio. */
  minhasEmpresas: Set<string>;
  /** Compradoras que a pessoa representa ou para quem a empresa dela trabalha. */
  minhasCompradoras: Set<string>;
  podeVerVendedora: boolean;
  matriz: Matriz;
};

export function ladoDaEmpresa(empresas: EmpresaNoNegocio[], empresaId: string | null): Lado | null {
  if (!empresaId) return null;
  return empresas.find((e) => e.empresaId === empresaId && e.lado)?.lado ?? null;
}

export function ladoDaParticipacao(
  empresas: EmpresaNoNegocio[],
  p: Pick<Participacao, "empresaId" | "lado">,
) {
  return ladoDaEmpresa(empresas, p.empresaId) ?? p.lado;
}

/** Lado comprador: a compradora da empresa (ela mesma, ou aquela para quem trabalha). */
export function compradoraDaEmpresa(empresas: EmpresaNoNegocio[], empresaId: string | null): string | null {
  const e = empresas.find((x) => x.empresaId === empresaId && x.lado === "comprador");
  if (!e) return null;
  return e.compradora ? e.empresaId : e.atuaParaId;
}

async function empresasDoNegocioSemCache(a: AcessoTenant, dealId: string): Promise<EmpresaNoNegocio[]> {
  return comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        id: dealEmpresa.id,
        empresaId: dealEmpresa.empresaId,
        papelId: dealEmpresa.papelId,
        lado: papelEmpresa.lado,
        situacaoFunil: dealEmpresa.situacaoFunil,
        compradora: sql<boolean>`${papelEmpresa.padrao} = 'compradora'`,
        atuaParaId: dealEmpresa.atuaParaId,
      })
      .from(dealEmpresa)
      .innerJoin(papelEmpresa, eq(papelEmpresa.id, dealEmpresa.papelId))
      .where(eq(dealEmpresa.dealId, dealId)),
  ).then((l) => l.map((e) => ({ ...e, compradora: Boolean(e.compradora) })));
}

async function minhasParticipacoes(a: AcessoTenant, dealIds: string[]) {
  if (dealIds.length === 0) return [];
  return comTenant(a.tenant.id, (tx) =>
    tx
      .select({ p: participacaoDeal })
      .from(participacaoDeal)
      .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
      .where(
        and(
          inArray(participacaoDeal.dealId, dealIds),
          eq(pessoa.usuarioId, a.usuario.id),
          sql`(${participacaoDeal.prazo} is null or ${participacaoDeal.prazo} >= current_date)`,
        ),
      ),
  ).then((l) => l.map((x) => x.p));
}

function montarVisao(
  a: AcessoTenant,
  empresas: EmpresaNoNegocio[],
  minhas: Participacao[],
  matriz: Matriz,
): Visao {
  const lados = new Set<Lado>();
  const minhasEmpresas = new Set<string>();
  for (const p of minhas) {
    const lado = ladoDaParticipacao(empresas, p);
    if (lado) lados.add(lado);
    if (p.empresaId) minhasEmpresas.add(p.empresaId);
  }
  // Compradoras "minhas": as que represento e aquelas para quem minha empresa trabalha.
  const minhasCompradoras = new Set<string>();
  for (const e of empresas) {
    if (!minhasEmpresas.has(e.empresaId)) continue;
    if (e.compradora) minhasCompradoras.add(e.empresaId);
    if (e.atuaParaId) minhasCompradoras.add(e.atuaParaId);
  }
  // Compradora que já assinou o NDA (ou passou dele) vê quem vende; quem trabalha para ela também.
  const compradoraAposNda = empresas.some(
    (e) =>
      e.compradora &&
      minhasCompradoras.has(e.empresaId) &&
      e.situacaoFunil &&
      FUNIL_APOS_NDA.includes(e.situacaoFunil),
  );
  return {
    administrador: a.administrador,
    participa: minhas.length > 0,
    lados,
    minhasEmpresas,
    minhasCompradoras,
    podeVerVendedora: a.administrador || lados.has("vendedor") || compradoraAposNda,
    matriz,
  };
}

/** Visão da pessoa sobre um negócio; nega (AcessoNegado) a quem não participa nem administra. */
async function visaoDoNegocioSemCache(
  a: AcessoTenant,
  dealId: string,
): Promise<{ visao: Visao; empresas: EmpresaNoNegocio[] }> {
  const [empresas, minhas, matriz] = await Promise.all([
    empresasDoNegocio(a, dealId),
    minhasParticipacoes(a, [dealId]),
    a.administrador ? Promise.resolve({} as Matriz) : permissoesNoDeal(a, dealId),
  ]);
  const visao = montarVisao(a, empresas, minhas, matriz);
  if (!a.administrador && !concede(matriz, "deal", "ver")) throw new AcessoNegado();
  return { visao, empresas };
}

/** Empresas que a pessoa pode ver no negócio (sigilo entre compradoras e antes do NDA). */
export function empresaVisivel(v: Visao, e: EmpresaNoNegocio): boolean {
  if (v.administrador || v.lados.has("vendedor")) return true;
  if (v.minhasEmpresas.has(e.empresaId)) return true;
  if (e.lado === "vendedor") return v.podeVerVendedora;
  // Do lado comprador, só a própria equipe: a compradora e quem trabalha para
  // ela (nunca as outras compradoras nem as equipes delas).
  if (e.compradora && v.minhasCompradoras.has(e.empresaId)) return true;
  return Boolean(e.atuaParaId && v.minhasCompradoras.has(e.atuaParaId));
}

// --- Lista ------------------------------------------------------------------------------

export const ORDENS_DE_NEGOCIOS = ["numero", "nome", "situacao", "inicio"] as const;
export type OrdemDeNegocios = (typeof ORDENS_DE_NEGOCIOS)[number];

export type NegocioResumo = {
  id: string;
  numero: number;
  nome: string;
  /** Só para quem pode ver a vendedora. */
  nomeInterno: string | null;
  vendedoras: string[] | null;
  compradoraEscolhida: string | null;
  /** Descrição (pode citar a vendedora: só para quem já pode vê-la). */
  descricao: string | null;
  tipo: string | null;
  situacao: SituacaoDoNegocio;
  coordenadores: string[];
  /** Etapa principal (a em andamento mais avançada) e quantas outras estão em paralelo. */
  etapa: string | null;
  etapasEmParalelo: number;
  dataInicio: string;
};

export type FiltroDeNegocios = { busca?: string; situacao?: string; tipo?: string; lado?: string };

/**
 * Lista dos negócios que a pessoa vê (participa ou administra). Montada em
 * memória porque a visibilidade depende da participação e do sigilo de cada
 * negócio (dezenas a centenas por tenant).
 */
export async function paginaDeNegocios(
  acesso: Acesso | null,
  filtro: FiltroDeNegocios,
  pedido: PedidoDePagina<OrdemDeNegocios>,
): Promise<Pagina<NegocioResumo>> {
  const a = await exigirPermissao(acesso, "deals", "ver");
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        id: deal.id,
        numero: deal.numero,
        codinome: deal.codinome,
        nomeInterno: deal.nomeInterno,
        descricao: deal.descricao,
        situacao: deal.situacao,
        dataInicio: deal.dataInicio,
        tipoId: deal.tipoOperacaoId,
        tipo: tipoOperacao.nome,
      })
      .from(deal)
      .leftJoin(tipoOperacao, eq(tipoOperacao.id, deal.tipoOperacaoId)),
  );
  const ids = linhas.map((l) => l.id);
  const [minhas, empresas, coordenadores] = await Promise.all([
    minhasParticipacoes(a, ids),
    ids.length
      ? comTenant(a.tenant.id, (tx) =>
          tx
            .select({
              dealId: dealEmpresa.dealId,
              id: dealEmpresa.id,
              empresaId: dealEmpresa.empresaId,
              papelId: dealEmpresa.papelId,
              papel: papelEmpresa.nome,
              papelPadrao: papelEmpresa.padrao,
              lado: papelEmpresa.lado,
              situacaoFunil: dealEmpresa.situacaoFunil,
              atuaParaId: dealEmpresa.atuaParaId,
              nome: empresa.razaoSocial,
              doContratante: empresa.doContratante,
            })
            .from(dealEmpresa)
            .innerJoin(papelEmpresa, eq(papelEmpresa.id, dealEmpresa.papelId))
            .innerJoin(empresa, eq(empresa.id, dealEmpresa.empresaId))
            .where(inArray(dealEmpresa.dealId, ids)),
        )
      : [],
    ids.length
      ? comTenant(a.tenant.id, (tx) =>
          tx
            .select({ dealId: participacaoDeal.dealId, nome: pessoa.nome })
            .from(participacaoDeal)
            .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
            .innerJoin(perfil, eq(perfil.id, participacaoDeal.perfilId))
            .where(and(inArray(participacaoDeal.dealId, ids), eq(perfil.padrao, "coordenador-deal"))),
        )
      : [],
  ]);
  const minhasPor = Map.groupBy(minhas, (p) => p.dealId);
  const etapasPor = Map.groupBy(
    ids.length
      ? await comTenant(a.tenant.id, (tx) =>
          tx
            .select({
              dealId: dealEtapa.dealId,
              paiId: dealEtapa.paiId,
              nome: dealEtapa.nome,
              ordem: dealEtapa.ordem,
              situacao: dealEtapa.situacao,
            })
            .from(dealEtapa)
            .where(inArray(dealEtapa.dealId, ids)),
        )
      : [],
    (e) => e.dealId,
  );
  const empresasPor = Map.groupBy(
    empresas.map((e) => ({ ...e, compradora: e.papelPadrao === "compradora" })),
    (e) => e.dealId,
  );
  const coordPor = Map.groupBy(coordenadores, (c) => c.dealId);
  const visiveis: (NegocioResumo & { tipoId: string | null; ladoDoContratante: Lado | null })[] = [];
  for (const l of linhas) {
    const doNegocio = empresasPor.get(l.id) ?? [];
    const minhasNele = minhasPor.get(l.id) ?? [];
    if (!a.administrador) {
      if (minhasNele.length === 0) continue;
      if (!concede(await permissoesNoDeal(a, l.id), "deal", "ver")) continue;
    }
    const v = montarVisao(a, doNegocio, minhasNele, {});
    const contratante = doNegocio.find((e) => e.doContratante);
    visiveis.push({
      id: l.id,
      numero: l.numero,
      nome: nomeVisivel(l.numero, l.codinome),
      nomeInterno: v.podeVerVendedora ? l.nomeInterno : null,
      vendedoras: v.podeVerVendedora
        ? doNegocio.filter((e) => e.papelPadrao === "vendedora").map((e) => e.nome)
        : null,
      compradoraEscolhida:
        doNegocio.find((e) => e.situacaoFunil === "escolhida" && empresaVisivel(v, e))?.nome ?? null,
      descricao: v.podeVerVendedora ? l.descricao : null,
      ladoDoContratante: contratante?.lado ?? null,
      tipo: l.tipo,
      tipoId: l.tipoId,
      situacao: l.situacao,
      coordenadores: (coordPor.get(l.id) ?? []).map((c) => c.nome),
      dataInicio: l.dataInicio,
      etapa: etapaPrincipal(etapasPor.get(l.id) ?? [])?.nome ?? null,
      etapasEmParalelo: etapaPrincipal(etapasPor.get(l.id) ?? [])?.paralelas ?? 0,
    });
  }
  const busca = filtro.busca?.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtrados = visiveis.filter(
    (n) =>
      (!filtro.situacao ||
        n.situacao === filtro.situacao ||
        (filtro.situacao === "abertos" && (n.situacao === "andamento" || n.situacao === "suspenso"))) &&
      (!filtro.tipo || n.tipoId === filtro.tipo) &&
      (!filtro.lado || n.ladoDoContratante === filtro.lado) &&
      (!busca ||
        [n.nome, n.nomeInterno ?? "", ...(n.vendedoras ?? []), n.compradoraEscolhida ?? ""].some((t) =>
          semAcento(t).includes(busca),
        )),
  );
  const chave = {
    numero: (n: NegocioResumo) => n.numero,
    nome: (n: NegocioResumo) => semAcento(n.nome.replace(/^N-\d+ /, "")),
    situacao: (n: NegocioResumo) => n.situacao,
    inicio: (n: NegocioResumo) => n.dataInicio,
  }[pedido.ordem];
  const sinal = pedido.direcao === "desc" ? -1 : 1;
  filtrados.sort((x, y) => {
    const a1 = chave(x);
    const b1 = chave(y);
    return (a1 < b1 ? -1 : a1 > b1 ? 1 : x.numero - y.numero) * sinal;
  });
  const pagina = paginarEmMemoria(filtrados, pedido);
  return { ...pagina, itens: pagina.itens.map((n) => semCamposInternos(n)) };
}

// --- Criação ---------------------------------------------------------------------------

const DadosNovoNegocio = z
  .object({
    codinome: z
      .string()
      .trim()
      .min(2, "negocios.erros.codinomeObrigatorio")
      .max(120, "negocios.erros.textoLongo"),
    nomeInterno: z
      .string()
      .trim()
      .min(2, "negocios.erros.nomeInternoObrigatorio")
      .max(200, "negocios.erros.textoLongo"),
    tipoOperacaoId: z.uuid("negocios.erros.tipoObrigatorio"),
    percentual: decimal(100, "negocios.erros.percentualInvalido"),
    papelContratanteId: z.uuid("negocios.erros.papelContratanteObrigatorio"),
    objeto: z.enum(["empresas", "grupo"], "negocios.erros.objetoInvalido"),
    vendedoras: z.array(z.uuid()).default([]),
    grupoId: z
      .string()
      .trim()
      .transform((v) => v || null),
    dataInicio: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "negocios.erros.dataInvalida"),
  })
  .superRefine((d, ctx) => {
    if (d.objeto === "grupo" && !(d.grupoId && uuidValido(d.grupoId)))
      ctx.addIssue({ code: "custom", path: ["grupoId"], message: "negocios.erros.grupoObrigatorio" });
    if (d.objeto === "empresas" && d.vendedoras.length === 0)
      ctx.addIssue({ code: "custom", path: ["vendedoras"], message: "negocios.erros.vendedoraObrigatoria" });
  });

export type DadosNovoNegocio = z.input<typeof DadosNovoNegocio>;

function erroDeValidacao(r: z.ZodSafeParseError<unknown>): ErroDeServico {
  const p = r.error.issues[0];
  return {
    erro: p?.message ?? "negocios.erros.dadosInvalidos",
    campo: p?.path[0] !== undefined ? String(p.path[0]) : undefined,
  };
}

/**
 * Cria o negócio: número sequencial do tenant; a empresa do contratante entra
 * com o papel escolhido (que define o lado); as vendedoras (ou as empresas do
 * grupo) entram com o papel "Vendedora"; quem criou entra como Coordenador,
 * representando o contratante.
 */
export async function criarNegocio(
  acesso: Acesso | null,
  dados: DadosNovoNegocio,
): Promise<{ id: string } | ErroDeServico> {
  const a = await exigirPermissao(acesso, "deals", "criar");
  const r = DadosNovoNegocio.safeParse(dados);
  if (!r.success) return erroDeValidacao(r);
  const d = r.data;
  const resultado = await comTenant(
    a.tenant.id,
    async (tx): Promise<{ id: string; numero: number } | ErroDeServico> => {
      const [tipo] = await tx.select().from(tipoOperacao).where(eq(tipoOperacao.id, d.tipoOperacaoId));
      if (!tipo) return { erro: "negocios.erros.tipoObrigatorio", campo: "tipoOperacaoId" };
      if (tipo.comPercentual && !d.percentual)
        return { erro: "negocios.erros.percentualObrigatorio", campo: "percentual" };
      const papeis = await tx.select().from(papelEmpresa);
      const papelContratante = papeis.find((p) => p.id === d.papelContratanteId);
      if (!papelContratante?.lado)
        return { erro: "negocios.erros.papelContratanteObrigatorio", campo: "papelContratanteId" };
      const papelVendedora =
        papeis.find((p) => p.padrao === "vendedora") ?? papeis.find((p) => p.lado === "vendedor");
      if (!papelVendedora) return { erro: "negocios.erros.semPapelVendedora" };
      const [coordenador] = await tx
        .select({ id: perfil.id })
        .from(perfil)
        .where(and(eq(perfil.camada, "deal"), eq(perfil.padrao, "coordenador-deal")));
      if (!coordenador) return { erro: "negocios.erros.semPerfilCoordenador" };
      const [contratante] = await tx
        .select({ id: empresa.id })
        .from(empresa)
        .where(eq(empresa.doContratante, true));
      if (!contratante) return { erro: "negocios.erros.semEmpresaDoContratante" };
      const [eu] = await tx.select({ id: pessoa.id }).from(pessoa).where(eq(pessoa.usuarioId, a.usuario.id));
      if (!eu) return { erro: "negocios.erros.semPessoa" };
      const vendedoras =
        d.objeto === "grupo"
          ? (
              await tx
                .select({ id: empresa.id })
                .from(empresa)
                .where(and(eq(empresa.grupoId, d.grupoId!), isNull(empresa.inativaEm)))
            ).map((e) => e.id)
          : (await tx.select({ id: empresa.id }).from(empresa).where(inArray(empresa.id, d.vendedoras))).map(
              (e) => e.id,
            );
      if (vendedoras.length === 0)
        return d.objeto === "grupo"
          ? { erro: "negocios.erros.grupoSemEmpresas", campo: "grupoId" }
          : { erro: "negocios.erros.vendedoraObrigatoria", campo: "vendedoras" };
      // Uma empresa fica num só lado: o contratante do lado comprador não pode ser vendedora.
      if (papelContratante.lado === "comprador" && vendedoras.includes(contratante.id))
        return { erro: "negocios.erros.mesmaEmpresaNosDoisLados", campo: "vendedoras" };
      // Número sequencial do tenant (trava para dois negócios criados ao mesmo tempo).
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${a.tenant.id} || ':deal'))`);
      const [{ ultimo }] = await tx
        .select({ ultimo: sql<number>`coalesce(max(${deal.numero}), 0)::int` })
        .from(deal);
      const [novo] = await tx
        .insert(deal)
        .values({
          tenantId: a.tenant.id,
          numero: ultimo + 1,
          codinome: d.codinome,
          nomeInterno: d.nomeInterno,
          tipoOperacaoId: tipo.id,
          percentual: tipo.comPercentual ? d.percentual : null,
          objeto: d.objeto,
          grupoId: d.objeto === "grupo" ? d.grupoId : null,
          dataInicio: d.dataInicio,
          criadoPor: a.usuario.id,
        })
        .returning({ id: deal.id, numero: deal.numero });
      const entradas = [
        { empresaId: contratante.id, papelId: papelContratante.id },
        ...vendedoras.map((id) => ({ empresaId: id, papelId: papelVendedora.id })),
      ];
      await tx
        .insert(dealEmpresa)
        .values(entradas.map((e) => ({ tenantId: a.tenant.id, dealId: novo.id, ...e })))
        .onConflictDoNothing();
      await copiarEtapasParaNegocio(tx, a.tenant.id, novo.id);
      await tx.insert(participacaoDeal).values({
        tenantId: a.tenant.id,
        dealId: novo.id,
        pessoaId: eu.id,
        empresaId: contratante.id,
        perfilId: coordenador.id,
        criadoPor: a.usuario.id,
      });
      return novo;
    },
  );
  if ("erro" in resultado) return resultado;
  await auditar(a, "negocio.criado", "deal", resultado.id, { numero: resultado.numero });
  return { id: resultado.id };
}

// --- Detalhe e edição -----------------------------------------------------------------

export type NegocioDetalhe = {
  id: string;
  numero: number;
  nome: string;
  codinome: string;
  nomeInterno: string | null;
  tipoOperacaoId: string | null;
  tipo: string | null;
  tipoComPercentual: boolean;
  percentual: string | null;
  objeto: "empresas" | "grupo";
  grupo: string | null;
  dataInicio: string;
  previsaoFechamento: string | null;
  valorEstimado: string | null;
  descricao: string | null;
  situacao: SituacaoDoNegocio;
  podeVerVendedora: boolean;
  podeEditar: boolean;
  podeGerirParticipantes: boolean;
  podeExcluir: boolean;
  empresas: {
    id: string;
    empresaId: string;
    nome: string;
    cnpj: string | null;
    papel: string;
    lado: Lado | null;
    situacaoFunil: SituacaoNoFunil | null;
    doContratante: boolean;
    /** Compradora para quem trabalha (empresa do lado comprador). */
    atuaPara: string | null;
  }[];
  /** Compradoras do negócio (para escolher para quem uma empresa do lado comprador trabalha). */
  compradoras: { empresaId: string; nome: string }[];
  participantes: {
    id: string;
    pessoaId: string;
    nome: string;
    temUsuario: boolean;
    perfil: string | null;
    empresa: string | null;
    lado: Lado | null;
    prazo: string | null;
    /** Etapas do alcance; null = negócio inteiro. */
    alcance: string[] | null;
    coordenador: boolean;
    /** Foto da conta da pessoa (quem tem usuário e enviou foto). */
    foto: string | null;
  }[];
};

/**
 * Negócio visto pela pessoa. Administrador que não participa também abre,
 * e o acesso fica na auditoria (perfis-e-permissoes.md).
 */
export async function obterNegocio(acesso: Acesso | null, id: string): Promise<NegocioDetalhe | null> {
  const a = exigirTenant(acesso);
  if (!uuidValido(id)) return null;
  const [d] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        n: deal,
        tipo: tipoOperacao.nome,
        tipoComPercentual: tipoOperacao.comPercentual,
        grupo: grupoEconomico.nome,
      })
      .from(deal)
      .leftJoin(tipoOperacao, eq(tipoOperacao.id, deal.tipoOperacaoId))
      .leftJoin(grupoEconomico, eq(grupoEconomico.id, deal.grupoId))
      .where(eq(deal.id, id)),
  );
  if (!d) return null;
  let visao: Visao;
  let empresas: EmpresaNoNegocio[];
  try {
    ({ visao, empresas } = await visaoDoNegocio(a, id));
  } catch (e) {
    if (e instanceof AcessoNegado) {
      await exigirPermissao(a, "deal", "ver", { dealId: id }); // registra a negação
    }
    throw e;
  }
  if (a.administrador && !visao.participa) await auditar(a, "negocio.visualizado", "deal", id);
  const visiveis = new Set(empresas.filter((e) => empresaVisivel(visao, e)).map((e) => e.id));
  const [detalheEmpresas, participantes] = await comTenant(a.tenant.id, async (tx) => [
    await tx
      .select({
        id: dealEmpresa.id,
        empresaId: empresa.id,
        nome: empresa.razaoSocial,
        cnpj: empresa.cnpj,
        papel: papelEmpresa.nome,
        lado: papelEmpresa.lado,
        situacaoFunil: dealEmpresa.situacaoFunil,
        doContratante: empresa.doContratante,
        atuaParaId: dealEmpresa.atuaParaId,
        papelPadrao: papelEmpresa.padrao,
      })
      .from(dealEmpresa)
      .innerJoin(empresa, eq(empresa.id, dealEmpresa.empresaId))
      .innerJoin(papelEmpresa, eq(papelEmpresa.id, dealEmpresa.papelId))
      .where(eq(dealEmpresa.dealId, id))
      .orderBy(asc(empresa.razaoSocial), asc(papelEmpresa.nome)),
    await tx
      .select({
        id: participacaoDeal.id,
        pessoaId: pessoa.id,
        nome: pessoa.nome,
        usuarioId: pessoa.usuarioId,
        imagem: usuario.image,
        perfil: perfil.nome,
        perfilPadrao: perfil.padrao,
        empresaId: participacaoDeal.empresaId,
        empresa: empresa.razaoSocial,
        lado: participacaoDeal.lado,
        prazo: participacaoDeal.prazo,
        alcance: participacaoDeal.alcance,
        etapaIds: participacaoDeal.etapaIds,
      })
      .from(participacaoDeal)
      .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
      .leftJoin(usuario, eq(usuario.id, pessoa.usuarioId))
      .leftJoin(perfil, eq(perfil.id, participacaoDeal.perfilId))
      .leftJoin(empresa, eq(empresa.id, participacaoDeal.empresaId))
      .where(eq(participacaoDeal.dealId, id))
      .orderBy(asc(pessoa.nome)),
  ]);
  const verTudo = visao.administrador || visao.lados.has("vendedor");
  const nomeDaEtapa = new Map(
    (
      await comTenant(a.tenant.id, (tx) =>
        tx.select({ id: dealEtapa.id, nome: dealEtapa.nome }).from(dealEtapa).where(eq(dealEtapa.dealId, id)),
      )
    ).map((e) => [e.id, e.nome]),
  );
  // Do lado comprador, os participantes da própria equipe (empresas visíveis do lado comprador).
  const equipe = new Set(
    empresas.filter((e) => e.lado === "comprador" && empresaVisivel(visao, e)).map((e) => e.empresaId),
  );
  const nomeDa = new Map(detalheEmpresas.map((e) => [e.empresaId, e.nome]));
  const m = visao.matriz;
  const fechado = d.n.situacao === "concluido" || d.n.situacao === "encerrado";
  const podeEditar = (a.administrador || concede(m, "deal", "editar")) && !fechado;
  return {
    id: d.n.id,
    numero: d.n.numero,
    nome: nomeVisivel(d.n.numero, d.n.codinome),
    codinome: d.n.codinome,
    nomeInterno: visao.podeVerVendedora ? d.n.nomeInterno : null,
    tipoOperacaoId: d.n.tipoOperacaoId,
    tipo: d.tipo,
    tipoComPercentual: d.tipoComPercentual ?? false,
    percentual: d.n.percentual,
    objeto: d.n.objeto,
    grupo: visao.podeVerVendedora ? d.grupo : null,
    dataInicio: d.n.dataInicio,
    previsaoFechamento: d.n.previsaoFechamento,
    valorEstimado: d.n.valorEstimado,
    descricao: d.n.descricao,
    situacao: d.n.situacao,
    podeVerVendedora: visao.podeVerVendedora,
    podeEditar,
    podeGerirParticipantes: podeEditar,
    podeExcluir: (await pode(a, "deals", "excluir")) && (a.administrador || visao.participa),
    empresas: detalheEmpresas
      .filter((e) => visiveis.has(e.id))
      .map((e) => ({
        id: e.id,
        empresaId: e.empresaId,
        nome: e.nome,
        cnpj: e.cnpj,
        papel: e.papel,
        lado: e.lado,
        situacaoFunil: e.situacaoFunil,
        doContratante: e.doContratante,
        atuaPara: e.atuaParaId ? (nomeDa.get(e.atuaParaId) ?? null) : null,
      })),
    compradoras: verTudo
      ? detalheEmpresas
          .filter((e) => e.papelPadrao === "compradora")
          .map((e) => ({ empresaId: e.empresaId, nome: e.nome }))
      : [],
    participantes: participantes
      .filter(
        (p) =>
          verTudo ||
          (p.empresaId !== null && (visao.minhasEmpresas.has(p.empresaId) || equipe.has(p.empresaId))) ||
          (p.empresaId === null && p.lado && visao.lados.has(p.lado) && p.lado !== "comprador"),
      )
      .map((p) => ({
        id: p.id,
        pessoaId: p.pessoaId,
        nome: p.nome,
        temUsuario: Boolean(p.usuarioId),
        perfil: p.perfil,
        empresa: p.empresa,
        lado: ladoDaParticipacao(empresas, p),
        prazo: p.prazo,
        alcance: p.alcance === "etapas" ? p.etapaIds.map((id) => nomeDaEtapa.get(id) ?? "—") : null,
        coordenador: p.perfilPadrao === "coordenador-deal",
        foto: p.usuarioId ? enderecoDaFoto(p.usuarioId, p.imagem) : null,
      })),
  };
}

const DadosNegocio = z
  .object({
    codinome: z
      .string()
      .trim()
      .min(2, "negocios.erros.codinomeObrigatorio")
      .max(120, "negocios.erros.textoLongo"),
    nomeInterno: z
      .string()
      .trim()
      .min(2, "negocios.erros.nomeInternoObrigatorio")
      .max(200, "negocios.erros.textoLongo"),
    tipoOperacaoId: z.uuid("negocios.erros.tipoObrigatorio"),
    percentual: decimal(100, "negocios.erros.percentualInvalido"),
    dataInicio: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "negocios.erros.dataInvalida"),
    previsaoFechamento: dataOpcional,
    valorEstimado: decimal(1e15, "negocios.erros.valorInvalido"),
    descricao: opcional(4000),
  })
  .refine((d) => !d.previsaoFechamento || d.previsaoFechamento >= d.dataInicio, {
    path: ["previsaoFechamento"],
    message: "negocios.erros.previsaoAntesDoInicio",
  });

export type DadosNegocio = z.input<typeof DadosNegocio>;

/** Edita os dados do negócio ("Deal e participantes" × editar). O nome interno só muda quem o vê. */
export async function editarNegocio(
  acesso: Acesso | null,
  id: string,
  dados: DadosNegocio,
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "deal", "editar", { dealId: id });
  const fechado = await negocioFechado(a, id);
  if (fechado) return fechado;
  if (!uuidValido(id)) return { erro: "negocios.erros.naoEncontrado" };
  const r = DadosNegocio.safeParse(dados);
  if (!r.success) return erroDeValidacao(r);
  const d = r.data;
  const { visao } = await visaoDoNegocio(a, id);
  const feito = await comTenant(a.tenant.id, async (tx): Promise<Resultado> => {
    const [tipo] = await tx.select().from(tipoOperacao).where(eq(tipoOperacao.id, d.tipoOperacaoId));
    if (!tipo) return { erro: "negocios.erros.tipoObrigatorio", campo: "tipoOperacaoId" };
    if (tipo.comPercentual && !d.percentual)
      return { erro: "negocios.erros.percentualObrigatorio", campo: "percentual" };
    const atualizados = await tx
      .update(deal)
      .set({
        codinome: d.codinome,
        ...(visao.podeVerVendedora ? { nomeInterno: d.nomeInterno } : {}),
        tipoOperacaoId: tipo.id,
        percentual: tipo.comPercentual ? d.percentual : null,
        dataInicio: d.dataInicio,
        previsaoFechamento: d.previsaoFechamento,
        valorEstimado: d.valorEstimado,
        descricao: d.descricao,
        atualizadoEm: new Date(),
      })
      .where(eq(deal.id, id))
      .returning({ id: deal.id });
    return atualizados.length ? { ok: true } : { erro: "negocios.erros.naoEncontrado" };
  });
  if ("erro" in feito) return feito;
  await auditar(a, "negocio.editado", "deal", id);
  return { ok: true };
}

/** Exclusão ("Negócios" × excluir). Com documentos, tarefas ou mensagens, só encerrar (dominio.md). */
export async function excluirNegocio(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "deals", "excluir");
  if (!uuidValido(id)) return { erro: "negocios.erros.naoEncontrado" };
  await visaoDoNegocio(a, id);
  const temConteudo = await comTenant(a.tenant.id, async (tx) => {
    for (const tabela of [documento, tarefa, mensagem]) {
      const l = await tx.select({ id: tabela.id }).from(tabela).where(eq(tabela.dealId, id)).limit(1);
      if (l.length) return true;
    }
    return false;
  });
  if (temConteudo) return { erro: "negocios.erros.temConteudo" };
  const feito = await comTenant(a.tenant.id, async (tx) => {
    await tx.delete(participacaoDeal).where(eq(participacaoDeal.dealId, id));
    await tx.delete(dealEmpresa).where(eq(dealEmpresa.dealId, id));
    return tx.delete(deal).where(eq(deal.id, id)).returning({ numero: deal.numero });
  });
  if (feito.length === 0) return { erro: "negocios.erros.naoEncontrado" };
  await auditar(a, "negocio.excluido", "deal", id, { numero: feito[0].numero });
  return { ok: true };
}

// --- Empresas no negócio ---------------------------------------------------------------

/** Opções para incluir empresas (papéis e empresas do tenant). */
export async function opcoesDeEmpresas(acesso: Acesso | null, dealId: string) {
  const a = await exigirPermissao(acesso, "deal", "editar", { dealId });
  const [papeis, empresas] = await Promise.all([
    papeisComLado(a),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ id: empresa.id, nome: empresa.razaoSocial })
        .from(empresa)
        .where(isNull(empresa.inativaEm))
        .orderBy(asc(empresa.razaoSocial)),
    ),
  ]);
  return { papeis, empresas };
}

/**
 * Inclui uma empresa com um papel. Uma empresa só pode estar num dos lados de
 * cada negócio. Empresa do lado comprador que não é compradora (escritório,
 * advisor etc.) fica ligada à compradora para quem trabalha: sozinha quando
 * há uma só; escolhida quando há várias; ligada depois, quando a primeira
 * compradora entrar.
 */
export async function adicionarEmpresaAoNegocio(
  acesso: Acesso | null,
  dealId: string,
  dados: { empresaId: string; papelId: string; atuaParaId?: string },
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "deal", "editar", { dealId });
  if (!uuidValido(dealId)) return { erro: "negocios.erros.naoEncontrado" };
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  if (!uuidValido(dados.empresaId)) return { erro: "negocios.erros.escolhaEmpresa", campo: "empresaId" };
  if (!uuidValido(dados.papelId)) return { erro: "negocios.erros.escolhaPapel", campo: "papelId" };
  const empresas = await empresasDoNegocio(a, dealId);
  const feito = await comTenant(a.tenant.id, async (tx): Promise<Resultado> => {
    const [papel] = await tx.select().from(papelEmpresa).where(eq(papelEmpresa.id, dados.papelId));
    if (!papel) return { erro: "negocios.erros.escolhaPapel", campo: "papelId" };
    const [e] = await tx.select({ id: empresa.id }).from(empresa).where(eq(empresa.id, dados.empresaId));
    if (!e) return { erro: "negocios.erros.escolhaEmpresa", campo: "empresaId" };
    const lados = new Set(empresas.filter((x) => x.empresaId === e.id && x.lado).map((x) => x.lado));
    if (papel.lado && [...lados].some((l) => l !== papel.lado))
      return { erro: "negocios.erros.mesmaEmpresaNosDoisLados", campo: "papelId" };
    if (empresas.some((x) => x.empresaId === e.id && x.papelId === papel.id))
      return { erro: "negocios.erros.empresaJaTemPapel" };
    const compradoras = [...new Set(empresas.filter((x) => x.compradora).map((x) => x.empresaId))];
    const ehCompradora = papel.padrao === "compradora";
    let atuaParaId: string | null = null;
    if (papel.lado === "comprador" && !ehCompradora) {
      if (dados.atuaParaId) {
        if (!compradoras.includes(dados.atuaParaId))
          return { erro: "negocios.erros.escolhaCompradora", campo: "atuaParaId" };
        atuaParaId = dados.atuaParaId;
      } else if (compradoras.length === 1) atuaParaId = compradoras[0];
      else if (compradoras.length > 1)
        return { erro: "negocios.erros.escolhaCompradora", campo: "atuaParaId" };
    }
    await tx.insert(dealEmpresa).values({
      tenantId: a.tenant.id,
      dealId,
      empresaId: e.id,
      papelId: papel.id,
      situacaoFunil: ehCompradora ? "prospectada" : null,
      atuaParaId,
    });
    // Primeira compradora: quem já estava no lado comprador passa a trabalhar para ela.
    if (ehCompradora && compradoras.length === 0) {
      const equipe = empresas
        .filter((x) => x.lado === "comprador" && !x.compradora && !x.atuaParaId && x.empresaId !== e.id)
        .map((x) => x.id);
      if (equipe.length)
        await tx.update(dealEmpresa).set({ atuaParaId: e.id }).where(inArray(dealEmpresa.id, equipe));
    }
    return { ok: true };
  });
  if ("erro" in feito) return feito;
  await auditar(a, "negocio.empresa_incluida", "deal", dealId, {
    empresaId: dados.empresaId,
    papelId: dados.papelId,
  });
  return { ok: true };
}

/**
 * Tira um papel de uma empresa. A empresa do contratante fica com ao menos um
 * papel; quem representa a empresa precisa sair antes de ela sair do negócio.
 */
export async function removerEmpresaDoNegocio(
  acesso: Acesso | null,
  dealId: string,
  id: string,
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "deal", "editar", { dealId });
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  if (!uuidValido(id) || !uuidValido(dealId)) return { erro: "negocios.erros.empresaNaoEncontrada" };
  const feito = await comTenant(a.tenant.id, async (tx): Promise<Resultado | { empresaId: string }> => {
    const [alvo] = await tx
      .select({ empresaId: dealEmpresa.empresaId, doContratante: empresa.doContratante })
      .from(dealEmpresa)
      .innerJoin(empresa, eq(empresa.id, dealEmpresa.empresaId))
      .where(and(eq(dealEmpresa.id, id), eq(dealEmpresa.dealId, dealId)));
    if (!alvo) return { erro: "negocios.erros.empresaNaoEncontrada" };
    const papeisDela = await tx
      .select({ id: dealEmpresa.id })
      .from(dealEmpresa)
      .where(and(eq(dealEmpresa.dealId, dealId), eq(dealEmpresa.empresaId, alvo.empresaId)));
    // Compradora com equipe (escritório, advisor) ligada a ela não sai antes da equipe.
    const [comoCompradora] = await tx
      .select({ padrao: papelEmpresa.padrao })
      .from(dealEmpresa)
      .innerJoin(papelEmpresa, eq(papelEmpresa.id, dealEmpresa.papelId))
      .where(eq(dealEmpresa.id, id));
    if (comoCompradora?.padrao === "compradora") {
      const [daEquipe] = await tx
        .select({ id: dealEmpresa.id })
        .from(dealEmpresa)
        .where(and(eq(dealEmpresa.dealId, dealId), eq(dealEmpresa.atuaParaId, alvo.empresaId)));
      if (daEquipe) return { erro: "negocios.erros.compradoraComEquipe" };
    }
    if (papeisDela.length === 1) {
      if (alvo.doContratante) return { erro: "negocios.erros.contratanteFica" };
      const [representante] = await tx
        .select({ id: participacaoDeal.id })
        .from(participacaoDeal)
        .where(and(eq(participacaoDeal.dealId, dealId), eq(participacaoDeal.empresaId, alvo.empresaId)));
      if (representante) return { erro: "negocios.erros.empresaComParticipantes" };
    }
    await tx.delete(dealEmpresa).where(eq(dealEmpresa.id, id));
    return { empresaId: alvo.empresaId };
  });
  if ("erro" in feito) return feito;
  if ("empresaId" in feito)
    await auditar(a, "negocio.empresa_removida", "deal", dealId, { empresaId: feito.empresaId });
  return { ok: true };
}

// --- Participantes ---------------------------------------------------------------------

/** Opções para incluir participantes: pessoas (com as empresas delas no negócio) e perfis de deal. */
export async function opcoesDeParticipantes(acesso: Acesso | null, dealId: string) {
  const a = await exigirPermissao(acesso, "deal", "editar", { dealId });
  const empresas = await empresasDoNegocio(a, dealId);
  const noNegocio = [...new Set(empresas.map((e) => e.empresaId))];
  return comTenant(a.tenant.id, async (tx) => {
    const pessoas = await tx
      .select({ id: pessoa.id, nome: pessoa.nome, usuarioId: pessoa.usuarioId })
      .from(pessoa)
      .where(isNull(pessoa.inativaEm))
      .orderBy(asc(pessoa.nome));
    const vinculos = noNegocio.length
      ? await tx
          .selectDistinct({
            pessoaId: vinculoPessoaEmpresa.pessoaId,
            empresaId: empresa.id,
            nome: empresa.razaoSocial,
          })
          .from(vinculoPessoaEmpresa)
          .innerJoin(empresa, eq(empresa.id, vinculoPessoaEmpresa.empresaId))
          .where(inArray(vinculoPessoaEmpresa.empresaId, noNegocio))
      : [];
    const perfis = await tx
      .select({ id: perfil.id, nome: perfil.nome })
      .from(perfil)
      .where(eq(perfil.camada, "deal"))
      .orderBy(asc(perfil.nome));
    const empresasPor = Map.groupBy(vinculos, (v) => v.pessoaId);
    return {
      pessoas: pessoas.map((p) => ({
        id: p.id,
        nome: p.nome,
        temUsuario: Boolean(p.usuarioId),
        empresas: (empresasPor.get(p.id) ?? []).map((v) => ({ id: v.empresaId, nome: v.nome })),
      })),
      perfis,
    };
  });
}

const DadosParticipante = z.object({
  pessoaId: z.uuid("negocios.erros.escolhaPessoa"),
  perfilId: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || uuidValido(v), "negocios.erros.escolhaPerfil"),
  empresaId: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || uuidValido(v), "negocios.erros.escolhaEmpresa"),
  lado: z
    .string()
    .trim()
    .transform((v) => (v === "vendedor" || v === "comprador" ? v : null)),
  prazo: dataOpcional,
  /** "deal" (negócio inteiro) ou "etapas" (só as etapas/subetapas escolhidas). */
  alcance: z
    .string()
    .trim()
    .default("deal")
    .transform((v) => (v === "etapas" ? ("etapas" as const) : ("deal" as const))),
  etapaIds: z.array(z.string()).default([]),
});

/**
 * Inclui uma pessoa (administradores e Coordenador). A empresa que ela
 * representa precisa ser uma das empresas dela que já estão no negócio; se
 * houver só uma, é escolhida sozinha. Sem empresa, o lado é obrigatório.
 * Pessoa sem usuário entra como contato (sem perfil).
 */
export async function adicionarParticipante(
  acesso: Acesso | null,
  dealId: string,
  dados: z.input<typeof DadosParticipante>,
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "deal", "editar", { dealId });
  if (!uuidValido(dealId)) return { erro: "negocios.erros.naoEncontrado" };
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const r = DadosParticipante.safeParse(dados);
  if (!r.success) return erroDeValidacao(r);
  const d = r.data;
  const etapasDoDeal = await comTenant(a.tenant.id, (tx) =>
    tx.select({ id: dealEtapa.id }).from(dealEtapa).where(eq(dealEtapa.dealId, dealId)),
  );
  const alcanceEtapas =
    d.alcance === "etapas" ? d.etapaIds.filter((id) => etapasDoDeal.some((e) => e.id === id)) : [];
  if (d.alcance === "etapas" && alcanceEtapas.length === 0)
    return { erro: "negocios.erros.escolhaEtapas", campo: "etapaIds" };
  const empresas = await empresasDoNegocio(a, dealId);
  const feito = await comTenant(
    a.tenant.id,
    async (tx): Promise<ErroDeServico | { usuarioId: string | null; numero: number; codinome: string }> => {
      const [p] = await tx
        .select({ id: pessoa.id, usuarioId: pessoa.usuarioId })
        .from(pessoa)
        .where(eq(pessoa.id, d.pessoaId));
      if (!p) return { erro: "negocios.erros.escolhaPessoa", campo: "pessoaId" };
      const [n] = await tx
        .select({ numero: deal.numero, codinome: deal.codinome })
        .from(deal)
        .where(eq(deal.id, dealId));
      if (!n) return { erro: "negocios.erros.naoEncontrado" };
      let perfilId = d.perfilId;
      if (!p.usuarioId)
        perfilId = null; // contato: sem acesso
      else if (!perfilId) return { erro: "negocios.erros.escolhaPerfil", campo: "perfilId" };
      if (perfilId) {
        const [pf] = await tx.select({ camada: perfil.camada }).from(perfil).where(eq(perfil.id, perfilId));
        if (pf?.camada !== "deal") return { erro: "negocios.erros.escolhaPerfil", campo: "perfilId" };
      }
      const noNegocio = new Set(empresas.map((e) => e.empresaId));
      const dela = (
        await tx
          .selectDistinct({ empresaId: vinculoPessoaEmpresa.empresaId })
          .from(vinculoPessoaEmpresa)
          .where(eq(vinculoPessoaEmpresa.pessoaId, p.id))
      )
        .map((v) => v.empresaId)
        .filter((id) => noNegocio.has(id));
      let empresaId = d.empresaId;
      if (!empresaId && dela.length === 1) empresaId = dela[0];
      if (!empresaId && dela.length > 1)
        return { erro: "negocios.erros.escolhaEmpresaDaPessoa", campo: "empresaId" };
      if (empresaId && !dela.includes(empresaId))
        return { erro: "negocios.erros.empresaNaoEDaPessoa", campo: "empresaId" };
      const lado = empresaId ? null : d.lado;
      if (!empresaId && !lado) return { erro: "negocios.erros.escolhaLado", campo: "lado" };
      if (empresaId && !ladoDaEmpresa(empresas, empresaId) && !d.lado)
        return { erro: "negocios.erros.escolhaLado", campo: "lado" };
      const [ja] = await tx
        .select({ id: participacaoDeal.id })
        .from(participacaoDeal)
        .where(
          and(
            eq(participacaoDeal.dealId, dealId),
            eq(participacaoDeal.pessoaId, p.id),
            perfilId ? eq(participacaoDeal.perfilId, perfilId) : isNull(participacaoDeal.perfilId),
          ),
        );
      if (ja) return { erro: "negocios.erros.participanteJaIncluido" };
      await tx.insert(participacaoDeal).values({
        tenantId: a.tenant.id,
        dealId,
        pessoaId: p.id,
        empresaId,
        lado: empresaId && ladoDaEmpresa(empresas, empresaId) ? null : (lado ?? d.lado),
        perfilId,
        prazo: d.prazo,
        alcance: d.alcance,
        etapaIds: alcanceEtapas,
        criadoPor: a.usuario.id,
      });
      if (p.usuarioId && perfilId && p.usuarioId !== a.usuario.id)
        await notificar(
          tx,
          a.tenant.id,
          p.usuarioId,
          "negocio_incluido",
          { negocio: nomeVisivel(n.numero, n.codinome) },
          `/negocios/${dealId}`,
        );
      return { usuarioId: p.usuarioId, ...n };
    },
  );
  if ("erro" in feito) return feito;
  await auditar(a, "negocio.participante_incluido", "deal", dealId, { pessoaId: d.pessoaId });
  if (feito.usuarioId && feito.usuarioId !== a.usuario.id && d.perfilId)
    await avisarPorEmail(a, [feito.usuarioId], "incluido", nomeVisivel(feito.numero, feito.codinome), dealId);
  return { ok: true };
}

/**
 * Remove uma participação. O acesso acaba na hora; o que a pessoa fez fica.
 * O negócio não fica sem Coordenador.
 */
export async function removerParticipante(
  acesso: Acesso | null,
  dealId: string,
  id: string,
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "deal", "editar", { dealId });
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  if (!uuidValido(id) || !uuidValido(dealId)) return { erro: "negocios.erros.participanteNaoEncontrado" };
  const feito = await comTenant(a.tenant.id, async (tx): Promise<ErroDeServico | { pessoaId: string }> => {
    const todas = await tx
      .select({
        id: participacaoDeal.id,
        pessoaId: participacaoDeal.pessoaId,
        padrao: perfil.padrao,
        usuarioId: pessoa.usuarioId,
      })
      .from(participacaoDeal)
      .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
      .leftJoin(perfil, eq(perfil.id, participacaoDeal.perfilId))
      .where(eq(participacaoDeal.dealId, dealId));
    const alvo = todas.find((p) => p.id === id);
    if (!alvo) return { erro: "negocios.erros.participanteNaoEncontrado" };
    if (
      alvo.padrao === "coordenador-deal" &&
      todas.filter((p) => p.padrao === "coordenador-deal").length === 1
    )
      return { erro: "negocios.erros.ultimoCoordenador" };
    await tx.delete(participacaoDeal).where(eq(participacaoDeal.id, id));
    // Sem outra participação no negócio, deixa de ser responsável pelas tarefas dele
    // (as tarefas ficam "sem responsável" para o Coordenador redistribuir).
    if (alvo.usuarioId && !todas.some((p) => p.id !== id && p.pessoaId === alvo.pessoaId))
      await tx.execute(
        sql`delete from tarefa_responsavel tr using tarefa t
            where t.id = tr.tarefa_id and t.deal_id = ${dealId} and tr.usuario_id = ${alvo.usuarioId}`,
      );
    const [n] = await tx
      .select({ numero: deal.numero, codinome: deal.codinome })
      .from(deal)
      .where(eq(deal.id, dealId));
    if (alvo.usuarioId && alvo.usuarioId !== a.usuario.id && n)
      await notificar(tx, a.tenant.id, alvo.usuarioId, "negocio_removido", {
        negocio: nomeVisivel(n.numero, n.codinome),
      });
    return { pessoaId: alvo.pessoaId };
  });
  if ("erro" in feito) return feito;
  await auditar(a, "negocio.participante_removido", "deal", dealId, { pessoaId: feito.pessoaId });
  return { ok: true };
}

function semCamposInternos(
  n: NegocioResumo & { tipoId: unknown; ladoDoContratante: unknown },
): NegocioResumo {
  const copia: Partial<typeof n> = { ...n };
  delete copia.tipoId;
  delete copia.ladoDoContratante;
  return copia as NegocioResumo;
}

/** Reaproveitado dentro do mesmo carregamento de página (React cache; gravações não usam). */
export const visaoDoNegocio = cache(visaoDoNegocioSemCache);

/** Reaproveitado dentro do mesmo carregamento de página (React cache; gravações não usam). */
export const empresasDoNegocio = cache(empresasDoNegocioSemCache);
