import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { auth } from "@/server/auth/auth";
import type { AcessoTenant } from "./acesso";
import {
  excluirTarefaGeral,
  moverTarefaGeral,
  quadroDeTarefasGerais,
  salvarTarefaGeral,
} from "./tarefas-gerais";

/** Kanban de tarefas gerais contra o banco de testes. */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const sufixo = Date.now().toString(36);
const slug = `tg-${sufixo}`;
let tenantId = "";
const ids: Record<"ana" | "rui" | "eva", string> = { ana: "", rui: "", eva: "" };

function acesso(quem: keyof typeof ids, administrador = false): AcessoTenant {
  return {
    area: "tenant",
    tenant: { id: tenantId, slug, nome: "Tarefas", nomeExibido: "Tarefas", modoPermissoes: "perfil" },
    usuario: { id: ids[quem], nome: quem, email: "" },
    administrador,
  } as unknown as AcessoTenant;
}

beforeAll(async () => {
  const t = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Tarefas') returning id`,
    [slug],
  );
  tenantId = t.rows[0].id;
  const ctx = await auth.$context;
  for (const quem of Object.keys(ids) as (keyof typeof ids)[]) {
    const u = await ctx.internalAdapter.createUser(
      { name: `${quem} teste`, email: `${quem}-tg-${sufixo}@exemplo.test`, emailVerified: true },
      { method: "admin" },
    );
    ids[quem] = u.id;
    await dono.query(
      `insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $2, 'ativo')`,
      [tenantId, u.id],
    );
  }
});

afterAll(async () => {
  await dono.query(`delete from tenant where id = $1`, [tenantId]);
  await dono.query(`delete from usuario where email like $1`, [`%-tg-${sufixo}@exemplo.test`]);
  await dono.end();
});

describe("kanban de tarefas gerais", () => {
  it("quem criou e o responsável veem e movem; outros não; só quem criou exclui", async () => {
    const r = await salvarTarefaGeral(acesso("ana"), null, {
      titulo: "Renovar seguro do escritório",
      descricao: "",
      prioridade: "alta",
      prazo: "2026-12-10",
      responsavelId: ids.rui,
    });
    if (!("id" in r) || !r.id) throw new Error("não criou");
    const vê = async (quem: keyof typeof ids, admin = false) =>
      (await quadroDeTarefasGerais(acesso(quem, admin))).tarefas.some((x) => x.id === r.id);
    expect(await vê("ana")).toBe(true);
    expect(await vê("rui")).toBe(true);
    expect(await vê("eva")).toBe(false);
    expect(await vê("eva", true)).toBe(true);
    // O responsável move; quem não vê, não mexe.
    expect(await moverTarefaGeral(acesso("rui"), r.id, "aguardando")).toEqual({ ok: true });
    expect(await moverTarefaGeral(acesso("eva"), r.id, "concluida")).toHaveProperty("erro");
    expect(await moverTarefaGeral(acesso("ana"), r.id, "inventada")).toHaveProperty("erro");
    const q = await quadroDeTarefasGerais(acesso("ana"));
    expect(q.tarefas.find((x) => x.id === r.id)).toMatchObject({
      situacao: "aguardando",
      responsavel: "rui teste",
    });
    expect(q.pessoas.map((p) => p.id)).toEqual(expect.arrayContaining([ids.ana, ids.rui, ids.eva]));
    // Responsável de fora do escritório é recusado.
    expect(
      await salvarTarefaGeral(acesso("ana"), r.id, {
        titulo: "Renovar seguro",
        descricao: "",
        prioridade: "normal",
        prazo: "",
        responsavelId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      }),
    ).toEqual({ erro: "tarefas.gerais.erros.responsavel" });
    // Excluir: o responsável não pode; quem criou pode.
    expect(await excluirTarefaGeral(acesso("rui"), r.id)).toEqual({
      erro: "tarefas.gerais.erros.soQuemCriou",
    });
    expect(await excluirTarefaGeral(acesso("ana"), r.id)).toEqual({ ok: true });
    expect(await vê("ana")).toBe(false);
  });
});
