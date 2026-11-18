import { and, eq } from "drizzle-orm";
import { banco, comTenant } from "@/server/db/cliente";
import { chaveDeAcesso, doisFatores, sessao, tenant, usuario, vinculoTenant } from "@/server/db/esquema";
import { exigidosPorPerfil } from "./exigencia-2fa";
import { enviarEmail } from "@/server/email/enviar";
import { montarEmail } from "@/server/email/modelo";
import { marcaParaEmail } from "./marca";
import { produto } from "@/config/produto";

/**
 * Fatores de autenticação da conta (ADR-0019: os fatores são da conta e valem
 * em todos os tenants). Regras de recuperação: autenticacao-e-sessao.md.
 * Uso interno da camada de serviços; quem chama confere a permissão.
 */

export type FatoresDaConta = {
  autenticador: boolean;
  passkeys: { id: string; nome: string | null; criadoEm: Date | null }[];
};

export async function fatoresDaConta(usuarioId: string): Promise<FatoresDaConta> {
  const [u] = await banco()
    .select({ autenticador: usuario.twoFactorEnabled })
    .from(usuario)
    .where(eq(usuario.id, usuarioId));
  const passkeys = await banco()
    .select({ id: chaveDeAcesso.id, nome: chaveDeAcesso.name, criadoEm: chaveDeAcesso.createdAt })
    .from(chaveDeAcesso)
    .where(eq(chaveDeAcesso.userId, usuarioId))
    .orderBy(chaveDeAcesso.createdAt);
  return { autenticador: Boolean(u?.autenticador), passkeys };
}

export function quantidadeDeFatores(f: FatoresDaConta): number {
  return f.passkeys.length + (f.autenticador ? 1 : 0);
}

/** Encerra as sessões da pessoa: todas, ou só as de uma área ("console", "tenant:<id>"). */
export async function encerrarSessoes(usuarioId: string, area?: string): Promise<void> {
  await banco()
    .delete(sessao)
    .where(area ? and(eq(sessao.userId, usuarioId), eq(sessao.area, area)) : eq(sessao.userId, usuarioId));
}

export async function removerPasskeyDaConta(usuarioId: string, passkeyId: string): Promise<boolean> {
  const r = await banco()
    .delete(chaveDeAcesso)
    .where(and(eq(chaveDeAcesso.id, passkeyId), eq(chaveDeAcesso.userId, usuarioId)))
    .returning({ id: chaveDeAcesso.id });
  return r.length > 0;
}

export async function removerAutenticadorDaConta(usuarioId: string): Promise<void> {
  await banco().delete(doisFatores).where(eq(doisFatores.userId, usuarioId));
  await banco().update(usuario).set({ twoFactorEnabled: false }).where(eq(usuario.id, usuarioId));
}

/** Redefinição completa: apaga autenticador, códigos de recuperação e passkeys; encerra as sessões. */
export async function apagarTodosOsFatores(usuarioId: string): Promise<void> {
  await removerAutenticadorDaConta(usuarioId);
  await banco().delete(chaveDeAcesso).where(eq(chaveDeAcesso.userId, usuarioId));
  await encerrarSessoes(usuarioId);
}

/**
 * Algum tenant além de `tenantIdIgnorado` (ou o console) exige 2FA desta pessoa? Consulta
 * tenant por tenant, sempre dentro do RLS (sem privilégio para cruzar
 * tenants). Devolve só sim/não: nada sobre quais tenants.
 */
export async function outroTenantExigeDoisFatores(
  usuarioId: string,
  tenantIdIgnorado: string | null,
): Promise<boolean> {
  // O console sempre exige 2FA: conta da plataforma conta como "outro lugar que exige".
  const [u] = await banco()
    .select({ papel: usuario.papelPlataforma })
    .from(usuario)
    .where(eq(usuario.id, usuarioId));
  if (u?.papel === "admin") return true;
  const tenants = await banco()
    .select({ id: tenant.id, deTodos: tenant.exigeDoisFatoresDeTodos })
    .from(tenant);
  for (const t of tenants) {
    if (t.id === tenantIdIgnorado) continue;
    const exige = await comTenant(t.id, async (tx) => {
      const [v] = await tx
        .select({ administrador: vinculoTenant.administrador, exige: vinculoTenant.exigeDoisFatores })
        .from(vinculoTenant)
        .where(and(eq(vinculoTenant.usuarioId, usuarioId), eq(vinculoTenant.situacao, "ativo")));
      if (!v) return false;
      return (
        v.administrador || v.exige || t.deTodos || (await exigidosPorPerfil(tx, [usuarioId])).has(usuarioId)
      );
    });
    if (exige) return true;
  }
  return false;
}

/** Avisa a pessoa por e-mail sobre mudança nos fatores da conta (sem detalhes sensíveis). */
export async function avisarMudancaNosFatores(
  usuarioId: string,
  oQue: string,
  onde: string,
  tenantId?: string,
): Promise<void> {
  const [u] = await banco()
    .select({ nome: usuario.name, email: usuario.email })
    .from(usuario)
    .where(eq(usuario.id, usuarioId));
  if (!u) return;
  await enviarEmail(
    montarEmail({
      para: u.email,
      assunto: `Mudança na segurança da sua conta no ${produto.nome}`,
      saudacao: `Olá, ${u.nome}.`,
      paragrafos: [
        `${oQue} (${onde}).`,
        "Suas sessões abertas foram encerradas. No próximo acesso, se a verificação em duas etapas for exigida, você vai configurá-la de novo.",
      ],
      rodape: "Se você não pediu esta mudança, avise o administrador imediatamente.",
      marca: tenantId ? await marcaParaEmail(tenantId) : null,
    }),
  );
}
