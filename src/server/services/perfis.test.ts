import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { auth } from "@/server/auth/auth";
import { AcessoNegado, type AcessoTenant } from "./acesso";
import {
  copiarMatrizIndividual,
  copiarPerfisPadrao,
  definirExigenciaDoPerfil,
  criarPerfil,
  definirPerfisDoUsuario,
  excluirPerfil,
  listarPerfis,
  obterPerfil,
  permissoesDoUsuario,
  salvarMatrizDoPerfil,
  salvarMatrizIndividual,
} from "./perfis";
import { normalizarMatriz, somarMatrizes } from "./permissoes/catalogo";
import { PERFIS_PADRAO } from "./permissoes/perfis-padrao";
import { exigirPermissao, pode } from "./permissoes/verificador";
import { outroTenantExigeDoisFatores } from "./fatores-da-conta";
import { obterUsuario } from "./usuarios";

/**
 * Perfis e permissões (ADR-0013 e adendo de 2026-11-18;
 * perfis-e-permissoes.md), contra o banco de testes.
 */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const sufixo = Date.now().toString(36);
const email = (nome: string) => `${nome}-${sufixo}@exemplo.test`;
const tenants: Record<"A" | "B", { id: string; slug: string; nome: string }> = {
  A: { id: "", slug: `pa-${sufixo}`, nome: "Tenant PA" },
  B: { id: "", slug: `pb-${sufixo}`, nome: "Tenant PB" },
};

async function criarConta(nome: string, t: "A" | "B" = "A", administrador = false): Promise<string> {
  const ctx = await auth.$context;
  const u = await ctx.internalAdapter.createUser(
    { name: nome, email: email(nome), emailVerified: true },
    { method: "admin" },
  );
  await dono.query(
    `insert into vinculo_tenant (tenant_id, usuario_id, situacao, administrador) values ($1, $2, 'ativo', $3)`,
    [tenants[t].id, u.id, administrador],
  );
  return u.id;
}

/** Acesso de tenant com sessão de dois fatores (cada chamada = uma requisição nova). */
function acesso(
  usuarioId: string,
  opcoes: { t?: "A" | "B"; administrador?: boolean; modo?: "perfil" | "usuario" } = {},
): AcessoTenant {
  return {
    area: "tenant",
    tenant: {
      ...tenants[opcoes.t ?? "A"],
      exigeDoisFatoresDeTodos: false,
      modoPermissoes: opcoes.modo ?? "perfil",
    },
    usuario: {
      id: usuarioId,
      nome: "Pessoa",
      email: "",
      temAutenticador: false,
      temPasskey: true,
      doisFatoresAtivo: true,
    },
    administrador: opcoes.administrador ?? false,
    exigeDoisFatores: false,
    sessaoId: "00000000-0000-0000-0000-000000000000",
    segundoFatorNaSessao: true,
  };
}

let admin = "";
let adminB = "";
const idDoPerfil = async (t: "A" | "B", nome: string) => {
  const r = await dono.query<{ id: string }>(`select id from perfil where tenant_id = $1 and nome = $2`, [
    tenants[t].id,
    nome,
  ]);
  return r.rows[0].id;
};

beforeAll(async () => {
  const r = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, $2), ($3, $4) returning id`,
    [tenants.A.slug, tenants.A.nome, tenants.B.slug, tenants.B.nome],
  );
  tenants.A.id = r.rows[0].id;
  tenants.B.id = r.rows[1].id;
  admin = await criarConta("admin", "A", true);
  adminB = await criarConta("adminb", "B", true);
});

afterAll(async () => {
  await dono.query(`delete from tenant where id = any($1)`, [[tenants.A.id, tenants.B.id]]);
  await dono.query(`delete from usuario where email like '%-${sufixo}@exemplo.test'`);
  await dono.end();
});

describe("catálogo", () => {
  it("normaliza: descarta recursos de outra camada e ações que não se aplicam", () => {
    expect(
      normalizarMatriz(
        { painel: ["ver", "excluir"], documentos: ["ver"], inexistente: ["ver"], deals: ["criar", "ver"] },
        "tenant",
      ),
    ).toEqual({ painel: ["ver"], deals: ["ver", "criar"] });
    expect(normalizarMatriz("lixo", "deal")).toEqual({});
  });

  it("soma matrizes sem repetir ações", () => {
    expect(somarMatrizes([{ deals: ["ver"] }, { deals: ["criar", "ver"], painel: ["ver"] }])).toEqual({
      deals: ["ver", "criar"],
      painel: ["ver"],
    });
  });

  it("os perfis padrão só usam recursos e ações válidos da sua camada", () => {
    for (const p of PERFIS_PADRAO) expect(normalizarMatriz(p.matriz, p.camada), p.nome).toEqual(p.matriz);
  });
});

describe("perfis padrão", () => {
  it("copia o conjunto para o tenant uma única vez", async () => {
    expect(await copiarPerfisPadrao(tenants.A.id)).toBe(PERFIS_PADRAO.length);
    expect(await copiarPerfisPadrao(tenants.A.id)).toBe(0);
    await copiarPerfisPadrao(tenants.B.id);
    const { perfis } = await listarPerfis(acesso(admin, { administrador: true }));
    expect(perfis.filter((p) => p.camada === "tenant").map((p) => p.nome)).toEqual([
      "Equipe do contratante",
      "Gestor do contratante",
      "Usuário externo",
    ]);
    expect(perfis.filter((p) => p.camada === "deal")).toHaveLength(10);
  });

  it("só administradores administram perfis", async () => {
    const comum = await criarConta("comum");
    await expect(listarPerfis(acesso(comum))).rejects.toBeInstanceOf(AcessoNegado);
  });
});

describe("verificador", () => {
  it("negado por padrão; perfis do tenant somam; administrador pode tudo", async () => {
    const ana = await criarConta("ana");
    expect(await pode(acesso(ana), "painel", "ver")).toBe(false);
    expect(await pode(acesso(admin, { administrador: true }), "auditoria", "ver")).toBe(true);

    const externo = await idDoPerfil("A", "Usuário externo");
    const equipe = await idDoPerfil("A", "Equipe do contratante");
    expect(await definirPerfisDoUsuario(acesso(admin, { administrador: true }), ana, [externo])).toEqual({
      ok: true,
    });
    expect(await pode(acesso(ana), "deals", "ver")).toBe(true);
    expect(await pode(acesso(ana), "deals", "criar")).toBe(false);

    await definirPerfisDoUsuario(acesso(admin, { administrador: true }), ana, [externo, equipe]);
    expect(await pode(acesso(ana), "deals", "criar")).toBe(true);
    expect(await pode(acesso(ana), "auditoria", "ver")).toBe(false);
    const p = await permissoesDoUsuario(acesso(admin, { administrador: true }), ana);
    expect(p?.efetiva.deals).toEqual(["ver", "criar", "editar"]);
  });

  it("recursos de deal: sem participação, ninguém além do administrador", async () => {
    const bia = await criarConta("bia");
    await definirPerfisDoUsuario(acesso(admin, { administrador: true }), bia, [
      await idDoPerfil("A", "Gestor do contratante"),
    ]);
    expect(await pode(acesso(bia), "documentos", "ver", { dealId: crypto.randomUUID() })).toBe(false);
    expect(await pode(acesso(admin, { administrador: true }), "documentos", "ver")).toBe(true);
  });

  it("nega com AcessoNegado e registra a negação na auditoria", async () => {
    const caio = await criarConta("caio");
    await expect(exigirPermissao(acesso(caio), "empresas", "criar")).rejects.toBeInstanceOf(AcessoNegado);
    const ev = await dono.query(
      `select detalhes from evento_auditoria where tenant_id = $1 and ator_id = $2 and tipo = 'acesso.negado'`,
      [tenants.A.id, caio],
    );
    expect(ev.rows[0].detalhes).toEqual({ recurso: "empresas", acao: "criar" });
  });

  it("mudança no perfil vale na próxima requisição (sem cache entre requisições)", async () => {
    const duda = await criarConta("duda");
    const perfilNovo = await criarPerfil(acesso(admin, { administrador: true }), {
      nome: `Teste ${sufixo}`,
      camada: "tenant",
    });
    if (!("id" in perfilNovo)) throw new Error(perfilNovo.erro);
    await definirPerfisDoUsuario(acesso(admin, { administrador: true }), duda, [perfilNovo.id]);
    expect(await pode(acesso(duda), "auditoria", "ver")).toBe(false);
    await salvarMatrizDoPerfil(acesso(admin, { administrador: true }), perfilNovo.id, {
      auditoria: ["ver"],
      documentos: ["ver"],
    });
    expect(await pode(acesso(duda), "auditoria", "ver")).toBe(true);
    // A matriz gravada só tem recursos da camada do perfil.
    expect((await obterPerfil(acesso(admin, { administrador: true }), perfilNovo.id))?.matriz).toEqual({
      auditoria: ["ver"],
    });
  });
});

describe("modo por usuário", () => {
  it("matriz individual vale só no modo por usuário, fica guardada e pode ser copiada ou desfeita", async () => {
    const adm = acesso(admin, { administrador: true });
    const junior = await criarConta("junior");
    const senior = await criarConta("senior");
    const equipe = await idDoPerfil("A", "Equipe do contratante");
    await definirPerfisDoUsuario(adm, junior, [equipe]);
    await definirPerfisDoUsuario(adm, senior, [equipe]);

    expect(await salvarMatrizIndividual(adm, junior, equipe, { painel: ["ver"], deals: ["ver"] })).toEqual({
      ok: true,
    });
    // Modo por perfil: a individual fica guardada, mas vale a do perfil.
    expect(await pode(acesso(junior), "deals", "criar")).toBe(true);
    // Modo por usuário: vale a individual.
    expect(await pode(acesso(junior, { modo: "usuario" }), "deals", "criar")).toBe(false);
    expect(await pode(acesso(senior, { modo: "usuario" }), "deals", "criar")).toBe(true);

    // Copiar do júnior para o sênior.
    expect(await copiarMatrizIndividual(adm, senior, equipe, junior)).toEqual({ ok: true });
    expect(await pode(acesso(senior, { modo: "usuario" }), "deals", "criar")).toBe(false);
    // Voltar à matriz do perfil.
    expect(await copiarMatrizIndividual(adm, senior, equipe, "perfil")).toEqual({ ok: true });
    expect(await pode(acesso(senior, { modo: "usuario" }), "deals", "criar")).toBe(true);
  });

  it("só ajusta perfil atribuído à pessoa", async () => {
    const eva = await criarConta("eva");
    const gestor = await idDoPerfil("A", "Gestor do contratante");
    expect(
      await salvarMatrizIndividual(acesso(admin, { administrador: true }), eva, gestor, { painel: ["ver"] }),
    ).toHaveProperty("erro");
  });
});

describe("integridade e isolamento", () => {
  it("perfil em uso não pode ser excluído; nome não se repete na camada", async () => {
    const adm = acesso(admin, { administrador: true });
    const fabio = await criarConta("fabio");
    const externo = await idDoPerfil("A", "Usuário externo");
    await definirPerfisDoUsuario(adm, fabio, [externo]);
    expect(await excluirPerfil(adm, externo)).toHaveProperty("erro");
    expect(await criarPerfil(adm, { nome: "Usuário externo", camada: "tenant" })).toHaveProperty("erro");
    const livre = await criarPerfil(adm, { nome: "Usuário externo", camada: "deal" });
    expect(livre).toHaveProperty("id");
    if ("id" in livre) expect(await excluirPerfil(adm, livre.id)).toEqual({ ok: true });
  });

  it("perfis de outro tenant não aparecem nem podem ser atribuídos", async () => {
    const perfilDeA = await idDoPerfil("A", "Gestor do contratante");
    expect(await obterPerfil(acesso(adminB, { t: "B", administrador: true }), perfilDeA)).toBeNull();
    const gabi = await criarConta("gabi", "B");
    await definirPerfisDoUsuario(acesso(adminB, { t: "B", administrador: true }), gabi, [perfilDeA]);
    const n = await dono.query(`select count(*)::int n from perfil_usuario where usuario_id = $1`, [gabi]);
    expect(n.rows[0].n).toBe(0);
    // Perfil de deal também não entra como perfil do tenant.
    const coordenador = await idDoPerfil("B", "Coordenador do deal");
    await definirPerfisDoUsuario(acesso(adminB, { t: "B", administrador: true }), gabi, [coordenador]);
    const m = await dono.query(`select count(*)::int n from perfil_usuario where usuario_id = $1`, [gabi]);
    expect(m.rows[0].n).toBe(0);
  });
});

describe("2FA por perfil", () => {
  it("perfil do tenant marcado exige 2FA de quem o tem (soma com as outras regras)", async () => {
    const adm = acesso(admin, { administrador: true });
    const hugo = await criarConta("hugo");
    const externo = await idDoPerfil("A", "Usuário externo");
    await definirPerfisDoUsuario(adm, hugo, [externo]);
    expect((await obterUsuario(adm, hugo))?.exigeDoisFatores).toBe(false);
    expect(await outroTenantExigeDoisFatores(hugo, null)).toBe(false);

    expect(await definirExigenciaDoPerfil(adm, externo, true)).toEqual({ ok: true });
    const u = await obterUsuario(adm, hugo);
    expect(u).toMatchObject({ exigePorPerfil: true, exigeIndividual: false, exigeDoisFatores: true });
    expect(await outroTenantExigeDoisFatores(hugo, tenants.B.id)).toBe(true);
    expect(await outroTenantExigeDoisFatores(hugo, tenants.A.id)).toBe(false);

    // Perfil de deal não tem esta opção.
    const coordenador = await idDoPerfil("A", "Coordenador do deal");
    expect(await definirExigenciaDoPerfil(adm, coordenador, true)).toHaveProperty("erro");
    await definirExigenciaDoPerfil(adm, externo, false);
  });
});
