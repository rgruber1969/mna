import { and, asc, desc, eq, inArray, max, sql } from "drizzle-orm";
import { z } from "zod";
import { tradutor, type ErroDeServico } from "@/i18n/servidor";
import { estaLigada } from "@/config/funcionalidades";
import { pdfDeTexto } from "@/server/arquivos/pdf-simples";
import { resultadoDoValuation, VALUATION_DE_EXEMPLO } from "@/config/valuation";
import { comTenant } from "@/server/db/cliente";
import { chaveDoArquivo, gravarArquivo } from "@/server/arquivos/armazenamento";
import {
  categoriaDocumento,
  documento,
  versaoAcesso,
  deal,
  ebookComentario,
  ebookVersao,
  participacaoDeal,
  pessoa,
  usuario,
  type IdentidadeDoEbook,
  type MaterialDoEbook,
  type SituacaoDoEbook,
} from "@/server/db/esquema";
import { exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import { auditar } from "./empresas";
import {
  compradoraDaEmpresa,
  empresasDoNegocio,
  ladoDaParticipacao,
  negocioFechado,
  nomeVisivel,
  visaoDoNegocio,
  type EmpresaNoNegocio,
} from "./negocios";
import { notificar } from "./notificacoes";
import { concluirEnvio, dataRoomDoNegocio, excluirVersao, iniciarEnvio, linkDeDownload } from "./documentos";
import { AcessoNegado } from "./acesso";
import type { Acao } from "./permissoes/catalogo";
import { pode } from "./permissoes/verificador";

/**
 * E-book e OnePager (item 19; dominio.md, "E-book e OnePager"): o fluxo de
 * situações é real (versões numeradas por material, comentários, aprovação e
 * liberação ao comprador, com permissões, auditoria e aviso no sino). Cada
 * versão é uma **versão de documento do data room** (decisão de 2026-11-24),
 * na categoria do material ("E-book teaser" etc.): antivírus, busca, lista de
 * acesso e downloads auditados valem para ela. Sem arquivo enviado
 * (demonstração), a versão recebe um PDF de exemplo montado na hora. Liberar
 * ao comprador dá às pessoas do lado comprador acesso àquela versão no data
 * room; o e-mail ao comprador ainda não é enviado.
 *
 * - Quatro materiais por negócio: e-book teaser e completo, OnePager teaser
 *   e completo.
 * - Situações: em revisão (o advisor criou; a vendedora comenta) → aprovada
 *   (quem tem "aprovar") → disponível ao comprador (quem tem "liberar").
 * - Lado vendedor (e administradores) vê todas as versões; lado comprador só
 *   as disponíveis, e os materiais completos só depois do NDA da sua
 *   compradora (situação no funil NDA, proposta ou escolhida).
 */

export const MATERIAIS: MaterialDoEbook[] = [
  "ebook_teaser",
  "ebook_completo",
  "onepager_teaser",
  "onepager_completo",
];
export const IDENTIDADES: IdentidadeDoEbook[] = ["tenant", "vendedora", "advisor", "combinada"];

type Resultado = { ok: true } | ErroDeServico;
const uuidValido = (id: string) => z.uuid().safeParse(id).success;
const DEPOIS_DO_NDA = new Set(["nda", "proposta", "escolhida"]);
const desligada = { erro: "ebook.erros.funcionalidadeDesligada" } as const;

/** Lado comprador: vê materiais completos se alguma das suas compradoras já assinou o NDA. */
function compradorPassouDoNda(empresas: EmpresaNoNegocio[], compradoras: Set<string>) {
  return empresas.some((e) => compradoras.has(e.empresaId) && DEPOIS_DO_NDA.has(e.situacaoFunil ?? ""));
}

async function contexto(a: AcessoTenant, dealId: string) {
  if (!uuidValido(dealId) || !estaLigada("ebook")) return null;
  const acoes: Acao[] = ["ver", "criar", "excluir", "baixar", "comentar", "aprovar", "liberar"];
  const permitidas = new Set<Acao>();
  for (const acao of acoes) if (await pode(a, "ebook", acao, { dealId })) permitidas.add(acao);
  if (!a.administrador && !permitidas.has("ver")) return null;
  const [{ visao }, empresas, fechado] = await Promise.all([
    visaoDoNegocio(a, dealId),
    empresasDoNegocio(a, dealId),
    negocioFechado(a, dealId),
  ]);
  const vendedor = a.administrador || visao.lados.has("vendedor");
  const completos = vendedor || compradorPassouDoNda(empresas, visao.minhasCompradoras);
  return {
    vendedor,
    fechado: Boolean(fechado),
    /** Ações de quem monta e revisa: só o lado vendedor (e administradores). */
    pode: (acao: Acao) => vendedor && (a.administrador || permitidas.has(acao)),
    ve: (v: { material: MaterialDoEbook; situacao: SituacaoDoEbook }) =>
      vendedor || (v.situacao === "disponivel" && (completos || v.material.endsWith("_teaser"))),
  };
}
type Ctx = NonNullable<Awaited<ReturnType<typeof contexto>>>;

// --- Consulta --------------------------------------------------------------------------------

export type VersaoDoEbook = {
  id: string;
  material: MaterialDoEbook;
  numero: number;
  situacao: SituacaoDoEbook;
  identidade: IdentidadeDoEbook;
  incluiValuation: boolean;
  observacoes: string | null;
  criadoPor: string | null;
  criadoEm: string;
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  liberadoPor: string | null;
  liberadoEm: string | null;
  comentarios: { id: string; autor: string | null; texto: string; criadoEm: string }[];
  podeComentar: boolean;
  podeAprovar: boolean;
  podeLiberar: boolean;
  podeExcluir: boolean;
  /** Versão do arquivo no data room (para visualizar na tela); vazio nas versões antigas de demonstração. */
  documentoVersaoId: string | null;
};

export type EbookDoNegocio = {
  vendedor: boolean;
  podeCriar: boolean;
  materiais: { material: MaterialDoEbook; versoes: VersaoDoEbook[] }[];
};

const nomeDe = (id: string | null, nomes: Map<string, string>) => (id ? (nomes.get(id) ?? null) : null);

export async function ebookDoNegocio(acesso: Acesso | null, dealId: string): Promise<EbookDoNegocio | null> {
  const a = exigirTenant(acesso);
  const ctx = await contexto(a, dealId);
  if (!ctx) return null;
  const linhas = (
    await comTenant(a.tenant.id, (tx) =>
      tx
        .select()
        .from(ebookVersao)
        .where(eq(ebookVersao.dealId, dealId))
        .orderBy(asc(ebookVersao.material), desc(ebookVersao.numero)),
    )
  ).filter((v) => ctx.ve(v));
  const ids = linhas.map((v) => v.id);
  const comentarios = ids.length
    ? await comTenant(a.tenant.id, (tx) =>
        tx
          .select()
          .from(ebookComentario)
          .where(inArray(ebookComentario.versaoId, ids))
          .orderBy(asc(ebookComentario.criadoEm)),
      )
    : [];
  const pessoas = [
    ...new Set(
      [
        ...linhas.flatMap((v) => [v.criadoPor, v.aprovadoPor, v.liberadoPor]),
        ...comentarios.map((c) => c.autorId),
      ].filter((x): x is string => Boolean(x)),
    ),
  ];
  const nomes = new Map(
    pessoas.length
      ? (
          await comTenant(a.tenant.id, (tx) =>
            tx
              .select({ id: usuario.id, nome: usuario.name })
              .from(usuario)
              .where(inArray(usuario.id, pessoas)),
          )
        ).map((u) => [u.id, u.nome])
      : [],
  );
  const aberto = !ctx.fechado;
  const versoes: VersaoDoEbook[] = linhas.map((v) => ({
    id: v.id,
    material: v.material,
    numero: v.numero,
    situacao: v.situacao,
    identidade: v.identidade,
    incluiValuation: v.incluiValuation,
    observacoes: ctx.vendedor ? v.observacoes : null,
    criadoPor: nomeDe(v.criadoPor, nomes),
    criadoEm: v.criadoEm.toISOString(),
    aprovadoPor: nomeDe(v.aprovadoPor, nomes),
    aprovadoEm: v.aprovadoEm?.toISOString() ?? null,
    liberadoPor: nomeDe(v.liberadoPor, nomes),
    liberadoEm: v.liberadoEm?.toISOString() ?? null,
    // Comentários são da revisão interna (lado vendedor).
    comentarios: ctx.vendedor
      ? comentarios
          .filter((c) => c.versaoId === v.id)
          .map((c) => ({
            id: c.id,
            autor: nomeDe(c.autorId, nomes),
            texto: c.texto,
            criadoEm: c.criadoEm.toISOString(),
          }))
      : [],
    podeComentar: aberto && v.situacao === "em_revisao" && ctx.pode("comentar"),
    podeAprovar: aberto && v.situacao === "em_revisao" && ctx.pode("aprovar"),
    podeLiberar: aberto && v.situacao === "aprovada" && ctx.pode("liberar"),
    podeExcluir: aberto && v.situacao === "em_revisao" && ctx.pode("excluir"),
    documentoVersaoId: v.documentoVersaoId,
  }));
  return {
    vendedor: ctx.vendedor,
    podeCriar: aberto && ctx.pode("criar"),
    materiais: MATERIAIS.map((material) => ({
      material,
      versoes: versoes.filter((v) => v.material === material),
    })).filter((m) => ctx.vendedor || m.versoes.length > 0),
  };
}

// --- Fluxo -----------------------------------------------------------------------------------

const DadosVersao = z.object({
  material: z.enum(MATERIAIS as [MaterialDoEbook, ...MaterialDoEbook[]], {
    error: "ebook.erros.materialInvalido",
  }),
  identidade: z
    .enum(IDENTIDADES as [IdentidadeDoEbook, ...IdentidadeDoEbook[]], {
      error: "ebook.erros.identidadeInvalida",
    })
    .default("tenant"),
  incluiValuation: z.boolean().default(false),
  observacoes: z.string().trim().max(2000, "ebook.erros.observacoesLongas").default(""),
  /** Arquivo que o navegador vai enviar (PDF); sem ele, a versão recebe o PDF de exemplo. */
  arquivo: z
    .object({ nomeArquivo: z.string().trim().min(1).max(200), tamanho: z.number().int().positive() })
    .optional(),
});
export type DadosVersaoDoEbook = z.input<typeof DadosVersao>;

/** Documento do material no negócio (o primeiro da categoria), para a nova versão entrar nele. */
async function documentoDoMaterial(a: AcessoTenant, dealId: string, material: MaterialDoEbook) {
  return comTenant(a.tenant.id, async (tx) => {
    const [cat] = await tx
      .select({ id: categoriaDocumento.id })
      .from(categoriaDocumento)
      .where(eq(categoriaDocumento.padrao, material));
    const [doc] = cat
      ? await tx
          .select({ id: documento.id })
          .from(documento)
          .where(and(eq(documento.dealId, dealId), eq(documento.categoriaId, cat.id)))
          .orderBy(asc(documento.criadoEm))
          .limit(1)
      : [];
    return { categoriaId: cat?.id ?? null, documentoId: doc?.id ?? null };
  });
}

/**
 * Nova versão de um material (lado vendedor, "E-book × criar"): número
 * seguinte, em revisão, gravada como nova versão do documento do material no
 * data room (lista de acesso: o lado de quem cria). Com `arquivo`, devolve o
 * link para o navegador enviar o PDF (depois, `concluirVersaoDoEbook`); sem
 * ele, grava o PDF de exemplo e já conclui.
 */
export async function criarVersaoDoEbook(
  acesso: Acesso | null,
  dealId: string,
  dados: DadosVersaoDoEbook,
): Promise<{ id: string; numero: number; url?: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  if (!estaLigada("ebook")) return desligada;
  const ctx = await contexto(a, dealId);
  if (!ctx) return { erro: "ebook.erros.naoEncontrado" };
  if (ctx.fechado) return { erro: "ebook.erros.negocioFechado" };
  if (!ctx.pode("criar")) return { erro: "ebook.erros.semPermissao" };
  const p = DadosVersao.safeParse(dados);
  if (!p.success) return { erro: p.error.issues[0].message };
  const d = p.data;
  if (d.arquivo && !d.arquivo.nomeArquivo.toLowerCase().endsWith(".pdf"))
    return { erro: "ebook.erros.soPdf" };
  const [{ ultimo }] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ ultimo: max(ebookVersao.numero) })
      .from(ebookVersao)
      .where(and(eq(ebookVersao.dealId, dealId), eq(ebookVersao.material, d.material))),
  );
  const numero = (ultimo ?? 0) + 1;
  const tr = await tradutor();
  const { categoriaId, documentoId } = await documentoDoMaterial(a, dealId, d.material);
  const exemplo = d.arquivo ? null : await montarPdfDeExemplo(a, { ...d, numero, dealId });
  const dr = await dataRoomDoNegocio(a, dealId).catch(() => null);
  let envio;
  try {
    envio = await iniciarEnvio(a, dealId, {
      documentoId: documentoId ?? undefined,
      titulo: tr(`ebook.materiais.${d.material}`),
      categoriaId: categoriaId ?? undefined,
      nomeArquivo: d.arquivo?.nomeArquivo ?? exemplo!.nome,
      tamanho: d.arquivo?.tamanho ?? exemplo!.conteudo.length,
      comentario: [tr("ebook.versao", { numero }), d.observacoes].filter(Boolean).join(" · "),
      usuarios: dr?.meuLado ?? [],
    });
  } catch (e) {
    if (e instanceof AcessoNegado) return { erro: "ebook.erros.semPermissaoDocumentos" };
    throw e;
  }
  if ("erro" in envio) return envio;
  const criada = await comTenant(a.tenant.id, async (tx) => {
    const [v] = await tx
      .insert(ebookVersao)
      .values({
        tenantId: a.tenant.id,
        dealId,
        material: d.material,
        numero,
        identidade: d.identidade,
        incluiValuation: d.incluiValuation,
        observacoes: d.observacoes || null,
        criadoPor: a.usuario.id,
        documentoVersaoId: envio.versaoId,
      })
      .returning({ id: ebookVersao.id, numero: ebookVersao.numero });
    return v;
  });
  if (exemplo) {
    // Demonstração: o servidor grava o PDF de exemplo e conclui o envio (antivírus, texto para a busca).
    await gravarArquivo(
      chaveDoArquivo(a.tenant.id, "documentos", dealId, envio.versaoId),
      exemplo.conteudo,
      "application/pdf",
    );
    const r = await concluirEnvio(a, envio.versaoId);
    if ("erro" in r) {
      await comTenant(a.tenant.id, (tx) => tx.delete(ebookVersao).where(eq(ebookVersao.id, criada.id)));
      return r;
    }
  }
  await auditar(a, "ebook.versao_criada", "deal", dealId, { material: d.material, numero: criada.numero });
  return exemplo ? criada : { ...criada, url: envio.url };
}

/** Depois que o navegador enviou o arquivo: conclui a versão de documento (ou desfaz a versão do e-book). */
export async function concluirVersaoDoEbook(acesso: Acesso | null, versaoId: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  if (!uuidValido(versaoId)) return { erro: "ebook.erros.naoEncontrado" };
  const [v] = await comTenant(a.tenant.id, (tx) =>
    tx.select().from(ebookVersao).where(eq(ebookVersao.id, versaoId)),
  );
  if (!v || v.criadoPor !== a.usuario.id || !v.documentoVersaoId)
    return { erro: "ebook.erros.naoEncontrado" };
  const r = await concluirEnvio(a, v.documentoVersaoId);
  if ("erro" in r) {
    await comTenant(a.tenant.id, (tx) => tx.delete(ebookVersao).where(eq(ebookVersao.id, versaoId)));
    return r;
  }
  return { ok: true };
}

/** Carrega a versão e o contexto do negócio dela (null se a pessoa não a vê). */
async function versaoVisivel(a: AcessoTenant, versaoId: string) {
  if (!uuidValido(versaoId)) return null;
  const [v] = await comTenant(a.tenant.id, (tx) =>
    tx.select().from(ebookVersao).where(eq(ebookVersao.id, versaoId)),
  );
  if (!v) return null;
  const ctx = await contexto(a, v.dealId);
  if (!ctx || !ctx.ve(v)) return null;
  return { v, ctx };
}

async function exigirVersao(
  a: AcessoTenant,
  versaoId: string,
  acao: Acao,
  situacao: SituacaoDoEbook,
): Promise<{ v: typeof ebookVersao.$inferSelect; ctx: Ctx } | ErroDeServico> {
  if (!estaLigada("ebook")) return desligada;
  const r = await versaoVisivel(a, versaoId);
  if (!r) return { erro: "ebook.erros.naoEncontrado" };
  if (r.ctx.fechado) return { erro: "ebook.erros.negocioFechado" };
  if (!r.ctx.pode(acao)) return { erro: "ebook.erros.semPermissao" };
  if (r.v.situacao !== situacao) return { erro: "ebook.erros.situacaoNaoPermite" };
  return r;
}

/** Comentário da revisão (versão em revisão; "E-book × comentar"). */
export async function comentarVersaoDoEbook(
  acesso: Acesso | null,
  versaoId: string,
  texto: string,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const limpo = texto.trim();
  if (limpo.length < 2) return { erro: "ebook.erros.comentarioVazio" };
  if (limpo.length > 4000) return { erro: "ebook.erros.comentarioLongo" };
  const r = await exigirVersao(a, versaoId, "comentar", "em_revisao");
  if ("erro" in r) return r;
  await comTenant(a.tenant.id, (tx) =>
    tx
      .insert(ebookComentario)
      .values({ tenantId: a.tenant.id, versaoId, autorId: a.usuario.id, texto: limpo }),
  );
  await auditar(a, "ebook.comentado", "deal", r.v.dealId, { material: r.v.material, numero: r.v.numero });
  return { ok: true };
}

/** Aprovação da versão ("E-book × aprovar"; em geral a vendedora). */
export async function aprovarVersaoDoEbook(acesso: Acesso | null, versaoId: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const r = await exigirVersao(a, versaoId, "aprovar", "em_revisao");
  if ("erro" in r) return r;
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(ebookVersao)
      .set({ situacao: "aprovada", aprovadoPor: a.usuario.id, aprovadoEm: new Date() })
      .where(eq(ebookVersao.id, versaoId)),
  );
  await auditar(a, "ebook.aprovado", "deal", r.v.dealId, { material: r.v.material, numero: r.v.numero });
  return { ok: true };
}

/**
 * Libera a versão aprovada ao lado comprador ("E-book × liberar"): passa a
 * "disponível ao comprador" e avisa no sino quem do lado comprador passa a
 * vê-la. O e-mail com o link fica para a versão real (simulado).
 */
export async function liberarVersaoDoEbook(
  acesso: Acesso | null,
  versaoId: string,
): Promise<{ ok: true; avisados: number } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const r = await exigirVersao(a, versaoId, "liberar", "aprovada");
  if ("erro" in r) return r;
  const { v } = r;
  const empresas = await empresasDoNegocio(a, v.dealId);
  const tr = await tradutor();
  const avisados = await comTenant(a.tenant.id, async (tx) => {
    await tx
      .update(ebookVersao)
      .set({ situacao: "disponivel", liberadoPor: a.usuario.id, liberadoEm: new Date() })
      .where(eq(ebookVersao.id, versaoId));
    const [n] = await tx
      .select({ numero: deal.numero, codinome: deal.codinome })
      .from(deal)
      .where(eq(deal.id, v.dealId));
    const participantes = await tx
      .select({
        usuarioId: pessoa.usuarioId,
        empresaId: participacaoDeal.empresaId,
        lado: participacaoDeal.lado,
      })
      .from(participacaoDeal)
      .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
      .where(
        and(
          eq(participacaoDeal.dealId, v.dealId),
          sql`${participacaoDeal.perfilId} is not null`,
          sql`(${participacaoDeal.prazo} is null or ${participacaoDeal.prazo} >= current_date)`,
        ),
      );
    const completo = !v.material.endsWith("_teaser");
    const usuarios = new Set<string>();
    for (const p of participantes) {
      if (!p.usuarioId || ladoDaParticipacao(empresas, p) !== "comprador") continue;
      const compradora = compradoraDaEmpresa(empresas, p.empresaId);
      if (completo && !compradorPassouDoNda(empresas, new Set(compradora ? [compradora] : []))) continue;
      usuarios.add(p.usuarioId);
    }
    // A versão no data room passa a ser vista por essas pessoas do lado comprador.
    if (v.documentoVersaoId && usuarios.size) {
      const ja = new Set(
        (
          await tx
            .select({ usuarioId: versaoAcesso.usuarioId })
            .from(versaoAcesso)
            .where(eq(versaoAcesso.versaoId, v.documentoVersaoId))
        ).map((x) => x.usuarioId),
      );
      const novos = [...usuarios].filter((u) => !ja.has(u));
      if (novos.length)
        await tx
          .insert(versaoAcesso)
          .values(
            novos.map((usuarioId) => ({ tenantId: a.tenant.id, versaoId: v.documentoVersaoId!, usuarioId })),
          );
    }
    for (const u of usuarios)
      await notificar(
        tx,
        a.tenant.id,
        u,
        "ebook_liberado",
        {
          negocio: n ? nomeVisivel(n.numero, n.codinome) : "",
          material: tr(`ebook.materiais.${v.material}`),
        },
        `/negocios/${v.dealId}?aba=compradoras`,
      );
    return usuarios.size;
  });
  await auditar(a, "ebook.liberado", "deal", v.dealId, { material: v.material, numero: v.numero, avisados });
  return { ok: true, avisados };
}

/** Exclui uma versão ainda em revisão ("E-book × excluir"). */
export async function excluirVersaoDoEbook(acesso: Acesso | null, versaoId: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const r = await exigirVersao(a, versaoId, "excluir", "em_revisao");
  if ("erro" in r) return r;
  if (r.v.documentoVersaoId) await excluirVersao(a, r.v.documentoVersaoId).catch(() => null);
  await comTenant(a.tenant.id, (tx) => tx.delete(ebookVersao).where(eq(ebookVersao.id, versaoId)));
  await auditar(a, "ebook.excluido", "deal", r.v.dealId, { material: r.v.material, numero: r.v.numero });
  return { ok: true };
}

// --- PDF de exemplo --------------------------------------------------------------------------

/** Seções da estrutura aprovada (dominio.md); o teaser omite a estrutura societária. */
const SECOES = [
  "capa",
  "avisoLegal",
  "agenda",
  "sumario",
  "historico",
  "produtos",
  "mercado",
  "clientes",
  "operacao",
  "parcerias",
  "societaria",
  "plano",
  "financeiro",
  "tese",
  "transacao",
  "proximos",
] as const;

/**
 * PDF de exemplo da versão (simulado): estrutura do material com textos de
 * demonstração e, se marcado, a faixa do valuation de exemplo. Quem vê a
 * versão pode abri-lo; auditado.
 */
export async function pdfDaVersaoDoEbook(
  acesso: Acesso | null,
  versaoId: string,
): Promise<{ nome: string; conteudo: string } | { url: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  if (!estaLigada("ebook")) return desligada;
  const r = await versaoVisivel(a, versaoId);
  if (!r) return { erro: "ebook.erros.naoEncontrado" };
  // Lado vendedor precisa de "baixar"; o comprador abre o que foi liberado a ele.
  if (r.ctx.vendedor && !a.administrador && !(await pode(a, "ebook", "baixar", { dealId: r.v.dealId })))
    return { erro: "ebook.erros.semPermissao" };
  const { v } = r;
  // Versão no data room: link temporário do arquivo (download auditado pelo data room).
  if (v.documentoVersaoId) {
    try {
      const link = await linkDeDownload(a, v.documentoVersaoId);
      if ("url" in link)
        await auditar(a, "ebook.baixado", "deal", v.dealId, { material: v.material, numero: v.numero });
      return link;
    } catch (e) {
      if (e instanceof AcessoNegado) return { erro: "ebook.erros.semPermissaoDocumentos" };
      throw e;
    }
  }
  const pdf = await montarPdfDeExemplo(a, v);
  await auditar(a, "ebook.baixado", "deal", v.dealId, {
    material: v.material,
    numero: v.numero,
    simulada: true,
  });
  return { nome: pdf.nome, conteudo: Buffer.from(pdf.conteudo).toString("base64") };
}

/** PDF de exemplo (estrutura do material com textos de demonstração e, se marcado, a faixa do valuation). */
async function montarPdfDeExemplo(
  a: AcessoTenant,
  v: {
    dealId: string;
    material: MaterialDoEbook;
    numero: number;
    identidade: IdentidadeDoEbook;
    incluiValuation: boolean;
  },
): Promise<{ nome: string; conteudo: Uint8Array }> {
  const [n] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ codinome: deal.codinome }).from(deal).where(eq(deal.id, v.dealId)),
  );
  const tr = await tradutor();
  const t = (chave: string, p?: Record<string, string>) => tr(`ebook.pdf.${chave}`, p);
  const teaser = v.material.endsWith("_teaser");
  const onepager = v.material.startsWith("onepager");
  const cabecalho = [
    t("demonstracao"),
    "",
    tr(`ebook.materiais.${v.material}`).toUpperCase(),
    t("projeto", { codinome: n?.codinome ?? "" }),
    t("versao", { numero: String(v.numero), identidade: tr(`ebook.identidades.${v.identidade}`) }),
    "",
  ];
  // Números do valuation de demonstração (item 18), só se quem montou marcou a opção.
  const mi = (x: number) => `R$ ${(x / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  const valuation = v.incluiValuation
    ? [
        t("valuation", {
          minimo: mi(VALUATION_DE_EXEMPLO.faixa.minimo),
          maximo: mi(VALUATION_DE_EXEMPLO.faixa.maximo),
          ponderado: mi(resultadoDoValuation(VALUATION_DE_EXEMPLO).ponderado),
        }),
      ]
    : [];
  const secoes = onepager
    ? (["sumario", "tese", "proximos"] as const)
    : SECOES.filter((s) => !(teaser && s === "societaria"));
  const corpo = secoes.flatMap((s) => [
    tr(`ebook.secoes.${s}`),
    `   ${tr(teaser && tr.has(`ebook.pdf.teaser.${s}`) ? `ebook.pdf.teaser.${s}` : "ebook.pdf.exemplo")}`,
    ...(s === "financeiro" ? valuation.map((l) => `   ${l}`) : []),
    "",
  ]);
  const linhas = [...cabecalho, ...corpo];
  const paginas: string[][] = [];
  for (let i = 0; i < linhas.length; i += 48) paginas.push(linhas.slice(i, i + 48));
  const nome = `${v.material.replace("_", "-")}-v${v.numero}-${(n?.codinome ?? "projeto").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-demonstracao.pdf`;
  return { nome, conteudo: pdfDeTexto(paginas) };
}
