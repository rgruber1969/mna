import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { areaPermitida, auth } from "@/server/auth/auth";
import { type Acesso, tenantPorSlug } from "./acesso";
import {
  convidarParaEquipe,
  definirSuspensao,
  listarEquipe,
  removerDaEquipe,
  renomearTenant,
} from "./console";
import { obterConvite } from "./convites";

/**
 * Console: edição, suspensão e equipe da RGRUBER (perfis-e-permissoes.md,
 * "Administrador geral"), contra o banco de testes.
 */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
const sufixo = Date.now().toString(36);
const slug = `cs-${sufixo}`;
const email = (nome: string) => `${nome}-${sufixo}@exemplo.test`;
let tenantId = "";

async function criarConta(nome: string, papel: string | null = null): Promise<string> {
  const ctx = await auth.$context;
  const u = await ctx.internalAdapter.createUser(
    { name: nome, email: email(nome), emailVerified: true },
    { method: "admin" },
  );
  if (papel) await dono.query(`update usuario set papel_plataforma = $1 where id = $2`, [papel, u.id]);
  return u.id;
}

function acessoConsole(id: string): Acesso {
  return {
    area: "console",
    usuario: { id, nome: "RG", email: "", temAutenticador: true, temPasskey: false, doisFatoresAtivo: true },
    sessaoId: "00000000-0000-0000-0000-000000000000",
    segundoFatorNaSessao: true,
  };
}

const sessoes = async (area: string) =>
  Number((await dono.query(`select count(*) n from sessao where area = $1`, [area])).rows[0].n);

beforeAll(async () => {
  const r = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Tenant CS') returning id`,
    [slug],
  );
  tenantId = r.rows[0].id;
});

afterAll(async () => {
  await dono.query(`delete from tenant where slug = $1`, [slug]);
  await dono.query(`delete from usuario where email like '%-${sufixo}@exemplo.test'`);
  await dono.query(`delete from convite_plataforma where email like '%-${sufixo}@exemplo.test'`);
  await dono.end();
});

describe("edição e suspensão do tenant", () => {
  it("renomeia sem mudar o endereço", async () => {
    const rg = await criarConta("rg1", "admin");
    expect(await renomearTenant(acessoConsole(rg), tenantId, "Novo Nome")).toEqual({ ok: true });
    expect(await tenantPorSlug(slug)).toMatchObject({ nome: "Novo Nome", slug });
  });

  it("suspenso: ninguém entra, sessões encerradas, convites param de valer; reativar devolve o acesso", async () => {
    const rg = await criarConta("rg2", "admin");
    const ana = await criarConta("ana");
    await dono.query(
      `insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $2, 'ativo')`,
      [tenantId, ana],
    );
    await dono.query(
      `insert into sessao (token, usuario_id, area, expira_em) values (gen_random_uuid()::text, $1, $2, now() + interval '1 hour')`,
      [ana, `tenant:${tenantId}`],
    );
    // Convite pendente (token conhecido: "token-cs" com hash calculado pelo banco).
    await dono.query(
      `insert into convite (tenant_id, email, nome, token_hash, expira_em)
       values ($1, $2, 'Bia', encode(sha256('token-cs-${sufixo}'::bytea), 'hex'), now() + interval '1 day')`,
      [tenantId, email("bia")],
    );
    const host = `${slug}.${dominio}`;
    expect(await areaPermitida(host, ana)).toBe(`tenant:${tenantId}`);
    expect(await obterConvite(host, `token-cs-${sufixo}`)).not.toBeNull();

    expect(await definirSuspensao(acessoConsole(rg), tenantId, true)).toEqual({ ok: true });
    expect(await areaPermitida(host, ana)).toBeNull();
    expect(await sessoes(`tenant:${tenantId}`)).toBe(0);
    expect(await tenantPorSlug(slug)).toBeNull();
    expect(await obterConvite(host, `token-cs-${sufixo}`)).toBeNull();

    expect(await definirSuspensao(acessoConsole(rg), tenantId, false)).toEqual({ ok: true });
    expect(await areaPermitida(host, ana)).toBe(`tenant:${tenantId}`);
    const ev = await dono.query(
      `select tipo from evento_plataforma where alvo_id = $1 and tipo like 'tenant.%' order by ocorrido_em`,
      [tenantId],
    );
    expect(ev.rows.map((r) => r.tipo)).toEqual(
      expect.arrayContaining(["tenant.suspenso", "tenant.reativado"]),
    );
  });
});

describe("equipe da RGRUBER", () => {
  it("convida, não duplica, remove na hora e protege o próprio acesso", async () => {
    const rg = await criarConta("rg3", "admin");
    const outro = await criarConta("rg4", "admin");
    expect(await convidarParaEquipe(acessoConsole(rg), { nome: "Nova", email: email("nova") })).toEqual({
      ok: true,
    });
    expect((await listarEquipe(acessoConsole(rg))).convites.map((c) => c.email)).toContain(email("nova"));
    expect(
      await convidarParaEquipe(acessoConsole(rg), { nome: "Outro", email: email("rg4") }),
    ).toHaveProperty("erro");

    await dono.query(
      `insert into sessao (token, usuario_id, area, expira_em) values (gen_random_uuid()::text, $1, 'console', now() + interval '1 hour')`,
      [outro],
    );
    expect(await removerDaEquipe(acessoConsole(rg), rg)).toHaveProperty("erro");
    expect(await removerDaEquipe(acessoConsole(rg), outro)).toEqual({ ok: true });
    const r = await dono.query(
      `select papel_plataforma, (select count(*) from sessao where usuario_id = $1)::int n from usuario where id = $1`,
      [outro],
    );
    expect(r.rows[0]).toEqual({ papel_plataforma: null, n: 0 });
  });
});
