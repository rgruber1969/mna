import { and, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { tradutor, type ErroDeServico } from "@/i18n/servidor";
import { banco, comTenant } from "@/server/db/cliente";
import {
  deal,
  dealEmpresa,
  empresa,
  eventoAuditoria,
  papelEmpresa,
  participacaoDeal,
  perfil,
  pessoa,
  prorrogacaoExclusividade,
  tarefa,
  tarefaResponsavel,
  tenant,
  usuario,
} from "@/server/db/esquema";
import { AcessoNegado, exigirAdministrador, exigirTenant, type Acesso } from "./acesso";
import { auditar } from "./empresas";
import { avisarPorEmail } from "./negocios-avisos";
import {
  empresasDoNegocio,
  negocioFechado,
  nomeVisivel,
  visaoDoNegocio,
  type SituacaoDoNegocio,
  type SituacaoNoFunil,
} from "./negocios";
import { notificar, type TipoDeNotificacao } from "./notificacoes";
import { exigirPermissao } from "./permissoes/verificador";

/**
 * Andamento do negócio (dominio.md, item 8, respostas N1–N6 de 2026-11-19):
 * funil das compradoras, situação do negócio, exclusividade com
 * prorrogações, avisos de prazo e histórico.
 */

type Resultado = { ok: true } | ErroDeServico;
const uuidValido = (id: string) => z.uuid().safeParse(id).success;
const dataValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Hoje em São Paulo (AAAA-MM-DD). */
export const hojeEmSaoPaulo = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
const dataBr = (d: string) => d.split("-").reverse().join("/");

type Tx = Parameters<Parameters<typeof comTenant>[1]>[0];

async function dadosDoNegocio(tx: Tx, dealId: string) {
  const [n] = await tx.select().from(deal).where(eq(deal.id, dealId));
  return n;
}

// --- Acessos cortados (descarte da compradora, encerramento dos externos) -------------------

async function cortarAcessos(tx: Tx, dealId: string, empresaIds: string[], motivo: "descarte" | "externos") {
  if (empresaIds.length === 0) return;
  await tx
    .update(participacaoDeal)
    .set({
      prazoAntesDoCorte: sql`${participacaoDeal.prazo}`,
      prazo: sql`current_date - 1`,
      cortadaEm: new Date(),
      motivoDoCorte: motivo,
    })
    .where(
      and(
        eq(participacaoDeal.dealId, dealId),
        inArray(participacaoDeal.empresaId, empresaIds),
        isNull(participacaoDeal.cortadaEm),
      ),
    );
}

async function devolverAcessos(tx: Tx, dealId: string, empresaIds: string[]) {
  if (empresaIds.length === 0) return;
  await tx
    .update(participacaoDeal)
    .set({
      prazo: sql`${participacaoDeal.prazoAntesDoCorte}`,
      prazoAntesDoCorte: null,
      cortadaEm: null,
      motivoDoCorte: null,
    })
    .where(
      and(
        eq(participacaoDeal.dealId, dealId),
        inArray(participacaoDeal.empresaId, empresaIds),
        eq(participacaoDeal.motivoDoCorte, "descarte"),
      ),
    );
}

// --- Funil das compradoras (N1–N3) --------------------------------------------------------

/**
 * O funil é ferramenta do lado vendedor: só quem está do lado vendedor (ou
 * administra o tenant) e tem "Funil de compradoras" no perfil vê e mexe.
 */
async function exigirFunil(acesso: Acesso | null, dealId: string, acao: "ver" | "editar") {
  const a = await exigirPermissao(acesso, "funil", acao, { dealId });
  if (!a.administrador) {
    const { visao } = await visaoDoNegocio(a, dealId);
    if (!visao.lados.has("vendedor")) throw new AcessoNegado();
  }
  return a;
}

/** Pode ver o funil? (para mostrar a aba sem registrar negação). */
async function podeVerFunil(acesso: Acesso | null, dealId: string): Promise<boolean> {
  try {
    const a = exigirTenant(acesso);
    if (a.administrador) return true;
    const { visao } = await visaoDoNegocio(a, dealId);
    return visao.lados.has("vendedor") && (visao.matriz.funil ?? []).includes("ver");
  } catch {
    return false;
  }
}

export type CartaoDoFunil = {
  id: string;
  empresaId: string;
  nome: string;
  situacao: SituacaoNoFunil;
  /** Escritórios, advisors etc. que trabalham para esta compradora. */
  equipe: string[];
  historico: { de: string; para: string; quando: Date; ator: string | null }[];
  observacoes: string | null;
};

/** Funil de compradoras do negócio (aba kanban), ou null se a pessoa não o vê. */
export async function funilDoNegocio(
  acesso: Acesso | null,
  dealId: string,
): Promise<{ cartoes: CartaoDoFunil[]; podeEditar: boolean } | null> {
  if (!uuidValido(dealId) || !(await podeVerFunil(acesso, dealId))) return null;
  const a = exigirTenant(acesso);
  const { visao } = await visaoDoNegocio(a, dealId);
  const empresas = await empresasDoNegocio(a, dealId);
  return comTenant(a.tenant.id, async (tx) => {
    const n = await dadosDoNegocio(tx, dealId);
    const nomes = new Map(
      (
        await tx
          .select({ id: empresa.id, nome: empresa.razaoSocial })
          .from(empresa)
          .where(inArray(empresa.id, [...new Set(empresas.map((e) => e.empresaId))]))
      ).map((e) => [e.id, e.nome]),
    );
    const eventos = await tx
      .select({ quando: eventoAuditoria.ocorridoEm, ator: usuario.name, detalhes: eventoAuditoria.detalhes })
      .from(eventoAuditoria)
      .leftJoin(usuario, eq(usuario.id, eventoAuditoria.atorId))
      .where(
        and(
          eq(eventoAuditoria.alvoTipo, "deal"),
          eq(eventoAuditoria.alvoId, dealId),
          eq(eventoAuditoria.tipo, "negocio.funil"),
        ),
      )
      .orderBy(desc(eventoAuditoria.ocorridoEm));
    const fechado = n?.situacao === "concluido" || n?.situacao === "encerrado";
    const obs = new Map(
      (
        await tx
          .select({ id: dealEmpresa.id, observacoes: dealEmpresa.observacoes })
          .from(dealEmpresa)
          .where(eq(dealEmpresa.dealId, dealId))
      ).map((o) => [o.id, o.observacoes]),
    );
    return {
      podeEditar: !fechado && (a.administrador || (visao.matriz.funil ?? []).includes("editar")),
      cartoes: empresas
        .filter((e) => e.compradora && e.situacaoFunil)
        .map((e) => ({
          id: e.id,
          empresaId: e.empresaId,
          nome: nomes.get(e.empresaId) ?? "—",
          situacao: e.situacaoFunil!,
          observacoes: obs.get(e.id) ?? null,
          equipe: empresas
            .filter((x) => x.atuaParaId === e.empresaId)
            .map((x) => nomes.get(x.empresaId) ?? "—"),
          historico: eventos
            .filter((ev) => ev.detalhes?.empresaId === e.empresaId)
            .map((ev) => ({
              de: String(ev.detalhes?.de ?? ""),
              para: String(ev.detalhes?.para ?? ""),
              quando: ev.quando,
              ator: ev.ator,
            })),
        })),
    };
  });
}

/** Observações do cartão da compradora no funil (quem pode mexer no funil). */
export async function salvarObservacoesDoFunil(
  acesso: Acesso | null,
  dealId: string,
  dealEmpresaId: string,
  texto: string,
): Promise<Resultado> {
  const a = await exigirFunil(acesso, dealId, "editar");
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  if (!uuidValido(dealEmpresaId)) return { erro: "negocios.erros.empresaNaoEncontrada" };
  const valor = texto.trim().slice(0, 4000) || null;
  const feito = await comTenant(a.tenant.id, (tx) =>
    tx
      .update(dealEmpresa)
      .set({ observacoes: valor })
      .where(
        and(
          eq(dealEmpresa.id, dealEmpresaId),
          eq(dealEmpresa.dealId, dealId),
          isNotNull(dealEmpresa.situacaoFunil),
        ),
      )
      .returning({ empresaId: dealEmpresa.empresaId }),
  );
  if (!feito[0]) return { erro: "negocios.erros.naoECompradora" };
  await auditar(a, "negocio.funil_observacoes", "deal", dealId, { empresaId: feito[0].empresaId });
  return { ok: true };
}

/**
 * Muda a situação de uma compradora no funil (lado vendedor, com "Funil de
 * compradoras × editar"; administradores).
 * Descartada perde o acesso na hora, com a sua equipe (N3); se voltar, os
 * acessos voltam. Escolhida: `descartarOutras` descarta as demais (N2).
 */
export async function alterarSituacaoNoFunil(
  acesso: Acesso | null,
  dealId: string,
  dados: { dealEmpresaId: string; situacao: string; descartarOutras?: boolean },
): Promise<Resultado> {
  const a = await exigirFunil(acesso, dealId, "editar");
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const situacoes: SituacaoNoFunil[] = [
    "prospectada",
    "teaser",
    "nda",
    "proposta",
    "escolhida",
    "descartada",
  ];
  const nova = dados.situacao as SituacaoNoFunil;
  if (!situacoes.includes(nova)) return { erro: "negocios.erros.situacaoInvalida" };
  if (!uuidValido(dados.dealEmpresaId)) return { erro: "negocios.erros.empresaNaoEncontrada" };
  const empresas = await empresasDoNegocio(a, dealId);
  const alvo = empresas.find((e) => e.id === dados.dealEmpresaId && e.compradora);
  if (!alvo) return { erro: "negocios.erros.naoECompradora" };
  const equipeDe = (compradora: string) => [
    compradora,
    ...empresas.filter((e) => e.atuaParaId === compradora).map((e) => e.empresaId),
  ];
  const mudancas: { empresaId: string; de: string; para: string }[] = [];
  await comTenant(a.tenant.id, async (tx) => {
    const mudar = async (
      linha: { id: string; empresaId: string; situacaoFunil: SituacaoNoFunil | null },
      para: SituacaoNoFunil,
    ) => {
      if (linha.situacaoFunil === para) return;
      await tx.update(dealEmpresa).set({ situacaoFunil: para }).where(eq(dealEmpresa.id, linha.id));
      if (para === "descartada") await cortarAcessos(tx, dealId, equipeDe(linha.empresaId), "descarte");
      if (linha.situacaoFunil === "descartada") await devolverAcessos(tx, dealId, equipeDe(linha.empresaId));
      mudancas.push({ empresaId: linha.empresaId, de: linha.situacaoFunil ?? "", para });
    };
    await mudar(alvo, nova);
    if (nova === "escolhida" && dados.descartarOutras)
      for (const outra of empresas.filter(
        (e) => e.compradora && e.id !== alvo.id && e.situacaoFunil !== "descartada",
      ))
        await mudar(outra, "descartada");
  });
  for (const m of mudancas) await auditar(a, "negocio.funil", "deal", dealId, m);
  return { ok: true };
}

// --- Situação do negócio (N5) ------------------------------------------------------------

export const MOTIVOS_DE_ENCERRAMENTO = [
  "desistencia_vendedora",
  "desistencia_compradora",
  "preco",
  "diligencia",
  "outro",
] as const;

/** Participantes com usuário e acesso válido (para avisos). */
async function usuariosDoNegocio(
  tx: Tx,
  dealId: string,
  filtro?: (p: {
    lado: string | null;
    padrao: string | null;
    perfilId: string;
    compradora: string | null;
  }) => boolean,
) {
  const linhas = await tx
    .select({
      usuarioId: pessoa.usuarioId,
      empresaId: participacaoDeal.empresaId,
      lado: participacaoDeal.lado,
      padrao: perfil.padrao,
      perfilId: perfil.id,
    })
    .from(participacaoDeal)
    .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
    .innerJoin(perfil, eq(perfil.id, participacaoDeal.perfilId))
    .where(
      and(
        eq(participacaoDeal.dealId, dealId),
        isNotNull(pessoa.usuarioId),
        sql`(${participacaoDeal.prazo} is null or ${participacaoDeal.prazo} >= current_date)`,
      ),
    );
  const papeis = await tx
    .select({
      empresaId: dealEmpresa.empresaId,
      lado: papelEmpresa.lado,
      padrao: papelEmpresa.padrao,
      atuaParaId: dealEmpresa.atuaParaId,
    })
    .from(dealEmpresa)
    .innerJoin(papelEmpresa, eq(papelEmpresa.id, dealEmpresa.papelId))
    .where(eq(dealEmpresa.dealId, dealId));
  const ladoDe = (empresaId: string | null, lado: string | null) =>
    (empresaId && papeis.find((p) => p.empresaId === empresaId && p.lado)?.lado) || lado;
  const compradoraDe = (empresaId: string | null) => {
    const e = papeis.find((p) => p.empresaId === empresaId && p.lado === "comprador");
    return e ? (e.padrao === "compradora" ? e.empresaId : e.atuaParaId) : null;
  };
  return [
    ...new Set(
      linhas
        .filter(
          (l) =>
            !filtro ||
            filtro({
              lado: ladoDe(l.empresaId, l.lado),
              padrao: l.padrao,
              perfilId: l.perfilId,
              compradora: compradoraDe(l.empresaId),
            }),
        )
        .map((l) => l.usuarioId!),
    ),
  ];
}

/**
 * Muda a situação do negócio. Suspender, retomar, concluir e encerrar: quem
 * edita o negócio (Coordenador). Reabrir um concluído ou encerrado: só
 * administradores. Encerrar pede o motivo. Todos os participantes são avisados.
 */
export async function alterarSituacaoDoNegocio(
  acesso: Acesso | null,
  dealId: string,
  dados: { situacao: string; motivo?: string },
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "deal", "editar", { dealId });
  if (!uuidValido(dealId)) return { erro: "negocios.erros.naoEncontrado" };
  const nova = dados.situacao as SituacaoDoNegocio;
  if (!["andamento", "suspenso", "concluido", "encerrado"].includes(nova))
    return { erro: "negocios.erros.situacaoInvalida" };
  const motivo = nova === "encerrado" ? dados.motivo : undefined;
  if (nova === "encerrado" && !(MOTIVOS_DE_ENCERRAMENTO as readonly string[]).includes(motivo ?? ""))
    return { erro: "negocios.erros.motivoObrigatorio", campo: "motivo" };
  const r = await comTenant(
    a.tenant.id,
    async (
      tx,
    ): Promise<ErroDeServico | { de: string; numero: number; codinome: string; usuarios: string[] }> => {
      const n = await dadosDoNegocio(tx, dealId);
      if (!n) return { erro: "negocios.erros.naoEncontrado" };
      if (n.situacao === nova) return { erro: "negocios.erros.mesmaSituacao" };
      const fechado = n.situacao === "concluido" || n.situacao === "encerrado";
      if (fechado && !a.administrador) return { erro: "negocios.erros.soAdministradorReabre" };
      await tx
        .update(deal)
        .set({
          situacao: nova,
          motivoEncerramento: motivo ?? null,
          encerradoEm: nova === "concluido" || nova === "encerrado" ? new Date() : null,
          atualizadoEm: new Date(),
        })
        .where(eq(deal.id, dealId));
      const usuarios = (await usuariosDoNegocio(tx, dealId)).filter((u) => u !== a.usuario.id);
      const nome = nomeVisivel(n.numero, n.codinome);
      for (const u of usuarios)
        await notificar(
          tx,
          a.tenant.id,
          u,
          "negocio_situacao",
          { negocio: nome, situacao: nova },
          `/negocios/${dealId}`,
        );
      return { de: n.situacao, numero: n.numero, codinome: n.codinome, usuarios };
    },
  );
  if ("erro" in r) return r;
  await auditar(a, "negocio.situacao", "deal", dealId, {
    de: r.de,
    para: nova,
    ...(motivo ? { motivo } : {}),
  });
  if (nova !== "andamento") {
    const tr = await tradutor();
    await avisarPorEmail(a, r.usuarios, "situacao", nomeVisivel(r.numero, r.codinome), dealId, {
      situacao: tr(`negocios.situacoes.${nova}`),
    });
  }
  return { ok: true };
}

/**
 * Encerra de uma vez os acessos de quem não representa o contratante (N5):
 * administradores. Os registros e o histórico continuam.
 */
export async function encerrarAcessosExternos(acesso: Acesso | null, dealId: string): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  if (!uuidValido(dealId)) return { erro: "negocios.erros.naoEncontrado" };
  const n = await comTenant(a.tenant.id, async (tx) => {
    const externas = await tx
      .select({ id: participacaoDeal.id })
      .from(participacaoDeal)
      .leftJoin(empresa, eq(empresa.id, participacaoDeal.empresaId))
      .where(
        and(
          eq(participacaoDeal.dealId, dealId),
          isNull(participacaoDeal.cortadaEm),
          sql`coalesce(${empresa.doContratante}, false) = false`,
        ),
      );
    if (externas.length)
      await tx
        .update(participacaoDeal)
        .set({
          prazoAntesDoCorte: sql`${participacaoDeal.prazo}`,
          prazo: sql`current_date - 1`,
          cortadaEm: new Date(),
          motivoDoCorte: "externos",
        })
        .where(
          inArray(
            participacaoDeal.id,
            externas.map((e) => e.id),
          ),
        );
    return externas.length;
  });
  await auditar(a, "negocio.acessos_externos_encerrados", "deal", dealId, { quantidade: n });
  return { ok: true };
}

// --- Exclusividade (N4) -------------------------------------------------------------------

/** Define o período de exclusividade com a compradora escolhida (fim pela data ou pelos dias). */
export async function definirExclusividade(
  acesso: Acesso | null,
  dealId: string,
  dados: { inicio: string; fim?: string; dias?: string },
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "deal", "editar", { dealId });
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  if (!dataValida(dados.inicio)) return { erro: "negocios.erros.dataInvalida", campo: "inicio" };
  const dias = Number(dados.dias);
  const fim =
    dados.fim && dataValida(dados.fim) ? dados.fim : dias > 0 ? somarDias(dados.inicio, dias) : null;
  if (!fim) return { erro: "negocios.erros.fimOuDias", campo: "fim" };
  if (fim < dados.inicio) return { erro: "negocios.erros.fimAntesDoInicio", campo: "fim" };
  const empresas = await empresasDoNegocio(a, dealId);
  const escolhida = empresas.find((e) => e.compradora && e.situacaoFunil === "escolhida");
  if (!escolhida) return { erro: "negocios.erros.semCompradoraEscolhida" };
  const r = await comTenant(a.tenant.id, async (tx): Promise<Resultado> => {
    const n = await dadosDoNegocio(tx, dealId);
    if (n?.exclusividadeFim) return { erro: "negocios.erros.exclusividadeJaDefinida" };
    await tx
      .update(deal)
      .set({
        exclusividadeEmpresaId: escolhida.empresaId,
        exclusividadeInicio: dados.inicio,
        exclusividadeFim: fim,
      })
      .where(eq(deal.id, dealId));
    return { ok: true };
  });
  if ("erro" in r) return r;
  await auditar(a, "negocio.exclusividade_definida", "deal", dealId, {
    empresaId: escolhida.empresaId,
    inicio: dados.inicio,
    fim,
  });
  await enviarAvisosDePrazo(a.tenant, { dealId });
  return { ok: true };
}

/** Prorroga a exclusividade (com histórico); os avisos recomeçam pela nova data. */
export async function prorrogarExclusividade(
  acesso: Acesso | null,
  dealId: string,
  dados: { novoFim: string; motivo?: string },
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "deal", "editar", { dealId });
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  if (!dataValida(dados.novoFim)) return { erro: "negocios.erros.dataInvalida", campo: "novoFim" };
  const motivo = dados.motivo?.trim().slice(0, 500) || null;
  const r = await comTenant(a.tenant.id, async (tx): Promise<ErroDeServico | { fimAnterior: string }> => {
    const n = await dadosDoNegocio(tx, dealId);
    if (!n?.exclusividadeFim) return { erro: "negocios.erros.semExclusividade" };
    if (dados.novoFim <= n.exclusividadeFim)
      return { erro: "negocios.erros.prorrogacaoAntes", campo: "novoFim" };
    await tx.insert(prorrogacaoExclusividade).values({
      tenantId: a.tenant.id,
      dealId,
      fimAnterior: n.exclusividadeFim,
      novoFim: dados.novoFim,
      motivo,
      criadoPor: a.usuario.id,
    });
    await tx.update(deal).set({ exclusividadeFim: dados.novoFim }).where(eq(deal.id, dealId));
    return { fimAnterior: n.exclusividadeFim };
  });
  if ("erro" in r) return r;
  await auditar(a, "negocio.exclusividade_prorrogada", "deal", dealId, {
    de: r.fimAnterior,
    para: dados.novoFim,
  });
  return { ok: true };
}

// --- Avisos de prazo (tarefa diária e após definir a exclusividade) ------------------------------

/**
 * Avisos de prazo de um tenant (ou de um negócio): início, antecedências
 * configuradas e fim da exclusividade, ao lado vendedor; vencimento do prazo
 * de participação, ao Coordenador. Idempotente: cada aviso sai uma vez.
 */
export async function enviarAvisosDePrazo(
  t: { id: string; slug: string },
  opcoes: { dealId?: string; hoje?: string } = {},
): Promise<number> {
  const hoje = opcoes.hoje ?? hojeEmSaoPaulo();
  const [conf] = await banco()
    .select({ dias: tenant.diasAvisoExclusividade, diasTarefa: tenant.diasLembreteTarefa })
    .from(tenant)
    .where(eq(tenant.id, t.id));
  const antecedencias = [...(conf?.dias ?? [15, 5])].sort((x, y) => y - x);
  const antecedenciasTarefa = [...(conf?.diasTarefa ?? [2, 0])].sort((x, y) => y - x);
  const emails: {
    usuarios: string[];
    tipo:
      | "exclusividadeInicio"
      | "exclusividadeAviso"
      | "exclusividadeFim"
      | "participacaoVencida"
      | "tarefaPrazo";
    negocio: string;
    dealId: string;
    p: Record<string, string | number>;
  }[] = [];
  let enviados = 0;
  await comTenant(t.id, async (tx) => {
    const negocios = await tx
      .select()
      .from(deal)
      .where(
        and(
          inArray(deal.situacao, ["andamento", "suspenso"]),
          opcoes.dealId ? eq(deal.id, opcoes.dealId) : undefined,
        ),
      );
    for (const n of negocios) {
      const nome = nomeVisivel(n.numero, n.codinome);
      const enviadosAntes = new Set(n.avisosEnviados);
      const novos: string[] = [];
      const avisar = async (
        chave: string,
        tipo: TipoDeNotificacao,
        email: (typeof emails)[number]["tipo"],
        p: Record<string, string>,
        usuarios: string[],
      ) => {
        novos.push(chave);
        for (const u of usuarios)
          await notificar(tx, t.id, u, tipo, { negocio: nome, ...p }, `/negocios/${n.id}`);
        emails.push({ usuarios, tipo: email, negocio: nome, dealId: n.id, p });
        enviados++;
      };
      if (n.exclusividadeInicio && n.exclusividadeFim) {
        const ini = n.exclusividadeInicio;
        const fim = n.exclusividadeFim;
        const ladoVendedor = await usuariosDoNegocio(tx, n.id, (p) => p.lado === "vendedor");
        if (hoje >= ini && hoje <= fim && !enviadosAntes.has(`inicio:${ini}`))
          await avisar(
            `inicio:${ini}`,
            "exclusividade_inicio",
            "exclusividadeInicio",
            { fim: dataBr(fim) },
            ladoVendedor,
          );
        // Antecedências: só o aviso mais próximo que já valeu (sem repetir os anteriores).
        const faltam = diasEntre(hoje, fim);
        const devidos = antecedencias.filter(
          (d) => faltam > 0 && faltam <= d && !enviadosAntes.has(`aviso${d}:${fim}`),
        );
        if (devidos.length) {
          const d = devidos[devidos.length - 1];
          await avisar(
            `aviso${d}:${fim}`,
            "exclusividade_aviso",
            "exclusividadeAviso",
            { dias: String(faltam), fim: dataBr(fim) },
            ladoVendedor,
          );
          for (const outro of devidos)
            if (!novos.includes(`aviso${outro}:${fim}`)) novos.push(`aviso${outro}:${fim}`);
        }
        if (hoje >= fim && !enviadosAntes.has(`fim:${fim}`)) {
          if (hoje === fim)
            await avisar(
              `fim:${fim}`,
              "exclusividade_fim",
              "exclusividadeFim",
              { fim: dataBr(fim) },
              ladoVendedor,
            );
          else novos.push(`fim:${fim}`);
        }
      }
      if (novos.length)
        await tx
          .update(deal)
          .set({ avisosEnviados: [...n.avisosEnviados, ...novos] })
          .where(eq(deal.id, n.id));
      // Tarefas abertas com prazo: lembra os responsáveis (o lembrete mais próximo, uma vez).
      const abertas = await tx
        .select({
          id: tarefa.id,
          titulo: tarefa.titulo,
          prazo: tarefa.prazo,
          lado: tarefa.lado,
          compradoraId: tarefa.compradoraId,
          enviados: tarefa.lembretesEnviados,
        })
        .from(tarefa)
        .where(
          and(
            eq(tarefa.dealId, n.id),
            inArray(tarefa.situacao, ["a_fazer", "andamento", "aguardando"]),
            isNotNull(tarefa.prazo),
          ),
        );
      for (const tf of abertas) {
        const faltam = diasEntre(hoje, tf.prazo!);
        const devidos = antecedenciasTarefa.filter(
          (d) => faltam >= 0 && faltam <= d && !tf.enviados.includes(`d${d}:${tf.prazo}`),
        );
        if (!devidos.length) continue;
        const resp = await tx
          .select({ usuarioId: tarefaResponsavel.usuarioId, perfilId: tarefaResponsavel.perfilId })
          .from(tarefaResponsavel)
          .where(eq(tarefaResponsavel.tarefaId, tf.id));
        const perfis = resp.flatMap((r) => (r.perfilId ? [r.perfilId] : []));
        // Por perfil: só quem tem o perfil do mesmo lado da tarefa.
        const porPerfil = perfis.length
          ? (
              await usuariosDoNegocio(
                tx,
                n.id,
                (p) =>
                  perfis.includes(p.perfilId) &&
                  (tf.lado === null || p.lado === tf.lado) &&
                  (tf.compradoraId === null || p.compradora === tf.compradoraId),
              )
            ).map((usuarioId) => ({ usuarioId }))
          : [];
        const usuarios = [
          ...new Set([
            ...resp.flatMap((r) => (r.usuarioId ? [r.usuarioId] : [])),
            ...porPerfil.map((p) => p.usuarioId!),
          ]),
        ];
        const p = { tarefa: tf.titulo, prazo: dataBr(tf.prazo!), dias: String(faltam) };
        for (const u of usuarios)
          await notificar(
            tx,
            t.id,
            u,
            "tarefa_prazo",
            { negocio: nome, ...p },
            `/negocios/${n.id}?aba=tarefas`,
          );
        emails.push({ usuarios, tipo: "tarefaPrazo", negocio: nome, dealId: n.id, p });
        enviados++;
        await tx
          .update(tarefa)
          .set({ lembretesEnviados: [...tf.enviados, ...devidos.map((d) => `d${d}:${tf.prazo}`)] })
          .where(eq(tarefa.id, tf.id));
      }
      // Prazo de participação vencido (não cortado à mão): avisa o Coordenador.
      const vencidas = await tx
        .select({ id: participacaoDeal.id, pessoa: pessoa.nome })
        .from(participacaoDeal)
        .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
        .where(
          and(
            eq(participacaoDeal.dealId, n.id),
            lt(participacaoDeal.prazo, hoje),
            isNull(participacaoDeal.cortadaEm),
            eq(participacaoDeal.vencimentoAvisado, false),
          ),
        );
      if (vencidas.length) {
        const coordenadores = await usuariosDoNegocio(tx, n.id, (p) => p.padrao === "coordenador-deal");
        for (const v of vencidas) {
          for (const u of coordenadores)
            await notificar(
              tx,
              t.id,
              u,
              "participacao_vencida",
              { negocio: nome, pessoa: v.pessoa },
              `/negocios/${n.id}?aba=participantes`,
            );
          emails.push({
            usuarios: coordenadores,
            tipo: "participacaoVencida",
            negocio: nome,
            dealId: n.id,
            p: { pessoa: v.pessoa },
          });
          enviados++;
        }
        await tx
          .update(participacaoDeal)
          .set({ vencimentoAvisado: true })
          .where(
            inArray(
              participacaoDeal.id,
              vencidas.map((v) => v.id),
            ),
          );
      }
    }
  });
  for (const e of emails) await avisarPorEmail({ tenant: t }, e.usuarios, e.tipo, e.negocio, e.dealId, e.p);
  return enviados;
}

/** Tarefa diária: avisos de prazo em todos os tenants ativos. */
export async function enviarAvisosDePrazoDeTodos(hoje?: string): Promise<number> {
  const tenants = await banco()
    .select({ id: tenant.id, slug: tenant.slug })
    .from(tenant)
    .where(isNull(tenant.suspensoEm));
  let total = 0;
  for (const t of tenants) total += await enviarAvisosDePrazo(t, { hoje });
  return total;
}

// --- Configurações gerais do tenant ------------------------------------------------------------

/** Dias antes do prazo para lembrar os responsáveis por uma tarefa (0 = no dia). */
export async function obterDiasDeLembreteDeTarefa(acesso: Acesso | null): Promise<number[]> {
  const a = exigirTenant(acesso);
  const [c] = await banco()
    .select({ dias: tenant.diasLembreteTarefa })
    .from(tenant)
    .where(eq(tenant.id, a.tenant.id));
  return c?.dias ?? [2, 0];
}

export async function salvarDiasDeLembreteDeTarefa(acesso: Acesso | null, texto: string): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const dias = [
    ...new Set(
      texto
        .split(/[,;\s]+/)
        .filter(Boolean)
        .map(Number),
    ),
  ];
  if (dias.length === 0 || dias.length > 5 || dias.some((d) => !Number.isInteger(d) || d < 0 || d > 60))
    return { erro: "negocios.erros.diasDeLembreteInvalidos", campo: "diasTarefa" };
  dias.sort((x, y) => y - x);
  await banco().update(tenant).set({ diasLembreteTarefa: dias }).where(eq(tenant.id, a.tenant.id));
  await auditar(a, "tenant.configuracoes_alteradas", "tenant", a.tenant.id, {
    diasLembreteTarefa: dias.join(","),
  });
  return { ok: true };
}

export async function obterDiasDeAviso(acesso: Acesso | null): Promise<number[]> {
  const a = exigirTenant(acesso);
  const [c] = await banco()
    .select({ dias: tenant.diasAvisoExclusividade })
    .from(tenant)
    .where(eq(tenant.id, a.tenant.id));
  return c?.dias ?? [15, 5];
}

/** Antecedências dos avisos de fim da exclusividade (administradores), ex.: "15, 5". */
export async function salvarDiasDeAviso(acesso: Acesso | null, texto: string): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const dias = [
    ...new Set(
      texto
        .split(/[,;\s]+/)
        .filter(Boolean)
        .map(Number),
    ),
  ];
  if (dias.length === 0 || dias.length > 5 || dias.some((d) => !Number.isInteger(d) || d < 1 || d > 180))
    return { erro: "negocios.erros.diasDeAvisoInvalidos", campo: "dias" };
  dias.sort((x, y) => y - x);
  await banco().update(tenant).set({ diasAvisoExclusividade: dias }).where(eq(tenant.id, a.tenant.id));
  await auditar(a, "tenant.configuracoes_alteradas", "tenant", a.tenant.id, {
    diasAvisoExclusividade: dias.join(","),
  });
  return { ok: true };
}

// --- Andamento e histórico na tela do negócio -------------------------------------------------

export type Andamento = {
  situacao: SituacaoDoNegocio;
  motivoEncerramento: string | null;
  podeMudarSituacao: boolean;
  podeReabrir: boolean;
  podeEncerrarExternos: boolean;
  /** Só para o lado vendedor e os administradores. */
  exclusividade: {
    compradora: string | null;
    inicio: string;
    fim: string;
    prorrogacoes: { fimAnterior: string; novoFim: string; motivo: string | null; quando: Date }[];
  } | null;
  verExclusividade: boolean;
  historico: { tipo: string; quando: Date; ator: string | null; parametros: Record<string, string> }[];
};

/** Eventos que o lado comprador vê no histórico (sem nomes de outras empresas nem do lado vendedor). */
const EVENTOS_GERAIS = new Set(["negocio.criado", "negocio.editado", "negocio.situacao"]);

export async function andamentoDoNegocio(acesso: Acesso | null, dealId: string): Promise<Andamento | null> {
  const a = exigirTenant(acesso);
  if (!uuidValido(dealId)) return null;
  let visao;
  try {
    ({ visao } = await visaoDoNegocio(a, dealId));
  } catch (e) {
    if (e instanceof AcessoNegado) return null;
    throw e;
  }
  const verTudo = visao.administrador || visao.lados.has("vendedor");
  const podeEditar = visao.administrador || (visao.matriz.deal ?? []).includes("editar");
  return comTenant(a.tenant.id, async (tx) => {
    const n = await dadosDoNegocio(tx, dealId);
    if (!n) return null;
    const fechado = n.situacao === "concluido" || n.situacao === "encerrado";
    const eventos = await tx
      .select({
        tipo: eventoAuditoria.tipo,
        quando: eventoAuditoria.ocorridoEm,
        ator: usuario.name,
        detalhes: eventoAuditoria.detalhes,
      })
      .from(eventoAuditoria)
      .leftJoin(usuario, eq(usuario.id, eventoAuditoria.atorId))
      .where(and(eq(eventoAuditoria.alvoTipo, "deal"), eq(eventoAuditoria.alvoId, dealId)))
      .orderBy(desc(eventoAuditoria.ocorridoEm))
      .limit(200);
    const visiveis = eventos.filter(
      (e) => e.tipo !== "negocio.visualizado" && (verTudo || EVENTOS_GERAIS.has(e.tipo)),
    );
    const ids = (campo: string) => [
      ...new Set(
        visiveis
          .map((e) => e.detalhes?.[campo])
          .filter((v): v is string => typeof v === "string" && uuidValido(v)),
      ),
    ];
    const [empresas, pessoas] = await Promise.all([
      ids("empresaId").length
        ? tx
            .select({ id: empresa.id, nome: empresa.razaoSocial })
            .from(empresa)
            .where(inArray(empresa.id, ids("empresaId")))
        : [],
      ids("pessoaId").length
        ? tx
            .select({ id: pessoa.id, nome: pessoa.nome })
            .from(pessoa)
            .where(inArray(pessoa.id, ids("pessoaId")))
        : [],
    ]);
    const nomeEmpresa = new Map(empresas.map((e) => [e.id, e.nome]));
    const nomePessoa = new Map(pessoas.map((p) => [p.id, p.nome]));
    const [compradora] = n.exclusividadeEmpresaId
      ? await tx
          .select({ nome: empresa.razaoSocial })
          .from(empresa)
          .where(eq(empresa.id, n.exclusividadeEmpresaId))
      : [];
    const prorrogacoes = n.exclusividadeFim
      ? await tx
          .select({
            fimAnterior: prorrogacaoExclusividade.fimAnterior,
            novoFim: prorrogacaoExclusividade.novoFim,
            motivo: prorrogacaoExclusividade.motivo,
            quando: prorrogacaoExclusividade.criadoEm,
          })
          .from(prorrogacaoExclusividade)
          .where(eq(prorrogacaoExclusividade.dealId, dealId))
          .orderBy(desc(prorrogacaoExclusividade.criadoEm))
      : [];
    return {
      situacao: n.situacao,
      motivoEncerramento: n.motivoEncerramento,
      podeMudarSituacao: podeEditar && (!fechado || a.administrador),
      podeReabrir: fechado && a.administrador,
      podeEncerrarExternos: a.administrador,
      verExclusividade: verTudo,
      exclusividade:
        verTudo && n.exclusividadeInicio && n.exclusividadeFim
          ? {
              compradora: compradora?.nome ?? null,
              inicio: n.exclusividadeInicio,
              fim: n.exclusividadeFim,
              prorrogacoes,
            }
          : null,
      historico: visiveis.map((e) => {
        const d = e.detalhes ?? {};
        const p: Record<string, string> = {};
        for (const [k, v] of Object.entries(d)) if (v !== null) p[k] = String(v);
        if (typeof d.empresaId === "string") p.empresa = nomeEmpresa.get(d.empresaId) ?? "—";
        if (typeof d.pessoaId === "string") p.pessoa = nomePessoa.get(d.pessoaId) ?? "—";
        return { tipo: e.tipo, quando: e.quando, ator: e.ator, parametros: p };
      }),
    };
  });
}
