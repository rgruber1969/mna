import { and, gt, inArray, isNull } from "drizzle-orm";
import type { Banco } from "@/server/db/cliente";
import { convite } from "@/server/db/esquema";

/**
 * Situação de acesso das pessoas do tenant ao sistema (usado nas telas de
 * empresas e pessoas para mostrar quem é usuário e oferecer o convite).
 */

export type Tx = Parameters<Parameters<Banco["transaction"]>[0]>[0];

/** Situação de acesso da pessoa ao sistema: usuária, convidada (convite válido) ou sem acesso. */
export type SituacaoDeAcesso = "usuario" | "convidado" | "sem-acesso";

export async function situacoes(
  tx: Tx,
  pessoas: { id: string; usuarioId: string | null; email: string | null }[],
): Promise<Map<string, SituacaoDeAcesso>> {
  const emails = pessoas.filter((p) => !p.usuarioId && p.email).map((p) => p.email!);
  const convidados = emails.length
    ? new Set(
        (
          await tx
            .select({ email: convite.email })
            .from(convite)
            .where(
              and(inArray(convite.email, emails), isNull(convite.aceitoEm), gt(convite.expiraEm, new Date())),
            )
        ).map((c) => c.email.toLowerCase()),
      )
    : new Set<string>();
  return new Map(
    pessoas.map((p) => [
      p.id,
      p.usuarioId ? "usuario" : p.email && convidados.has(p.email) ? "convidado" : "sem-acesso",
    ]),
  );
}
