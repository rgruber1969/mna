import { eq } from "drizzle-orm";
import { comTenant } from "@/server/db/cliente";
import { eventoAuditoria, matrizUsuario, perfil, perfilUsuario } from "@/server/db/esquema";
import { AcessoNegado, exigirTenant, type Acesso, type AcessoTenant } from "../acesso";
import {
  concede,
  normalizarMatriz,
  RECURSOS,
  somarMatrizes,
  type Acao,
  type Matriz,
  type Recurso,
} from "./catalogo";

/**
 * Verificador único de permissões (ADR-0013, elemento 10). Telas, API e MCP
 * perguntam aqui; a interface só esconde o que o verificador nega.
 *
 * - Negado por padrão: só vale o que alguma matriz concede.
 * - Administrador do tenant: tudo, sem precisar de perfil (auditado onde
 *   cada funcionalidade registra o acesso).
 * - Calculado a cada requisição; reaproveitado só dentro dela (o objeto de
 *   acesso é criado por requisição). Sem cache entre requisições, para que
 *   uma revogação valha na hora (adendo de 2026-11-18).
 * - Recursos de deal dependem de participação (segunda entrega). Até lá,
 *   ninguém além dos administradores os recebe: sem participação, o deal não
 *   existe para a pessoa.
 */

/** Contexto de um recurso de deal (a participação chega na segunda entrega). */
export type ContextoDoRecurso = { dealId: string };

const daRequisicao = new WeakMap<AcessoTenant, Promise<Matriz>>();

/** Matriz efetiva da pessoa na camada do tenant: soma dos perfis do tenant. */
export function permissoesNoTenant(a: AcessoTenant): Promise<Matriz> {
  let p = daRequisicao.get(a);
  if (!p) {
    p = calcularPermissoesNoTenant(a);
    daRequisicao.set(a, p);
  }
  return p;
}

async function calcularPermissoesNoTenant(a: AcessoTenant): Promise<Matriz> {
  return matrizDoUsuarioNoTenant(a.tenant.id, a.usuario.id, a.tenant.modoPermissoes);
}

/**
 * Soma das matrizes dos perfis do tenant atribuídos à pessoa; no modo "por
 * usuário", a matriz individual (se houver) substitui a do perfil.
 */
export async function matrizDoUsuarioNoTenant(
  tenantId: string,
  usuarioId: string,
  modo: "perfil" | "usuario",
): Promise<Matriz> {
  const { perfis, individuais } = await comTenant(tenantId, async (tx) => ({
    perfis: await tx
      .select({ id: perfil.id, camada: perfil.camada, matriz: perfil.matriz })
      .from(perfilUsuario)
      .innerJoin(perfil, eq(perfil.id, perfilUsuario.perfilId))
      .where(eq(perfilUsuario.usuarioId, usuarioId)),
    individuais:
      modo === "usuario"
        ? await tx
            .select({ perfilId: matrizUsuario.perfilId, matriz: matrizUsuario.matriz })
            .from(matrizUsuario)
            .where(eq(matrizUsuario.usuarioId, usuarioId))
        : [],
  }));
  const individualDe = new Map(individuais.map((i) => [i.perfilId, i.matriz]));
  return somarMatrizes(
    perfis
      .filter((p) => p.camada === "tenant")
      .map((p) => normalizarMatriz(individualDe.get(p.id) ?? p.matriz, "tenant")),
  );
}

/** A pessoa pode executar `acao` sobre `recurso`? Para decidir o que mostrar. */
export async function pode(
  acesso: Acesso | null,
  recurso: Recurso,
  acao: Acao,
  contexto?: ContextoDoRecurso,
): Promise<boolean> {
  if (acesso?.area !== "tenant") return false;
  let a: AcessoTenant;
  try {
    a = exigirTenant(acesso);
  } catch {
    return false;
  }
  if (a.administrador) return true;
  if (RECURSOS[recurso].camada === "deal") {
    // Segunda entrega: participação e alcance no deal do `contexto`.
    void contexto;
    return false;
  }
  return concede(await permissoesNoTenant(a), recurso, acao);
}

/**
 * Exige a permissão; nega com AcessoNegado e registra a negação na
 * auditoria (ADR-0013, elemento 12). Toda operação de serviço passa por aqui.
 */
export async function exigirPermissao(
  acesso: Acesso | null,
  recurso: Recurso,
  acao: Acao,
  contexto?: ContextoDoRecurso,
): Promise<AcessoTenant> {
  const a = exigirTenant(acesso);
  if (await pode(a, recurso, acao, contexto)) return a;
  await comTenant(a.tenant.id, (tx) =>
    tx.insert(eventoAuditoria).values({
      tenantId: a.tenant.id,
      tipo: "acesso.negado",
      atorId: a.usuario.id,
      alvoTipo: "recurso",
      detalhes: { recurso, acao, ...(contexto ? { dealId: contexto.dealId } : {}) },
    }),
  );
  throw new AcessoNegado();
}
