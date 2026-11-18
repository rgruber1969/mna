import { and, eq, inArray } from "drizzle-orm";
import type { comTenant } from "@/server/db/cliente";
import { perfil, perfilUsuario } from "@/server/db/esquema";

/**
 * Regra "por perfil" da exigência de 2FA (autenticacao-e-sessao.md): quem tem
 * algum perfil do tenant marcado "exige 2FA". Soma-se às demais regras
 * (administrador, todos do tenant, marcação individual).
 */
type Transacao = Parameters<Parameters<typeof comTenant>[1]>[0];

export async function exigidosPorPerfil(tx: Transacao, usuarioIds: string[]): Promise<Set<string>> {
  if (usuarioIds.length === 0) return new Set();
  const r = await tx
    .select({ usuarioId: perfilUsuario.usuarioId })
    .from(perfilUsuario)
    .innerJoin(perfil, eq(perfil.id, perfilUsuario.perfilId))
    .where(
      and(
        inArray(perfilUsuario.usuarioId, usuarioIds),
        eq(perfil.camada, "tenant"),
        eq(perfil.exigeDoisFatores, true),
      ),
    );
  return new Set(r.map((x) => x.usuarioId));
}
