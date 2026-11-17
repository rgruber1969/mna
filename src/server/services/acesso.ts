import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { auth, SESSAO_DURACAO_MAXIMA_S } from "@/server/auth/auth";
import { banco, comTenant } from "@/server/db/cliente";
import { eventoAuditoria, eventoPlataforma, sessao, tenant, vinculoTenant } from "@/server/db/esquema";
import { resolverArea } from "@/server/enderecos";

/**
 * Acesso e sessão (ADR-0011, ADR-0019; docs/projeto/autenticacao-e-sessao.md).
 * Toda tela e rota protegida obtém o acesso por `obterAcesso`, que confere:
 * área do endereço, área gravada na sessão, duração máxima, sessão única por
 * endereço e vínculo/papel ainda válidos.
 */

export type UsuarioDoAcesso = { id: string; nome: string; email: string; doisFatoresAtivo: boolean };
export type TenantDoAcesso = { id: string; slug: string; nome: string };

export type Acesso =
  | { area: "console"; usuario: UsuarioDoAcesso; sessaoId: string }
  | {
      area: "tenant";
      tenant: TenantDoAcesso;
      usuario: UsuarioDoAcesso;
      administrador: boolean;
      sessaoId: string;
    };

export class AcessoNegado extends Error {
  constructor() {
    super("Acesso negado.");
  }
}

/** Mensagem única para falhas de login: não revela se a conta existe (ADR-0019, regra 5). */
export const ERRO_LOGIN = "E-mail ou senha inválidos, ou acesso não permitido neste endereço.";

export function gerarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDoToken(token) };
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function tenantPorSlug(slug: string): Promise<TenantDoAcesso | null> {
  const [t] = await banco()
    .select({ id: tenant.id, slug: tenant.slug, nome: tenant.nome })
    .from(tenant)
    .where(eq(tenant.slug, slug));
  return t ?? null;
}

async function revogarSessao(id: string): Promise<void> {
  await banco().delete(sessao).where(eq(sessao.id, id));
}

export async function obterAcesso(headers: Headers): Promise<Acesso | null> {
  const area = resolverArea(headers.get("host"));
  if (area.tipo !== "console" && area.tipo !== "tenant") return null;

  const atual = await auth.api.getSession({ headers });
  if (!atual) return null;
  const { session: s, user: u } = atual;

  // Regra 7: a sessão só vale na área onde nasceu.
  const t = area.tipo === "tenant" ? await tenantPorSlug(area.slug) : null;
  const areaEsperada = area.tipo === "console" ? "console" : t ? `tenant:${t.id}` : null;
  if (!areaEsperada || s.area !== areaEsperada) return null;

  // Duração máxima (8 h), independentemente do uso.
  if (Date.now() - new Date(s.createdAt).getTime() > SESSAO_DURACAO_MAXIMA_S * 1000) {
    await revogarSessao(s.id);
    return null;
  }

  // Regra 8: só a sessão mais recente do usuário neste endereço vale.
  const [maisRecente] = await banco()
    .select({ id: sessao.id })
    .from(sessao)
    .where(and(eq(sessao.userId, u.id), eq(sessao.area, s.area)))
    .orderBy(desc(sessao.createdAt))
    .limit(1);
  if (maisRecente?.id !== s.id) {
    await revogarSessao(s.id);
    return null;
  }

  const usuario: UsuarioDoAcesso = {
    id: u.id,
    nome: u.name,
    email: u.email,
    doisFatoresAtivo: Boolean(u.twoFactorEnabled),
  };

  if (area.tipo === "console") {
    if (u.papelPlataforma !== "admin") return null;
    return { area: "console", usuario, sessaoId: s.id };
  }

  const [v] = await comTenant(t!.id, (tx) =>
    tx
      .select({ administrador: vinculoTenant.administrador })
      .from(vinculoTenant)
      .where(and(eq(vinculoTenant.usuarioId, u.id), eq(vinculoTenant.situacao, "ativo"))),
  );
  if (!v) {
    await revogarSessao(s.id);
    return null;
  }
  return { area: "tenant", tenant: t!, usuario, administrador: v.administrador, sessaoId: s.id };
}

// --- Login, segundo fator e saída ------------------------------------------

export type ResultadoLogin = { etapa: "concluido" } | { etapa: "dois-fatores" } | { erro: string };

export async function registrarEntrada(headers: Headers, usuarioId: string, metodo: string): Promise<void> {
  const area = resolverArea(headers.get("host"));
  if (area.tipo === "console") {
    await banco()
      .insert(eventoPlataforma)
      .values({ tipo: "sessao.entrada", atorId: usuarioId, detalhes: { metodo } });
  } else if (area.tipo === "tenant") {
    const t = await tenantPorSlug(area.slug);
    if (t)
      await comTenant(t.id, (tx) =>
        tx
          .insert(eventoAuditoria)
          .values({ tenantId: t.id, tipo: "sessao.entrada", atorId: usuarioId, detalhes: { metodo } }),
      );
  }
}

export async function entrar(
  dados: { email: string; senha: string },
  headers: Headers,
): Promise<ResultadoLogin> {
  try {
    const r = await auth.api.signInEmail({
      body: { email: dados.email.trim().toLowerCase(), password: dados.senha },
      headers,
    });
    if ("twoFactorRedirect" in r && r.twoFactorRedirect) return { etapa: "dois-fatores" };
    if ("user" in r && r.user) await registrarEntrada(headers, r.user.id, "senha");
    return { etapa: "concluido" };
  } catch {
    return { erro: ERRO_LOGIN };
  }
}

export async function verificarSegundoFator(
  dados: { codigo: string; recuperacao?: boolean },
  headers: Headers,
): Promise<ResultadoLogin> {
  try {
    const codigo = dados.codigo.replace(/\s/g, "");
    const r = dados.recuperacao
      ? await auth.api.verifyBackupCode({ body: { code: codigo }, headers })
      : await auth.api.verifyTOTP({ body: { code: codigo }, headers });
    await registrarEntrada(
      headers,
      r.user.id,
      dados.recuperacao ? "senha+recuperacao" : "senha+autenticador",
    );
    return { etapa: "concluido" };
  } catch {
    return { erro: "Código inválido ou expirado. Entre novamente se o problema continuar." };
  }
}

export async function sair(headers: Headers): Promise<void> {
  try {
    await auth.api.signOut({ headers });
  } catch {
    // Sessão já encerrada: nada a fazer.
  }
}

// --- Configuração do aplicativo autenticador --------------------------------

export async function iniciarAutenticador(
  senha: string,
  headers: Headers,
): Promise<{ uri: string; codigosRecuperacao: string[] } | { erro: string }> {
  try {
    const r = await auth.api.enableTwoFactor({ body: { password: senha }, headers });
    if (r.method !== "totp") return { erro: "Método de 2FA não suportado." };
    return { uri: r.totpURI, codigosRecuperacao: r.backupCodes };
  } catch {
    return { erro: "Senha incorreta." };
  }
}

export async function confirmarAutenticador(
  codigo: string,
  headers: Headers,
): Promise<{ ok: true } | { erro: string }> {
  try {
    const r = await auth.api.verifyTOTP({ body: { code: codigo.replace(/\s/g, "") }, headers });
    await registrarEntrada(headers, r.user.id, "autenticador-configurado");
    return { ok: true };
  } catch {
    return { erro: "Código inválido. Confira o horário do celular e tente de novo." };
  }
}
