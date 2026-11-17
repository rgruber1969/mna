import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { twoFactor } from "better-auth/plugins/two-factor";
import { passkey } from "@better-auth/passkey";
import type { BetterAuthPlugin } from "better-auth";
import { and, eq } from "drizzle-orm";
import { produto } from "@/config/produto";
import { banco, comTenant } from "@/server/db/cliente";
import {
  conta,
  chaveDeAcesso,
  doisFatores,
  limiteTentativas,
  sessao,
  tenant,
  usuario,
  verificacao,
  vinculoTenant,
} from "@/server/db/esquema";
import { enviarEmail } from "@/server/email/enviar";
import { dominio, hostsPermitidos, protocolo, resolverArea } from "@/server/enderecos";

/**
 * Autenticação (ADR-0005, ADR-0019): o Better Auth cuida só de identidade e
 * sessão. Vínculos, convites e permissões ficam na camada de serviços.
 * Políticas: docs/projeto/autenticacao-e-sessao.md.
 */

export const SESSAO_INATIVIDADE_S = 60 * 60; // saída após 1 h sem uso
export const SESSAO_DURACAO_MAXIMA_S = 8 * 60 * 60; // novo login após 8 h
export const SENHA_TAMANHO_MINIMO = 12;
export const LINK_MAGICO_VALIDADE_S = 10 * 60; // 10 min, uso único

/** Caminhos que concluem um login com dois fatores (política: autenticacao-e-sessao.md). */
const CAMINHOS_COM_DOIS_FATORES = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/passkey/verify-authentication",
]);

type ContextoHook = { headers?: Headers; request?: Request; path?: string } | null | undefined;

function hostDoContexto(ctx: ContextoHook): string | null {
  return ctx?.headers?.get("host") ?? ctx?.request?.headers.get("host") ?? null;
}

/**
 * Área gravada na sessão (ADR-0019, regra 7), ou null se a conta não pode
 * entrar neste endereço: console exige papel de plataforma; tenant exige
 * vínculo ativo.
 */
export async function areaPermitida(host: string | null, usuarioId: string): Promise<string | null> {
  const area = resolverArea(host);
  const db = banco();
  if (area.tipo === "console") {
    const [u] = await db
      .select({ papel: usuario.papelPlataforma })
      .from(usuario)
      .where(eq(usuario.id, usuarioId));
    return u?.papel === "admin" ? "console" : null;
  }
  if (area.tipo === "tenant") {
    const [t] = await db.select({ id: tenant.id }).from(tenant).where(eq(tenant.slug, area.slug));
    if (!t) return null;
    const [v] = await comTenant(t.id, (tx) =>
      tx
        .select({ id: vinculoTenant.id })
        .from(vinculoTenant)
        .where(and(eq(vinculoTenant.usuarioId, usuarioId), eq(vinculoTenant.situacao, "ativo"))),
    );
    return v ? `tenant:${t.id}` : null;
  }
  return null;
}

const doisFatoresPlugin = twoFactor({ issuer: produto.nome, backupCodeOptions: { amount: 10 } });

/**
 * O plugin de 2FA só intercepta o login com senha. Este plugin aplica a mesma
 * etapa ao link mágico: quem tem autenticador precisa do código depois do
 * link (política 1A). Teste: acesso.test.ts ("link mágico exige 2FA").
 */
const doisFatoresNoLinkMagico = {
  id: "dois-fatores-no-link-magico",
  hooks: {
    after: [
      {
        matcher: (c: { path?: string }) => c.path === "/magic-link/verify",
        handler: doisFatoresPlugin.hooks.after[0].handler,
      },
    ],
  },
} satisfies BetterAuthPlugin;

/** Passkeys: no localhost, presas ao subdomínio; fora dele, valem em todo o domínio (ADR-0011). */
const hostBase = dominio().split(":")[0];
const rpID = hostBase === "localhost" ? undefined : hostBase;

export const auth = betterAuth({
  appName: produto.nome,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: { allowedHosts: hostsPermitidos(), protocol: protocolo() },
  // Só o próprio endereço da requisição é origem confiável (sem cruzar tenants).
  trustedOrigins: async (request) => {
    const host = request?.headers.get("host");
    return host && resolverArea(host).tipo !== "invalido" ? [`${protocolo()}://${host}`] : [];
  },
  database: drizzleAdapter(banco(), {
    provider: "pg",
    schema: {
      user: usuario,
      session: sessao,
      account: conta,
      verification: verificacao,
      twoFactor: doisFatores,
      passkey: chaveDeAcesso,
      rateLimit: limiteTentativas,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // cadastro só por convite
    minPasswordLength: SENHA_TAMANHO_MINIMO,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  user: {
    additionalFields: { papelPlataforma: { type: "string", required: false, input: false } },
  },
  session: {
    expiresIn: SESSAO_INATIVIDADE_S,
    updateAge: 5 * 60, // renova a validade a cada 5 min de uso
    freshAge: 10 * 60,
    additionalFields: {
      area: { type: "string", required: true, input: false },
      segundoFator: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 100 },
  advanced: {
    database: { generateId: "uuid" },
    cookiePrefix: "app",
    useSecureCookies: protocolo() === "https",
    // Cookies restritos ao host (sem Domain): ADR-0011, regra 3.
  },
  telemetry: { enabled: false },
  databaseHooks: {
    session: {
      create: {
        before: async (dados, ctx) => {
          const area = await areaPermitida(hostDoContexto(ctx as ContextoHook), dados.userId);
          if (!area) return false;
          const segundoFator = CAMINHOS_COM_DOIS_FATORES.has((ctx as ContextoHook)?.path ?? "");
          return { data: { ...dados, area, segundoFator } };
        },
      },
    },
  },
  plugins: [
    doisFatoresPlugin,
    magicLink({
      expiresIn: LINK_MAGICO_VALIDADE_S,
      disableSignUp: true, // cadastro só por convite
      storeToken: "hashed",
      // Só envia se a conta pode entrar neste endereço; a resposta é sempre a mesma.
      sendMagicLink: async ({ email, token }, ctx) => {
        const host = hostDoContexto(ctx as ContextoHook);
        const [u] = await banco()
          .select({ id: usuario.id, nome: usuario.name })
          .from(usuario)
          .where(eq(usuario.email, email));
        if (!u || !(await areaPermitida(host, u.id))) return;
        await enviarEmail({
          para: email,
          assunto: `Seu link de acesso ao ${produto.nome}`,
          texto: [
            `Olá, ${u.nome}.`,
            "",
            "Use o link abaixo para entrar. Ele vale por 10 minutos e só uma vez:",
            `${protocolo()}://${host}/link/${encodeURIComponent(token)}`,
            "",
            "Se não foi você que pediu, ignore este e-mail: sua conta continua protegida.",
          ].join("\n"),
        });
      },
    }),
    doisFatoresNoLinkMagico,
    passkey({
      rpID,
      rpName: produto.nome,
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    }),
    nextCookies(), // precisa ser o último plugin
  ],
});

export type SessaoAuth = typeof auth.$Infer.Session;
