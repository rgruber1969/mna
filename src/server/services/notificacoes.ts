import { and, count, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { comTenant, type Banco } from "@/server/db/cliente";
import { notificacao } from "@/server/db/esquema";
import { exigirTenant, type Acesso } from "./acesso";

/**
 * Notificações do usuário no tenant (sino do cabeçalho). Cada pessoa só vê e
 * mexe nas suas. Os serviços que geram eventos chamam `notificar`; o texto
 * vem dos arquivos de mensagens pelo `tipo` (ADR-0020).
 */

/** Tipos existentes (cada um tem texto em `notificacoes.tipos.<tipo>` nas mensagens). */
export const TIPOS_DE_NOTIFICACAO = [
  "convite_aceito",
  "perfil_alterado",
  "dois_fatores_redefinido",
  "arquivo_bloqueado",
] as const;
export type TipoDeNotificacao = (typeof TIPOS_DE_NOTIFICACAO)[number];

type Tx = Parameters<Parameters<Banco["transaction"]>[0]>[0];

export type Notificacao = {
  id: string;
  tipo: TipoDeNotificacao;
  parametros: Record<string, string>;
  link: string | null;
  lida: boolean;
  criadoEm: Date;
};

/** Cria uma notificação (dentro da transação de quem gerou o evento). */
export async function notificar(
  tx: Tx,
  tenantId: string,
  usuarioId: string,
  tipo: TipoDeNotificacao,
  parametros: Record<string, string> = {},
  link: string | null = null,
): Promise<void> {
  await tx.insert(notificacao).values({ tenantId, usuarioId, tipo, parametros, link });
}

/** As mais recentes e o total de não lidas (sino). */
export async function minhasNotificacoes(
  acesso: Acesso | null,
  limite = 10,
): Promise<{ itens: Notificacao[]; naoLidas: number }> {
  const a = exigirTenant(acesso);
  return comTenant(a.tenant.id, async (tx) => {
    const minhas = eq(notificacao.usuarioId, a.usuario.id);
    const linhas = await tx
      .select()
      .from(notificacao)
      .where(minhas)
      .orderBy(desc(notificacao.criadoEm))
      .limit(Math.min(Math.max(limite, 1), 200));
    const [{ n }] = await tx
      .select({ n: count() })
      .from(notificacao)
      .where(and(minhas, isNull(notificacao.lidaEm)));
    return {
      itens: linhas.map((l) => ({
        id: l.id,
        tipo: l.tipo as TipoDeNotificacao,
        parametros: l.parametros,
        link: l.link,
        lida: Boolean(l.lidaEm),
        criadoEm: l.criadoEm,
      })),
      naoLidas: n,
    };
  });
}

export async function marcarTodasComoLidas(acesso: Acesso | null): Promise<void> {
  const a = exigirTenant(acesso);
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(notificacao)
      .set({ lidaEm: new Date() })
      .where(and(eq(notificacao.usuarioId, a.usuario.id), isNull(notificacao.lidaEm))),
  );
}

/** Remove uma notificação da própria pessoa. */
export async function removerNotificacao(acesso: Acesso | null, id: string): Promise<void> {
  const a = exigirTenant(acesso);
  if (!z.uuid().safeParse(id).success) return;
  await comTenant(a.tenant.id, (tx) =>
    tx.delete(notificacao).where(and(eq(notificacao.id, id), eq(notificacao.usuarioId, a.usuario.id))),
  );
}
