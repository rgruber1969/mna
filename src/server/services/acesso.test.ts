import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { auth } from "@/server/auth/auth";
import { obterAcesso, entrar, hashDoToken } from "./acesso";
import { aceitarConvite } from "./convites";
import { criarTenant, exigirConsole } from "./console";

/**
 * Regras de acesso e sessão (ADR-0011, ADR-0019) contra o banco de testes.
 * O `dono` só prepara e limpa dados; tudo o mais passa pelos serviços.
 */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
const sufixo = Date.now().toString(36);
const slugA = `ta-${sufixo}`;
const slugB = `tb-${sufixo}`;
const senha = "senha-de-teste-123";
const emails = { ana: `ana-${sufixo}@exemplo.test`, rui: `rui-${sufixo}@exemplo.test` };
let tenantA = "";
let tenantB = "";
let ana = "";
let rui = "";

const host = (sub: string) => new Headers({ host: `${sub}.${dominio}` });

async function criarConta(nome: string, email: string): Promise<string> {
  const ctx = await auth.$context;
  const u = await ctx.internalAdapter.createUser(
    { name: nome, email, emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: u.id,
    providerId: "credential",
    accountId: u.id,
    password: await ctx.password.hash(senha),
  });
  return u.id;
}

/** Faz login pela API do Better Auth e devolve cabeçalhos com o cookie da sessão, no mesmo host. */
async function login(sub: string, email: string): Promise<Headers> {
  const r = await auth.api.signInEmail({
    body: { email, password: senha },
    headers: host(sub),
    returnHeaders: true,
  });
  const cookie = r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const h = host(sub);
  h.set("cookie", cookie);
  return h;
}

const comCookie = (sub: string, origem: Headers) => {
  const h = host(sub);
  h.set("cookie", origem.get("cookie") ?? "");
  return h;
};

beforeAll(async () => {
  const t = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Tenant A'), ($2, 'Tenant B') returning id`,
    [slugA, slugB],
  );
  [tenantA, tenantB] = t.rows.map((x) => x.id);
  ana = await criarConta("Ana Teste", emails.ana);
  rui = await criarConta("Rui Teste", emails.rui);
  // Ana: vínculo ativo em A e B. Rui: só em A.
  await dono.query(
    `insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $3, 'ativo'), ($2, $3, 'ativo'), ($1, $4, 'ativo')`,
    [tenantA, tenantB, ana, rui],
  );
});

afterAll(async () => {
  await dono.query(`delete from tenant where slug like 'ta-%' or slug like 'tb-%' or slug like 'tc-%'`);
  await dono.query(`delete from usuario where email like '%@exemplo.test'`);
  await dono.end();
});

describe("sessão ligada ao endereço (ADR-0019, regra 7)", () => {
  it("vale no tenant onde foi criada e é recusada em outro tenant e no console", async () => {
    const h = await login(slugA, emails.ana);
    const acesso = await obterAcesso(h);
    expect(acesso?.area).toBe("tenant");
    expect(acesso?.area === "tenant" && acesso.tenant.id).toBe(tenantA);
    expect(await obterAcesso(comCookie(slugB, h))).toBeNull();
    expect(await obterAcesso(comCookie("admin", h))).toBeNull();
  });

  it("recusa login onde a conta não tem vínculo e no console sem papel de plataforma", async () => {
    expect(await entrar({ email: emails.rui, senha }, host(slugB))).toHaveProperty("erro");
    expect(await entrar({ email: emails.rui, senha }, host("admin"))).toHaveProperty("erro");
  });

  it("não revela se o e-mail existe: mesma mensagem para senha errada e conta inexistente", async () => {
    const a = await entrar({ email: emails.rui, senha: "errada-errada-1" }, host(slugA));
    const b = await entrar({ email: `ninguem-${sufixo}@exemplo.test`, senha }, host(slugA));
    expect(a).toEqual(b);
  });
});

describe("sessão única por endereço (ADR-0019, regra 8)", () => {
  it("novo login no mesmo endereço encerra o anterior; em outro endereço, não", async () => {
    const primeira = await login(slugA, emails.ana);
    const outroTenant = await login(slugB, emails.ana);
    const segunda = await login(slugA, emails.ana);
    expect(await obterAcesso(primeira)).toBeNull();
    expect(await obterAcesso(segunda)).not.toBeNull();
    expect(await obterAcesso(outroTenant)).not.toBeNull();
  });
});

describe("duração e revogação", () => {
  it("sessão com mais de 8 horas é encerrada", async () => {
    const h = await login(slugA, emails.rui);
    await dono.query(
      `update sessao set criado_em = now() - interval '9 hours' where usuario_id = $1 and area = $2`,
      [rui, `tenant:${tenantA}`],
    );
    expect(await obterAcesso(h)).toBeNull();
  });

  it("vínculo revogado bloqueia a sessão existente", async () => {
    const h = await login(slugB, emails.ana);
    expect(await obterAcesso(h)).not.toBeNull();
    await dono.query(
      `update vinculo_tenant set situacao = 'revogado' where tenant_id = $1 and usuario_id = $2`,
      [tenantB, ana],
    );
    expect(await obterAcesso(h)).toBeNull();
  });
});

describe("console (ADR-0011, regra 4)", () => {
  it("usuário da plataforma entra, mas sem 2FA não usa o console", async () => {
    await dono.query(`update usuario set papel_plataforma = 'admin' where id = $1`, [ana]);
    const h = await login("admin", emails.ana);
    const acesso = await obterAcesso(h);
    expect(acesso?.area).toBe("console");
    expect(() => exigirConsole(acesso)).toThrow();
    await expect(criarTenant(acesso, { nome: "X", slug: `tc-${sufixo}` })).rejects.toThrow();
    // O papel de plataforma não vale num endereço de tenant.
    expect(() => exigirConsole(acesso && ({ ...acesso, area: "tenant" } as never))).toThrow();
  });
});

describe("convites (ADR-0019, regra 4)", () => {
  async function criarConvite(email: string, expiraEm: string): Promise<string> {
    const token = `tok-${Math.random().toString(36).slice(2)}`;
    await dono.query(
      `insert into convite (tenant_id, email, nome, administrador, token_hash, expira_em) values ($1, $2, 'Bia', true, $3, ${expiraEm})`,
      [tenantA, email, hashDoToken(token)],
    );
    return token;
  }

  it("convite expirado é recusado", async () => {
    const token = await criarConvite(`bia-${sufixo}@exemplo.test`, "now() - interval '1 minute'");
    expect(await aceitarConvite(token, { nome: "Bia", senha }, host(slugA))).toHaveProperty("erro");
  });

  it("convite válido cria a conta e o vínculo, e só pode ser usado uma vez", async () => {
    const email = `ceci-${sufixo}@exemplo.test`;
    const token = await criarConvite(email, "now() + interval '3 days'");
    const r = await aceitarConvite(token, { nome: "Ceci", senha }, host(slugA));
    expect(r).not.toHaveProperty("erro");
    const v = await dono.query(
      `select v.situacao, v.administrador, u.email_verificado from vinculo_tenant v join usuario u on u.id = v.usuario_id where u.email = $1`,
      [email],
    );
    expect(v.rows).toEqual([{ situacao: "ativo", administrador: true, email_verificado: true }]);
    expect(await aceitarConvite(token, { nome: "Ceci", senha }, host(slugA))).toHaveProperty("erro");
  });

  it("convite de um tenant não funciona no endereço de outro", async () => {
    const token = await criarConvite(`davi-${sufixo}@exemplo.test`, "now() + interval '3 days'");
    expect(await aceitarConvite(token, { nome: "Davi", senha }, host(slugB))).toHaveProperty("erro");
  });
});
