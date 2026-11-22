import { cache } from "react";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import type { ErroDeServico } from "@/i18n/servidor";
import { comTenant } from "@/server/db/cliente";
import {
  categoriaDocumento,
  documento,
  documentoVersao,
  eventoAuditoria,
  participacaoDeal,
  perfil,
  pessoa,
  usuario,
  versaoAcesso,
} from "@/server/db/esquema";
import {
  apagarArquivo,
  chaveDoArquivo,
  gerarLinkDeDownload,
  gerarLinkDeEnvio,
  lerArquivo,
} from "@/server/arquivos/armazenamento";
import { AcessoNegado, exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import { tipoRealDoArquivo, verificarArquivo } from "./antivirus";
import { auditar } from "./empresas";
import { guardarTextoDaVersao } from "./texto-de-documento";
import { contextoDeEtapas } from "./etapas";
import { ordenarEtapas } from "./tarefas";
import { compradoraDaEmpresa, empresasDoNegocio, ladoDaParticipacao, negocioFechado } from "./negocios";
import { notificar } from "./notificacoes";
import { concede, type Acao } from "./permissoes/catalogo";
import { exigirPermissao, pode } from "./permissoes/verificador";

/**
 * Data room do negócio (item 11; dominio.md, "Documentos"; respostas D1–D8).
 *
 * - Documento com versões; ligado a uma etapa ou subetapa, ou "geral".
 * - Permissões pela matriz "Documentos" na etapa (alcance das participações).
 * - Lista de acesso por versão, definida por quem envia (perfis e/ou
 *   usuários; pré-preenchida com o próprio lado, ou com a da versão anterior).
 *   Quem enviou e os administradores sempre veem. A lista só restringe.
 * - O arquivo vai do navegador direto ao armazenamento (link temporário) e
 *   só fica disponível depois da verificação de tipo e antivírus (ADR-0016).
 * - Até 200 MB por arquivo (D5). Excluir: quem enviou ou o Coordenador, em
 *   até 24 h e se ninguém mais baixou (D8).
 */

type Resultado = { ok: true } | ErroDeServico;
export const TAMANHO_MAXIMO_DOCUMENTO = 200 * 1024 * 1024;
const PRAZO_EXCLUSAO_MS = 24 * 60 * 60 * 1000;
const EXTENSOES = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "webp",
];
const uuidValido = (id: string) => z.uuid().safeParse(id).success;

/** Tipo real do arquivo do data room (assinatura do conteúdo, nunca só a extensão). */
export function tipoDoDocumento(conteudo: Uint8Array, nome: string): string | null {
  const n = nome.toLowerCase();
  const b = Buffer.from(conteudo.subarray(0, 8));
  if (n.endsWith(".pptx") && b[0] === 0x50 && b[1] === 0x4b)
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  // Formatos antigos do Office (doc, xls, ppt): contêiner OLE.
  if (b.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) {
    if (n.endsWith(".doc")) return "application/msword";
    if (n.endsWith(".xls")) return "application/vnd.ms-excel";
    if (n.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  }
  const conhecido = tipoRealDoArquivo(conteudo, nome);
  if (conhecido) return conhecido;
  // CSV e TXT: texto sem bytes nulos no início.
  if ((n.endsWith(".csv") || n.endsWith(".txt")) && !conteudo.subarray(0, 4096).includes(0))
    return n.endsWith(".csv") ? "text/csv" : "text/plain";
  return null;
}

// --- Categorias (cadastro auxiliar) -----------------------------------------------------------

export const CATEGORIAS_PADRAO = [
  ["societario", "Societário"],
  ["contabil", "Contábil e financeiro"],
  ["fiscal", "Fiscal"],
  ["trabalhista", "Trabalhista"],
  ["contratos", "Contratos comerciais"],
  ["imobiliario", "Imobiliário"],
  ["ambiental", "Ambiental"],
  ["pi", "Propriedade intelectual"],
  ["tecnologia", "Tecnologia"],
  ["contencioso", "Contencioso"],
  ["outros", "Outros"],
] as const;

export type Categoria = { id: string; nome: string; emUso: number };

export async function listarCategorias(acesso: Acesso | null): Promise<Categoria[]> {
  const recurso = (await pode(acesso, "cadastros", "ver")) ? "cadastros" : "deals";
  const a = await exigirPermissao(acesso, recurso, "ver");
  return comTenant(a.tenant.id, async (tx) => {
    const cats = await tx
      .select({ id: categoriaDocumento.id, nome: categoriaDocumento.nome })
      .from(categoriaDocumento)
      .orderBy(asc(categoriaDocumento.nome));
    const uso = await tx
      .select({ id: documento.categoriaId, n: sql<number>`count(*)::int` })
      .from(documento)
      .groupBy(documento.categoriaId);
    const n = new Map(uso.map((u) => [u.id, u.n]));
    return cats.map((c) => ({ ...c, emUso: n.get(c.id) ?? 0 }));
  });
}

export async function salvarCategoria(
  acesso: Acesso | null,
  dados: { id?: string; nome: string },
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "cadastros", dados.id ? "editar" : "criar");
  const nome = dados.nome.trim();
  if (nome.length < 2 || nome.length > 120) return { erro: "documentos.erros.nomeCategoria" };
  const r = await comTenant(a.tenant.id, (tx) =>
    dados.id && uuidValido(dados.id)
      ? tx
          .update(categoriaDocumento)
          .set({ nome })
          .where(eq(categoriaDocumento.id, dados.id))
          .returning({ id: categoriaDocumento.id })
      : tx
          .insert(categoriaDocumento)
          .values({ tenantId: a.tenant.id, nome })
          .returning({ id: categoriaDocumento.id }),
  ).catch(() => "duplicada" as const);
  if (r === "duplicada") return { erro: "documentos.erros.categoriaJaExiste" };
  if (!r[0]) return { erro: "documentos.erros.categoriaNaoEncontrada" };
  await auditar(
    a,
    dados.id ? "categoria_documento.editada" : "categoria_documento.criada",
    "tenant",
    a.tenant.id,
    { nome },
  );
  return { ok: true };
}

/** Categoria em uso não é excluída (os documentos ficariam sem categoria). */
export async function excluirCategoria(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "cadastros", "excluir");
  if (!uuidValido(id)) return { erro: "documentos.erros.categoriaNaoEncontrada" };
  const r = await comTenant(a.tenant.id, async (tx) => {
    const [uso] = await tx
      .select({ id: documento.id })
      .from(documento)
      .where(eq(documento.categoriaId, id))
      .limit(1);
    if (uso) return "emUso" as const;
    return tx
      .delete(categoriaDocumento)
      .where(eq(categoriaDocumento.id, id))
      .returning({ id: categoriaDocumento.id });
  });
  if (r === "emUso") return { erro: "documentos.erros.categoriaEmUso" };
  if (!r[0]) return { erro: "documentos.erros.categoriaNaoEncontrada" };
  await auditar(a, "categoria_documento.excluida", "tenant", a.tenant.id);
  return { ok: true };
}

/** Nega com AcessoNegado e registra a negação na auditoria (ADR-0013). */
async function negar(a: AcessoTenant, acao: Acao, dealId: string): Promise<never> {
  await comTenant(a.tenant.id, (tx) =>
    tx.insert(eventoAuditoria).values({
      tenantId: a.tenant.id,
      tipo: "acesso.negado",
      atorId: a.usuario.id,
      alvoTipo: "recurso",
      detalhes: { recurso: "documentos", acao, dealId },
    }),
  );
  throw new AcessoNegado();
}

// --- Contexto da pessoa no data room de um negócio ---------------------------------------

async function contextoDoDataRoom(a: AcessoTenant, dealId: string) {
  const ctx = await contextoDeEtapas(a, dealId);
  const minhas = a.administrador
    ? []
    : await comTenant(a.tenant.id, (tx) =>
        tx
          .select({
            perfilId: participacaoDeal.perfilId,
            alcance: participacaoDeal.alcance,
            etapaIds: participacaoDeal.etapaIds,
          })
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
      );
  const paiDe = new Map(ctx.etapas.map((e) => [e.id, e.paiId]));
  /** Perfis da pessoa que alcançam a etapa (para a lista de acesso por perfil). */
  const perfisNa = (etapaId: string | null) =>
    new Set(
      minhas
        .filter(
          (p) =>
            p.alcance === "deal" ||
            (etapaId !== null &&
              (p.etapaIds.includes(etapaId) || p.etapaIds.includes(paiDe.get(etapaId) ?? ""))),
        )
        .map((p) => p.perfilId!),
    );
  const pode = (etapaId: string | null, acao: Acao) => concede(ctx.matrizNa(etapaId), "documentos", acao);
  // Grupo de cada participante: "vendedor" ou a compradora (ela e quem trabalha para ela).
  const [todos, empresas] = await Promise.all([
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({
          usuarioId: pessoa.usuarioId,
          empresaId: participacaoDeal.empresaId,
          lado: participacaoDeal.lado,
        })
        .from(participacaoDeal)
        .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
        .where(and(eq(participacaoDeal.dealId, dealId), sql`${pessoa.usuarioId} is not null`)),
    ),
    empresasDoNegocio(a, dealId),
  ]);
  const gruposDe = new Map<string, Set<string>>();
  for (const p of todos) {
    const lado = ladoDaParticipacao(empresas, p);
    const grupo =
      lado === "vendedor"
        ? "vendedor"
        : lado === "comprador"
          ? `c:${compradoraDaEmpresa(empresas, p.empresaId) ?? "-"}`
          : null;
    if (!grupo) continue;
    gruposDe.set(p.usuarioId!, (gruposDe.get(p.usuarioId!) ?? new Set()).add(grupo));
  }
  const meusGrupos = gruposDe.get(a.usuario.id) ?? new Set<string>();
  /** Mesmo grupo de quem enviou (acesso por perfil não atravessa lados nem compradoras). */
  const mesmoGrupo = (usuarioId: string | null) => {
    const deles = usuarioId ? gruposDe.get(usuarioId) : undefined;
    if (!deles || deles.size === 0) return true; // quem enviou saiu do negócio: vale o perfil
    return [...deles].some((g) => meusGrupos.has(g));
  };
  return { ...ctx, perfisNa, podeDoc: pode, gruposDe, meusGrupos, mesmoGrupo };
}

function versaoVisivel(
  a: AcessoTenant,
  v: { enviadoPor: string | null; todos: boolean },
  acessos: { perfilId: string | null; usuarioId: string | null }[],
  perfis: Set<string>,
  mesmoGrupo: (usuarioId: string | null) => boolean,
) {
  // "Todos os participantes": quem chega aqui já participa e pode ver documentos na etapa.
  if (a.administrador || v.enviadoPor === a.usuario.id || v.todos) return true;
  if (acessos.some((x) => x.usuarioId === a.usuario.id)) return true;
  // Por perfil: só no grupo de quem enviou (o "Advogado" da vendedora não abre para o da compradora).
  return mesmoGrupo(v.enviadoPor) && acessos.some((x) => x.perfilId !== null && perfis.has(x.perfilId));
}

// --- Consulta --------------------------------------------------------------------------------

export type VersaoNaTela = {
  id: string;
  numero: number;
  nomeArquivo: string;
  tamanho: number;
  situacao: "enviando" | "disponivel" | "bloqueado";
  enviadoPor: string | null;
  criadoEm: Date;
  comentario: string | null;
  /** Tipo real do arquivo (para saber se tem prévia). */
  tipo: string | null;
  acesso: string[];
  /** Lista atual (para "Alterar quem vê"). */
  acessoIds: { todos: boolean; perfis: string[]; usuarios: string[] };
  podeAlterarAcesso: boolean;
  podeBaixar: boolean;
  podeExcluir: boolean;
};

export type DocumentoNaTela = {
  id: string;
  titulo: string;
  categoria: string | null;
  etapaId: string | null;
  etapa: string | null;
  versoes: VersaoNaTela[];
  podeNovaVersao: boolean;
};

export type DataRoom = {
  documentos: DocumentoNaTela[];
  /** Etapas e subetapas em que a pessoa pode enviar (null = geral). */
  destinos: { id: string | null; nome: string }[];
  categorias: { id: string; nome: string }[];
  /** Todas as etapas do negócio (para o filtro). */
  etapas: { id: string; nome: string }[];
  opcoesDeAcesso: {
    perfis: { id: string; nome: string }[];
    usuarios: { id: string; nome: string; lado: string | null }[];
  };
  /** Usuários do mesmo lado de quem envia (pré-seleção da lista de acesso). */
  meuLado: string[];
  fechado: boolean;
};

/** Documentos do negócio que a pessoa vê (só as versões liberadas a ela). */
async function dataRoomDoNegocioSemCache(acesso: Acesso | null, dealId: string): Promise<DataRoom | null> {
  const a = exigirTenant(acesso);
  if (!uuidValido(dealId)) return null;
  const ctx = await contextoDoDataRoom(a, dealId);
  const nomeEtapa = new Map(
    ctx.etapas.map((e) => [
      e.id,
      e.paiId ? `${ctx.etapas.find((p) => p.id === e.paiId)?.nome ?? ""} › ${e.nome}` : e.nome,
    ]),
  );
  const fechado = Boolean(await negocioFechado(a, dealId));
  const [docs, versoes, acessos, categorias, participantes, empresas] = await Promise.all([
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({
          id: documento.id,
          titulo: documento.titulo,
          etapaId: documento.etapaId,
          categoria: categoriaDocumento.nome,
        })
        .from(documento)
        .leftJoin(categoriaDocumento, eq(categoriaDocumento.id, documento.categoriaId))
        .where(eq(documento.dealId, dealId))
        .orderBy(asc(documento.titulo)),
    ),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ v: documentoVersao, autor: usuario.name })
        .from(documentoVersao)
        .innerJoin(documento, eq(documento.id, documentoVersao.documentoId))
        .leftJoin(usuario, eq(usuario.id, documentoVersao.enviadoPor))
        .where(eq(documento.dealId, dealId))
        .orderBy(desc(documentoVersao.numero)),
    ),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({
          versaoId: versaoAcesso.versaoId,
          perfilId: versaoAcesso.perfilId,
          usuarioId: versaoAcesso.usuarioId,
          perfil: perfil.nome,
          usuario: usuario.name,
        })
        .from(versaoAcesso)
        .innerJoin(documentoVersao, eq(documentoVersao.id, versaoAcesso.versaoId))
        .innerJoin(documento, eq(documento.id, documentoVersao.documentoId))
        .leftJoin(perfil, eq(perfil.id, versaoAcesso.perfilId))
        .leftJoin(usuario, eq(usuario.id, versaoAcesso.usuarioId))
        .where(eq(documento.dealId, dealId)),
    ),
    comTenant(a.tenant.id, (tx) =>
      tx
        .select({ id: categoriaDocumento.id, nome: categoriaDocumento.nome })
        .from(categoriaDocumento)
        .orderBy(asc(categoriaDocumento.nome)),
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
  ]);
  const acessosPor = Map.groupBy(acessos, (x) => x.versaoId);
  const versoesPor = Map.groupBy(versoes, (x) => x.v.documentoId);
  const documentos: DocumentoNaTela[] = [];
  for (const d of docs) {
    const perfis = ctx.perfisNa(d.etapaId);
    if (!ctx.podeDoc(d.etapaId, "ver")) continue;
    const visiveis = (versoesPor.get(d.id) ?? []).filter(
      ({ v }) =>
        versaoVisivel(a, v, acessosPor.get(v.id) ?? [], perfis, ctx.mesmoGrupo) &&
        (v.situacao === "disponivel" || v.enviadoPor === a.usuario.id || a.administrador),
    );
    if (visiveis.length === 0) continue;
    documentos.push({
      id: d.id,
      titulo: d.titulo,
      categoria: d.categoria,
      etapaId: d.etapaId,
      etapa: d.etapaId ? (nomeEtapa.get(d.etapaId) ?? null) : null,
      podeNovaVersao: !fechado && ctx.podeDoc(d.etapaId, "criar"),
      versoes: visiveis.map(({ v, autor }) => ({
        id: v.id,
        numero: v.numero,
        nomeArquivo: v.nomeArquivo,
        tamanho: v.tamanho,
        tipo: v.tipoDeConteudo,
        situacao: v.situacao,
        enviadoPor: autor,
        criadoEm: v.criadoEm,
        comentario: v.comentario,
        acesso: v.todos ? [TODOS] : (acessosPor.get(v.id) ?? []).map((x) => x.perfil ?? x.usuario ?? "—"),
        acessoIds: {
          todos: v.todos,
          perfis: (acessosPor.get(v.id) ?? []).flatMap((x) => (x.perfilId ? [x.perfilId] : [])),
          usuarios: (acessosPor.get(v.id) ?? []).flatMap((x) => (x.usuarioId ? [x.usuarioId] : [])),
        },
        podeAlterarAcesso: !fechado && (v.enviadoPor === a.usuario.id || a.administrador),
        podeBaixar: v.situacao === "disponivel" && ctx.podeDoc(d.etapaId, "baixar"),
        podeExcluir:
          !fechado &&
          !v.baixadaPorOutros &&
          Date.now() - v.criadoEm.getTime() < PRAZO_EXCLUSAO_MS &&
          (v.enviadoPor === a.usuario.id || a.administrador || concede(ctx.matrizNa(null), "deal", "editar")),
      })),
    });
  }
  const destinos = [
    ...(ctx.podeDoc(null, "criar") ? [{ id: null, nome: "" }] : []),
    ...ctx.etapas
      .slice()
      .sort((x, y) => (x.paiId ?? x.id).localeCompare(y.paiId ?? y.id) || x.ordem - y.ordem)
      .filter((e) => ctx.podeDoc(e.id, "criar"))
      .map((e) => ({ id: e.id as string | null, nome: nomeEtapa.get(e.id) ?? e.nome })),
  ];
  // Ordem das etapas como no negócio (etapa, depois as subetapas).
  const ordemDe = new Map(ctx.etapas.filter((e) => !e.paiId).map((e) => [e.id, e.ordem]));
  destinos.sort((x, y) => {
    if (x.id === null) return -1;
    if (y.id === null) return 1;
    const ex = ctx.etapas.find((e) => e.id === x.id)!;
    const ey = ctx.etapas.find((e) => e.id === y.id)!;
    const ox = ordemDe.get(ex.paiId ?? ex.id)! * 1000 + (ex.paiId ? ex.ordem : 0);
    const oy = ordemDe.get(ey.paiId ?? ey.id)! * 1000 + (ey.paiId ? ey.ordem : 0);
    return ox - oy;
  });
  const vendedor = a.administrador || ctx.meusGrupos.has("vendedor");
  const podeVerVendedora =
    vendedor ||
    empresas.some(
      (e) =>
        e.compradora &&
        ctx.meusGrupos.has(`c:${e.empresaId}`) &&
        e.situacaoFunil !== null &&
        ["nda", "proposta", "escolhida"].includes(e.situacaoFunil),
    );
  const pessoaVisivel = (usuarioId: string) => {
    if (vendedor) return true;
    const deles = ctx.gruposDe.get(usuarioId) ?? new Set<string>();
    if (deles.has("vendedor")) return podeVerVendedora;
    return [...deles].some((g) => ctx.meusGrupos.has(g));
  };
  const usuarios = [
    ...new Map(
      participantes
        .filter((p) => pessoaVisivel(p.usuarioId!))
        .map((p) => [
          p.usuarioId!,
          { id: p.usuarioId!, nome: p.nome, lado: ladoDaParticipacao(empresas, p) },
        ]),
    ).values(),
  ].sort((x, y) => x.nome.localeCompare(y.nome));
  return {
    documentos,
    destinos,
    categorias,
    etapas: ordenarEtapas(ctx.etapas).map((e) => ({ id: e.id, nome: nomeEtapa.get(e.id) ?? e.nome })),
    opcoesDeAcesso: {
      perfis: [
        ...new Map(participantes.map((p) => [p.perfilId!, { id: p.perfilId!, nome: p.perfil }])).values(),
      ].sort((x, y) => x.nome.localeCompare(y.nome)),
      usuarios,
    },
    meuLado: usuarios
      .filter(
        (u) =>
          u.id !== a.usuario.id && [...(ctx.gruposDe.get(u.id) ?? [])].some((g) => ctx.meusGrupos.has(g)),
      )
      .map((u) => u.id),
    fechado,
  };
}

// --- Envio -----------------------------------------------------------------------------------

const DadosEnvio = z.object({
  documentoId: z.string().optional(),
  titulo: z.string().trim().max(200).optional(),
  etapaId: z.string().nullable().optional(),
  categoriaId: z.string().optional(),
  nomeArquivo: z.string().trim().min(1).max(200),
  tamanho: z.number().int().positive(),
  comentario: z.string().trim().max(2000).optional(),
  perfis: z.array(z.string()).default([]),
  usuarios: z.array(z.string()).default([]),
  todos: z.boolean().default(false),
});

/**
 * Prepara o envio de um documento novo ou de uma nova versão: confere a
 * permissão na etapa, registra a versão "enviando" com a lista de acesso e
 * devolve o link temporário para o navegador enviar o arquivo.
 */
export async function iniciarEnvio(
  acesso: Acesso | null,
  dealId: string,
  dados: z.input<typeof DadosEnvio>,
): Promise<{ versaoId: string; url: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  if (!uuidValido(dealId)) return { erro: "documentos.erros.naoEncontrado" };
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const r = DadosEnvio.safeParse(dados);
  if (!r.success) return { erro: "documentos.erros.dadosInvalidos" };
  const d = r.data;
  if (d.tamanho > TAMANHO_MAXIMO_DOCUMENTO) return { erro: "documentos.erros.grande" };
  const ext = d.nomeArquivo.toLowerCase().split(".").pop() ?? "";
  if (!EXTENSOES.includes(ext)) return { erro: "documentos.erros.formato" };
  const ctx = await contextoDoDataRoom(a, dealId);
  let documentoId = d.documentoId && uuidValido(d.documentoId) ? d.documentoId : null;
  let etapaId: string | null = null;
  if (documentoId) {
    const [doc] = await comTenant(a.tenant.id, (tx) =>
      tx
        .select()
        .from(documento)
        .where(and(eq(documento.id, documentoId!), eq(documento.dealId, dealId))),
    );
    if (!doc) return { erro: "documentos.erros.naoEncontrado" };
    etapaId = doc.etapaId;
  } else {
    if (!d.titulo || d.titulo.length < 2)
      return { erro: "documentos.erros.tituloObrigatorio", campo: "titulo" };
    etapaId = d.etapaId && uuidValido(d.etapaId) ? d.etapaId : null;
    if (etapaId && !ctx.etapas.some((e) => e.id === etapaId))
      return { erro: "documentos.erros.etapaInvalida" };
  }
  if (!ctx.podeDoc(etapaId, "criar")) {
    await negar(a, "criar", dealId);
  }
  // A lista só restringe: perfis e usuários que participam do negócio.
  const validos = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ perfilId: participacaoDeal.perfilId, usuarioId: pessoa.usuarioId })
      .from(participacaoDeal)
      .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
      .where(eq(participacaoDeal.dealId, dealId)),
  );
  const perfis = [...new Set(d.perfis)].filter((p) => validos.some((v) => v.perfilId === p));
  const usuarios = [...new Set(d.usuarios)].filter((u) => validos.some((v) => v.usuarioId === u));
  const versaoId = randomUUID();
  const chave = chaveDoArquivo(a.tenant.id, "documentos", dealId, versaoId);
  await comTenant(a.tenant.id, async (tx) => {
    if (!documentoId) {
      const [novo] = await tx
        .insert(documento)
        .values({
          tenantId: a.tenant.id,
          dealId,
          etapaId,
          categoriaId: d.categoriaId && uuidValido(d.categoriaId) ? d.categoriaId : null,
          titulo: d.titulo!,
          criadoPor: a.usuario.id,
        })
        .returning({ id: documento.id });
      documentoId = novo.id;
    }
    const [{ ultimo }] = await tx
      .select({ ultimo: max(documentoVersao.numero) })
      .from(documentoVersao)
      .where(eq(documentoVersao.documentoId, documentoId));
    await tx.insert(documentoVersao).values({
      id: versaoId,
      tenantId: a.tenant.id,
      documentoId,
      numero: (ultimo ?? 0) + 1,
      nomeArquivo: d.nomeArquivo,
      tamanho: d.tamanho,
      chave,
      comentario: d.comentario || null,
      todos: d.todos,
      enviadoPor: a.usuario.id,
    });
    const linhas = [
      ...perfis.map((perfilId) => ({ tenantId: a.tenant.id, versaoId, perfilId })),
      ...usuarios.map((usuarioId) => ({ tenantId: a.tenant.id, versaoId, usuarioId })),
    ];
    if (linhas.length) await tx.insert(versaoAcesso).values(linhas);
  });
  return { versaoId, url: await gerarLinkDeEnvio(chave, "application/octet-stream", 30 * 60) };
}

/** Depois do envio: confere o tamanho, o tipo real e o antivírus; libera ou bloqueia a versão. */
export async function concluirEnvio(acesso: Acesso | null, versaoId: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  if (!uuidValido(versaoId)) return { erro: "documentos.erros.naoEncontrado" };
  const [linha] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ v: documentoVersao, dealId: documento.dealId, titulo: documento.titulo })
      .from(documentoVersao)
      .innerJoin(documento, eq(documento.id, documentoVersao.documentoId))
      .where(eq(documentoVersao.id, versaoId)),
  );
  if (!linha || linha.v.enviadoPor !== a.usuario.id || linha.v.situacao !== "enviando")
    return { erro: "documentos.erros.naoEncontrado" };
  const conteudo = await lerArquivo(linha.v.chave);
  const recusar = async (erro: string, situacao: "bloqueado" | null) => {
    await apagarArquivo(linha.v.chave).catch(() => null);
    await comTenant(a.tenant.id, async (tx) => {
      if (situacao)
        await tx.update(documentoVersao).set({ situacao }).where(eq(documentoVersao.id, versaoId));
      else await removerVersaoEDocumentoVazio(tx, versaoId, linha.v.documentoId);
    });
    return { erro };
  };
  if (!conteudo || conteudo.length !== linha.v.tamanho)
    return recusar("documentos.erros.envioIncompleto", null);
  const tipo = tipoDoDocumento(conteudo, linha.v.nomeArquivo);
  if (!tipo) return recusar("documentos.erros.formato", null);
  if ((await verificarArquivo(conteudo)) === "bloqueado") {
    await auditar(a, "documento.bloqueado", "deal", linha.dealId, { versaoId });
    const admins = await comTenant(a.tenant.id, (tx) =>
      tx.execute<{ usuario_id: string }>(
        sql`select usuario_id from vinculo_tenant where tenant_id = ${a.tenant.id} and administrador and situacao = 'ativo'`,
      ),
    ).catch(() => ({ rows: [] as { usuario_id: string }[] }));
    await comTenant(a.tenant.id, async (tx) => {
      for (const ad of admins.rows) await notificar(tx, a.tenant.id, ad.usuario_id, "arquivo_bloqueado");
    });
    return recusar("documentos.erros.bloqueado", "bloqueado");
  }
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(documentoVersao)
      .set({ situacao: "disponivel", tipoDeConteudo: tipo })
      .where(eq(documentoVersao.id, versaoId)),
  );
  // Texto para a busca por conteúdo (ADR-0022), depois do antivírus.
  await guardarTextoDaVersao(a.tenant.id, versaoId, conteudo, tipo);
  await auditar(a, "documento.enviado", "deal", linha.dealId, {
    documentoId: linha.v.documentoId,
    versao: linha.v.numero,
    titulo: linha.titulo,
  });
  return { ok: true };
}

type Tx = Parameters<Parameters<typeof comTenant>[1]>[0];
async function removerVersaoEDocumentoVazio(tx: Tx, versaoId: string, documentoId: string) {
  await tx.delete(documentoVersao).where(eq(documentoVersao.id, versaoId));
  const [resta] = await tx
    .select({ id: documentoVersao.id })
    .from(documentoVersao)
    .where(eq(documentoVersao.documentoId, documentoId))
    .limit(1);
  if (!resta) await tx.delete(documento).where(eq(documento.id, documentoId));
}

/** Versão que a pessoa pode ver (com o documento e a etapa), ou null. */
async function versaoAcessivel(a: AcessoTenant, versaoId: string) {
  if (!uuidValido(versaoId)) return null;
  const [linha] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        v: documentoVersao,
        dealId: documento.dealId,
        etapaId: documento.etapaId,
        titulo: documento.titulo,
      })
      .from(documentoVersao)
      .innerJoin(documento, eq(documento.id, documentoVersao.documentoId))
      .where(eq(documentoVersao.id, versaoId)),
  );
  if (!linha) return null;
  const ctx = await contextoDoDataRoom(a, linha.dealId);
  const acessos = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ perfilId: versaoAcesso.perfilId, usuarioId: versaoAcesso.usuarioId })
      .from(versaoAcesso)
      .where(eq(versaoAcesso.versaoId, versaoId)),
  );
  if (
    !ctx.podeDoc(linha.etapaId, "ver") ||
    !versaoVisivel(a, linha.v, acessos, ctx.perfisNa(linha.etapaId), ctx.mesmoGrupo)
  )
    return null;
  return { ...linha, ctx };
}

/** Link temporário de download (só versão disponível e com "Documentos × baixar"); auditado. */
export async function linkDeDownload(
  acesso: Acesso | null,
  versaoId: string,
): Promise<{ url: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const x = await versaoAcessivel(a, versaoId);
  if (!x || x.v.situacao !== "disponivel") return { erro: "documentos.erros.naoEncontrado" };
  if (!x.ctx.podeDoc(x.etapaId, "baixar")) await negar(a, "baixar", x.dealId);
  if (x.v.enviadoPor !== a.usuario.id && !x.v.baixadaPorOutros)
    await comTenant(a.tenant.id, (tx) =>
      tx.update(documentoVersao).set({ baixadaPorOutros: true }).where(eq(documentoVersao.id, versaoId)),
    );
  await auditar(a, "documento.baixado", "deal", x.dealId, {
    documentoId: x.v.documentoId,
    versao: x.v.numero,
  });
  return { url: await gerarLinkDeDownload(x.v.chave, x.v.nomeArquivo) };
}

/** Tamanho máximo para visualizar na tela (acima disso, só baixando). */
export const TAMANHO_MAXIMO_PREVIA = 50 * 1024 * 1024;

/**
 * Conteúdo de uma versão para a prévia na tela (PDF e imagens): mesma
 * permissão de baixar, com o seu evento de auditoria.
 */
export async function conteudoParaVisualizar(
  acesso: Acesso | null,
  versaoId: string,
): Promise<{ conteudo: Uint8Array; tipo: string; nome: string } | null> {
  const a = exigirTenant(acesso);
  const x = await versaoAcessivel(a, versaoId);
  if (!x || x.v.situacao !== "disponivel" || !x.v.tipoDeConteudo) return null;
  if (!(x.v.tipoDeConteudo === "application/pdf" || x.v.tipoDeConteudo.startsWith("image/"))) return null;
  if (x.v.tamanho > TAMANHO_MAXIMO_PREVIA) return null;
  if (!x.ctx.podeDoc(x.etapaId, "baixar")) await negar(a, "baixar", x.dealId);
  const conteudo = await lerArquivo(x.v.chave);
  if (!conteudo) return null;
  await auditar(a, "documento.visualizado", "deal", x.dealId, {
    documentoId: x.v.documentoId,
    versao: x.v.numero,
  });
  return { conteudo, tipo: x.v.tipoDeConteudo, nome: x.v.nomeArquivo };
}

/** Exclui uma versão (D8): quem enviou ou o Coordenador, em até 24 h e se ninguém mais baixou. */
export async function excluirVersao(acesso: Acesso | null, versaoId: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const x = await versaoAcessivel(a, versaoId);
  if (!x) return { erro: "documentos.erros.naoEncontrado" };
  const fechado = await negocioFechado(a, x.dealId);
  if (fechado) return fechado;
  const podeQuem =
    x.v.enviadoPor === a.usuario.id || a.administrador || concede(x.ctx.matrizNa(null), "deal", "editar");
  if (!podeQuem) await negar(a, "excluir", x.dealId);
  if (x.v.baixadaPorOutros || Date.now() - x.v.criadoEm.getTime() >= PRAZO_EXCLUSAO_MS)
    return { erro: "documentos.erros.naoExcluivel" };
  await apagarArquivo(x.v.chave).catch(() => null);
  await comTenant(a.tenant.id, (tx) => removerVersaoEDocumentoVazio(tx, versaoId, x.v.documentoId));
  await auditar(a, "documento.versao_excluida", "deal", x.dealId, {
    documentoId: x.v.documentoId,
    versao: x.v.numero,
    titulo: x.titulo,
  });
  return { ok: true };
}

/** Marcador que a tela traduz como "Todos os participantes". */
const TODOS = "__todos__";

/**
 * Altera quem vê uma versão já enviada (quem a enviou ou os administradores),
 * por exemplo para liberá-la ao outro lado. A lista só restringe a quem
 * participa do negócio; a mudança fica na auditoria.
 */
export async function alterarAcessoDaVersao(
  acesso: Acesso | null,
  versaoId: string,
  dados: { todos: boolean; perfis: string[]; usuarios: string[] },
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const x = await versaoAcessivel(a, versaoId);
  if (!x) return { erro: "documentos.erros.naoEncontrado" };
  const fechado = await negocioFechado(a, x.dealId);
  if (fechado) return fechado;
  if (x.v.enviadoPor !== a.usuario.id && !a.administrador) await negar(a, "editar", x.dealId);
  const validos = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ perfilId: participacaoDeal.perfilId, usuarioId: pessoa.usuarioId })
      .from(participacaoDeal)
      .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
      .where(eq(participacaoDeal.dealId, x.dealId)),
  );
  const perfis = [...new Set(dados.perfis)].filter((p) => validos.some((v) => v.perfilId === p));
  const usuarios = [...new Set(dados.usuarios)].filter((u) => validos.some((v) => v.usuarioId === u));
  await comTenant(a.tenant.id, async (tx) => {
    await tx.update(documentoVersao).set({ todos: dados.todos }).where(eq(documentoVersao.id, versaoId));
    await tx.delete(versaoAcesso).where(eq(versaoAcesso.versaoId, versaoId));
    const linhas = [
      ...perfis.map((perfilId) => ({ tenantId: a.tenant.id, versaoId, perfilId })),
      ...usuarios.map((usuarioId) => ({ tenantId: a.tenant.id, versaoId, usuarioId })),
    ];
    if (linhas.length) await tx.insert(versaoAcesso).values(linhas);
  });
  await auditar(a, "documento.acesso_alterado", "deal", x.dealId, {
    titulo: x.titulo,
    versao: x.v.numero,
    todos: dados.todos,
  });
  return { ok: true };
}

/** Lista de acesso da última versão (pré-preenchimento de uma nova versão). */
export async function acessoDaUltimaVersao(acesso: Acesso | null, documentoId: string) {
  const a = exigirTenant(acesso);
  if (!uuidValido(documentoId)) return { perfis: [], usuarios: [] };
  const [ultima] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: documentoVersao.id })
      .from(documentoVersao)
      .where(eq(documentoVersao.documentoId, documentoId))
      .orderBy(desc(documentoVersao.numero))
      .limit(1),
  );
  const visivel = ultima ? await versaoAcessivel(a, ultima.id) : null;
  if (!ultima || !visivel) return { perfis: [], usuarios: [] };
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ perfilId: versaoAcesso.perfilId, usuarioId: versaoAcesso.usuarioId })
      .from(versaoAcesso)
      .where(eq(versaoAcesso.versaoId, ultima.id)),
  );
  return {
    todos: visivel.v.todos,
    perfis: linhas.flatMap((l) => (l.perfilId ? [l.perfilId] : [])),
    usuarios: linhas.flatMap((l) => (l.usuarioId ? [l.usuarioId] : [])),
  };
}

/** Reaproveitado dentro do mesmo carregamento de página (React cache; gravações não usam). */
export const dataRoomDoNegocio = cache(dataRoomDoNegocioSemCache);
