import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { auth, SESSAO_DURACAO_MAXIMA_S } from "@/server/auth/auth";
import { banco, comTenant } from "@/server/db/cliente";
import {
  chaveDeAcesso,
  eventoAuditoria,
  eventoPlataforma,
  sessao,
  tenant,
  vinculoTenant,
} from "@/server/db/esquema";
import { resolverArea } from "@/server/enderecos";
import { exigidosPorPerfil } from "./exigencia-2fa";
import { entradaDeDesenvolvimentoLigada, hostLocal } from "@/server/auth/entrada-de-desenvolvimento";

/**
 * Acesso e sessão (ADR-0011, ADR-0019; docs/projeto/autenticacao-e-sessao.md).
 * Toda tela e rota protegida obtém o acesso por `obterAcesso`, que confere:
 * área do endereço, área gravada na sessão, duração máxima, sessão única por
 * endereço e vínculo/papel ainda válidos.
 */

export type UsuarioDoAcesso = {
  id: string;
  nome: string;
  email: string;
  temAutenticador: boolean;
  temPasskey: boolean;
  /** Tem algum segundo fator configurado (autenticador ou passkey). */
  doisFatoresAtivo: boolean;
};
export type TenantDoAcesso = {
  id: string;
  slug: string;
  nome: string;
  exigeDoisFatoresDeTodos: boolean;
  modoPermissoes: "perfil" | "usuario";
};

export type Acesso =
  | { area: "console"; usuario: UsuarioDoAcesso; sessaoId: string; segundoFatorNaSessao: boolean }
  | {
      area: "tenant";
      tenant: TenantDoAcesso;
      usuario: UsuarioDoAcesso;
      administrador: boolean;
      /** 2FA exigido desta pessoa neste tenant (as regras se somam). */
      exigeDoisFatores: boolean;
      sessaoId: string;
      segundoFatorNaSessao: boolean;
    };

export type AcessoTenant = Extract<Acesso, { area: "tenant" }>;

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

/**
 * Tenant ativo pelo endereço. Tenant suspenso conta como inexistente para
 * sessão e convites (perfis-e-permissoes.md, "Suspensão do tenant").
 */
export async function tenantPorSlug(slug: string): Promise<TenantDoAcesso | null> {
  const [t] = await banco()
    .select({
      id: tenant.id,
      slug: tenant.slug,
      nome: tenant.nome,
      exigeDoisFatoresDeTodos: tenant.exigeDoisFatoresDeTodos,
      modoPermissoes: tenant.modoPermissoes,
    })
    .from(tenant)
    .where(and(eq(tenant.slug, slug), isNull(tenant.suspensoEm)));
  return t ?? null;
}

/** Para a tela de entrada: o endereço é de um tenant suspenso? */
export async function tenantSuspenso(slug: string): Promise<boolean> {
  const [t] = await banco()
    .select({ suspensoEm: tenant.suspensoEm })
    .from(tenant)
    .where(eq(tenant.slug, slug));
  return Boolean(t?.suspensoEm);
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

  const [chave] = await banco()
    .select({ id: chaveDeAcesso.id })
    .from(chaveDeAcesso)
    .where(eq(chaveDeAcesso.userId, u.id))
    .limit(1);
  const temAutenticador = Boolean(u.twoFactorEnabled);
  const usuario: UsuarioDoAcesso = {
    id: u.id,
    nome: u.name,
    email: u.email,
    temAutenticador,
    temPasskey: Boolean(chave),
    doisFatoresAtivo: temAutenticador || Boolean(chave),
  };
  const segundoFatorNaSessao = Boolean(s.segundoFator);

  if (area.tipo === "console") {
    if (u.papelPlataforma !== "admin") return null;
    return { area: "console", usuario, sessaoId: s.id, segundoFatorNaSessao };
  }

  const [v] = await comTenant(t!.id, async (tx) => {
    const vinculos = await tx
      .select({ administrador: vinculoTenant.administrador, exige: vinculoTenant.exigeDoisFatores })
      .from(vinculoTenant)
      .where(and(eq(vinculoTenant.usuarioId, u.id), eq(vinculoTenant.situacao, "ativo")));
    const porPerfil = vinculos.length > 0 && (await exigidosPorPerfil(tx, [u.id])).has(u.id);
    return vinculos.map((x) => ({ ...x, porPerfil }));
  });
  if (!v) {
    await revogarSessao(s.id);
    return null;
  }
  return {
    area: "tenant",
    tenant: t!,
    usuario,
    administrador: v.administrador,
    // Regras somadas: administrador sempre, todos do tenant, perfil ou marcação individual.
    exigeDoisFatores: v.administrador || t!.exigeDoisFatoresDeTodos || v.porPerfil || v.exige,
    sessaoId: s.id,
    segundoFatorNaSessao,
  };
}

/**
 * O que falta para a pessoa usar o tenant quando o 2FA é exigido dela:
 * configurar um fator, ou entrar de novo com dois fatores.
 */
export function pendenciaDeDoisFatores(acesso: Acesso): "configurar" | "reentrar" | null {
  const exige = acesso.area === "console" || acesso.exigeDoisFatores;
  if (!exige) return null;
  if (!acesso.usuario.doisFatoresAtivo) return "configurar";
  return acesso.segundoFatorNaSessao ? null : "reentrar";
}

/** Acesso de tenant em dia com a exigência de 2FA. Toda operação de tenant passa por aqui. */
export function exigirTenant(acesso: Acesso | null): AcessoTenant {
  if (acesso?.area !== "tenant" || pendenciaDeDoisFatores(acesso)) throw new AcessoNegado();
  return acesso;
}

/** Administrador do tenant (sempre com sessão de dois fatores). */
export function exigirAdministrador(acesso: Acesso | null): AcessoTenant {
  const a = exigirTenant(acesso);
  if (!a.administrador) throw new AcessoNegado();
  return a;
}

/**
 * Quem já tem um fator só cadastra outro numa sessão aberta com dois fatores;
 * senão, quem descobrisse só a senha cadastraria a própria passkey.
 */
async function podeCadastrarFator(headers: Headers): Promise<boolean> {
  const a = await obterAcesso(headers);
  return Boolean(a && (!a.usuario.doisFatoresAtivo || a.segundoFatorNaSessao));
}

const ENTRE_COM_DOIS_FATORES = "Para cadastrar outro fator, saia e entre de novo com dois fatores.";

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

/** Mostrar a entrada só com e-mail neste endereço? (travas em entrada-de-desenvolvimento.ts) */
export function entradaDeDesenvolvimentoDisponivel(headers: Headers): boolean {
  return entradaDeDesenvolvimentoLigada() && hostLocal(headers.get("host"));
}

/**
 * Entrada de desenvolvimento: só e-mail (autenticacao-e-sessao.md). O
 * endpoint recusa se as três travas não estiverem satisfeitas.
 */
export async function entrarSoComEmail(email: string, headers: Headers): Promise<ResultadoLogin> {
  try {
    const r = await auth.api.entrarSoComEmail({ body: { email }, headers });
    if (!r.ok || !r.usuarioId) return { erro: ERRO_LOGIN };
    await registrarEntrada(headers, r.usuarioId, "desenvolvimento-so-email");
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
  if (!(await podeCadastrarFator(headers))) return { erro: ENTRE_COM_DOIS_FATORES };
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

// --- Link mágico (política 1A: substitui só a senha) --------------------------

/** Pede o link. A resposta é sempre a mesma, exista a conta ou não (ADR-0019, regra 5). */
export async function pedirLinkMagico(email: string, headers: Headers): Promise<{ ok: true }> {
  try {
    await auth.api.signInMagicLink({ body: { email: email.trim().toLowerCase() }, headers });
  } catch {
    // Mesmo resultado para quem não tem conta ou acesso.
  }
  return { ok: true };
}

/** Usa o link. Quem tem autenticador segue para o código (etapa "dois-fatores"). */
export async function entrarComLinkMagico(token: string, headers: Headers): Promise<ResultadoLogin> {
  try {
    const r = (await auth.api.magicLinkVerify({ query: { token }, headers })) as {
      twoFactorRedirect?: boolean;
      user?: { id: string };
    };
    if (r.twoFactorRedirect) return { etapa: "dois-fatores" };
    if (r.user) await registrarEntrada(headers, r.user.id, "link");
    return { etapa: "concluido" };
  } catch {
    return { erro: "Link inválido, expirado ou já utilizado. Peça um novo na tela de entrada." };
  }
}

// --- Passkeys (política 2A: login completo, já com dois fatores) -----------------

export type OpcoesWebAuthn = Record<string, unknown>;

export async function opcoesParaCriarPasskey(headers: Headers): Promise<OpcoesWebAuthn | { erro: string }> {
  if (!(await podeCadastrarFator(headers))) return { erro: ENTRE_COM_DOIS_FATORES };
  try {
    return (await auth.api.generatePasskeyRegistrationOptions({ headers })) as unknown as OpcoesWebAuthn;
  } catch {
    return { erro: "Não foi possível iniciar o cadastro da passkey. Entre novamente e tente de novo." };
  }
}

export async function salvarPasskey(
  resposta: unknown,
  nome: string,
  headers: Headers,
): Promise<{ ok: true } | { erro: string }> {
  try {
    const r = await auth.api.verifyPasskeyRegistration({
      body: { response: resposta as never, name: nome.trim().slice(0, 60) || undefined },
      headers,
    });
    const usuarioId = (r as { passkey?: { userId?: string } }).passkey?.userId;
    if (usuarioId) await registrarEntrada(headers, usuarioId, "passkey-cadastrada");
    return { ok: true };
  } catch {
    return { erro: "A passkey não foi cadastrada. Tente de novo." };
  }
}

export async function opcoesParaEntrarComPasskey(
  headers: Headers,
): Promise<OpcoesWebAuthn | { erro: string }> {
  try {
    return (await auth.api.generatePasskeyAuthenticationOptions({ headers })) as unknown as OpcoesWebAuthn;
  } catch {
    return { erro: "Não foi possível iniciar o login com passkey." };
  }
}

export async function entrarComPasskey(resposta: unknown, headers: Headers): Promise<ResultadoLogin> {
  try {
    const r = await auth.api.verifyPasskeyAuthentication({ body: { response: resposta as never }, headers });
    await registrarEntrada(headers, r.user.id, "passkey");
    return { etapa: "concluido" };
  } catch {
    return { erro: "Passkey não reconhecida ou sem acesso a este endereço." };
  }
}
