import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { banco, comTenant } from "@/server/db/cliente";
import {
  convite,
  convitePlataforma,
  eventoPlataforma,
  sessao,
  tenant,
  usuario,
  vinculoTenant,
} from "@/server/db/esquema";
import { problemaNoSlug } from "@/server/enderecos";
import { AcessoNegado, type Acesso } from "./acesso";
import { copiarPerfisPadrao } from "./perfis";
import { convidarUsuarioDaPlataforma, emitirConviteDoTenant, type DadosPessoa } from "./convites";
import { apagarTodosOsFatores, avisarMudancaNosFatores } from "./fatores-da-conta";

/**
 * Console da plataforma (ADR-0011, regra 4; docs/projeto/perfis-e-permissoes.md):
 * só usuários da plataforma, sempre com 2FA ativo, todas as ações auditadas.
 */

export type AcessoConsole = Extract<Acesso, { area: "console" }>;

export function exigirConsole(acesso: Acesso | null): AcessoConsole {
  // Exige que ESTA sessão tenha sido aberta com dois fatores, não só que a conta tenha 2FA.
  if (acesso?.area !== "console" || !acesso.segundoFatorNaSessao) throw new AcessoNegado();
  return acesso;
}

async function auditar(
  atorId: string,
  tipo: string,
  alvoId: string,
  detalhes?: Record<string, string | boolean>,
) {
  await banco().insert(eventoPlataforma).values({ tipo, atorId, alvoTipo: "tenant", alvoId, detalhes });
}

export type TenantResumo = {
  id: string;
  slug: string;
  nome: string;
  criadoEm: Date;
  suspensoEm: Date | null;
};

export async function listarTenants(acesso: Acesso | null): Promise<TenantResumo[]> {
  exigirConsole(acesso);
  return banco()
    .select({
      id: tenant.id,
      slug: tenant.slug,
      nome: tenant.nome,
      criadoEm: tenant.criadoEm,
      suspensoEm: tenant.suspensoEm,
    })
    .from(tenant)
    .orderBy(tenant.nome);
}

const NovoTenant = z.object({
  nome: z.string().trim().min(2, "Informe o nome do tenant.").max(120),
  slug: z.string().trim().toLowerCase(),
});

export async function criarTenant(
  acesso: Acesso | null,
  dados: { nome: string; slug: string },
): Promise<{ id: string } | { erro: string }> {
  const a = exigirConsole(acesso);
  const r = NovoTenant.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0]?.message ?? "Dados inválidos." };
  const problema = problemaNoSlug(r.data.slug);
  if (problema) return { erro: problema };
  const [ja] = await banco().select({ id: tenant.id }).from(tenant).where(eq(tenant.slug, r.data.slug));
  if (ja) return { erro: "Já existe um tenant com este endereço." };
  const [t] = await banco().insert(tenant).values(r.data).returning({ id: tenant.id });
  await copiarPerfisPadrao(t.id);
  await auditar(a.usuario.id, "tenant.criado", t.id, { slug: r.data.slug });
  return { id: t.id };
}

export type TenantDetalhe = TenantResumo & {
  administradores: number;
  convitesPendentes: { email: string; nome: string; expiraEm: Date }[];
};

/** Detalhe do tenant no console. Acesso a dados de tenant pelo console é auditado. */
export async function obterTenant(acesso: Acesso | null, id: string): Promise<TenantDetalhe | null> {
  const a = exigirConsole(acesso);
  if (!z.uuid().safeParse(id).success) return null;
  const [t] = await banco()
    .select({
      id: tenant.id,
      slug: tenant.slug,
      nome: tenant.nome,
      criadoEm: tenant.criadoEm,
      suspensoEm: tenant.suspensoEm,
    })
    .from(tenant)
    .where(eq(tenant.id, id));
  if (!t) return null;
  const { administradores, convitesPendentes } = await comTenant(t.id, async (tx) => ({
    administradores: (
      await tx
        .select({ id: vinculoTenant.id })
        .from(vinculoTenant)
        .where(and(eq(vinculoTenant.administrador, true), eq(vinculoTenant.situacao, "ativo")))
    ).length,
    convitesPendentes: await tx
      .select({ email: convite.email, nome: convite.nome, expiraEm: convite.expiraEm })
      .from(convite)
      .where(and(eq(convite.administrador, true), isNull(convite.aceitoEm)))
      .orderBy(desc(convite.criadoEm)),
  }));
  await auditar(a.usuario.id, "tenant.consultado", t.id);
  return { ...t, administradores, convitesPendentes };
}

/** O console cadastra os primeiros administradores de cada tenant. */
export async function convidarAdministradorDoTenant(
  acesso: Acesso | null,
  tenantId: string,
  dados: DadosPessoa,
): Promise<{ ok: true } | { erro: string }> {
  const a = exigirConsole(acesso);
  if (!z.uuid().safeParse(tenantId).success) return { erro: "Tenant não encontrado." };
  const [t] = await banco()
    .select({ id: tenant.id, slug: tenant.slug, nome: tenant.nome })
    .from(tenant)
    .where(eq(tenant.id, tenantId));
  if (!t) return { erro: "Tenant não encontrado." };
  const r = await emitirConviteDoTenant(t, { ...dados, administrador: true }, a.usuario.id);
  if ("ok" in r) await auditar(a.usuario.id, "tenant.administrador.convidado", t.id);
  return r;
}

// --- Redefinição de 2FA pela plataforma -------------------------------------------

/** Motivos fixos: a auditoria não guarda texto livre (sem dados pessoais, ADR-0007). */
export const MOTIVOS_DE_REDEFINICAO = {
  "perdeu-aparelho": "Perdeu ou trocou o aparelho e os códigos de recuperação",
  "aparelho-roubado": "Aparelho roubado ou comprometido",
  outro: "Outro motivo (detalhado no atendimento)",
} as const;
export type MotivoDeRedefinicao = keyof typeof MOTIVOS_DE_REDEFINICAO;

/**
 * Redefinição completa do 2FA de qualquer conta (autenticacao-e-sessao.md,
 * "Recuperação"): para quem tem acesso a vários tenants que exigem 2FA. A
 * identidade da pessoa é confirmada antes, fora do sistema.
 */
export async function redefinirDoisFatoresPelaPlataforma(
  acesso: Acesso | null,
  dados: { email: string; motivo: string; identidadeConfirmada: boolean },
): Promise<{ ok: true } | { erro: string }> {
  const a = exigirConsole(acesso);
  if (!dados.identidadeConfirmada) return { erro: "Confirme a identidade da pessoa antes de redefinir." };
  if (!(dados.motivo in MOTIVOS_DE_REDEFINICAO)) return { erro: "Escolha o motivo." };
  const email = dados.email.trim().toLowerCase();
  const [u] = await banco().select({ id: usuario.id }).from(usuario).where(eq(usuario.email, email));
  if (!u) return { erro: "Nenhuma conta com este e-mail." };
  if (u.id === a.usuario.id) return { erro: "Você não pode redefinir o seu próprio 2FA por aqui." };
  await apagarTodosOsFatores(u.id);
  await banco()
    .insert(eventoPlataforma)
    .values({
      tipo: "usuario.2fa.redefinido",
      atorId: a.usuario.id,
      alvoTipo: "usuario",
      alvoId: u.id,
      detalhes: { motivo: dados.motivo },
    });
  await avisarMudancaNosFatores(
    u.id,
    "A verificação em duas etapas da sua conta foi redefinida pelo suporte da plataforma",
    "console da plataforma",
  );
  return { ok: true };
}

// --- Edição e suspensão do tenant ---------------------------------------------------

/** Só o nome muda; o endereço é fixo depois de criado (perfis-e-permissoes.md). */
export async function renomearTenant(
  acesso: Acesso | null,
  tenantId: string,
  nome: string,
): Promise<{ ok: true } | { erro: string }> {
  const a = exigirConsole(acesso);
  const r = NovoTenant.shape.nome.safeParse(nome);
  if (!r.success) return { erro: r.error.issues[0]?.message ?? "Nome inválido." };
  if (!z.uuid().safeParse(tenantId).success) return { erro: "Tenant não encontrado." };
  const feito = await banco()
    .update(tenant)
    .set({ nome: r.data })
    .where(eq(tenant.id, tenantId))
    .returning({ id: tenant.id });
  if (feito.length === 0) return { erro: "Tenant não encontrado." };
  await auditar(a.usuario.id, "tenant.renomeado", tenantId);
  return { ok: true };
}

/** Suspensão: ninguém do tenant entra, sessões encerradas na hora; dados preservados. */
export async function definirSuspensao(
  acesso: Acesso | null,
  tenantId: string,
  suspender: boolean,
): Promise<{ ok: true } | { erro: string }> {
  const a = exigirConsole(acesso);
  if (!z.uuid().safeParse(tenantId).success) return { erro: "Tenant não encontrado." };
  const feito = await banco()
    .update(tenant)
    .set({ suspensoEm: suspender ? new Date() : null })
    .where(eq(tenant.id, tenantId))
    .returning({ id: tenant.id });
  if (feito.length === 0) return { erro: "Tenant não encontrado." };
  if (suspender)
    await banco()
      .delete(sessao)
      .where(eq(sessao.area, `tenant:${tenantId}`));
  await auditar(a.usuario.id, suspender ? "tenant.suspenso" : "tenant.reativado", tenantId);
  return { ok: true };
}

// --- Equipe da RGRUBER (usuários da plataforma) ----------------------------------------

export type EquipeDaPlataforma = {
  usuarios: { id: string; nome: string; email: string; ehVoce: boolean }[];
  convites: { id: string; nome: string; email: string; expiraEm: Date }[];
};

export async function listarEquipe(acesso: Acesso | null): Promise<EquipeDaPlataforma> {
  const a = exigirConsole(acesso);
  const usuarios = await banco()
    .select({ id: usuario.id, nome: usuario.name, email: usuario.email })
    .from(usuario)
    .where(eq(usuario.papelPlataforma, "admin"))
    .orderBy(usuario.name);
  const convites = await banco()
    .select({
      id: convitePlataforma.id,
      nome: convitePlataforma.nome,
      email: convitePlataforma.email,
      expiraEm: convitePlataforma.expiraEm,
    })
    .from(convitePlataforma)
    .where(and(isNull(convitePlataforma.aceitoEm), gt(convitePlataforma.expiraEm, new Date())))
    .orderBy(desc(convitePlataforma.criadoEm));
  return { usuarios: usuarios.map((u) => ({ ...u, ehVoce: u.id === a.usuario.id })), convites };
}

export async function convidarParaEquipe(
  acesso: Acesso | null,
  dados: DadosPessoa,
): Promise<{ ok: true } | { erro: string }> {
  const a = exigirConsole(acesso);
  const email = String(dados.email ?? "")
    .trim()
    .toLowerCase();
  const [ja] = await banco()
    .select({ id: usuario.id })
    .from(usuario)
    .where(and(eq(usuario.email, email), eq(usuario.papelPlataforma, "admin")));
  if (ja) return { erro: "Esta pessoa já faz parte da equipe." };
  // Um convite novo substitui o pendente para o mesmo e-mail.
  await banco()
    .update(convitePlataforma)
    .set({ expiraEm: new Date() })
    .where(and(eq(convitePlataforma.email, email), isNull(convitePlataforma.aceitoEm)));
  return convidarUsuarioDaPlataforma(dados, a.usuario.id);
}

export async function cancelarConviteDaEquipe(
  acesso: Acesso | null,
  conviteId: string,
): Promise<{ ok: true } | { erro: string }> {
  const a = exigirConsole(acesso);
  if (!z.uuid().safeParse(conviteId).success) return { erro: "Convite não encontrado." };
  const feito = await banco()
    .update(convitePlataforma)
    .set({ expiraEm: new Date() })
    .where(and(eq(convitePlataforma.id, conviteId), isNull(convitePlataforma.aceitoEm)))
    .returning({ id: convitePlataforma.id });
  if (feito.length === 0) return { erro: "Convite não encontrado." };
  await banco().insert(eventoPlataforma).values({
    tipo: "convite.plataforma.cancelado",
    atorId: a.usuario.id,
    alvoTipo: "convite_plataforma",
    alvoId: conviteId,
  });
  return { ok: true };
}

/** Remove o acesso ao console na hora; nunca o próprio, nunca o último. */
export async function removerDaEquipe(
  acesso: Acesso | null,
  usuarioId: string,
): Promise<{ ok: true } | { erro: string }> {
  const a = exigirConsole(acesso);
  if (!z.uuid().safeParse(usuarioId).success) return { erro: "Usuário não encontrado." };
  if (usuarioId === a.usuario.id) return { erro: "Você não pode remover o seu próprio acesso." };
  const equipe = await banco()
    .select({ id: usuario.id })
    .from(usuario)
    .where(eq(usuario.papelPlataforma, "admin"));
  if (!equipe.some((u) => u.id === usuarioId)) return { erro: "Usuário não encontrado." };
  if (equipe.length <= 1) return { erro: "O console precisa de pelo menos um usuário." };
  await banco().update(usuario).set({ papelPlataforma: null }).where(eq(usuario.id, usuarioId));
  await banco()
    .delete(sessao)
    .where(and(eq(sessao.userId, usuarioId), eq(sessao.area, "console")));
  await banco().insert(eventoPlataforma).values({
    tipo: "plataforma.usuario.removido",
    atorId: a.usuario.id,
    alvoTipo: "usuario",
    alvoId: usuarioId,
  });
  return { ok: true };
}
