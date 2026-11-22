import { eq } from "drizzle-orm";
import { banco } from "@/server/db/cliente";
import { usuario } from "@/server/db/esquema";
import type { Acesso } from "./acesso";

/**
 * Preferências da própria conta, válidas no console e em todos os tenants
 * (a conta é única: ADR-0019). Só a própria pessoa altera.
 */

export const TEMAS = ["claro", "escuro", "sistema"] as const;
export type Tema = (typeof TEMAS)[number];

/** Menu lateral no tema oposto ao da tela (preferência da conta). */
export async function definirMenuInvertido(
  acesso: Acesso | null,
  ligado: boolean,
): Promise<{ ok: true } | { erro: string }> {
  if (!acesso) return { erro: "acesso.erros.temaEntreDeNovo" };
  await banco()
    .update(usuario)
    .set({ menuInvertido: ligado, updatedAt: new Date() })
    .where(eq(usuario.id, acesso.usuario.id));
  return { ok: true };
}

export async function definirTema(
  acesso: Acesso | null,
  tema: string,
): Promise<{ ok: true } | { erro: string }> {
  if (!acesso) return { erro: "acesso.erros.temaEntreDeNovo" };
  if (!(TEMAS as readonly string[]).includes(tema)) return { erro: "acesso.erros.temaInvalido" };
  await banco()
    .update(usuario)
    .set({ tema: tema as Tema, updatedAt: new Date() })
    .where(eq(usuario.id, acesso.usuario.id));
  return { ok: true };
}
