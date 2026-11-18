import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { auth } from "@/server/auth/auth";
import { comTenant } from "@/server/db/cliente";
import { AcessoNegado, type AcessoTenant } from "./acesso";
import { completarCadastrosPadrao } from "./cadastros-padrao";
import { excluirTipoDeVinculo, listarPapeis, listarTiposDeVinculo, salvarTipoDeVinculo } from "./cadastros";
import { criarEmpresa, editarEmpresa, excluirEmpresa, listarEmpresas, obterEmpresa } from "./empresas";
import {
  adicionarVinculo,
  criarPessoa,
  editarPessoa,
  ligarContaAPessoa,
  listarPessoas,
  obterPessoa,
  pessoaVazia,
  revelarDadosSensiveis,
} from "./pessoas";

/** Empresas, papéis e pessoas (item 7) com dados sensíveis criptografados (item 24). */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const sufixo = Date.now().toString(36);
const email = (nome: string) => `${nome}-${sufixo}@exemplo.test`;
let tenantId = "";
let adminId = "";
let semPerfilId = "";

const CPF = "52998224725";
const empresaVazia = {
  cnpj: "",
  identificadorEstrangeiro: "",
  razaoSocial: "",
  nomeFantasia: "",
  cnae: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  pais: "",
  site: "",
  telefone: "",
  email: "",
  observacoes: "",
  grupoId: "",
};

function acesso(usuarioId: string, administrador: boolean): AcessoTenant {
  return {
    area: "tenant",
    tenant: {
      id: tenantId,
      slug: `ep-${sufixo}`,
      nome: "Empresas e Pessoas",
      exigeDoisFatoresDeTodos: false,
      modoPermissoes: "perfil",
      nomeExibido: "Empresas e Pessoas",
      logo: null,
    },
    usuario: {
      id: usuarioId,
      nome: "Teste",
      email: "",
      temAutenticador: false,
      temPasskey: false,
      doisFatoresAtivo: false,
    },
    administrador,
    exigeDoisFatores: false,
    sessaoId: "00000000-0000-0000-0000-000000000000",
    segundoFatorNaSessao: false,
  } as AcessoTenant;
}

async function criarConta(nome: string): Promise<string> {
  const ctx = await auth.$context;
  const u = await ctx.internalAdapter.createUser(
    { name: nome, email: email(nome), emailVerified: true },
    { method: "admin" },
  );
  await dono.query(`insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $2, 'ativo')`, [
    tenantId,
    u.id,
  ]);
  return u.id;
}

beforeAll(async () => {
  const r = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Empresas e Pessoas') returning id`,
    [`ep-${sufixo}`],
  );
  tenantId = r.rows[0].id;
  adminId = await criarConta("admin");
  semPerfilId = await criarConta("semperfil");
});

afterAll(async () => {
  await dono.query(`delete from tenant where id = $1`, [tenantId]);
  await dono.query(`delete from usuario where email like '%-${sufixo}@exemplo.test'`);
  await dono.end();
});

describe("cadastros padrão do tenant", () => {
  it("papéis, tipos de vínculo, empresa do contratante e usuários como pessoas; sem duplicar", async () => {
    await completarCadastrosPadrao(tenantId);
    await completarCadastrosPadrao(tenantId);
    const a = acesso(adminId, true);
    const papeis = await listarPapeis(a);
    expect(papeis).toHaveLength(12);
    expect(papeis.find((p) => p.nome === "Escritório de advocacia da compradora")?.perfilSugerido).toBe(
      "Advogado da compradora",
    );
    expect(await listarTiposDeVinculo(a)).toHaveLength(6);
    const empresas = await listarEmpresas(a);
    expect(empresas.filter((e) => e.doContratante)).toHaveLength(1);
    const pessoas = await listarPessoas(a);
    expect(
      pessoas
        .filter((p) => p.temConta)
        .map((p) => p.email)
        .sort(),
    ).toEqual([email("admin"), email("semperfil")]);
  });
});

describe("permissões", () => {
  it("sem perfil, nada: nem ver nem criar (e a negação é auditada)", async () => {
    const a = acesso(semPerfilId, false);
    await expect(listarEmpresas(a)).rejects.toBeInstanceOf(AcessoNegado);
    await expect(criarPessoa(a, { ...pessoaVazia, nome: "Ninguém" })).rejects.toBeInstanceOf(AcessoNegado);
    const ev = await dono.query(
      `select count(*)::int n from evento_auditoria where ator_id = $1 and tipo = 'acesso.negado'`,
      [semPerfilId],
    );
    expect(ev.rows[0].n).toBe(2);
  });
});

describe("empresas", () => {
  it("CNPJ válido e único no tenant; a empresa do contratante não é excluída", async () => {
    const a = acesso(adminId, true);
    expect(
      await criarEmpresa(a, { ...empresaVazia, razaoSocial: "Alfa", cnpj: "11.222.333/0001-82" }),
    ).toHaveProperty("erro");
    const r = await criarEmpresa(a, {
      ...empresaVazia,
      razaoSocial: "Alfa Ltda",
      cnpj: "11.222.333/0001-81",
      cep: "01001-000",
    });
    expect(r).toHaveProperty("id");
    const dup = await criarEmpresa(a, { ...empresaVazia, razaoSocial: "Outra", cnpj: "11222333000181" });
    expect(dup).toMatchObject({
      erro: "Já existe uma empresa com este CNPJ.",
      existenteId: (r as { id: string }).id,
    });
    const e = await obterEmpresa(a, (r as { id: string }).id);
    expect(e).toMatchObject({ cnpj: "11222333000181", cep: "01001000", pais: "Brasil" });
    // Estrangeira, sem CNPJ.
    expect(
      await criarEmpresa(a, {
        ...empresaVazia,
        razaoSocial: "Foreign Inc.",
        pais: "Estados Unidos",
        identificadorEstrangeiro: "EIN 12-3456789",
      }),
    ).toHaveProperty("id");
    const contratante = (await listarEmpresas(a)).find((x) => x.doContratante)!;
    expect(await excluirEmpresa(a, contratante.id)).toEqual({
      erro: "A empresa do contratante não pode ser excluída.",
    });
    expect(
      await editarEmpresa(a, contratante.id, {
        ...empresaVazia,
        razaoSocial: "Contratante S.A.",
        cnpj: "11222333000181",
      }),
    ).toHaveProperty("erro");
  });
});

describe("pessoas e dados sensíveis", () => {
  it("CPF gravado criptografado, mascarado na leitura, único no tenant; mostrar é auditado", async () => {
    const a = acesso(adminId, true);
    const r = await criarPessoa(a, {
      ...pessoaVazia,
      nome: "Maria Teste",
      email: "Maria@Exemplo.test",
      cpf: "529.982.247-25",
      rg: "12.345.678-9",
      rgOrgao: "Detran",
      rgUf: "rj",
      conjugeNome: "José Teste",
      conjugeRegime: "Comunhão parcial de bens",
    });
    if (!("id" in r)) throw new Error(r.erro);

    const banco = await dono.query(`select * from pessoa where id = $1`, [r.id]);
    const linha = JSON.stringify(banco.rows[0]);
    expect(linha).not.toContain(CPF);
    expect(linha).not.toContain("12.345.678-9");
    expect(linha).not.toContain("Comunhão");
    expect(banco.rows[0]).toMatchObject({ email: "maria@exemplo.test", rg_uf: "RJ" });

    const p = await obterPessoa(a, r.id);
    expect(p?.mascarados).toMatchObject({
      cpf: "***.982.247-**",
      rg: "******-9",
      conjugeRegime: "••••••",
      conjugeCpf: null,
    });
    expect(JSON.stringify(p)).not.toContain(CPF);

    expect(await criarPessoa(a, { ...pessoaVazia, nome: "Outra Maria", cpf: CPF })).toMatchObject({
      erro: "Já existe uma pessoa com este CPF.",
      existenteId: r.id,
    });
    expect(
      await criarPessoa(a, { ...pessoaVazia, nome: "Outra", email: "maria@exemplo.test" }),
    ).toMatchObject({
      erro: "Já existe uma pessoa com este e-mail.",
    });
    expect(await criarPessoa(a, { ...pessoaVazia, nome: "Inválida", cpf: "123.456.789-00" })).toHaveProperty(
      "erro",
    );

    const legiveis = await revelarDadosSensiveis(a, r.id);
    expect(legiveis).toMatchObject({
      cpf: CPF,
      rg: "12.345.678-9",
      conjugeRegime: "Comunhão parcial de bens",
    });
    const ev = await dono.query(
      `select count(*)::int n from evento_auditoria where alvo_id = $1 and tipo = 'pessoa.dados_sensiveis.vistos'`,
      [r.id],
    );
    expect(ev.rows[0].n).toBe(1);

    // Edição: em branco mantém; "limpar" apaga.
    expect(
      await editarPessoa(a, r.id, { ...pessoaVazia, nome: "Maria Teste", email: "maria@exemplo.test" }, [
        "rg",
      ]),
    ).toEqual({
      id: r.id,
    });
    const depois = await revelarDadosSensiveis(a, r.id);
    expect(depois).toMatchObject({ cpf: CPF, rg: null });
  });

  it("dados de outro tenant não abrem (RLS e chave por tenant)", async () => {
    const outro = await dono.query<{ id: string }>(
      `insert into tenant (slug, nome) values ($1, 'Outro') returning id`,
      [`ep2-${sufixo}`],
    );
    try {
      const vistas = await comTenant(outro.rows[0].id, (tx) =>
        tx.execute(`select count(*)::int n from pessoa`),
      );
      expect((vistas.rows[0] as { n: number }).n).toBe(0);
    } finally {
      await dono.query(`delete from tenant where id = $1`, [outro.rows[0].id]);
    }
  });

  it("vínculos com percentual só no tipo que pede; tipo em uso não sai", async () => {
    const a = acesso(adminId, true);
    const e = await criarEmpresa(a, { ...empresaVazia, razaoSocial: "Beta Ltda" });
    const p = await criarPessoa(a, { ...pessoaVazia, nome: "Sócio Beta" });
    if (!("id" in e) || !("id" in p)) throw new Error("cadastro");
    const tipos = await listarTiposDeVinculo(a);
    const socio = tipos.find((t) => t.nome === "Sócio")!;
    const contato = tipos.find((t) => t.nome === "Contato")!;
    expect(
      await adicionarVinculo(a, {
        pessoaId: p.id,
        empresaId: e.id,
        tipoId: socio.id,
        cargo: "",
        percentual: "33,5",
      }),
    ).toEqual({ ok: true });
    expect(
      await adicionarVinculo(a, {
        pessoaId: p.id,
        empresaId: e.id,
        tipoId: contato.id,
        cargo: "Diretor",
        percentual: "10",
      }),
    ).toEqual({
      ok: true,
    });
    expect(
      await adicionarVinculo(a, {
        pessoaId: p.id,
        empresaId: e.id,
        tipoId: socio.id,
        cargo: "",
        percentual: "120",
      }),
    ).toHaveProperty("erro");
    const detalhe = await obterEmpresa(a, e.id);
    expect(detalhe?.vinculos.map((v) => [v.tipo, v.percentual]).sort()).toEqual([
      ["Contato", null],
      ["Sócio", "33.5000"],
    ]);
    expect(await excluirTipoDeVinculo(a, socio.id)).toHaveProperty("erro");
    const novo = await salvarTipoDeVinculo(a, { nome: "Conselheiro", comPercentual: false });
    expect(novo).toHaveProperty("id");
    expect(await excluirTipoDeVinculo(a, (novo as { id: string }).id)).toEqual({ ok: true });
  });
});

describe("conta e pessoa", () => {
  it("o convite aceito liga a conta à pessoa já cadastrada com o mesmo e-mail", async () => {
    const a = acesso(adminId, true);
    const p = await criarPessoa(a, { ...pessoaVazia, nome: "Convidada", email: email("convidada") });
    if (!("id" in p)) throw new Error(p.erro);
    const conta = await criarConta("convidada");
    await comTenant(tenantId, (tx) =>
      ligarContaAPessoa(tx, tenantId, { usuarioId: conta, nome: "Convidada", email: email("convidada") }),
    );
    await comTenant(tenantId, (tx) =>
      ligarContaAPessoa(tx, tenantId, { usuarioId: conta, nome: "Convidada", email: email("convidada") }),
    );
    const lista = (await listarPessoas(a)).filter((x) => x.email === email("convidada"));
    expect(lista).toEqual([expect.objectContaining({ id: p.id, temConta: true })]);
  });
});
