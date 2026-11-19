import { notificar } from "./notificacoes";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { banco, comTenant } from "@/server/db/cliente";
import {
  eventoAuditoria,
  matrizUsuario,
  perfil,
  perfilUsuario,
  tenant,
  usuario,
  vinculoTenant,
} from "@/server/db/esquema";
import { exigirAdministrador, type Acesso, type AcessoTenant } from "./acesso";
import { normalizarMatriz, type Camada, type Matriz } from "./permissoes/catalogo";
import { PERFIS_PADRAO } from "./permissoes/perfis-padrao";
import { matrizDoUsuarioNoTenant } from "./permissoes/verificador";

/**
 * Perfis e permissões do tenant, administrados pelos administradores do
 * tenant (ADR-0013; perfis-e-permissoes.md). Toda mudança é auditada.
 */

type Resultado = { ok: true } | { erro: string };
type Transacao = Parameters<Parameters<typeof comTenant>[1]>[0];

const uuidValido = (id: string) => z.uuid().safeParse(id).success;
const Nome = z.string().trim().min(2, "Informe o nome do perfil.").max(80, "Nome muito longo.");
const Descricao = z.string().trim().max(400, "Descrição muito longa (até 400 caracteres).");

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

// --- Perfis padrão -------------------------------------------------------------

/**
 * Copia o conjunto padrão para o tenant, só se ele ainda não tiver nenhum
 * perfil (perfis excluídos pelo tenant não voltam).
 */
export async function copiarPerfisPadrao(tenantId: string): Promise<number> {
  return comTenant(tenantId, async (tx) => {
    const [{ n }] = await tx.select({ n: count() }).from(perfil);
    if (n > 0) return 0;
    await tx.insert(perfil).values(
      PERFIS_PADRAO.map((p) => ({
        tenantId,
        camada: p.camada,
        nome: p.nome,
        descricao: p.descricao,
        matriz: p.matriz as Record<string, string[]>,
        padrao: p.codigo,
      })),
    );
    return PERFIS_PADRAO.length;
  });
}

/** Para tenants criados antes dos perfis padrão (script de manutenção). */
export async function copiarPerfisPadraoParaTodos(): Promise<number> {
  const tenants = await banco().select({ id: tenant.id }).from(tenant);
  let copiados = 0;
  for (const t of tenants) if ((await copiarPerfisPadrao(t.id)) > 0) copiados++;
  return copiados;
}

// --- Consulta ------------------------------------------------------------------

export type PerfilResumo = {
  id: string;
  nome: string;
  descricao: string;
  camada: Camada;
  /** Perfil do tenant que exige 2FA de quem o tem. */
  exigeDoisFatores: boolean;
  /** Usuários com este perfil no tenant (perfis de deal: participações, na 2ª entrega). */
  emUso: number;
};

export type PainelDePerfis = { modo: "perfil" | "usuario"; perfis: PerfilResumo[] };

export async function listarPerfis(acesso: Acesso | null): Promise<PainelDePerfis> {
  const a = exigirAdministrador(acesso);
  const perfis = await comTenant(a.tenant.id, async (tx) => {
    const lista = await tx
      .select({
        id: perfil.id,
        nome: perfil.nome,
        descricao: perfil.descricao,
        camada: perfil.camada,
        exigeDoisFatores: perfil.exigeDoisFatores,
      })
      .from(perfil)
      .orderBy(asc(perfil.camada), asc(perfil.nome));
    const usos = await tx
      .select({ perfilId: perfilUsuario.perfilId, n: count() })
      .from(perfilUsuario)
      .groupBy(perfilUsuario.perfilId);
    const usoDe = new Map(usos.map((u) => [u.perfilId, u.n]));
    return lista.map((p) => ({ ...p, emUso: usoDe.get(p.id) ?? 0 }));
  });
  return { modo: a.tenant.modoPermissoes, perfis };
}

export type DetalheDoPerfil = PerfilResumo & { matriz: Matriz; usuarios: { id: string; nome: string }[] };

async function perfilDoTenant(tx: Transacao, perfilId: string) {
  if (!uuidValido(perfilId)) return null;
  const [p] = await tx
    .select({
      id: perfil.id,
      nome: perfil.nome,
      descricao: perfil.descricao,
      camada: perfil.camada,
      exigeDoisFatores: perfil.exigeDoisFatores,
      matriz: perfil.matriz,
    })
    .from(perfil)
    .where(eq(perfil.id, perfilId));
  return p ?? null;
}

export async function obterPerfil(acesso: Acesso | null, perfilId: string): Promise<DetalheDoPerfil | null> {
  const a = exigirAdministrador(acesso);
  return comTenant(a.tenant.id, async (tx) => {
    const p = await perfilDoTenant(tx, perfilId);
    if (!p) return null;
    const usuarios = await tx
      .select({ id: usuario.id, nome: usuario.name })
      .from(perfilUsuario)
      .innerJoin(usuario, eq(usuario.id, perfilUsuario.usuarioId))
      .where(eq(perfilUsuario.perfilId, p.id))
      .orderBy(asc(usuario.name));
    return { ...p, matriz: normalizarMatriz(p.matriz, p.camada), emUso: usuarios.length, usuarios };
  });
}

// --- Cadastro de perfis --------------------------------------------------------

const NOME_REPETIDO = "Já existe um perfil com este nome nesta camada.";

async function nomeLivre(tx: Transacao, camada: Camada, nome: string, ignorar?: string) {
  const r = await tx
    .select({ id: perfil.id })
    .from(perfil)
    .where(and(eq(perfil.camada, camada), eq(perfil.nome, nome)));
  return r.every((p) => p.id === ignorar);
}

export async function criarPerfil(
  acesso: Acesso | null,
  dados: { nome: string; camada: string; descricao?: string; copiarDe?: string },
): Promise<{ id: string } | { erro: string }> {
  const a = exigirAdministrador(acesso);
  const nome = Nome.safeParse(dados.nome);
  if (!nome.success) return { erro: nome.error.issues[0].message };
  if (dados.camada !== "tenant" && dados.camada !== "deal") return { erro: "Escolha a camada do perfil." };
  const descricao = Descricao.safeParse(dados.descricao ?? "");
  if (!descricao.success) return { erro: descricao.error.issues[0].message };
  const camada: Camada = dados.camada;
  const r = await comTenant(a.tenant.id, async (tx): Promise<{ id: string } | { erro: string }> => {
    if (!(await nomeLivre(tx, camada, nome.data))) return { erro: NOME_REPETIDO };
    let matriz: Matriz = {};
    if (dados.copiarDe) {
      const origem = await perfilDoTenant(tx, dados.copiarDe);
      if (!origem || origem.camada !== camada) return { erro: "Perfil de origem inválido." };
      matriz = normalizarMatriz(origem.matriz, camada);
    }
    const [p] = await tx
      .insert(perfil)
      .values({ tenantId: a.tenant.id, camada, nome: nome.data, descricao: descricao.data, matriz })
      .returning({ id: perfil.id });
    return { id: p.id };
  });
  if ("id" in r) await auditar(a, "perfil.criado", "perfil", r.id, { camada });
  return r;
}

/** Edita o nome e a descrição do perfil. */
export async function editarPerfil(
  acesso: Acesso | null,
  perfilId: string,
  dados: { nome: string; descricao: string },
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const nome = Nome.safeParse(dados.nome);
  if (!nome.success) return { erro: nome.error.issues[0].message };
  const descricao = Descricao.safeParse(dados.descricao ?? "");
  if (!descricao.success) return { erro: descricao.error.issues[0].message };
  const r = await comTenant(a.tenant.id, async (tx): Promise<Resultado> => {
    const p = await perfilDoTenant(tx, perfilId);
    if (!p) return { erro: "Perfil não encontrado." };
    if (!(await nomeLivre(tx, p.camada, nome.data, p.id))) return { erro: NOME_REPETIDO };
    await tx
      .update(perfil)
      .set({ nome: nome.data, descricao: descricao.data, atualizadoEm: new Date() })
      .where(eq(perfil.id, p.id));
    return { ok: true };
  });
  if ("ok" in r) await auditar(a, "perfil.editado", "perfil", perfilId);
  return r;
}

export async function salvarMatrizDoPerfil(
  acesso: Acesso | null,
  perfilId: string,
  matrizBruta: unknown,
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const r = await comTenant(a.tenant.id, async (tx): Promise<Resultado> => {
    const p = await perfilDoTenant(tx, perfilId);
    if (!p) return { erro: "Perfil não encontrado." };
    const matriz = normalizarMatriz(matrizBruta, p.camada);
    await tx.update(perfil).set({ matriz, atualizadoEm: new Date() }).where(eq(perfil.id, p.id));
    return { ok: true };
  });
  if ("ok" in r) await auditar(a, "perfil.matriz.alterada", "perfil", perfilId);
  return r;
}

/** "Exige 2FA" do perfil (só perfis do tenant; autenticacao-e-sessao.md). */
export async function definirExigenciaDoPerfil(
  acesso: Acesso | null,
  perfilId: string,
  exige: boolean,
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const r = await comTenant(a.tenant.id, async (tx): Promise<Resultado> => {
    const p = await perfilDoTenant(tx, perfilId);
    if (!p) return { erro: "Perfil não encontrado." };
    if (p.camada !== "tenant") return { erro: "A exigência de 2FA vale para perfis do tenant." };
    await tx
      .update(perfil)
      .set({ exigeDoisFatores: exige, atualizadoEm: new Date() })
      .where(eq(perfil.id, p.id));
    return { ok: true };
  });
  if ("ok" in r) await auditar(a, "perfil.2fa.exigencia", "perfil", perfilId, { exige });
  return r;
}

/** Perfil em uso não pode ser excluído (adendo de 2026-11-18 ao ADR-0013). */
export async function excluirPerfil(acesso: Acesso | null, perfilId: string): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const r = await comTenant(a.tenant.id, async (tx): Promise<Resultado> => {
    const p = await perfilDoTenant(tx, perfilId);
    if (!p) return { erro: "Perfil não encontrado." };
    const [{ n }] = await tx
      .select({ n: count() })
      .from(perfilUsuario)
      .where(eq(perfilUsuario.perfilId, p.id));
    if (n > 0) return { erro: `Perfil em uso por ${n} usuário(s). Retire-o deles antes de excluir.` };
    await tx.delete(perfil).where(eq(perfil.id, p.id));
    return { ok: true };
  });
  if ("ok" in r) await auditar(a, "perfil.excluido", "perfil", perfilId);
  return r;
}

// --- Modo do tenant --------------------------------------------------------------

/** Trocar o modo não apaga matrizes individuais: elas voltam se o modo voltar. */
export async function definirModoPermissoes(acesso: Acesso | null, modo: string): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  if (modo !== "perfil" && modo !== "usuario") return { erro: "Modo inválido." };
  await banco().update(tenant).set({ modoPermissoes: modo }).where(eq(tenant.id, a.tenant.id));
  await auditar(a, "tenant.permissoes.modo", "tenant", a.tenant.id, { modo });
  return { ok: true };
}

// --- Perfis e matrizes de cada usuário ---------------------------------------------

async function usuarioAtivo(tx: Transacao, usuarioId: string) {
  if (!uuidValido(usuarioId)) return null;
  const [v] = await tx
    .select({ id: usuario.id, nome: usuario.name, administrador: vinculoTenant.administrador })
    .from(vinculoTenant)
    .innerJoin(usuario, eq(usuario.id, vinculoTenant.usuarioId))
    .where(and(eq(vinculoTenant.usuarioId, usuarioId), eq(vinculoTenant.situacao, "ativo")));
  return v ?? null;
}

/** Só perfis do tenant (camada tenant) deste tenant; descarta o resto. */
export async function filtrarPerfisDoTenant(tx: Transacao, ids: string[]): Promise<string[]> {
  const validos = [...new Set(ids)].filter(uuidValido);
  if (validos.length === 0) return [];
  const r = await tx
    .select({ id: perfil.id })
    .from(perfil)
    .where(and(inArray(perfil.id, validos), eq(perfil.camada, "tenant")));
  return r.map((p) => p.id);
}

export type PermissoesDoUsuario = {
  modo: "perfil" | "usuario";
  disponiveis: { id: string; nome: string; descricao: string }[];
  atribuidos: { id: string; nome: string; personalizada: boolean }[];
  /** Soma do que os perfis concedem (administradores têm tudo, fora da matriz). */
  efetiva: Matriz;
};

export async function permissoesDoUsuario(
  acesso: Acesso | null,
  usuarioId: string,
): Promise<PermissoesDoUsuario | null> {
  const a = exigirAdministrador(acesso);
  const dados = await comTenant(a.tenant.id, async (tx) => {
    const u = await usuarioAtivo(tx, usuarioId);
    if (!u) return null;
    const disponiveis = await tx
      .select({ id: perfil.id, nome: perfil.nome, descricao: perfil.descricao })
      .from(perfil)
      .where(eq(perfil.camada, "tenant"))
      .orderBy(asc(perfil.nome));
    const atribuidos = await tx
      .select({ id: perfil.id, nome: perfil.nome })
      .from(perfilUsuario)
      .innerJoin(perfil, eq(perfil.id, perfilUsuario.perfilId))
      .where(and(eq(perfilUsuario.usuarioId, u.id), eq(perfil.camada, "tenant")))
      .orderBy(asc(perfil.nome));
    const individuais = await tx
      .select({ perfilId: matrizUsuario.perfilId })
      .from(matrizUsuario)
      .where(eq(matrizUsuario.usuarioId, u.id));
    const comIndividual = new Set(individuais.map((i) => i.perfilId));
    return {
      disponiveis,
      atribuidos: atribuidos.map((p) => ({ ...p, personalizada: comIndividual.has(p.id) })),
    };
  });
  if (!dados) return null;
  const efetiva = await matrizDoUsuarioNoTenant(a.tenant.id, usuarioId, a.tenant.modoPermissoes);
  return { modo: a.tenant.modoPermissoes, ...dados, efetiva };
}

export const UM_PERFIL_SO = "Escolha um único perfil do tenant.";

/** Define o perfil do tenant da pessoa: um só, ou nenhum (decisão de 2026-11-18). */
export async function definirPerfisDoUsuario(
  acesso: Acesso | null,
  usuarioId: string,
  perfilIds: string[],
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  perfilIds = perfilIds.filter(Boolean);
  if (perfilIds.length > 1) return { erro: UM_PERFIL_SO };
  const r = await comTenant(a.tenant.id, async (tx): Promise<Resultado> => {
    const u = await usuarioAtivo(tx, usuarioId);
    if (!u) return { erro: "Usuário não encontrado." };
    const ids = await filtrarPerfisDoTenant(tx, perfilIds);
    await atribuirPerfis(tx, a.tenant.id, u.id, ids);
    if (u.id !== a.usuario.id) await notificar(tx, a.tenant.id, u.id, "perfil_alterado", {}, "/seguranca");
    return { ok: true };
  });
  if ("ok" in r)
    await auditar(a, "usuario.perfis.alterados", "usuario", usuarioId, { quantidade: perfilIds.length });
  return r;
}

/** Substitui o perfil do tenant da pessoa (no máximo um; usado também ao aceitar convite). */
export async function atribuirPerfis(tx: Transacao, tenantId: string, usuarioId: string, todos: string[]) {
  const ids = todos.slice(0, 1);
  const atuais = await tx
    .select({ id: perfilUsuario.id, perfilId: perfilUsuario.perfilId })
    .from(perfilUsuario)
    .innerJoin(perfil, eq(perfil.id, perfilUsuario.perfilId))
    .where(and(eq(perfilUsuario.usuarioId, usuarioId), eq(perfil.camada, "tenant")));
  const sair = atuais.filter((p) => !ids.includes(p.perfilId)).map((p) => p.id);
  if (sair.length > 0) await tx.delete(perfilUsuario).where(inArray(perfilUsuario.id, sair));
  const entrar = ids.filter((id) => !atuais.some((p) => p.perfilId === id));
  if (entrar.length > 0)
    await tx.insert(perfilUsuario).values(entrar.map((perfilId) => ({ tenantId, usuarioId, perfilId })));
}

export type MatrizIndividual = {
  usuario: { id: string; nome: string };
  perfil: { id: string; nome: string; camada: Camada };
  matriz: Matriz;
  personalizada: boolean;
  /** Outros usuários com o mesmo perfil, para copiar as permissões. */
  outros: { id: string; nome: string }[];
};

async function atribuicao(tx: Transacao, usuarioId: string, perfilId: string) {
  const u = await usuarioAtivo(tx, usuarioId);
  const p = await perfilDoTenant(tx, perfilId);
  if (!u || !p) return null;
  const [tem] = await tx
    .select({ id: perfilUsuario.id })
    .from(perfilUsuario)
    .where(and(eq(perfilUsuario.usuarioId, u.id), eq(perfilUsuario.perfilId, p.id)));
  return tem ? { u, p } : null;
}

async function matrizIndividualDe(tx: Transacao, usuarioId: string, perfilId: string) {
  const [m] = await tx
    .select({ matriz: matrizUsuario.matriz })
    .from(matrizUsuario)
    .where(and(eq(matrizUsuario.usuarioId, usuarioId), eq(matrizUsuario.perfilId, perfilId)));
  return m?.matriz ?? null;
}

export async function obterMatrizIndividual(
  acesso: Acesso | null,
  usuarioId: string,
  perfilId: string,
): Promise<MatrizIndividual | null> {
  const a = exigirAdministrador(acesso);
  return comTenant(a.tenant.id, async (tx) => {
    const at = await atribuicao(tx, usuarioId, perfilId);
    if (!at) return null;
    const individual = await matrizIndividualDe(tx, at.u.id, at.p.id);
    const outros = await tx
      .select({ id: usuario.id, nome: usuario.name })
      .from(perfilUsuario)
      .innerJoin(usuario, eq(usuario.id, perfilUsuario.usuarioId))
      .where(eq(perfilUsuario.perfilId, at.p.id))
      .orderBy(asc(usuario.name));
    return {
      usuario: { id: at.u.id, nome: at.u.nome },
      perfil: { id: at.p.id, nome: at.p.nome, camada: at.p.camada },
      matriz: normalizarMatriz(individual ?? at.p.matriz, at.p.camada),
      personalizada: individual !== null,
      outros: outros.filter((o) => o.id !== at.u.id),
    };
  });
}

async function gravarIndividual(
  tx: Transacao,
  tenantId: string,
  usuarioId: string,
  perfilId: string,
  matriz: Matriz,
) {
  await tx
    .insert(matrizUsuario)
    .values({ tenantId, usuarioId, perfilId, matriz })
    .onConflictDoUpdate({
      target: [matrizUsuario.tenantId, matrizUsuario.usuarioId, matrizUsuario.perfilId],
      set: { matriz, atualizadoEm: new Date() },
    });
}

export async function salvarMatrizIndividual(
  acesso: Acesso | null,
  usuarioId: string,
  perfilId: string,
  matrizBruta: unknown,
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const r = await comTenant(a.tenant.id, async (tx): Promise<Resultado> => {
    const at = await atribuicao(tx, usuarioId, perfilId);
    if (!at) return { erro: "Perfil não atribuído a este usuário." };
    await gravarIndividual(tx, a.tenant.id, at.u.id, at.p.id, normalizarMatriz(matrizBruta, at.p.camada));
    return { ok: true };
  });
  if ("ok" in r) await auditar(a, "usuario.matriz.alterada", "usuario", usuarioId, { perfilId });
  return r;
}

/**
 * Copia as permissões: `origem` = "perfil" volta à matriz do perfil (apaga a
 * individual); um id de usuário copia a matriz que vale para ele nesse perfil.
 */
export async function copiarMatrizIndividual(
  acesso: Acesso | null,
  usuarioId: string,
  perfilId: string,
  origem: string,
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const r = await comTenant(a.tenant.id, async (tx): Promise<Resultado> => {
    const at = await atribuicao(tx, usuarioId, perfilId);
    if (!at) return { erro: "Perfil não atribuído a este usuário." };
    if (origem === "perfil") {
      await tx
        .delete(matrizUsuario)
        .where(and(eq(matrizUsuario.usuarioId, at.u.id), eq(matrizUsuario.perfilId, at.p.id)));
      return { ok: true };
    }
    const deOutro = await atribuicao(tx, origem, perfilId);
    if (!deOutro || deOutro.u.id === at.u.id) return { erro: "Escolha outro usuário com o mesmo perfil." };
    const matriz = (await matrizIndividualDe(tx, deOutro.u.id, at.p.id)) ?? at.p.matriz;
    await gravarIndividual(tx, a.tenant.id, at.u.id, at.p.id, normalizarMatriz(matriz, at.p.camada));
    return { ok: true };
  });
  if ("ok" in r)
    await auditar(a, "usuario.matriz.copiada", "usuario", usuarioId, {
      perfilId,
      origem: origem === "perfil" ? "perfil" : "usuario",
    });
  return r;
}
