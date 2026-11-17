import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { sql } from "drizzle-orm";
import { comTenant, criarBanco } from "./cliente";
import { eventoAuditoria } from "./esquema";

/**
 * Isolamento entre tenants (ADR-0009), contra banco REAL de testes.
 * - `dono`: usuário dono das tabelas, só para preparar e limpar dados.
 * - `app`: usuário da aplicação (papel mna_app), sujeito ao RLS.
 */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const { banco: app, pool: poolApp } = criarBanco(process.env.DATABASE_URL_TESTE);

let tenantA = "";
let tenantB = "";

beforeAll(async () => {
  const sufixo = Date.now().toString(36);
  const r = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Tenant A'), ($2, 'Tenant B') returning id`,
    [`teste-a-${sufixo}`, `teste-b-${sufixo}`],
  );
  [tenantA, tenantB] = r.rows.map((x) => x.id);
  await dono.query(
    `insert into evento_auditoria (tenant_id, tipo) values ($1, 'teste.a'), ($2, 'teste.b')`,
    [tenantA, tenantB],
  );
});

afterAll(async () => {
  await dono.query(`delete from tenant where id = any($1)`, [[tenantA, tenantB]]);
  await dono.end();
  await poolApp.end();
});

describe("catálogo do banco", () => {
  it("toda tabela com tenant_id tem RLS ativado, forçado e com política", async () => {
    const r = await dono.query<{ tabela: string; rls: boolean; forcado: boolean; politicas: number }>(`
      select c.relname as tabela, c.relrowsecurity as rls, c.relforcerowsecurity as forcado,
             (select count(*)::int from pg_policies p where p.tablename = c.relname) as politicas
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
      where c.relkind = 'r'`);
    expect(r.rows.length).toBeGreaterThan(0);
    const semProtecao = r.rows.filter((t) => !t.rls || !t.forcado || t.politicas === 0);
    expect(semProtecao, `Tabelas sem RLS completo: ${semProtecao.map((t) => t.tabela).join(", ")}`).toEqual([]);
  });

  it("o papel da aplicação não é superusuário nem contorna RLS", async () => {
    const r = await app.execute(sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`);
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });
});

describe("isolamento entre tenants", () => {
  it("dentro do tenant A, só enxerga eventos do tenant A", async () => {
    const linhas = await comTenant(tenantA, (tx) => tx.select().from(eventoAuditoria), app);
    expect(linhas.map((l) => l.tenantId)).toEqual([tenantA]);
  });

  it("sem tenant definido, não enxerga nada", async () => {
    const linhas = await app.select().from(eventoAuditoria);
    expect(linhas).toEqual([]);
  });

  it("não consegue gravar evento em outro tenant", async () => {
    await expect(
      comTenant(tenantA, (tx) => tx.insert(eventoAuditoria).values({ tenantId: tenantB, tipo: "invasao" }), app),
    ).rejects.toThrow();
  });

  it("grava no próprio tenant", async () => {
    await comTenant(tenantA, (tx) => tx.insert(eventoAuditoria).values({ tenantId: tenantA, tipo: "teste.gravar" }), app);
    const linhas = await comTenant(tenantA, (tx) => tx.select().from(eventoAuditoria), app);
    expect(linhas.map((l) => l.tipo).sort()).toEqual(["teste.a", "teste.gravar"]);
  });

  it("auditoria é imutável: a aplicação não altera nem apaga", async () => {
    // O Drizzle embrulha o erro do banco; a mensagem original fica em `cause`.
    const motivo = (p: Promise<unknown>) =>
      p.then(
        () => "permitido",
        (e: Error & { cause?: Error }) => e.cause?.message ?? e.message,
      );
    expect(await motivo(comTenant(tenantA, (tx) => tx.update(eventoAuditoria).set({ tipo: "alterado" }), app))).toMatch(
      /permission denied/,
    );
    expect(await motivo(comTenant(tenantA, (tx) => tx.delete(eventoAuditoria), app))).toMatch(/permission denied/);
  });
});
