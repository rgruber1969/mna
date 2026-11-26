import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { auth } from "@/server/auth/auth";
import { entrar } from "./acesso";
import { pedirRedefinicaoDeSenha, redefinirSenha } from "./senha";

/** "Esqueci minha senha" contra o banco de testes; os e-mails ficam presos aqui. */
const enviados = vi.hoisted(() => [] as { para: string; html: string; assunto: string }[]);
vi.mock("@/server/email/enviar", () => ({
  enviarEmail: async (m: { para: string; html: string; assunto: string }) => {
    enviados.push(m);
  },
}));

const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
const sufixo = Date.now().toString(36);
const slugA = `ts-${sufixo}`;
const slugB = `tu-${sufixo}`;
const email = `senha-${sufixo}@exemplo.test`;
const senhaAntiga = "senha-antiga-de-teste-1";
const senhaNova = "senha-nova-de-teste-22";
const host = (sub: string) => new Headers({ host: `${sub}.${dominio}` });

/** Token do último link de senha enviado (o e-mail traz /redefinir-senha/<token>). */
const ultimoToken = () => {
  const m = enviados.at(-1)?.html.match(/redefinir-senha\/([A-Za-z0-9_-]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

beforeAll(async () => {
  const t = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Tenant S'), ($2, 'Tenant U') returning id`,
    [slugA, slugB],
  );
  const ctx = await auth.$context;
  const u = await ctx.internalAdapter.createUser(
    { name: "Sara Teste", email, emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: u.id,
    providerId: "credential",
    accountId: u.id,
    password: await ctx.password.hash(senhaAntiga),
  });
  // Vínculo só no tenant A.
  await dono.query(`insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $2, 'ativo')`, [
    t.rows[0].id,
    u.id,
  ]);
});

afterAll(async () => {
  await dono.query(`delete from tenant where slug in ($1, $2)`, [slugA, slugB]);
  await dono.query(`delete from usuario where email = $1`, [email]);
  await dono.end();
});

describe("esqueci minha senha", () => {
  it("não envia link para conta inexistente nem para endereço sem acesso, com a mesma resposta", async () => {
    enviados.length = 0;
    expect(await pedirRedefinicaoDeSenha(`nao-existe-${sufixo}@exemplo.test`, host(slugA))).toEqual({
      ok: true,
    });
    expect(await pedirRedefinicaoDeSenha(email, host(slugB))).toEqual({ ok: true });
    expect(enviados).toHaveLength(0);
  });

  it("troca a senha pelo link, uma vez só, e só no endereço do pedido", async () => {
    await pedirRedefinicaoDeSenha(email, host(slugA));
    const token = ultimoToken();
    expect(token).not.toBe("");
    // Um pedido logo em seguida não gera outro link.
    await pedirRedefinicaoDeSenha(email, host(slugA));
    expect(enviados.filter((m) => m.html.includes("redefinir-senha"))).toHaveLength(1);

    const dados = { senha: senhaNova, confirmacao: senhaNova };
    expect(await redefinirSenha(token, { senha: "curta", confirmacao: "curta" }, host(slugA))).toHaveProperty(
      "erro",
      "acesso.erros.senhaCurta",
    );
    expect(await redefinirSenha(token, dados, host(slugB))).toHaveProperty("erro");
    expect(await redefinirSenha(token, dados, host(slugA))).toEqual({ ok: true });
    expect(await redefinirSenha(token, dados, host(slugA))).toHaveProperty("erro");

    expect(await entrar({ email, senha: senhaAntiga }, host(slugA))).toHaveProperty("erro");
    expect(await entrar({ email, senha: senhaNova }, host(slugA))).not.toHaveProperty("erro");
    expect(enviados.at(-1)?.para).toBe(email); // aviso de senha alterada
  });
});
