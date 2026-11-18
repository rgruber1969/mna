import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";

/**
 * Entrada de desenvolvimento: só e-mail, para agilizar testes locais
 * (docs/projeto/autenticacao-e-sessao.md, "Entrada de desenvolvimento").
 *
 * Três travas, todas obrigatórias:
 * 1. `DEV_ENTRAR_SO_COM_EMAIL=sim` no .env (desligada por padrão);
 * 2. fora de produção (`NODE_ENV !== "production"`);
 * 3. só em endereços `*.localhost`.
 * Além disso, a aplicação recusa iniciar em produção com a marcação ligada
 * (instrumentation.ts).
 */

export const CAMINHO_ENTRADA_DE_DESENVOLVIMENTO = "/dev/entrar";

export function entradaDeDesenvolvimentoLigada(): boolean {
  return process.env.DEV_ENTRAR_SO_COM_EMAIL === "sim" && process.env.NODE_ENV !== "production";
}

/** O endereço é local (`localhost` ou `*.localhost`, com ou sem porta)? */
export function hostLocal(host: string | null | undefined): boolean {
  const nome = (host ?? "").split(":")[0].toLowerCase();
  return nome === "localhost" || nome.endsWith(".localhost");
}

/** Recusa iniciar em produção com a entrada de desenvolvimento ligada. */
export function conferirEntradaDeDesenvolvimento(): void {
  if (process.env.NODE_ENV === "production" && process.env.DEV_ENTRAR_SO_COM_EMAIL === "sim")
    throw new Error(
      "DEV_ENTRAR_SO_COM_EMAIL está ligada em produção. Remova a variável: ela só vale no ambiente local.",
    );
}

const Corpo = z.object({ email: z.string().trim().toLowerCase() });

export const entradaDeDesenvolvimento = {
  id: "entrada-de-desenvolvimento",
  endpoints: {
    entrarSoComEmail: createAuthEndpoint(
      CAMINHO_ENTRADA_DE_DESENVOLVIMENTO,
      { method: "POST", body: Corpo, requireHeaders: true },
      async (ctx) => {
        const negar = () => ctx.json({ ok: false, usuarioId: null as string | null }, { status: 403 });
        if (!entradaDeDesenvolvimentoLigada() || !hostLocal(ctx.headers?.get("host"))) return negar();
        const achado = await ctx.context.internalAdapter.findUserByEmail(ctx.body.email);
        if (!achado?.user) return negar();
        // A área (vínculo, tenant suspenso, papel do console) é conferida no
        // hook de criação de sessão, como em qualquer entrada.
        const session = await ctx.context.internalAdapter.createSession(achado.user.id).catch(() => null);
        if (!session) return negar();
        await setSessionCookie(ctx, { session, user: achado.user });
        return ctx.json({ ok: true, usuarioId: achado.user.id as string | null });
      },
    ),
  },
} satisfies BetterAuthPlugin;
