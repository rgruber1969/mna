import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { auth } from "@/server/auth/auth";
import {
  AcessoNegado,
  exigirAdministrador,
  opcoesParaCriarPasskey,
  pendenciaDeDoisFatores,
  type AcessoTenant,
  type Acesso,
} from "./acesso";
import { redefinirDoisFatoresPelaPlataforma } from "./console";
import {
  definirAdministrador,
  definirExigenciaDeTodos,
  listarUsuarios,
  REDEFINICAO_PELA_PLATAFORMA,
  redefinirDoisFatoresDoUsuario,
  removerAutenticadorDoUsuario,
  removerPasskeyDoUsuario,
  revogarAcesso,
} from "./usuarios";

/**
 * Usuários do tenant, exigência e recuperação do 2FA (autenticacao-e-sessao.md:
 * "Exigência no tenant" e "Recuperação"), contra o banco de testes.
 */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
const sufixo = Date.now().toString(36);
const senha = "senha-de-teste-123";
const email = (nome: string) => `${nome}-${sufixo}@exemplo.test`;
const tenants: Record<"A" | "B", { id: string; slug: string; nome: string }> = {
  A: { id: "", slug: `ua-${sufixo}`, nome: "Tenant UA" },
  B: { id: "", slug: `ub-${sufixo}`, nome: "Tenant UB" },
};

async function criarConta(nome: string): Promise<string> {
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
  return u.id;
}

async function vincular(
  usuarioId: string,
  t: "A" | "B",
  extra: { administrador?: boolean; exige?: boolean } = {},
) {
  await dono.query(
    `insert into vinculo_tenant (tenant_id, usuario_id, situacao, administrador, exige_2fa)
     values ($1, $2, 'ativo', $3, $4)`,
    [tenants[t].id, usuarioId, extra.administrador ?? false, extra.exige ?? false],
  );
}

async function darPasskey(usuarioId: string, nome = "Celular") {
  await dono.query(
    `insert into chave_de_acesso (usuario_id, nome, chave_publica, id_credencial, contador, tipo_dispositivo, com_copia)
     values ($1, $2, 'chave', gen_random_uuid()::text, 0, 'singleDevice', false)`,
    [usuarioId, nome],
  );
}

async function darAutenticador(usuarioId: string) {
  await dono.query(`update usuario set dois_fatores_ativo = true where id = $1`, [usuarioId]);
  await dono.query(
    `insert into dois_fatores (usuario_id, segredo, codigos_recuperacao) values ($1, 's', 'c')`,
    [usuarioId],
  );
}

async function criarSessao(usuarioId: string, area: string) {
  await dono.query(
    `insert into sessao (token, usuario_id, area, expira_em) values (gen_random_uuid()::text, $1, $2, now() + interval '1 hour')`,
    [usuarioId, area],
  );
}

const contar = async (sql: string, params: unknown[]) =>
  Number((await dono.query<{ n: string }>(sql, params)).rows[0].n);
const passkeys = (id: string) => contar(`select count(*) n from chave_de_acesso where usuario_id = $1`, [id]);
const sessoes = (id: string) => contar(`select count(*) n from sessao where usuario_id = $1`, [id]);

/** Acesso de administrador com sessão de dois fatores no tenant indicado. */
function acessoAdmin(usuarioId: string, t: "A" | "B" = "A"): AcessoTenant {
  return {
    area: "tenant",
    tenant: { ...tenants[t], exigeDoisFatoresDeTodos: false, modoPermissoes: "perfil" },
    usuario: {
      id: usuarioId,
      nome: "Admin",
      email: email("admin"),
      temAutenticador: false,
      temPasskey: true,
      doisFatoresAtivo: true,
    },
    administrador: true,
    exigeDoisFatores: true,
    sessaoId: "00000000-0000-0000-0000-000000000000",
    segundoFatorNaSessao: true,
  };
}

let admin = "";

beforeAll(async () => {
  const r = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, $2), ($3, $4) returning id`,
    [tenants.A.slug, tenants.A.nome, tenants.B.slug, tenants.B.nome],
  );
  tenants.A.id = r.rows[0].id;
  tenants.B.id = r.rows[1].id;
  admin = await criarConta("admin");
  await vincular(admin, "A", { administrador: true });
  await darPasskey(admin);
});

afterAll(async () => {
  await dono.query(`delete from tenant where slug = any($1)`, [[tenants.A.slug, tenants.B.slug]]);
  await dono.query(`delete from usuario where email like '%-${sufixo}@exemplo.test'`);
  await dono.end();
});

describe("exigência de 2FA (regras somadas)", () => {
  const base = acessoAdmin("00000000-0000-0000-0000-000000000001");
  const pessoa = (
    mudancas: Partial<AcessoTenant>,
    usuario: Partial<AcessoTenant["usuario"]> = {},
  ): Acesso => ({
    ...base,
    administrador: false,
    exigeDoisFatores: false,
    segundoFatorNaSessao: false,
    ...mudancas,
    usuario: { ...base.usuario, doisFatoresAtivo: false, ...usuario },
  });

  it("sem exigência, nada pendente; com exigência, configurar ou entrar de novo", () => {
    expect(pendenciaDeDoisFatores(pessoa({}))).toBeNull();
    expect(pendenciaDeDoisFatores(pessoa({ exigeDoisFatores: true }))).toBe("configurar");
    expect(pendenciaDeDoisFatores(pessoa({ exigeDoisFatores: true }, { doisFatoresAtivo: true }))).toBe(
      "reentrar",
    );
    expect(
      pendenciaDeDoisFatores(
        pessoa({ exigeDoisFatores: true, segundoFatorNaSessao: true }, { doisFatoresAtivo: true }),
      ),
    ).toBeNull();
  });

  it("serviços de administração recusam quem não é administrador ou não entrou com dois fatores", () => {
    expect(() => exigirAdministrador(pessoa({}))).toThrow(AcessoNegado);
    expect(() =>
      exigirAdministrador(
        pessoa({ administrador: true, exigeDoisFatores: true }, { doisFatoresAtivo: true }),
      ),
    ).toThrow(AcessoNegado);
    expect(exigirAdministrador(base).administrador).toBe(true);
  });

  it("administrador e 'exigir de todos' entram na soma; desligar 'todos' mantém a marcação individual", async () => {
    const marcado = await criarConta("marcado");
    const comum = await criarConta("comum");
    await vincular(marcado, "A", { exige: true });
    await vincular(comum, "A");
    const exige = async () =>
      Object.fromEntries(
        (await listarUsuarios(acessoAdmin(admin))).usuarios.map((u) => [u.id, u.exigeDoisFatores]),
      );
    expect(await exige()).toMatchObject({ [admin]: true, [marcado]: true, [comum]: false });
    await definirExigenciaDeTodos(acessoAdmin(admin), true);
    expect(await exige()).toMatchObject({ [comum]: true });
    await definirExigenciaDeTodos(acessoAdmin(admin), false);
    expect(await exige()).toMatchObject({ [marcado]: true, [comum]: false });
  });
});

describe("recuperação do 2FA pelo administrador do tenant", () => {
  it("não remove o único fator, mas remove um aparelho perdido se restar outro", async () => {
    const ana = await criarConta("ana");
    await vincular(ana, "A");
    await darPasskey(ana, "Celular perdido");
    const [{ id: perdido }] = (
      await dono.query<{ id: string }>(`select id from chave_de_acesso where usuario_id = $1`, [ana])
    ).rows;
    expect(await removerPasskeyDoUsuario(acessoAdmin(admin), ana, perdido)).toHaveProperty("erro");

    await darAutenticador(ana);
    await criarSessao(ana, `tenant:${tenants.A.id}`);
    expect(await removerPasskeyDoUsuario(acessoAdmin(admin), ana, perdido)).toEqual({ ok: true });
    expect(await passkeys(ana)).toBe(0);
    expect(await sessoes(ana)).toBe(0);
    expect(await removerAutenticadorDoUsuario(acessoAdmin(admin), ana)).toHaveProperty("erro");
  });

  it("redefine tudo se nenhum outro tenant exige 2FA da pessoa", async () => {
    const bia = await criarConta("bia");
    await vincular(bia, "A");
    await vincular(bia, "B"); // está em B, mas B não exige dela
    await darPasskey(bia);
    await darAutenticador(bia);
    await criarSessao(bia, `tenant:${tenants.B.id}`);
    expect(await redefinirDoisFatoresDoUsuario(acessoAdmin(admin), bia)).toEqual({ ok: true });
    expect(await passkeys(bia)).toBe(0);
    expect(await sessoes(bia)).toBe(0);
    const u = await dono.query(`select dois_fatores_ativo from usuario where id = $1`, [bia]);
    expect(u.rows[0]).toEqual({ dois_fatores_ativo: false });
  });

  it("não redefine se outro tenant (ou o console) exige 2FA; a RGRUBER redefine pelo console", async () => {
    const caio = await criarConta("caio");
    await vincular(caio, "A");
    await vincular(caio, "B", { exige: true });
    await darPasskey(caio);
    expect(await redefinirDoisFatoresDoUsuario(acessoAdmin(admin), caio)).toEqual({
      erro: REDEFINICAO_PELA_PLATAFORMA,
    });
    expect(await passkeys(caio)).toBe(1);

    const rg = await criarConta("rg");
    await dono.query(`update usuario set papel_plataforma = 'admin' where id = $1`, [rg]);
    await vincular(rg, "A");
    expect(await redefinirDoisFatoresDoUsuario(acessoAdmin(admin), rg)).toHaveProperty("erro");

    const consoleAcesso: Acesso = {
      area: "console",
      usuario: { ...acessoAdmin(rg).usuario, id: rg },
      sessaoId: "00000000-0000-0000-0000-000000000000",
      segundoFatorNaSessao: true,
    };
    const dados = { email: email("caio"), motivo: "perdeu-aparelho", identidadeConfirmada: false };
    expect(await redefinirDoisFatoresPelaPlataforma(consoleAcesso, dados)).toHaveProperty("erro");
    expect(
      await redefinirDoisFatoresPelaPlataforma(consoleAcesso, { ...dados, identidadeConfirmada: true }),
    ).toEqual({ ok: true });
    expect(await passkeys(caio)).toBe(0);
    const ev = await dono.query(
      `select detalhes from evento_plataforma where alvo_id = $1 and tipo = 'usuario.2fa.redefinido'`,
      [caio],
    );
    expect(ev.rows[0].detalhes).toEqual({ motivo: "perdeu-aparelho" });
  });
});

describe("papel e revogação", () => {
  it("revoga na hora (sessões só deste tenant) e protege o último administrador", async () => {
    const duda = await criarConta("duda");
    await vincular(duda, "A");
    await vincular(duda, "B");
    await criarSessao(duda, `tenant:${tenants.A.id}`);
    await criarSessao(duda, `tenant:${tenants.B.id}`);
    expect(await revogarAcesso(acessoAdmin(admin), duda)).toEqual({ ok: true });
    expect(await sessoes(duda)).toBe(1); // a sessão em B continua
    expect(await revogarAcesso(acessoAdmin(admin), admin)).toHaveProperty("erro");
    expect(await definirAdministrador(acessoAdmin(admin), admin, false)).toHaveProperty("erro");
  });
});

describe("cadastro de novo fator", () => {
  it("quem já tem fator precisa de sessão com dois fatores para cadastrar outro", async () => {
    const eva = await criarConta("eva");
    await vincular(eva, "A");
    const entrar = async () => {
      const r = await auth.api.signInEmail({
        body: { email: email("eva"), password: senha },
        headers: new Headers({ host: `${tenants.A.slug}.${dominio}` }),
        returnHeaders: true,
      });
      const h = new Headers({ host: `${tenants.A.slug}.${dominio}` });
      h.set(
        "cookie",
        r.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; "),
      );
      return h;
    };
    expect(await opcoesParaCriarPasskey(await entrar())).not.toHaveProperty("erro");
    await darPasskey(eva);
    expect(await opcoesParaCriarPasskey(await entrar())).toHaveProperty("erro");
  });
});
