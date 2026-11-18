import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { comTenant } from "@/server/db/cliente";
import { papelEmpresa, perfil, tipoVinculo, vinculoPessoaEmpresa } from "@/server/db/esquema";
import type { Acesso } from "./acesso";
import { auditar, type ResultadoComId } from "./empresas";
import { exigirPermissao, pode } from "./permissoes/verificador";

/**
 * Cadastros gerais do tenant (perfis-e-permissoes.md: "Cadastros gerais"):
 * papéis de empresa (com perfil de deal sugerido) e tipos de vínculo entre
 * pessoa e empresa. Ambos extensíveis pelo tenant.
 */

type Resultado = { ok: true } | { erro: string };

const uuidValido = (id: string) => z.uuid().safeParse(id).success;
const Nome = z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo.");

// --- Papéis de empresa ---------------------------------------------------------------

export type Papel = {
  id: string;
  nome: string;
  perfilSugeridoId: string | null;
  perfilSugerido: string | null;
};

export async function listarPapeis(acesso: Acesso | null): Promise<Papel[]> {
  const a = await exigirPermissao(acesso, "cadastros", "ver");
  return comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        id: papelEmpresa.id,
        nome: papelEmpresa.nome,
        perfilSugeridoId: papelEmpresa.perfilSugeridoId,
        perfilSugerido: perfil.nome,
      })
      .from(papelEmpresa)
      .leftJoin(perfil, eq(perfil.id, papelEmpresa.perfilSugeridoId))
      .orderBy(asc(papelEmpresa.nome)),
  );
}

/** Perfis de deal, para escolher o perfil sugerido de cada papel. */
export async function perfisDeDeal(acesso: Acesso | null): Promise<{ id: string; nome: string }[]> {
  const a = await exigirPermissao(acesso, "cadastros", "ver");
  return comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: perfil.id, nome: perfil.nome })
      .from(perfil)
      .where(eq(perfil.camada, "deal"))
      .orderBy(asc(perfil.nome)),
  );
}

async function perfilDeDealValido(tenantId: string, id: string | null): Promise<boolean> {
  if (!id) return true;
  if (!uuidValido(id)) return false;
  const [p] = await comTenant(tenantId, (tx) =>
    tx.select({ camada: perfil.camada }).from(perfil).where(eq(perfil.id, id)),
  );
  return p?.camada === "deal";
}

export async function salvarPapel(
  acesso: Acesso | null,
  dados: { id?: string; nome: string; perfilSugeridoId: string },
): Promise<ResultadoComId> {
  const a = await exigirPermissao(acesso, "cadastros", dados.id ? "editar" : "criar");
  const nome = Nome.safeParse(dados.nome);
  if (!nome.success) return { erro: nome.error.issues[0]?.message ?? "Nome inválido." };
  const perfilId = dados.perfilSugeridoId || null;
  if (!(await perfilDeDealValido(a.tenant.id, perfilId))) return { erro: "Escolha um perfil de deal." };
  const r = await comTenant(a.tenant.id, async (tx) => {
    if (dados.id) {
      if (!uuidValido(dados.id)) return null;
      return tx
        .update(papelEmpresa)
        .set({ nome: nome.data, perfilSugeridoId: perfilId })
        .where(eq(papelEmpresa.id, dados.id))
        .returning({ id: papelEmpresa.id });
    }
    return tx
      .insert(papelEmpresa)
      .values({ tenantId: a.tenant.id, nome: nome.data, perfilSugeridoId: perfilId })
      .returning({ id: papelEmpresa.id });
  }).catch(() => "duplicado" as const);
  if (r === "duplicado") return { erro: "Já existe um papel com este nome." };
  if (!r?.[0]) return { erro: "Papel não encontrado." };
  await auditar(a, dados.id ? "papel.editado" : "papel.criado", "papel_empresa", r[0].id);
  return { id: r[0].id };
}

/** Papel em uso nos deals não pode ser excluído (verificação chega com os deals, item 8). */
export async function excluirPapel(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "cadastros", "excluir");
  if (!uuidValido(id)) return { erro: "Papel não encontrado." };
  const feito = await comTenant(a.tenant.id, (tx) =>
    tx.delete(papelEmpresa).where(eq(papelEmpresa.id, id)).returning({ id: papelEmpresa.id }),
  );
  if (feito.length === 0) return { erro: "Papel não encontrado." };
  await auditar(a, "papel.excluido", "papel_empresa", id);
  return { ok: true };
}

// --- Tipos de vínculo ----------------------------------------------------------------

export type TipoDeVinculo = { id: string; nome: string; comPercentual: boolean; emUso: number };

export async function listarTiposDeVinculo(acesso: Acesso | null): Promise<TipoDeVinculo[]> {
  // Usados também ao vincular pessoas: basta poder ver "Empresas e pessoas" ou "Cadastros".
  const recurso = (await pode(acesso, "empresas", "ver")) ? "empresas" : "cadastros";
  const a = await exigirPermissao(acesso, recurso, "ver");
  return comTenant(a.tenant.id, async (tx) => {
    const tipos = await tx
      .select({ id: tipoVinculo.id, nome: tipoVinculo.nome, comPercentual: tipoVinculo.comPercentual })
      .from(tipoVinculo)
      .orderBy(asc(tipoVinculo.nome));
    const uso = await tx
      .select({ tipoId: vinculoPessoaEmpresa.tipoId, n: count() })
      .from(vinculoPessoaEmpresa)
      .groupBy(vinculoPessoaEmpresa.tipoId);
    const n = new Map(uso.map((u) => [u.tipoId, u.n]));
    return tipos.map((t) => ({ ...t, emUso: n.get(t.id) ?? 0 }));
  });
}

export async function salvarTipoDeVinculo(
  acesso: Acesso | null,
  dados: { id?: string; nome: string; comPercentual: boolean },
): Promise<ResultadoComId> {
  const a = await exigirPermissao(acesso, "cadastros", dados.id ? "editar" : "criar");
  const nome = Nome.safeParse(dados.nome);
  if (!nome.success) return { erro: nome.error.issues[0]?.message ?? "Nome inválido." };
  const r = await comTenant(a.tenant.id, async (tx) => {
    if (dados.id) {
      if (!uuidValido(dados.id)) return null;
      return tx
        .update(tipoVinculo)
        .set({ nome: nome.data, comPercentual: dados.comPercentual })
        .where(eq(tipoVinculo.id, dados.id))
        .returning({ id: tipoVinculo.id });
    }
    return tx
      .insert(tipoVinculo)
      .values({ tenantId: a.tenant.id, nome: nome.data, comPercentual: dados.comPercentual })
      .returning({ id: tipoVinculo.id });
  }).catch(() => "duplicado" as const);
  if (r === "duplicado") return { erro: "Já existe um tipo de vínculo com este nome." };
  if (!r?.[0]) return { erro: "Tipo de vínculo não encontrado." };
  await auditar(a, dados.id ? "tipo_vinculo.editado" : "tipo_vinculo.criado", "tipo_vinculo", r[0].id);
  return { id: r[0].id };
}

export async function excluirTipoDeVinculo(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "cadastros", "excluir");
  if (!uuidValido(id)) return { erro: "Tipo de vínculo não encontrado." };
  const [{ n }] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ n: count() }).from(vinculoPessoaEmpresa).where(eq(vinculoPessoaEmpresa.tipoId, id)),
  );
  if (n > 0) return { erro: `Tipo em uso em ${n} vínculo${n > 1 ? "s" : ""}: remova os vínculos antes.` };
  const feito = await comTenant(a.tenant.id, (tx) =>
    tx.delete(tipoVinculo).where(eq(tipoVinculo.id, id)).returning({ id: tipoVinculo.id }),
  );
  if (feito.length === 0) return { erro: "Tipo de vínculo não encontrado." };
  await auditar(a, "tipo_vinculo.excluido", "tipo_vinculo", id);
  return { ok: true };
}
