import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { limites, type Pagina, type PedidoDePagina } from "@/config/paginacao";
import { z } from "zod";
import { comTenant } from "@/server/db/cliente";
import { apagarArquivo } from "@/server/arquivos/armazenamento";
import {
  anexoCadastro,
  empresa,
  eventoAuditoria,
  grupoEconomico,
  pessoa,
  tipoVinculo,
  usuario,
  vinculoPessoaEmpresa,
  contratoParte,
} from "@/server/db/esquema";
import { cnpjValido, soDigitos } from "@/config/documentos";
import type { ErroDeServico } from "@/i18n/servidor";
import type { Acesso, AcessoTenant } from "./acesso";
import { exigirPermissao } from "./permissoes/verificador";
import { situacoes } from "./situacao-de-acesso";
import { enderecoDaFoto } from "./foto-da-conta";

/**
 * Empresas e grupos econômicos do tenant (dominio.md, "Empresa"). Toda
 * operação passa pelo verificador de permissões ("Empresas e pessoas") e
 * gera evento de auditoria. Nome e CNPJ de empresa não são dados pessoais.
 */

type Resultado = { ok: true } | ErroDeServico;

const uuidValido = (id: string) => z.uuid().safeParse(id).success;
const opcional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, "cadastros.erros.textoLongo")
    .transform((v) => v || null);

export async function auditar(
  a: AcessoTenant,
  tipo: string,
  alvoTipo: string,
  alvoId: string,
  detalhes?: Record<string, string | boolean | number>,
) {
  await comTenant(a.tenant.id, (tx) =>
    tx
      .insert(eventoAuditoria)
      .values({ tenantId: a.tenant.id, tipo, atorId: a.usuario.id, alvoTipo, alvoId, detalhes }),
  );
}

/** Campos de endereço, comuns a empresas e pessoas. */
export const CamposEndereco = {
  cep: opcional(9).transform((v) => (v ? soDigitos(v) || null : null)),
  logradouro: opcional(),
  numero: opcional(20),
  complemento: opcional(),
  bairro: opcional(),
  cidade: opcional(),
  uf: opcional(2).transform((v) => v?.toUpperCase() ?? null),
  pais: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || "Brasil"),
};

const DadosEmpresa = z.object({
  cnpj: z
    .string()
    .trim()
    .transform((v) => soDigitos(v) || null)
    .refine((v) => v === null || cnpjValido(v), "cadastros.erros.cnpjInvalido"),
  identificadorEstrangeiro: opcional(60),
  razaoSocial: z
    .string()
    .trim()
    .min(2, "cadastros.erros.razaoSocialObrigatoria")
    .max(200, "cadastros.erros.razaoSocialLonga"),
  nomeFantasia: opcional(),
  cnae: opcional(300),
  ...CamposEndereco,
  site: opcional(),
  telefone: opcional(40),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, "cadastros.erros.emailInvalido"),
  /** Setor financeiro: recebe os dados de contratos para nota fiscal e cobrança (C3). */
  emailFinanceiro: z
    .string()
    .trim()
    .toLowerCase()
    .default("")
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, "cadastros.erros.emailInvalido"),
  observacoes: opcional(2000),
  grupoId: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || uuidValido(v), "cadastros.erros.grupoInvalido"),
});

export type DadosEmpresa = z.input<typeof DadosEmpresa>;
export type ResultadoComId =
  { id: string } | (ErroDeServico & { existenteId?: string; parecida?: { id: string; nome: string } });

function validar(dados: DadosEmpresa) {
  const r = DadosEmpresa.safeParse(dados);
  if (r.success) return r.data;
  const problema = r.error.issues[0];
  return {
    erro: problema?.message ?? "cadastros.erros.dadosInvalidos",
    campo: problema?.path[0] !== undefined ? String(problema.path[0]) : undefined,
  };
}

// --- Consulta --------------------------------------------------------------------

export type EmpresaResumo = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  pais: string;
  grupo: string | null;
  doContratante: boolean;
  inativa: boolean;
  pessoas: number;
  /** Até 4 pessoas ligadas (miniaturas na lista); só na lista paginada. */
  rostos?: { nome: string; foto: string | null }[];
};

export const ORDENS_DE_EMPRESAS = ["razaoSocial", "cnpj", "grupo", "criadoEm"] as const;
export type OrdemDeEmpresas = (typeof ORDENS_DE_EMPRESAS)[number];

function filtroDeEmpresas(filtro: { busca?: string; inativas?: boolean }) {
  const busca = filtro.busca?.trim();
  return and(
    filtro.inativas ? undefined : isNull(empresa.inativaEm),
    busca
      ? or(
          ilike(empresa.razaoSocial, `%${busca}%`),
          ilike(empresa.nomeFantasia, `%${busca}%`),
          eq(empresa.cnpj, soDigitos(busca) || "-"),
        )
      : undefined,
  );
}

/** Lista paginada no banco (tela de empresas). */
export async function paginaDeEmpresas(
  acesso: Acesso | null,
  filtro: { busca?: string; inativas?: boolean },
  pedido: PedidoDePagina<OrdemDeEmpresas>,
): Promise<Pagina<EmpresaResumo>> {
  const a = await exigirPermissao(acesso, "empresas", "ver");
  const onde = filtroDeEmpresas(filtro);
  return comTenant(a.tenant.id, async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(empresa).where(onde);
    const { limite, deslocamento, pagina } = limites(pedido, total);
    const coluna = {
      razaoSocial: empresa.razaoSocial,
      cnpj: empresa.cnpj,
      grupo: grupoEconomico.nome,
      criadoEm: empresa.criadoEm,
    }[pedido.ordem];
    const linhas = await tx
      .select({
        id: empresa.id,
        razaoSocial: empresa.razaoSocial,
        nomeFantasia: empresa.nomeFantasia,
        cnpj: empresa.cnpj,
        pais: empresa.pais,
        grupo: grupoEconomico.nome,
        doContratante: empresa.doContratante,
        inativaEm: empresa.inativaEm,
      })
      .from(empresa)
      .leftJoin(grupoEconomico, eq(grupoEconomico.id, empresa.grupoId))
      .where(onde)
      .orderBy(pedido.direcao === "desc" ? desc(coluna) : asc(coluna), asc(empresa.id))
      .limit(limite)
      .offset(deslocamento);
    const ids = linhas.map((l) => l.id);
    const contagem = ids.length
      ? await tx
          .select({ empresaId: vinculoPessoaEmpresa.empresaId, n: count() })
          .from(vinculoPessoaEmpresa)
          .where(inArray(vinculoPessoaEmpresa.empresaId, ids))
          .groupBy(vinculoPessoaEmpresa.empresaId)
      : [];
    const n = new Map(contagem.map((c) => [c.empresaId, c.n]));
    // Miniaturas: as pessoas ligadas a cada empresa (foto da conta, quando a pessoa tem uma).
    const ligadas = ids.length
      ? await tx
          .select({
            empresaId: vinculoPessoaEmpresa.empresaId,
            nome: pessoa.nome,
            usuarioId: pessoa.usuarioId,
            imagem: usuario.image,
          })
          .from(vinculoPessoaEmpresa)
          .innerJoin(pessoa, eq(pessoa.id, vinculoPessoaEmpresa.pessoaId))
          .leftJoin(usuario, eq(usuario.id, pessoa.usuarioId))
          .where(inArray(vinculoPessoaEmpresa.empresaId, ids))
          .orderBy(asc(pessoa.nome))
      : [];
    const rostos = Map.groupBy(ligadas, (x) => x.empresaId);
    return {
      itens: linhas.map(({ inativaEm, ...l }) => ({
        ...l,
        inativa: Boolean(inativaEm),
        pessoas: n.get(l.id) ?? 0,
        rostos: [...new Map((rostos.get(l.id) ?? []).map((x) => [x.nome, x])).values()]
          .slice(0, 4)
          .map((x) => ({
            nome: x.nome,
            foto: x.usuarioId ? enderecoDaFoto(x.usuarioId, x.imagem) : null,
          })),
      })),
      total,
      pagina,
      porPagina: limite,
    };
  });
}

/** Lista completa (para escolher numa caixa de seleção). */
export async function listarEmpresas(
  acesso: Acesso | null,
  filtro: { busca?: string; inativas?: boolean } = {},
): Promise<EmpresaResumo[]> {
  const a = await exigirPermissao(acesso, "empresas", "ver");
  const busca = filtro.busca?.trim();
  return comTenant(a.tenant.id, async (tx) => {
    const linhas = await tx
      .select({
        id: empresa.id,
        razaoSocial: empresa.razaoSocial,
        nomeFantasia: empresa.nomeFantasia,
        cnpj: empresa.cnpj,
        pais: empresa.pais,
        grupo: grupoEconomico.nome,
        doContratante: empresa.doContratante,
        inativaEm: empresa.inativaEm,
      })
      .from(empresa)
      .leftJoin(grupoEconomico, eq(grupoEconomico.id, empresa.grupoId))
      .where(
        and(
          filtro.inativas ? undefined : isNull(empresa.inativaEm),
          busca
            ? or(
                ilike(empresa.razaoSocial, `%${busca}%`),
                ilike(empresa.nomeFantasia, `%${busca}%`),
                eq(empresa.cnpj, soDigitos(busca) || "-"),
              )
            : undefined,
        ),
      )
      .orderBy(asc(empresa.razaoSocial));
    const contagem = await tx
      .select({ empresaId: vinculoPessoaEmpresa.empresaId, n: count() })
      .from(vinculoPessoaEmpresa)
      .groupBy(vinculoPessoaEmpresa.empresaId);
    const n = new Map(contagem.map((c) => [c.empresaId, c.n]));
    return linhas.map(({ inativaEm, ...l }) => ({
      ...l,
      inativa: Boolean(inativaEm),
      pessoas: n.get(l.id) ?? 0,
    }));
  });
}

export type VinculoDaEmpresa = {
  id: string;
  pessoaId: string;
  pessoa: string;
  email: string | null;
  acesso: "usuario" | "convidado" | "sem-acesso";
  tipo: string;
  cargo: string | null;
  percentual: string | null;
};

export type EmpresaDetalhe = typeof empresa.$inferSelect & {
  grupo: string | null;
  vinculos: VinculoDaEmpresa[];
};

export async function obterEmpresa(acesso: Acesso | null, id: string): Promise<EmpresaDetalhe | null> {
  const a = await exigirPermissao(acesso, "empresas", "ver");
  if (!uuidValido(id)) return null;
  return comTenant(a.tenant.id, async (tx) => {
    const [e] = await tx
      .select({ e: empresa, grupo: grupoEconomico.nome })
      .from(empresa)
      .leftJoin(grupoEconomico, eq(grupoEconomico.id, empresa.grupoId))
      .where(eq(empresa.id, id));
    if (!e) return null;
    const vinculos = await tx
      .select({
        id: vinculoPessoaEmpresa.id,
        pessoaId: pessoa.id,
        pessoa: pessoa.nome,
        email: pessoa.email,
        usuarioId: pessoa.usuarioId,
        tipo: tipoVinculo.nome,
        cargo: vinculoPessoaEmpresa.cargo,
        percentual: vinculoPessoaEmpresa.percentual,
      })
      .from(vinculoPessoaEmpresa)
      .innerJoin(pessoa, eq(pessoa.id, vinculoPessoaEmpresa.pessoaId))
      .innerJoin(tipoVinculo, eq(tipoVinculo.id, vinculoPessoaEmpresa.tipoId))
      .where(eq(vinculoPessoaEmpresa.empresaId, id))
      .orderBy(asc(pessoa.nome));
    const situacao = await situacoes(
      tx,
      vinculos.map((v) => ({ id: v.pessoaId, usuarioId: v.usuarioId, email: v.email })),
    );
    return {
      ...e.e,
      grupo: e.grupo,
      vinculos: vinculos.map((v) => ({
        id: v.id,
        pessoaId: v.pessoaId,
        pessoa: v.pessoa,
        email: v.email,
        tipo: v.tipo,
        cargo: v.cargo,
        percentual: v.percentual,
        acesso: situacao.get(v.pessoaId) ?? "sem-acesso",
      })),
    };
  });
}

// --- Cadastro --------------------------------------------------------------------

async function cnpjEmUso(a: AcessoTenant, cnpj: string | null, exceto?: string): Promise<string | null> {
  if (!cnpj) return null;
  const [ja] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: empresa.id })
      .from(empresa)
      .where(and(eq(empresa.cnpj, cnpj), exceto ? ne(empresa.id, exceto) : undefined)),
  );
  return ja?.id ?? null;
}

// --- Empresa parecida sem CNPJ ------------------------------------------------------

/** Palavras que não distinguem empresas (forma jurídica e conectivos). */
const PALAVRAS_GENERICAS = new Set([
  "LTDA",
  "SA",
  "S",
  "A",
  "ME",
  "EPP",
  "EIRELI",
  "E",
  "DE",
  "DA",
  "DO",
  "DAS",
  "DOS",
]);

/** "Bastos-Tigre, Lopes e Freitas Ltda." → ["BASTOS", "TIGRE", "LOPES", "FREITAS"] */
function palavrasDoNome(nome: string | null | undefined): string[] {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((p) => p && !PALAVRAS_GENERICAS.has(p));
}

/** Um nome está contido no outro, palavra por palavra e na ordem (ex.: "Bastos Tigre" em "Bastos-Tigre, Lopes e Freitas")? */
export function nomesParecidos(a: string | null | undefined, b: string | null | undefined): boolean {
  const [x, y] = [palavrasDoNome(a), palavrasDoNome(b)];
  if (x.length === 0 || y.length === 0) return false;
  const [curto, longo] = x.length <= y.length ? [x, y] : [y, x];
  if (curto.length === 1 && longo.length > 1) return false; // uma palavra só é pouco para afirmar
  const texto = ` ${longo.join(" ")} `;
  return texto.includes(` ${curto.join(" ")} `);
}

/**
 * Empresa do tenant sem CNPJ e sem identificador estrangeiro com nome parecido
 * (ex.: a empresa do contratante, criada só com o nome). Evita cadastrar de
 * novo quem já existe sem documento.
 */
export async function empresaParecidaSemCnpj(
  a: AcessoTenant,
  nomes: (string | null | undefined)[],
): Promise<{ id: string; nome: string } | null> {
  const candidatas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: empresa.id, razaoSocial: empresa.razaoSocial, nomeFantasia: empresa.nomeFantasia })
      .from(empresa)
      .where(and(isNull(empresa.cnpj), isNull(empresa.identificadorEstrangeiro))),
  );
  const achada = candidatas.find((c) =>
    nomes.some((n) => nomesParecidos(n, c.razaoSocial) || nomesParecidos(n, c.nomeFantasia)),
  );
  return achada ? { id: achada.id, nome: achada.razaoSocial } : null;
}

/**
 * Completa uma empresa existente com os dados novos: preenche só o que está
 * vazio (inclusive o CNPJ), sem apagar nada do que já havia.
 */
export async function completarEmpresa(
  acesso: Acesso | null,
  id: string,
  dados: DadosEmpresa,
): Promise<ResultadoComId> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  if (!uuidValido(id)) return { erro: "cadastros.erros.empresaNaoEncontrada" };
  const d = validar(dados);
  if ("erro" in d) return d;
  const existente = await cnpjEmUso(a, d.cnpj, id);
  if (existente) return { erro: "cadastros.erros.empresaCnpjJaExisteOutra", existenteId: existente };
  const [atual] = await comTenant(a.tenant.id, (tx) => tx.select().from(empresa).where(eq(empresa.id, id)));
  if (!atual) return { erro: "cadastros.erros.empresaNaoEncontrada" };
  const mudancas: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(d)) {
    const antes = (atual as Record<string, unknown>)[campo];
    if (valor !== null && valor !== "" && (antes === null || antes === "" || antes === undefined))
      mudancas[campo] = valor;
  }
  // A razão social oficial (com CNPJ) substitui o nome provisório de quem não tinha CNPJ.
  if (!atual.cnpj && d.cnpj && d.razaoSocial) mudancas.razaoSocial = d.razaoSocial;
  if (!atual.nomeFantasia && !d.nomeFantasia && mudancas.razaoSocial)
    mudancas.nomeFantasia = atual.razaoSocial;
  if (Object.keys(mudancas).length > 0)
    await comTenant(a.tenant.id, (tx) =>
      tx
        .update(empresa)
        .set({ ...mudancas, atualizadoEm: new Date() })
        .where(eq(empresa.id, id)),
    );
  await auditar(a, "empresa.completada", "empresa", id);
  return { id };
}

export async function criarEmpresa(
  acesso: Acesso | null,
  dados: DadosEmpresa,
  opcoes: { ignorarParecida?: boolean } = {},
): Promise<ResultadoComId> {
  const a = await exigirPermissao(acesso, "empresas", "criar");
  const d = validar(dados);
  if ("erro" in d) return d;
  const existente = await cnpjEmUso(a, d.cnpj);
  if (existente) return { erro: "cadastros.erros.empresaCnpjJaExiste", existenteId: existente };
  if (!opcoes.ignorarParecida) {
    const parecida = await empresaParecidaSemCnpj(a, [d.razaoSocial, d.nomeFantasia]);
    if (parecida)
      return {
        erro: "cadastros.erros.empresaParecidaSemCnpj",
        parametros: { nome: parecida.nome },
        parecida,
      };
  }
  const [e] = await comTenant(a.tenant.id, (tx) =>
    tx
      .insert(empresa)
      .values({ ...d, tenantId: a.tenant.id })
      .returning({ id: empresa.id }),
  );
  await auditar(a, "empresa.criada", "empresa", e.id);
  return { id: e.id };
}

export async function editarEmpresa(
  acesso: Acesso | null,
  id: string,
  dados: DadosEmpresa,
): Promise<ResultadoComId> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  if (!uuidValido(id)) return { erro: "cadastros.erros.empresaNaoEncontrada" };
  const d = validar(dados);
  if ("erro" in d) return d;
  const existente = await cnpjEmUso(a, d.cnpj, id);
  if (existente) return { erro: "cadastros.erros.empresaCnpjJaExisteOutra", existenteId: existente };
  const feito = await comTenant(a.tenant.id, (tx) =>
    tx
      .update(empresa)
      .set({ ...d, atualizadoEm: new Date() })
      .where(eq(empresa.id, id))
      .returning({ id: empresa.id }),
  );
  if (feito.length === 0) return { erro: "cadastros.erros.empresaNaoEncontrada" };
  await auditar(a, "empresa.editada", "empresa", id);
  return { id };
}

/** Inativar: some das listas de escolha; o histórico fica. */
export async function definirEmpresaInativa(
  acesso: Acesso | null,
  id: string,
  inativa: boolean,
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  if (!uuidValido(id)) return { erro: "cadastros.erros.empresaNaoEncontrada" };
  const [e] = await comTenant(a.tenant.id, (tx) =>
    tx
      .update(empresa)
      .set({ inativaEm: inativa ? new Date() : null })
      .where(and(eq(empresa.id, id), inativa ? eq(empresa.doContratante, false) : undefined))
      .returning({ id: empresa.id }),
  );
  if (!e)
    return {
      erro: inativa ? "cadastros.erros.empresaNaoInativavel" : "cadastros.erros.empresaNaoEncontrada",
    };
  await auditar(a, inativa ? "empresa.inativada" : "empresa.reativada", "empresa", id);
  return { ok: true };
}

/**
 * Exclusão definitiva: só sem uso em deals, contratos ou valuations (que
 * chegam nos próximos itens; a verificação cresce com eles) e nunca a empresa
 * do contratante. Os vínculos com pessoas saem junto.
 */
export async function excluirEmpresa(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "empresas", "excluir");
  if (!uuidValido(id)) return { erro: "cadastros.erros.empresaNaoEncontrada" };
  const [e] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ doContratante: empresa.doContratante }).from(empresa).where(eq(empresa.id, id)),
  );
  if (!e) return { erro: "cadastros.erros.empresaNaoEncontrada" };
  if (e.doContratante) return { erro: "cadastros.erros.empresaContratanteNaoExcluivel" };
  const [emContrato] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ id: contratoParte.id }).from(contratoParte).where(eq(contratoParte.empresaId, id)).limit(1),
  );
  if (emContrato) return { erro: "cadastros.erros.empresaEmContrato" };
  // Anexos saem junto (cascata no banco); os arquivos, do armazenamento.
  const anexos = await comTenant(a.tenant.id, async (tx) => {
    const chaves = await tx
      .select({ chave: anexoCadastro.chave })
      .from(anexoCadastro)
      .where(eq(anexoCadastro.empresaId, id));
    await tx.delete(empresa).where(eq(empresa.id, id));
    return chaves;
  });
  await Promise.all(anexos.map((x) => apagarArquivo(x.chave).catch(() => undefined)));
  await auditar(a, "empresa.excluida", "empresa", id);
  return { ok: true };
}

// --- Grupos econômicos -------------------------------------------------------------

const NomeGrupo = z
  .string()
  .trim()
  .min(2, "cadastros.erros.grupoNomeObrigatorio")
  .max(120, "cadastros.erros.nomeLongo");

export async function listarGrupos(
  acesso: Acesso | null,
): Promise<{ id: string; nome: string; empresas: number }[]> {
  const a = await exigirPermissao(acesso, "empresas", "ver");
  return comTenant(a.tenant.id, async (tx) => {
    const grupos = await tx
      .select({ id: grupoEconomico.id, nome: grupoEconomico.nome })
      .from(grupoEconomico)
      .orderBy(asc(grupoEconomico.nome));
    const n = await tx
      .select({ grupoId: empresa.grupoId, n: count() })
      .from(empresa)
      .where(isNotNull(empresa.grupoId))
      .groupBy(empresa.grupoId);
    const porGrupo = new Map(n.map((x) => [x.grupoId, x.n]));
    return grupos.map((g) => ({ ...g, empresas: porGrupo.get(g.id) ?? 0 }));
  });
}

export async function criarGrupo(acesso: Acesso | null, nome: string): Promise<ResultadoComId> {
  const a = await exigirPermissao(acesso, "empresas", "criar");
  const r = NomeGrupo.safeParse(nome);
  if (!r.success) return { erro: r.error.issues[0]?.message ?? "cadastros.erros.nomeInvalido" };
  const [g] = await comTenant(a.tenant.id, (tx) =>
    tx
      .insert(grupoEconomico)
      .values({ tenantId: a.tenant.id, nome: r.data })
      .onConflictDoNothing()
      .returning({ id: grupoEconomico.id }),
  );
  if (!g) return { erro: "cadastros.erros.grupoJaExiste" };
  await auditar(a, "grupo.criado", "grupo_economico", g.id);
  return { id: g.id };
}

export async function excluirGrupo(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "empresas", "excluir");
  if (!uuidValido(id)) return { erro: "cadastros.erros.grupoNaoEncontrado" };
  const feito = await comTenant(a.tenant.id, (tx) =>
    tx.delete(grupoEconomico).where(eq(grupoEconomico.id, id)).returning({ id: grupoEconomico.id }),
  );
  if (feito.length === 0) return { erro: "cadastros.erros.grupoNaoEncontrado" };
  await auditar(a, "grupo.excluido", "grupo_economico", id);
  return { ok: true };
}
