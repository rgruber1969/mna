import { and, asc, count, eq, ilike, isNotNull, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { comTenant } from "@/server/db/cliente";
import {
  empresa,
  eventoAuditoria,
  grupoEconomico,
  pessoa,
  tipoVinculo,
  vinculoPessoaEmpresa,
} from "@/server/db/esquema";
import { cnpjValido, soDigitos } from "@/config/documentos";
import type { Acesso, AcessoTenant } from "./acesso";
import { exigirPermissao } from "./permissoes/verificador";
import { situacoes } from "./situacao-de-acesso";

/**
 * Empresas e grupos econômicos do tenant (dominio.md, "Empresa"). Toda
 * operação passa pelo verificador de permissões ("Empresas e pessoas") e
 * gera evento de auditoria. Nome e CNPJ de empresa não são dados pessoais.
 */

type Resultado = { ok: true } | { erro: string };

const uuidValido = (id: string) => z.uuid().safeParse(id).success;
const opcional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, "Texto muito longo.")
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
    .refine((v) => v === null || cnpjValido(v), "CNPJ inválido. Confira os números."),
  identificadorEstrangeiro: opcional(60),
  razaoSocial: z.string().trim().min(2, "Informe a razão social.").max(200, "Razão social muito longa."),
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
    .refine((v) => v === null || z.email().safeParse(v).success, "E-mail inválido."),
  observacoes: opcional(2000),
  grupoId: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || uuidValido(v), "Grupo inválido."),
});

export type DadosEmpresa = z.input<typeof DadosEmpresa>;
export type ResultadoComId = { id: string } | { erro: string; existenteId?: string };

function validar(dados: DadosEmpresa) {
  const r = DadosEmpresa.safeParse(dados);
  return r.success ? r.data : { erro: r.error.issues[0]?.message ?? "Dados inválidos." };
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
};

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

export async function criarEmpresa(acesso: Acesso | null, dados: DadosEmpresa): Promise<ResultadoComId> {
  const a = await exigirPermissao(acesso, "empresas", "criar");
  const d = validar(dados);
  if ("erro" in d) return d;
  const existente = await cnpjEmUso(a, d.cnpj);
  if (existente) return { erro: "Já existe uma empresa com este CNPJ.", existenteId: existente };
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
  if (!uuidValido(id)) return { erro: "Empresa não encontrada." };
  const d = validar(dados);
  if ("erro" in d) return d;
  const existente = await cnpjEmUso(a, d.cnpj, id);
  if (existente) return { erro: "Já existe outra empresa com este CNPJ.", existenteId: existente };
  const feito = await comTenant(a.tenant.id, (tx) =>
    tx
      .update(empresa)
      .set({ ...d, atualizadoEm: new Date() })
      .where(eq(empresa.id, id))
      .returning({ id: empresa.id }),
  );
  if (feito.length === 0) return { erro: "Empresa não encontrada." };
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
  if (!uuidValido(id)) return { erro: "Empresa não encontrada." };
  const [e] = await comTenant(a.tenant.id, (tx) =>
    tx
      .update(empresa)
      .set({ inativaEm: inativa ? new Date() : null })
      .where(and(eq(empresa.id, id), inativa ? eq(empresa.doContratante, false) : undefined))
      .returning({ id: empresa.id }),
  );
  if (!e) return { erro: inativa ? "Esta empresa não pode ser inativada." : "Empresa não encontrada." };
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
  if (!uuidValido(id)) return { erro: "Empresa não encontrada." };
  const [e] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ doContratante: empresa.doContratante }).from(empresa).where(eq(empresa.id, id)),
  );
  if (!e) return { erro: "Empresa não encontrada." };
  if (e.doContratante) return { erro: "A empresa do contratante não pode ser excluída." };
  await comTenant(a.tenant.id, (tx) => tx.delete(empresa).where(eq(empresa.id, id)));
  await auditar(a, "empresa.excluida", "empresa", id);
  return { ok: true };
}

// --- Grupos econômicos -------------------------------------------------------------

const NomeGrupo = z.string().trim().min(2, "Informe o nome do grupo.").max(120, "Nome muito longo.");

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
  if (!r.success) return { erro: r.error.issues[0]?.message ?? "Nome inválido." };
  const [g] = await comTenant(a.tenant.id, (tx) =>
    tx
      .insert(grupoEconomico)
      .values({ tenantId: a.tenant.id, nome: r.data })
      .onConflictDoNothing()
      .returning({ id: grupoEconomico.id }),
  );
  if (!g) return { erro: "Já existe um grupo com este nome." };
  await auditar(a, "grupo.criado", "grupo_economico", g.id);
  return { id: g.id };
}

export async function excluirGrupo(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "empresas", "excluir");
  if (!uuidValido(id)) return { erro: "Grupo não encontrado." };
  const feito = await comTenant(a.tenant.id, (tx) =>
    tx.delete(grupoEconomico).where(eq(grupoEconomico.id, id)).returning({ id: grupoEconomico.id }),
  );
  if (feito.length === 0) return { erro: "Grupo não encontrado." };
  await auditar(a, "grupo.excluido", "grupo_economico", id);
  return { ok: true };
}
