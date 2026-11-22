import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { ErroDeServico } from "@/i18n/servidor";
import { banco, comTenant } from "@/server/db/cliente";
import { chaveApi, perfil, perfilUsuario, pessoa, usuario, vinculoTenant } from "@/server/db/esquema";
import { exigirAdministrador, hashDoToken, PREFIXO_DA_CHAVE, type Acesso } from "./acesso";
import { auditar } from "./empresas";

/**
 * Chaves de API (itens 25 e 26; ADR-0013, regra 11; autenticacao-e-sessao.md).
 * Só administradores criam e revogam. Cada chave é um usuário de serviço do
 * tenant, com vínculo, perfil do tenant escolhido pelo administrador e pessoa
 * (para poder ser incluída como participante de um negócio). O segredo é
 * mostrado uma única vez; guarda-se só o hash.
 */

export type ChaveNaTela = {
  id: string;
  nome: string;
  prefixo: string;
  perfil: string | null;
  criadaPor: string | null;
  criadaEm: string;
  expiraEm: string | null;
  ultimoUsoEm: string | null;
  situacao: "ativa" | "vencida" | "revogada";
};

const uuidValido = (id: string) => z.uuid().safeParse(id).success;
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export async function listarChaves(acesso: Acesso | null): Promise<ChaveNaTela[]> {
  const a = exigirAdministrador(acesso);
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        c: chaveApi,
        perfil: perfil.nome,
      })
      .from(chaveApi)
      .leftJoin(
        perfilUsuario,
        and(eq(perfilUsuario.usuarioId, chaveApi.usuarioId), eq(perfilUsuario.tenantId, chaveApi.tenantId)),
      )
      .leftJoin(perfil, eq(perfil.id, perfilUsuario.perfilId))
      .orderBy(desc(chaveApi.criadoEm)),
  );
  const autores = [...new Set(linhas.map((l) => l.c.criadoPor).filter((x): x is string => Boolean(x)))];
  const nomes = new Map<string, string>();
  for (const id of autores) {
    const [u] = await banco().select({ nome: usuario.name }).from(usuario).where(eq(usuario.id, id));
    if (u) nomes.set(id, u.nome);
  }
  return linhas.map(({ c, perfil: p }) => ({
    id: c.id,
    nome: c.nome,
    prefixo: c.prefixo,
    perfil: p,
    criadaPor: c.criadoPor ? (nomes.get(c.criadoPor) ?? null) : null,
    criadaEm: c.criadoEm.toISOString(),
    expiraEm: c.expiraEm,
    ultimoUsoEm: c.ultimoUsoEm?.toISOString() ?? null,
    situacao: c.revogadaEm ? "revogada" : c.expiraEm && c.expiraEm < hoje() ? "vencida" : "ativa",
  }));
}

const DadosChave = z.object({
  nome: z.string().trim().min(2, "chaves.erros.nomeObrigatorio").max(100, "chaves.erros.nomeLongo"),
  perfilId: z.string().refine(uuidValido, "chaves.erros.perfilObrigatorio"),
  expiraEm: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "chaves.erros.dataInvalida"),
});

/** Cria a chave e o usuário de serviço; devolve o segredo (mostrado uma vez só). */
export async function criarChave(
  acesso: Acesso | null,
  dados: z.input<typeof DadosChave>,
): Promise<{ segredo: string } | ErroDeServico> {
  const a = exigirAdministrador(acesso);
  const d = DadosChave.safeParse(dados);
  if (!d.success) {
    const p = d.error.issues[0];
    return { erro: p.message, campo: String(p.path[0]) };
  }
  if (d.data.expiraEm && d.data.expiraEm < hoje())
    return { erro: "chaves.erros.dataNoPassado", campo: "expiraEm" };
  const [p] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: perfil.id })
      .from(perfil)
      .where(and(eq(perfil.id, d.data.perfilId), eq(perfil.camada, "tenant"))),
  );
  if (!p) return { erro: "chaves.erros.perfilObrigatorio", campo: "perfilId" };
  const segredo = `${PREFIXO_DA_CHAVE}${randomBytes(32).toString("base64url")}`;
  const nomeDoServico = `Chave de API: ${d.data.nome}`;
  // Usuário de serviço: e-mail técnico que nunca recebe mensagem (domínio reservado .invalid).
  const [u] = await banco()
    .insert(usuario)
    .values({ name: nomeDoServico, email: `chave-${randomUUID()}@chaves.invalid`, emailVerified: true })
    .returning({ id: usuario.id });
  const id = await comTenant(a.tenant.id, async (tx) => {
    await tx.insert(vinculoTenant).values({ tenantId: a.tenant.id, usuarioId: u.id, situacao: "ativo" });
    await tx.insert(perfilUsuario).values({ tenantId: a.tenant.id, usuarioId: u.id, perfilId: p.id });
    await tx.insert(pessoa).values({ tenantId: a.tenant.id, nome: nomeDoServico, usuarioId: u.id });
    const [c] = await tx
      .insert(chaveApi)
      .values({
        tenantId: a.tenant.id,
        nome: d.data.nome,
        prefixo: segredo.slice(0, PREFIXO_DA_CHAVE.length + 6),
        hash: hashDoToken(segredo),
        usuarioId: u.id,
        criadoPor: a.usuario.id,
        expiraEm: d.data.expiraEm,
      })
      .returning({ id: chaveApi.id });
    return c.id;
  });
  await auditar(a, "chave_api.criada", "chave_api", id, { nome: d.data.nome });
  return { segredo };
}

/** Revoga na hora: a chave deixa de funcionar e o vínculo do usuário de serviço é encerrado. */
export async function revogarChave(acesso: Acesso | null, id: string): Promise<{ ok: true } | ErroDeServico> {
  const a = exigirAdministrador(acesso);
  if (!uuidValido(id)) return { erro: "chaves.erros.naoEncontrada" };
  const feito = await comTenant(a.tenant.id, async (tx) => {
    const [c] = await tx
      .update(chaveApi)
      .set({ revogadaEm: new Date() })
      .where(eq(chaveApi.id, id))
      .returning({ usuarioId: chaveApi.usuarioId, nome: chaveApi.nome });
    if (!c) return null;
    await tx
      .update(vinculoTenant)
      .set({ situacao: "revogado" })
      .where(and(eq(vinculoTenant.usuarioId, c.usuarioId), eq(vinculoTenant.tenantId, a.tenant.id)));
    return c;
  });
  if (!feito) return { erro: "chaves.erros.naoEncontrada" };
  await auditar(a, "chave_api.revogada", "chave_api", id, { nome: feito.nome });
  return { ok: true };
}
