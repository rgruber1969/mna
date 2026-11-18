import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { banco, comTenant } from "@/server/db/cliente";
import { convite, eventoAuditoria, tenant, usuario, vinculoTenant } from "@/server/db/esquema";
import { exigirAdministrador, type Acesso, type AcessoTenant } from "./acesso";
import { emitirConviteDoTenant, type DadosPessoa } from "./convites";
import { filtrarPerfisDoTenant } from "./perfis";
import {
  apagarTodosOsFatores,
  avisarMudancaNosFatores,
  encerrarSessoes,
  fatoresDaConta,
  outroTenantExigeDoisFatores,
  quantidadeDeFatores,
  removerAutenticadorDaConta,
  removerPasskeyDaConta,
  type FatoresDaConta,
} from "./fatores-da-conta";

/**
 * Usuários do tenant, administrados pelos administradores do tenant
 * (perfis-e-permissoes.md; autenticacao-e-sessao.md). Toda ação é auditada.
 */

type Resultado = { ok: true } | { erro: string };

const uuidValido = (id: string) => z.uuid().safeParse(id).success;

async function auditar(
  a: AcessoTenant,
  tipo: string,
  alvoTipo: string,
  alvoId: string,
  detalhes?: Record<string, string | boolean | number>,
) {
  await comTenant(a.tenant.id, (tx) =>
    tx
      .insert(eventoAuditoria)
      .values({ tenantId: a.tenant.id, tipo, atorId: a.usuario.id, alvoTipo, alvoId, detalhes }),
  );
}

// --- Consulta ------------------------------------------------------------------

export type UsuarioDoTenant = {
  id: string;
  nome: string;
  email: string;
  administrador: boolean;
  exigeIndividual: boolean;
  /** Resultado das regras somadas. */
  exigeDoisFatores: boolean;
  temDoisFatores: boolean;
};

export type ConvitePendente = {
  id: string;
  nome: string;
  email: string;
  administrador: boolean;
  expiraEm: Date;
};

export type PainelDeUsuarios = {
  exigeDeTodos: boolean;
  usuarios: UsuarioDoTenant[];
  convites: ConvitePendente[];
};

export async function listarUsuarios(acesso: Acesso | null): Promise<PainelDeUsuarios> {
  const a = exigirAdministrador(acesso);
  const [t] = await banco()
    .select({ exige: tenant.exigeDoisFatoresDeTodos })
    .from(tenant)
    .where(eq(tenant.id, a.tenant.id));
  const exigeDeTodos = Boolean(t?.exige);
  const { vinculos, convites } = await comTenant(a.tenant.id, async (tx) => ({
    vinculos: await tx
      .select({
        id: usuario.id,
        nome: usuario.name,
        email: usuario.email,
        autenticador: usuario.twoFactorEnabled,
        administrador: vinculoTenant.administrador,
        exigeIndividual: vinculoTenant.exigeDoisFatores,
      })
      .from(vinculoTenant)
      .innerJoin(usuario, eq(usuario.id, vinculoTenant.usuarioId))
      .where(eq(vinculoTenant.situacao, "ativo"))
      .orderBy(usuario.name),
    convites: await tx
      .select({
        id: convite.id,
        nome: convite.nome,
        email: convite.email,
        administrador: convite.administrador,
        expiraEm: convite.expiraEm,
      })
      .from(convite)
      .where(and(isNull(convite.aceitoEm), gt(convite.expiraEm, new Date())))
      .orderBy(desc(convite.criadoEm)),
  }));
  const usuarios = await Promise.all(
    vinculos.map(async (v) => ({
      id: v.id,
      nome: v.nome,
      email: v.email,
      administrador: v.administrador,
      exigeIndividual: v.exigeIndividual,
      exigeDoisFatores: v.administrador || v.exigeIndividual || exigeDeTodos,
      temDoisFatores: quantidadeDeFatores(await fatoresDaConta(v.id)) > 0,
    })),
  );
  return { exigeDeTodos, usuarios, convites };
}

export type DetalheDoUsuario = UsuarioDoTenant & { fatores: FatoresDaConta; ehVoce: boolean };

/** Vínculo ativo da pessoa neste tenant (o RLS garante que é só deste tenant). */
async function vinculoAtivo(a: AcessoTenant, usuarioId: string) {
  if (!uuidValido(usuarioId)) return null;
  const [v] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        id: usuario.id,
        nome: usuario.name,
        email: usuario.email,
        administrador: vinculoTenant.administrador,
        exigeIndividual: vinculoTenant.exigeDoisFatores,
      })
      .from(vinculoTenant)
      .innerJoin(usuario, eq(usuario.id, vinculoTenant.usuarioId))
      .where(and(eq(vinculoTenant.usuarioId, usuarioId), eq(vinculoTenant.situacao, "ativo"))),
  );
  return v ?? null;
}

export async function obterUsuario(
  acesso: Acesso | null,
  usuarioId: string,
): Promise<DetalheDoUsuario | null> {
  const a = exigirAdministrador(acesso);
  const v = await vinculoAtivo(a, usuarioId);
  if (!v) return null;
  const fatores = await fatoresDaConta(v.id);
  const exigeDoisFatores = v.administrador || v.exigeIndividual || a.tenant.exigeDoisFatoresDeTodos;
  return {
    ...v,
    exigeDoisFatores,
    temDoisFatores: quantidadeDeFatores(fatores) > 0,
    fatores,
    ehVoce: v.id === a.usuario.id,
  };
}

// --- Convites --------------------------------------------------------------------

export async function convidarUsuario(
  acesso: Acesso | null,
  dados: DadosPessoa & { administrador: boolean; perfis?: string[] },
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const perfis = await comTenant(a.tenant.id, (tx) => filtrarPerfisDoTenant(tx, dados.perfis ?? []));
  const email = String(dados.email ?? "")
    .trim()
    .toLowerCase();
  const jaTem = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: vinculoTenant.id })
      .from(vinculoTenant)
      .innerJoin(usuario, eq(usuario.id, vinculoTenant.usuarioId))
      .where(and(eq(usuario.email, email), eq(vinculoTenant.situacao, "ativo"))),
  );
  if (jaTem.length > 0) return { erro: "Esta pessoa já tem acesso a este tenant." };
  // Um convite novo substitui o pendente para o mesmo e-mail.
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(convite)
      .set({ expiraEm: new Date() })
      .where(and(eq(convite.email, email), isNull(convite.aceitoEm))),
  );
  return emitirConviteDoTenant(a.tenant, { ...dados, perfis }, a.usuario.id);
}

async function convitePendente(a: AcessoTenant, conviteId: string) {
  if (!uuidValido(conviteId)) return null;
  const [c] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        id: convite.id,
        nome: convite.nome,
        email: convite.email,
        administrador: convite.administrador,
        perfis: convite.perfis,
      })
      .from(convite)
      .where(and(eq(convite.id, conviteId), isNull(convite.aceitoEm))),
  );
  return c ?? null;
}

/** Cancelar = expirar agora (o convite fica no histórico). */
export async function cancelarConvite(acesso: Acesso | null, conviteId: string): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const c = await convitePendente(a, conviteId);
  if (!c) return { erro: "Convite não encontrado." };
  await comTenant(a.tenant.id, (tx) =>
    tx.update(convite).set({ expiraEm: new Date() }).where(eq(convite.id, c.id)),
  );
  await auditar(a, "convite.cancelado", "convite", c.id);
  return { ok: true };
}

/** Reenviar = cancelar o anterior e emitir um novo (novo link, novo prazo de 3 dias). */
export async function reenviarConvite(acesso: Acesso | null, conviteId: string): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const c = await convitePendente(a, conviteId);
  if (!c) return { erro: "Convite não encontrado." };
  await comTenant(a.tenant.id, (tx) =>
    tx.update(convite).set({ expiraEm: new Date() }).where(eq(convite.id, c.id)),
  );
  return emitirConviteDoTenant(
    a.tenant,
    { nome: c.nome, email: c.email, administrador: c.administrador, perfis: c.perfis },
    a.usuario.id,
  );
}

// --- Papel, exigência de 2FA e revogação ---------------------------------------

async function quantosAdministradores(a: AcessoTenant): Promise<number> {
  const r = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: vinculoTenant.id })
      .from(vinculoTenant)
      .where(and(eq(vinculoTenant.administrador, true), eq(vinculoTenant.situacao, "ativo"))),
  );
  return r.length;
}

export async function definirAdministrador(
  acesso: Acesso | null,
  usuarioId: string,
  administrador: boolean,
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const v = await vinculoAtivo(a, usuarioId);
  if (!v) return { erro: "Usuário não encontrado." };
  if (!administrador && v.administrador && (await quantosAdministradores(a)) <= 1)
    return { erro: "O tenant precisa de pelo menos um administrador." };
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(vinculoTenant)
      .set({ administrador, atualizadoEm: new Date() })
      .where(eq(vinculoTenant.usuarioId, v.id)),
  );
  await auditar(a, "usuario.administrador.alterado", "usuario", v.id, { administrador });
  return { ok: true };
}

export async function definirExigenciaIndividual(
  acesso: Acesso | null,
  usuarioId: string,
  exige: boolean,
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const v = await vinculoAtivo(a, usuarioId);
  if (!v) return { erro: "Usuário não encontrado." };
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(vinculoTenant)
      .set({ exigeDoisFatores: exige, atualizadoEm: new Date() })
      .where(eq(vinculoTenant.usuarioId, v.id)),
  );
  await auditar(a, "usuario.2fa.exigencia", "usuario", v.id, { exige });
  return { ok: true };
}

export async function definirExigenciaDeTodos(acesso: Acesso | null, exige: boolean): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  await banco().update(tenant).set({ exigeDoisFatoresDeTodos: exige }).where(eq(tenant.id, a.tenant.id));
  await auditar(a, "tenant.2fa.exigencia", "tenant", a.tenant.id, { exige });
  return { ok: true };
}

/** Revogação imediata: desativa o vínculo e encerra as sessões neste tenant. */
export async function revogarAcesso(acesso: Acesso | null, usuarioId: string): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const v = await vinculoAtivo(a, usuarioId);
  if (!v) return { erro: "Usuário não encontrado." };
  if (v.id === a.usuario.id) return { erro: "Você não pode revogar o seu próprio acesso." };
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(vinculoTenant)
      .set({ situacao: "revogado", administrador: false, atualizadoEm: new Date() })
      .where(and(eq(vinculoTenant.usuarioId, v.id), ne(vinculoTenant.situacao, "revogado"))),
  );
  await encerrarSessoes(v.id, `tenant:${a.tenant.id}`);
  await auditar(a, "usuario.acesso.revogado", "usuario", v.id);
  return { ok: true };
}

// --- Fatores (recuperação) --------------------------------------------------------

const PRECISA_OUTRO_FATOR =
  "Não é possível remover o único fator da pessoa. Use a redefinição completa do 2FA.";

/** Remove um aparelho perdido, desde que reste outro fator (vale mesmo com outros tenants). */
export async function removerPasskeyDoUsuario(
  acesso: Acesso | null,
  usuarioId: string,
  passkeyId: string,
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const v = await vinculoAtivo(a, usuarioId);
  if (!v || !uuidValido(passkeyId)) return { erro: "Usuário não encontrado." };
  if (quantidadeDeFatores(await fatoresDaConta(v.id)) <= 1) return { erro: PRECISA_OUTRO_FATOR };
  if (!(await removerPasskeyDaConta(v.id, passkeyId))) return { erro: "Passkey não encontrada." };
  await encerrarSessoes(v.id);
  await auditar(a, "usuario.2fa.passkey.removida", "usuario", v.id);
  await avisarMudancaNosFatores(
    v.id,
    "Uma passkey foi removida da sua conta pelo administrador",
    a.tenant.nome,
  );
  return { ok: true };
}

export async function removerAutenticadorDoUsuario(
  acesso: Acesso | null,
  usuarioId: string,
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const v = await vinculoAtivo(a, usuarioId);
  if (!v) return { erro: "Usuário não encontrado." };
  const f = await fatoresDaConta(v.id);
  if (!f.autenticador) return { erro: "A pessoa não tem aplicativo autenticador." };
  if (quantidadeDeFatores(f) <= 1) return { erro: PRECISA_OUTRO_FATOR };
  await removerAutenticadorDaConta(v.id);
  await encerrarSessoes(v.id);
  await auditar(a, "usuario.2fa.autenticador.removido", "usuario", v.id);
  await avisarMudancaNosFatores(
    v.id,
    "O aplicativo autenticador foi removido da sua conta pelo administrador",
    a.tenant.nome,
  );
  return { ok: true };
}

/** Mensagem genérica: não revela que a pessoa tem acesso a outros tenants (ADR-0019, regra 5). */
export const REDEFINICAO_PELA_PLATAFORMA =
  "Por segurança, esta redefinição precisa ser feita pelo suporte da plataforma. Peça à RGRUBER.";

/** Redefinição completa: só se nenhum outro tenant exige 2FA da pessoa. */
export async function redefinirDoisFatoresDoUsuario(
  acesso: Acesso | null,
  usuarioId: string,
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const v = await vinculoAtivo(a, usuarioId);
  if (!v) return { erro: "Usuário não encontrado." };
  if (await outroTenantExigeDoisFatores(v.id, a.tenant.id)) return { erro: REDEFINICAO_PELA_PLATAFORMA };
  await apagarTodosOsFatores(v.id);
  await auditar(a, "usuario.2fa.redefinido", "usuario", v.id);
  await avisarMudancaNosFatores(
    v.id,
    "A verificação em duas etapas da sua conta foi redefinida pelo administrador",
    a.tenant.nome,
  );
  return { ok: true };
}
