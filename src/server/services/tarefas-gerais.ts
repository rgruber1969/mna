import { and, asc, eq, or } from "drizzle-orm";
import { z } from "zod";
import type { ErroDeServico } from "@/i18n/servidor";
import { comTenant } from "@/server/db/cliente";
import { tarefaGeral, usuario, vinculoTenant } from "@/server/db/esquema";
import { exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import { auditar } from "./empresas";
import { hojeEmSaoPaulo } from "./negocios-andamento";

/**
 * Kanban de tarefas gerais, fora de negócio (backlog V2, 2026-11-27):
 * colunas A fazer → Em andamento → Aguardando terceiros → Concluído.
 * Qualquer pessoa do tenant cria; veem e mexem quem criou, o responsável e
 * os administradores. Ações auditadas.
 */

export const COLUNAS_GERAIS = ["a_fazer", "andamento", "aguardando", "concluida"] as const;
export type ColunaGeral = (typeof COLUNAS_GERAIS)[number];
const PRIORIDADES = ["baixa", "normal", "alta", "urgente"] as const;

export type TarefaGeralNaTela = {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: (typeof PRIORIDADES)[number];
  prazo: string | null;
  situacao: ColunaGeral;
  responsavelId: string | null;
  responsavel: string | null;
  atrasada: boolean;
};

type Resultado = { ok: true; id?: string } | ErroDeServico;

const uuidValido = (id: string) => z.uuid().safeParse(id).success;

/** Só o que a pessoa vê: criou, é responsável, ou é administrador. */
const visivel = (a: AcessoTenant) =>
  a.administrador
    ? undefined
    : or(eq(tarefaGeral.criadoPor, a.usuario.id), eq(tarefaGeral.responsavelId, a.usuario.id));

export async function quadroDeTarefasGerais(acesso: Acesso | null): Promise<{
  tarefas: TarefaGeralNaTela[];
  pessoas: { id: string; nome: string }[];
}> {
  const a = exigirTenant(acesso);
  const hoje = hojeEmSaoPaulo();
  const [linhas, pessoas] = await comTenant(a.tenant.id, (tx) =>
    Promise.all([
      tx
        .select({ t: tarefaGeral, responsavel: usuario.name })
        .from(tarefaGeral)
        .leftJoin(usuario, eq(usuario.id, tarefaGeral.responsavelId))
        .where(visivel(a))
        .orderBy(asc(tarefaGeral.prazo), asc(tarefaGeral.criadoEm)),
      tx
        .select({ id: usuario.id, nome: usuario.name })
        .from(vinculoTenant)
        .innerJoin(usuario, eq(usuario.id, vinculoTenant.usuarioId))
        .where(eq(vinculoTenant.situacao, "ativo"))
        .orderBy(asc(usuario.name)),
    ]),
  );
  return {
    tarefas: linhas.map(({ t, responsavel }) => ({
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      prioridade: t.prioridade,
      prazo: t.prazo,
      situacao: t.situacao,
      responsavelId: t.responsavelId,
      responsavel,
      atrasada: Boolean(t.prazo && t.prazo < hoje && t.situacao !== "concluida"),
    })),
    pessoas,
  };
}

const Dados = z.object({
  titulo: z.string().trim().min(2, "tarefas.gerais.erros.titulo").max(200, "tarefas.gerais.erros.titulo"),
  descricao: z
    .string()
    .trim()
    .max(4000)
    .transform((v) => v || null),
  prioridade: z.enum(PRIORIDADES),
  prazo: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "tarefas.gerais.erros.prazo")
    .transform((v) => v || null),
  responsavelId: z
    .string()
    .refine((v) => !v || uuidValido(v), "tarefas.gerais.erros.responsavel")
    .transform((v) => v || null),
});

async function tarefaVisivel(a: AcessoTenant, id: string) {
  if (!uuidValido(id)) return null;
  const [t] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select()
      .from(tarefaGeral)
      .where(and(eq(tarefaGeral.id, id), visivel(a))),
  );
  return t ?? null;
}

async function responsavelDoTenant(a: AcessoTenant, usuarioId: string | null) {
  if (!usuarioId) return true;
  const [v] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: vinculoTenant.id })
      .from(vinculoTenant)
      .where(and(eq(vinculoTenant.usuarioId, usuarioId), eq(vinculoTenant.situacao, "ativo"))),
  );
  return Boolean(v);
}

/** Cria (sem id) ou edita a tarefa geral. */
export async function salvarTarefaGeral(
  acesso: Acesso | null,
  id: string | null,
  dados: z.input<typeof Dados>,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const d = Dados.safeParse(dados);
  if (!d.success) return { erro: d.error.issues[0]?.message ?? "tarefas.gerais.erros.dados" };
  if (!(await responsavelDoTenant(a, d.data.responsavelId)))
    return { erro: "tarefas.gerais.erros.responsavel" };
  if (id) {
    if (!(await tarefaVisivel(a, id))) return { erro: "tarefas.gerais.erros.naoEncontrada" };
    await comTenant(a.tenant.id, (tx) =>
      tx
        .update(tarefaGeral)
        .set({ ...d.data, atualizadoEm: new Date() })
        .where(eq(tarefaGeral.id, id)),
    );
    await auditar(a, "tarefa_geral.editada", "tarefa_geral", id, { titulo: d.data.titulo });
    return { ok: true, id };
  }
  const [nova] = await comTenant(a.tenant.id, (tx) =>
    tx
      .insert(tarefaGeral)
      .values({ tenantId: a.tenant.id, ...d.data, criadoPor: a.usuario.id })
      .returning({ id: tarefaGeral.id }),
  );
  await auditar(a, "tarefa_geral.criada", "tarefa_geral", nova.id, { titulo: d.data.titulo });
  return { ok: true, id: nova.id };
}

/** Move a tarefa para outra coluna (arrastando ou pelo menu). */
export async function moverTarefaGeral(
  acesso: Acesso | null,
  id: string,
  situacao: string,
): Promise<Resultado> {
  const a = exigirTenant(acesso);
  if (!COLUNAS_GERAIS.includes(situacao as ColunaGeral)) return { erro: "tarefas.gerais.erros.situacao" };
  const t = await tarefaVisivel(a, id);
  if (!t) return { erro: "tarefas.gerais.erros.naoEncontrada" };
  const col = situacao as ColunaGeral;
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(tarefaGeral)
      .set({
        situacao: col,
        concluidaEm: col === "concluida" ? new Date() : null,
        atualizadoEm: new Date(),
      })
      .where(eq(tarefaGeral.id, id)),
  );
  await auditar(a, "tarefa_geral.movida", "tarefa_geral", id, { de: t.situacao, para: col });
  return { ok: true };
}

export async function excluirTarefaGeral(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  const t = await tarefaVisivel(a, id);
  if (!t) return { erro: "tarefas.gerais.erros.naoEncontrada" };
  // Só quem criou ou administrador exclui; o responsável apenas move e edita.
  if (!a.administrador && t.criadoPor !== a.usuario.id) return { erro: "tarefas.gerais.erros.soQuemCriou" };
  await comTenant(a.tenant.id, (tx) => tx.delete(tarefaGeral).where(eq(tarefaGeral.id, id)));
  await auditar(a, "tarefa_geral.excluida", "tarefa_geral", id, { titulo: t.titulo });
  return { ok: true };
}
