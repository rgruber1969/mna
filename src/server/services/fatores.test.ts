import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { auth } from "@/server/auth/auth";
import { linkDoEmail, totp } from "@/testes/apoio";
import { entrarComLinkMagico, pedirLinkMagico } from "./acesso";

/**
 * Link mágico e segundo fator (políticas 1A e 2A em autenticacao-e-sessao.md),
 * contra o banco de testes e o Mailpit local.
 */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
const sufixo = Date.now().toString(36);
const slugA = `fa-${sufixo}`;
const slugB = `fb-${sufixo}`;
const senha = "senha-de-teste-123";
const email = (nome: string) => `${nome}-${sufixo}@exemplo.test`;
let tenantA = "";

const host = (sub: string) => new Headers({ host: `${sub}.${dominio}` });

function comCookies(sub: string, resposta: Headers, anterior?: Headers): Headers {
  const h = host(sub);
  const novos = resposta.getSetCookie().map((c) => c.split(";")[0]);
  h.set("cookie", [anterior?.get("cookie"), ...novos].filter(Boolean).join("; "));
  return h;
}

async function criarContaComVinculo(nome: string): Promise<string> {
  const ctx = await auth.$context;
  const u = await ctx.internalAdapter.createUser(
    { name: nome, email: email(nome), emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: u.id,
    providerId: "credential",
    accountId: u.id,
    password: await ctx.password.hash(senha),
  });
  await dono.query(`insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $2, 'ativo')`, [
    tenantA,
    u.id,
  ]);
  return u.id;
}

const tokenDoLink = (link: string) => decodeURIComponent(link.split("/link/")[1]);
const ultimaSessao = async (usuarioId: string) =>
  (
    await dono.query<{ segundo_fator: boolean }>(
      `select segundo_fator from sessao where usuario_id = $1 order by criado_em desc limit 1`,
      [usuarioId],
    )
  ).rows[0];

/** Ativa o autenticador da conta pela API, como na tela de configuração. Devolve o segredo. */
async function ativarAutenticador(nome: string): Promise<string> {
  const login = await auth.api.signInEmail({
    body: { email: email(nome), password: senha },
    headers: host(slugA),
    returnHeaders: true,
  });
  const h = comCookies(slugA, login.headers);
  const r = await auth.api.enableTwoFactor({ body: { password: senha }, headers: h });
  if (r.method !== "totp") throw new Error("esperado TOTP");
  const segredo = new URL(r.totpURI).searchParams.get("secret")!;
  await auth.api.verifyTOTP({ body: { code: totp(segredo) }, headers: h });
  return segredo;
}

beforeAll(async () => {
  const t = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Tenant FA'), ($2, 'Tenant FB') returning id`,
    [slugA, slugB],
  );
  tenantA = t.rows[0].id;
});

afterAll(async () => {
  await dono.query(`delete from tenant where slug like 'fa-%' or slug like 'fb-%'`);
  await dono.query(`delete from usuario where email like '%-${sufixo}@exemplo.test'`);
  await dono.end();
});

describe("link mágico (política 1A)", () => {
  it("envia o link só para quem tem acesso ao endereço, e o link vale uma vez", async () => {
    const id = await criarContaComVinculo("lia");
    await pedirLinkMagico(email("lia"), host(slugB)); // sem vínculo em B: nada é enviado
    expect(await linkDoEmail(email("lia"), /\/link\/\S+/, 4)).toBeNull();

    await pedirLinkMagico(email("lia"), host(slugA));
    const link = await linkDoEmail(email("lia"), /https?:\/\/\S+\/link\/\S+/);
    expect(link).toContain(`://${slugA}.${dominio}/link/`);

    expect(await entrarComLinkMagico(tokenDoLink(link!), host(slugA))).toEqual({ etapa: "concluido" });
    expect(await ultimaSessao(id)).toEqual({ segundo_fator: false });
    expect(await entrarComLinkMagico(tokenDoLink(link!), host(slugA))).toHaveProperty("erro");
  });

  it("pedido para e-mail desconhecido responde igual e não envia nada", async () => {
    expect(await pedirLinkMagico(email("ninguem"), host(slugA))).toEqual({ ok: true });
    expect(await linkDoEmail(email("ninguem"), /\/link\/\S+/, 4)).toBeNull();
  });

  it("quem tem autenticador precisa do código depois do link (o link não pula o 2FA)", async () => {
    const id = await criarContaComVinculo("teo");
    await ativarAutenticador("teo");
    const antes = (await dono.query(`select count(*)::int n from sessao where usuario_id = $1`, [id])).rows[0]
      .n;

    await pedirLinkMagico(email("teo"), host(slugA));
    const link = await linkDoEmail(email("teo"), /https?:\/\/\S+\/link\/\S+/);
    expect(await entrarComLinkMagico(tokenDoLink(link!), host(slugA))).toEqual({ etapa: "dois-fatores" });
    const depois = (await dono.query(`select count(*)::int n from sessao where usuario_id = $1`, [id]))
      .rows[0].n;
    expect(depois).toBe(antes); // nenhuma sessão nova sem o código
  });
});

describe("sessão registra se houve dois fatores (política 2A)", () => {
  it("senha sozinha: sem segundo fator; senha + código: com segundo fator", async () => {
    const id = await criarContaComVinculo("bia");
    await auth.api.signInEmail({ body: { email: email("bia"), password: senha }, headers: host(slugA) });
    expect(await ultimaSessao(id)).toEqual({ segundo_fator: false });

    const segredo = await ativarAutenticador("bia");
    expect(await ultimaSessao(id)).toEqual({ segundo_fator: true }); // sessão nova após confirmar o código

    // Novo login com senha: pede o código; com ele, a sessão nasce com segundo fator.
    const etapa1 = await auth.api.signInEmail({
      body: { email: email("bia"), password: senha },
      headers: host(slugA),
      returnHeaders: true,
    });
    expect(etapa1.response).toHaveProperty("twoFactorRedirect", true);
    await new Promise((r) => setTimeout(r, 31_000 - (Date.now() % 30_000))); // próximo código
    await auth.api.verifyTOTP({ body: { code: totp(segredo) }, headers: comCookies(slugA, etapa1.headers) });
    expect(await ultimaSessao(id)).toEqual({ segundo_fator: true });
  }, 60_000);
});
