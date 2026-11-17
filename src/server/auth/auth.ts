import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { and, eq } from "drizzle-orm";
import { produto } from "@/config/produto";
import { banco, comTenant } from "@/server/db/cliente";
import {
  conta,
  doisFatores,
  limiteTentativas,
  sessao,
  tenant,
  usuario,
  verificacao,
  vinculoTenant,
} from "@/server/db/esquema";
import { hostsPermitidos, protocolo, resolverArea } from "@/server/enderecos";

/**
 * Autenticação (ADR-0005, ADR-0019): o Better Auth cuida só de identidade e
 * sessão. Vínculos, convites e permissões ficam na camada de serviços.
 * Políticas: docs/projeto/autenticacao-e-sessao.md.
 */

export const SESSAO_INATIVIDADE_S = 60 * 60; // saída após 1 h sem uso
export const SESSAO_DURACAO_MAXIMA_S = 8 * 60 * 60; // novo login após 8 h
export const SENHA_TAMANHO_MINIMO = 12;

type ContextoHook = { headers?: Headers; request?: Request } | null | undefined;

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
    additionalFields: { area: { type: "string", required: true, input: false } },
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
          return { data: { ...dados, area } };
        },
      },
    },
  },
  plugins: [
    twoFactor({ issuer: produto.nome, backupCodeOptions: { amount: 10 } }),
    nextCookies(), // precisa ser o último plugin
  ],
});

export type SessaoAuth = typeof auth.$Infer.Session;
