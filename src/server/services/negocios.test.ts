import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { auth } from "@/server/auth/auth";
import { AcessoNegado, type AcessoTenant } from "./acesso";
import { completarCadastrosPadrao } from "./cadastros-padrao";
import { criarEmpresa, criarGrupo } from "./empresas";
import { adicionarVinculo } from "./pessoas";
import {
  adicionarEmpresaAoNegocio,
  adicionarParticipante,
  criarNegocio,
  editarNegocio,
  excluirNegocio,
  excluirTipoDeOperacao,
  listarTiposDeOperacao,
  obterNegocio,
  opcoesParaNovoNegocio,
  paginaDeNegocios,
  removerEmpresaDoNegocio,
  removerParticipante,
} from "./negocios";

/** Negócios (item 8): criação, visibilidade por participação, lados e sigilo do lado comprador. */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const sufixo = Date.now().toString(36);
const email = (nome: string) => `${nome}-${sufixo}@exemplo.test`;
let tenantId = "";
const contas: Record<string, string> = {};

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
const pedido = { pagina: 1, porPagina: 25, ordem: "numero" as const, direcao: "asc" as const };

function acesso(nome: string, administrador = false): AcessoTenant {
  return {
    area: "tenant",
    tenant: {
      id: tenantId,
      slug: `ng-${sufixo}`,
      nome: "Negócios",
      exigeDoisFatoresDeTodos: false,
      modoPermissoes: "perfil",
      nomeExibido: "Negócios",
      logo: null,
    },
    usuario: {
      id: contas[nome],
      nome,
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

async function criarConta(nome: string, perfilDoTenant: string | null): Promise<void> {
  const ctx = await auth.$context;
  const u = await ctx.internalAdapter.createUser(
    { name: nome, email: email(nome), emailVerified: true },
    { method: "admin" },
  );
  contas[nome] = u.id;
  await dono.query(`insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $2, 'ativo')`, [
    tenantId,
    u.id,
  ]);
  await dono.query(`insert into pessoa (tenant_id, nome, email, usuario_id) values ($1, $2, $3, $4)`, [
    tenantId,
    nome,
    email(nome),
    u.id,
  ]);
  if (perfilDoTenant)
    await dono.query(
      `insert into perfil_usuario (tenant_id, usuario_id, perfil_id)
       select $1, $2, id from perfil where tenant_id = $1 and padrao = $3 and camada = 'tenant'`,
      [tenantId, u.id, perfilDoTenant],
    );
}

const pessoaDe = async (nome: string) =>
  (await dono.query<{ id: string }>(`select id from pessoa where usuario_id = $1`, [contas[nome]])).rows[0]
    .id;
const papel = async (codigo: string) =>
  (
    await dono.query<{ id: string }>(`select id from papel_empresa where tenant_id = $1 and padrao = $2`, [
      tenantId,
      codigo,
    ])
  ).rows[0].id;
const perfilDeDeal = async (codigo: string) =>
  (
    await dono.query<{ id: string }>(
      `select id from perfil where tenant_id = $1 and padrao = $2 and camada = 'deal'`,
      [tenantId, codigo],
    )
  ).rows[0].id;

let vendedora = "";
let compradoraA = "";
let compradoraB = "";
let negocioId = "";

beforeAll(async () => {
  const r = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Negócios') returning id`,
    [`ng-${sufixo}`],
  );
  tenantId = r.rows[0].id;
  await completarCadastrosPadrao(tenantId);
  await criarConta("admin", null);
  await criarConta("gestor", "gestor-contratante");
  await criarConta("externo", "usuario-externo");
  await criarConta("compradorb", "usuario-externo");
  await criarConta("curioso", "equipe-contratante");
  const a = acesso("admin", true);
  const id = async (nome: string) => {
    const e = await criarEmpresa(a, { ...empresaVazia, razaoSocial: nome });
    if (!("id" in e)) throw new Error(e.erro);
    return e.id;
  };
  vendedora = await id("Vendedora Exemplo Ltda");
  compradoraA = await id("Compradora A S.A.");
  compradoraB = await id("Compradora B S.A.");
  const [{ id: socio }] = (
    await dono.query(`select id from tipo_vinculo where tenant_id = $1 and padrao = 'contato'`, [tenantId])
  ).rows as { id: string }[];
  await adicionarVinculo(a, {
    pessoaId: await pessoaDe("externo"),
    empresaId: compradoraA,
    tipoId: socio,
    cargo: "",
    percentual: "",
  });
  await adicionarVinculo(a, {
    pessoaId: await pessoaDe("compradorb"),
    empresaId: compradoraB,
    tipoId: socio,
    cargo: "",
    percentual: "",
  });
});

afterAll(async () => {
  await dono.query(`delete from tenant where id = $1`, [tenantId]);
  await dono.query(`delete from usuario where email like '%-${sufixo}@exemplo.test'`);
  await dono.end();
});

describe("cadastros do negócio", () => {
  it("tipos de operação padrão; papéis com lado", async () => {
    const tipos = await listarTiposDeOperacao(acesso("gestor"));
    expect(tipos.map((t) => t.nome)).toContain("Aquisição parcial");
    expect(tipos.find((t) => t.nome === "Aquisição parcial")?.comPercentual).toBe(true);
    const { papeis } = await opcoesParaNovoNegocio(acesso("gestor"));
    expect(papeis.find((p) => p.nome === "Escritório de advocacia da vendedora")?.lado).toBe("vendedor");
    expect(papeis.find((p) => p.nome === "Compradora")?.lado).toBe("comprador");
  });
});

describe("criação e visibilidade", () => {
  it("cria com número sequencial; quem criou é Coordenador representando o contratante", async () => {
    const g = acesso("gestor");
    const { tipos } = await opcoesParaNovoNegocio(g);
    const base = {
      codinome: "Projeto Gadol",
      nomeInterno: "Venda da Vendedora Exemplo",
      tipoOperacaoId: tipos.find((t) => t.nome === "Aquisição total")!.id,
      percentual: "",
      papelContratanteId: await papel("escritorio-vendedora"),
      objeto: "empresas" as const,
      vendedoras: [vendedora],
      grupoId: "",
      dataInicio: "2026-11-19",
    };
    const parcial = await criarNegocio(g, {
      ...base,
      tipoOperacaoId: tipos.find((t) => t.comPercentual)!.id,
    });
    expect(parcial).toMatchObject({ erro: "negocios.erros.percentualObrigatorio", campo: "percentual" });
    const r = await criarNegocio(g, base);
    if (!("id" in r)) throw new Error(r.erro);
    negocioId = r.id;
    const d = await obterNegocio(g, negocioId);
    expect(d?.nome).toBe("N-0001 Projeto Gadol");
    expect(d?.nomeInterno).toBe("Venda da Vendedora Exemplo");
    expect(d?.participantes).toMatchObject([
      { nome: "gestor", perfil: "Coordenador do negócio", coordenador: true, lado: "vendedor" },
    ]);
    expect(d?.empresas.map((e) => [e.papel, e.lado]).sort()).toEqual([
      ["Escritório de advocacia da vendedora", "vendedor"],
      ["Vendedora", "vendedor"],
    ]);
    const outro = await criarNegocio(g, { ...base, codinome: "Projeto Dois" });
    if (!("id" in outro)) throw new Error(outro.erro);
    expect((await obterNegocio(g, outro.id))?.numero).toBe(2);
    expect(await excluirNegocio(g, outro.id)).toEqual({ ok: true });
  });

  it("grupo econômico: as empresas do grupo entram como vendedoras", async () => {
    const a = acesso("admin", true);
    const grupo = await criarGrupo(a, "Grupo Exemplo");
    if (!("id" in grupo)) throw new Error(grupo.erro);
    const vazio = await criarNegocio(acesso("gestor"), {
      codinome: "Projeto Grupo",
      nomeInterno: "Grupo",
      tipoOperacaoId: (await listarTiposDeOperacao(a)).find((t) => !t.comPercentual)!.id,
      percentual: "",
      papelContratanteId: await papel("advisor-vendedora"),
      objeto: "grupo",
      vendedoras: [],
      grupoId: grupo.id,
      dataInicio: "2026-11-19",
    });
    expect(vazio).toMatchObject({ erro: "negocios.erros.grupoSemEmpresas" });
    await dono.query(`update empresa set grupo_id = $1 where id = $2`, [grupo.id, vendedora]);
    const comGrupo = await criarNegocio(acesso("gestor"), {
      codinome: "Projeto Grupo",
      nomeInterno: "Grupo",
      tipoOperacaoId: (await listarTiposDeOperacao(a)).find((t) => !t.comPercentual)!.id,
      percentual: "",
      papelContratanteId: await papel("advisor-vendedora"),
      objeto: "grupo",
      vendedoras: [],
      grupoId: grupo.id,
      dataInicio: "2026-11-19",
    });
    if (!("id" in comGrupo)) throw new Error(comGrupo.erro);
    const d = await obterNegocio(acesso("gestor"), comGrupo.id);
    expect(d?.grupo).toBe("Grupo Exemplo");
    expect(d?.empresas.find((e) => e.papel === "Vendedora")?.nome).toBe("Vendedora Exemplo Ltda");
    expect(await excluirNegocio(acesso("gestor"), comGrupo.id)).toEqual({ ok: true });
  });

  it("quem não participa não vê; administrador vê tudo, com auditoria", async () => {
    expect((await paginaDeNegocios(acesso("curioso"), {}, pedido)).total).toBe(0);
    await expect(obterNegocio(acesso("curioso"), negocioId)).rejects.toBeInstanceOf(AcessoNegado);
    expect((await paginaDeNegocios(acesso("admin", true), {}, pedido)).itens.map((n) => n.nome)).toEqual([
      "N-0001 Projeto Gadol",
    ]);
    await obterNegocio(acesso("admin", true), negocioId);
    const ev = await dono.query(
      `select count(*)::int n from evento_auditoria where tipo = 'negocio.visualizado' and alvo_id = $1`,
      [negocioId],
    );
    expect(ev.rows[0].n).toBe(1);
  });
});

describe("lados e sigilo", () => {
  it("uma empresa só fica num lado do negócio", async () => {
    const g = acesso("gestor");
    expect(
      await adicionarEmpresaAoNegocio(g, negocioId, {
        empresaId: compradoraA,
        papelId: await papel("compradora"),
      }),
    ).toEqual({
      ok: true,
    });
    expect(
      await adicionarEmpresaAoNegocio(g, negocioId, {
        empresaId: compradoraB,
        papelId: await papel("compradora"),
      }),
    ).toEqual({
      ok: true,
    });
    expect(
      await adicionarEmpresaAoNegocio(g, negocioId, {
        empresaId: compradoraA,
        papelId: await papel("socios-vendedora"),
      }),
    ).toMatchObject({ erro: "negocios.erros.mesmaEmpresaNosDoisLados" });
  });

  it("compradora antes do NDA: só número e codinome, sem vendedora nem outras compradoras", async () => {
    const g = acesso("gestor");
    const r = await adicionarParticipante(g, negocioId, {
      pessoaId: await pessoaDe("externo"),
      perfilId: await perfilDeDeal("representante"),
      empresaId: "",
      lado: "",
      prazo: "",
    });
    expect(r).toEqual({ ok: true });
    await adicionarParticipante(g, negocioId, {
      pessoaId: await pessoaDe("compradorb"),
      perfilId: await perfilDeDeal("representante"),
      empresaId: "",
      lado: "",
      prazo: "",
    });
    const visto = await obterNegocio(acesso("externo"), negocioId);
    expect(visto?.nome).toBe("N-0001 Projeto Gadol");
    expect(visto?.nomeInterno).toBeNull();
    expect(visto?.empresas.map((e) => e.nome)).toEqual(["Compradora A S.A."]);
    expect(visto?.participantes.map((p) => p.nome)).toEqual(["externo"]);
    expect(visto?.podeEditar).toBe(false);
    const lista = await paginaDeNegocios(acesso("externo"), { busca: "Vendedora Exemplo" }, pedido);
    expect(lista.total).toBe(0);
    await expect(
      editarNegocio(acesso("externo"), negocioId, {
        codinome: "X",
        nomeInterno: "X",
        tipoOperacaoId: "",
        percentual: "",
        dataInicio: "",
        previsaoFechamento: "",
        valorEstimado: "",
        descricao: "",
      }),
    ).rejects.toBeInstanceOf(AcessoNegado);
    // Depois do NDA, a compradora passa a ver quem vende.
    await dono.query(
      `update deal_empresa set situacao_funil = 'nda' where deal_id = $1 and empresa_id = $2`,
      [negocioId, compradoraA],
    );
    const depois = await obterNegocio(acesso("externo"), negocioId);
    expect(depois?.nomeInterno).toBe("Venda da Vendedora Exemplo");
    expect(depois?.empresas.map((e) => e.nome).sort()).toEqual([
      "Compradora A S.A.",
      "Negócios",
      "Vendedora Exemplo Ltda",
    ]);
  });

  it("prazo vencido tira o acesso; o último coordenador não sai; a empresa com representante não sai", async () => {
    const g = acesso("gestor");
    await dono.query(
      `update participacao_deal set prazo = current_date - 1 where deal_id = $1 and pessoa_id = $2`,
      [negocioId, await pessoaDe("compradorb")],
    );
    await expect(obterNegocio(acesso("compradorb"), negocioId)).rejects.toBeInstanceOf(AcessoNegado);
    const d = await obterNegocio(g, negocioId);
    const coord = d!.participantes.find((p) => p.coordenador)!;
    expect(await removerParticipante(g, negocioId, coord.id)).toMatchObject({
      erro: "negocios.erros.ultimoCoordenador",
    });
    const papelA = d!.empresas.find((e) => e.nome === "Compradora A S.A.")!;
    expect(await removerEmpresaDoNegocio(g, negocioId, papelA.id)).toMatchObject({
      erro: "negocios.erros.empresaComParticipantes",
    });
    const externo = d!.participantes.find((p) => p.nome === "externo")!;
    expect(await removerParticipante(g, negocioId, externo.id)).toEqual({ ok: true });
    await expect(obterNegocio(acesso("externo"), negocioId)).rejects.toBeInstanceOf(AcessoNegado);
    const n = await dono.query(`select tipo from notificacao where usuario_id = $1 order by criado_em`, [
      contas.externo,
    ]);
    expect(n.rows.map((x) => x.tipo)).toEqual(["negocio_incluido", "negocio_removido"]);
  });

  it("tipo de operação em uso não pode ser excluído", async () => {
    const d = await obterNegocio(acesso("gestor"), negocioId);
    expect(await excluirTipoDeOperacao(acesso("admin", true), d!.tipoOperacaoId!)).toMatchObject({
      erro: "negocios.erros.tipoEmUso",
    });
  });
});

describe("equipe da compradora (escritório, advisor)", () => {
  it("com várias compradoras, escolhe para qual trabalha e vê o negócio como ela", async () => {
    const g = acesso("gestor");
    const a = acesso("admin", true);
    await criarConta("adva", "usuario-externo");
    const esc = await criarEmpresa(a, { ...empresaVazia, razaoSocial: "Escritório da Compradora A" });
    if (!("id" in esc)) throw new Error(esc.erro);
    const [{ id: contato }] = (
      await dono.query(`select id from tipo_vinculo where tenant_id = $1 and padrao = 'contato'`, [tenantId])
    ).rows as { id: string }[];
    await adicionarVinculo(a, {
      pessoaId: await pessoaDe("adva"),
      empresaId: esc.id,
      tipoId: contato,
      cargo: "",
      percentual: "",
    });
    const papelEsc = await papel("escritorio-compradora");
    expect(
      await adicionarEmpresaAoNegocio(g, negocioId, { empresaId: esc.id, papelId: papelEsc }),
    ).toMatchObject({
      erro: "negocios.erros.escolhaCompradora",
    });
    expect(
      await adicionarEmpresaAoNegocio(g, negocioId, {
        empresaId: esc.id,
        papelId: papelEsc,
        atuaParaId: compradoraA,
      }),
    ).toEqual({ ok: true });
    await adicionarParticipante(g, negocioId, {
      pessoaId: await pessoaDe("adva"),
      perfilId: await perfilDeDeal("advogado"),
      empresaId: "",
      lado: "",
      prazo: "",
    });
    // A Compradora A já assinou o NDA: o escritório dela vê a vendedora, mas não a Compradora B.
    const visto = await obterNegocio(acesso("adva"), negocioId);
    expect(visto?.nomeInterno).toBe("Venda da Vendedora Exemplo");
    const nomes = visto!.empresas.map((e) => e.nome);
    expect(nomes).toEqual(
      expect.arrayContaining(["Compradora A S.A.", "Escritório da Compradora A", "Vendedora Exemplo Ltda"]),
    );
    expect(nomes).not.toContain("Compradora B S.A.");
    expect(visto!.empresas.find((e) => e.nome === "Escritório da Compradora A")?.atuaPara).toBe(
      "Compradora A S.A.",
    );
    // A compradora não sai antes da equipe dela.
    const d = await obterNegocio(g, negocioId);
    const papelA = d!.empresas.find((e) => e.nome === "Compradora A S.A." && e.papel === "Compradora")!;
    expect(await removerEmpresaDoNegocio(g, negocioId, papelA.id)).toMatchObject({
      erro: "negocios.erros.compradoraComEquipe",
    });
  });

  it("com uma compradora só, a ligação é automática, inclusive para quem entrou antes dela", async () => {
    const g = acesso("gestor");
    const a = acesso("admin", true);
    const r = await criarNegocio(g, {
      codinome: "Projeto Simples",
      nomeInterno: "Bilateral",
      tipoOperacaoId: (await listarTiposDeOperacao(a)).find((t) => !t.comPercentual)!.id,
      percentual: "",
      papelContratanteId: await papel("escritorio-vendedora"),
      objeto: "empresas",
      vendedoras: [vendedora],
      grupoId: "",
      dataInicio: "2026-11-19",
    });
    if (!("id" in r)) throw new Error(r.erro);
    const esc = await criarEmpresa(a, { ...empresaVazia, razaoSocial: "Assessoria Financeira Ltda" });
    if (!("id" in esc)) throw new Error(esc.erro);
    // Entra antes de haver compradora: fica sem ligação...
    expect(
      await adicionarEmpresaAoNegocio(g, r.id, {
        empresaId: esc.id,
        papelId: await papel("advisor-compradora"),
      }),
    ).toEqual({ ok: true });
    // ...e é ligada sozinha quando a primeira compradora entra.
    await adicionarEmpresaAoNegocio(g, r.id, { empresaId: compradoraB, papelId: await papel("compradora") });
    const d = await obterNegocio(g, r.id);
    expect(d?.empresas.find((e) => e.nome === "Assessoria Financeira Ltda")?.atuaPara).toBe(
      "Compradora B S.A.",
    );
    const outro = await criarEmpresa(a, { ...empresaVazia, razaoSocial: "Banca Jurídica Ltda" });
    if (!("id" in outro)) throw new Error(outro.erro);
    await adicionarEmpresaAoNegocio(g, r.id, {
      empresaId: outro.id,
      papelId: await papel("escritorio-compradora"),
    });
    const d2 = await obterNegocio(g, r.id);
    expect(d2?.empresas.find((e) => e.nome === "Banca Jurídica Ltda")?.atuaPara).toBe("Compradora B S.A.");
  });
});
