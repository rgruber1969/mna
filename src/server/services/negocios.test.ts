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
import {
  alterarSituacaoDoNegocio,
  alterarSituacaoNoFunil,
  andamentoDoNegocio,
  definirExclusividade,
  enviarAvisosDePrazo,
  funilDoNegocio,
  obterDiasDeAviso,
  prorrogarExclusividade,
  salvarDiasDeAviso,
} from "./negocios-andamento";
import {
  editarEtapa,
  etapasDoNegocio,
  excluirEtapaPadrao,
  incluirEtapa,
  listarEtapasPadrao,
  mudarSituacaoDaEtapa,
  removerEtapa,
  salvarEtapaPadrao,
} from "./etapas";
import { moverNegocioParaEtapa, quadroDeNegocios } from "./negocios-kanban";
import {
  alterarAcessoDaVersao,
  concluirEnvio,
  dataRoomDoNegocio,
  excluirVersao,
  iniciarEnvio,
  linkDeDownload,
} from "./documentos";
import { pdfComTexto } from "@/testes/pdf-de-teste";
import { painelDoUsuario } from "./painel";
import { criarTarefa, marcarItem, mudarSituacaoDaTarefa, tarefasDoNegocio } from "./tarefas";
import {
  conversasDoNegocio,
  enviarMensagem,
  enviarResumosDeMensagens,
  mensagemParaTarefa,
  minhasMensagens,
  obterConversa,
} from "./mensagens";
import { eq } from "drizzle-orm";
import { comTenant } from "@/server/db/cliente";
import { mensagem } from "@/server/db/esquema";
import { buscarDocumentos } from "./busca-de-documentos";

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

describe("andamento: funil, exclusividade, situação e histórico", () => {
  const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const linhaDe = async (empresaId: string) =>
    (
      await dono.query<{ id: string; situacao_funil: string }>(
        `select id, situacao_funil from deal_empresa where deal_id = $1 and empresa_id = $2 and situacao_funil is not null`,
        [negocioId, empresaId],
      )
    ).rows[0];

  it("escolher descarta as outras (se pedido); descartada perde o acesso e o recupera ao voltar", async () => {
    const g = acesso("gestor");
    const a = await linhaDe(compradoraA);
    expect(
      await alterarSituacaoNoFunil(g, negocioId, {
        dealEmpresaId: a.id,
        situacao: "escolhida",
        descartarOutras: true,
      }),
    ).toEqual({ ok: true });
    expect((await linhaDe(compradoraB)).situacao_funil).toBe("descartada");
    expect(
      await alterarSituacaoNoFunil(g, negocioId, { dealEmpresaId: a.id, situacao: "descartada" }),
    ).toEqual({ ok: true });
    await expect(obterNegocio(acesso("adva"), negocioId)).rejects.toBeInstanceOf(AcessoNegado);
    await alterarSituacaoNoFunil(g, negocioId, { dealEmpresaId: a.id, situacao: "escolhida" });
    expect((await obterNegocio(acesso("adva"), negocioId))?.nome).toBe("N-0001 Projeto Gadol");
  });

  it("exclusividade: avisos ao lado vendedor uma vez só; prorrogação recomeça os avisos", async () => {
    const g = acesso("gestor");
    expect(await definirExclusividade(g, negocioId, { inicio: hoje(), dias: "10" })).toEqual({ ok: true });
    const t = { id: tenantId, slug: `ng-${sufixo}` };
    await enviarAvisosDePrazo(t);
    const tipos = async (u: string) =>
      (
        await dono.query(
          `select tipo from notificacao where usuario_id = $1 and tipo like 'exclusividade%' order by tipo`,
          [u],
        )
      ).rows.map((r) => r.tipo);
    // Lado vendedor: início e o aviso de antecedência mais próximo (faltam 10 dias: o de 15).
    expect(await tipos(contas.gestor)).toEqual(["exclusividade_aviso", "exclusividade_inicio"]);
    await enviarAvisosDePrazo(t);
    expect(await tipos(contas.gestor)).toHaveLength(2); // sem repetir
    expect(await tipos(contas.adva)).toEqual([]); // lado comprador nunca
    expect(await definirExclusividade(g, negocioId, { inicio: hoje(), dias: "5" })).toMatchObject({
      erro: "negocios.erros.exclusividadeJaDefinida",
    });
    const fim = (await dono.query(`select exclusividade_fim from deal where id = $1`, [negocioId])).rows[0]
      .exclusividade_fim;
    expect(await prorrogarExclusividade(g, negocioId, { novoFim: "2020-01-01" })).toMatchObject({
      erro: "negocios.erros.prorrogacaoAntes",
    });
    expect(
      await prorrogarExclusividade(g, negocioId, { novoFim: "2099-12-31", motivo: "pedido da compradora" }),
    ).toEqual({
      ok: true,
    });
    const and = await andamentoDoNegocio(g, negocioId);
    expect(and?.exclusividade?.prorrogacoes).toHaveLength(1);
    expect(and?.exclusividade?.fim).toBe("2099-12-31");
    void fim;
  });

  it("concluído fica só para consulta; só administrador reabre; histórico respeita o lado", async () => {
    const g = acesso("gestor");
    expect(await alterarSituacaoDoNegocio(g, negocioId, { situacao: "encerrado" })).toMatchObject({
      erro: "negocios.erros.motivoObrigatorio",
    });
    expect(await alterarSituacaoDoNegocio(g, negocioId, { situacao: "concluido" })).toEqual({ ok: true });
    expect(
      await adicionarEmpresaAoNegocio(g, negocioId, {
        empresaId: compradoraB,
        papelId: await papel("compradora"),
      }),
    ).toMatchObject({ erro: "negocios.erros.negocioFechado" });
    expect((await obterNegocio(g, negocioId))?.podeEditar).toBe(false);
    expect(await alterarSituacaoDoNegocio(g, negocioId, { situacao: "andamento" })).toMatchObject({
      erro: "negocios.erros.soAdministradorReabre",
    });
    expect(
      await alterarSituacaoDoNegocio(acesso("admin", true), negocioId, { situacao: "andamento" }),
    ).toEqual({ ok: true });
    const n = await dono.query(
      `select count(*)::int n from notificacao where usuario_id = $1 and tipo = 'negocio_situacao'`,
      [contas.adva],
    );
    expect(n.rows[0].n).toBe(2);
    const doVendedor = (await andamentoDoNegocio(g, negocioId))!.historico.map((h) => h.tipo);
    expect(doVendedor).toEqual(
      expect.arrayContaining(["negocio.funil", "negocio.exclusividade_definida", "negocio.situacao"]),
    );
    const doComprador = (await andamentoDoNegocio(acesso("adva"), negocioId))!.historico.map((h) => h.tipo);
    expect(doComprador).not.toContain("negocio.funil");
    expect(doComprador).toContain("negocio.situacao");
  });

  it("configurações: dias de aviso da exclusividade (administradores)", async () => {
    expect(await salvarDiasDeAviso(acesso("admin", true), "0")).toMatchObject({
      erro: "negocios.erros.diasDeAvisoInvalidos",
    });
    expect(await salvarDiasDeAviso(acesso("admin", true), "3, 10")).toEqual({ ok: true });
    expect(await obterDiasDeAviso(acesso("gestor"))).toEqual([10, 3]);
  });
});

describe("permissão do funil de compradoras", () => {
  it("advogado do lado vendedor move o funil; o da compradora nem vê", async () => {
    const a = acesso("admin", true);
    const g = acesso("gestor");
    await criarConta("advv", "usuario-externo");
    const [{ id: contratante }] = (
      await dono.query(`select id from empresa where tenant_id = $1 and do_contratante`, [tenantId])
    ).rows as { id: string }[];
    const [{ id: contato }] = (
      await dono.query(`select id from tipo_vinculo where tenant_id = $1 and padrao = 'contato'`, [tenantId])
    ).rows as { id: string }[];
    await adicionarVinculo(a, {
      pessoaId: await pessoaDe("advv"),
      empresaId: contratante,
      tipoId: contato,
      cargo: "",
      percentual: "",
    });
    expect(
      await adicionarParticipante(g, negocioId, {
        pessoaId: await pessoaDe("advv"),
        perfilId: await perfilDeDeal("advogado"),
        empresaId: "",
        lado: "",
        prazo: "",
      }),
    ).toEqual({ ok: true });
    const funil = await funilDoNegocio(acesso("advv"), negocioId);
    expect(funil?.podeEditar).toBe(true);
    const b = funil!.cartoes.find((c) => c.nome === "Compradora B S.A.")!;
    expect(b.historico.length).toBeGreaterThan(0);
    expect(
      await alterarSituacaoNoFunil(acesso("advv"), negocioId, { dealEmpresaId: b.id, situacao: "proposta" }),
    ).toEqual({
      ok: true,
    });
    // Advogado da compradora (mesmo perfil, outro lado): sem funil.
    expect(await funilDoNegocio(acesso("adva"), negocioId)).toBeNull();
    await expect(
      alterarSituacaoNoFunil(acesso("adva"), negocioId, { dealEmpresaId: b.id, situacao: "descartada" }),
    ).rejects.toBeInstanceOf(AcessoNegado);
  });
});

describe("etapas do negócio", () => {
  it("copiadas do padrão; dependência só avisa; etapa principal; aviso de troca", async () => {
    const g = acesso("gestor");
    const r = await etapasDoNegocio(g, negocioId);
    expect(r?.etapas.map((e) => e.nome)).toEqual([
      "Prospecção",
      "Negociação informal",
      "Term Sheet",
      "Diligência",
      "QPA",
      "QPA → Closing",
      "Closing",
      "Pós-closing",
    ]);
    expect(r?.etapas.find((e) => e.nome === "Diligência")?.subetapas).toHaveLength(4);
    const id = (nome: string) => r!.etapas.find((e) => e.nome === nome)!.id;
    expect(await mudarSituacaoDaEtapa(g, negocioId, id("Negociação informal"), "andamento")).toEqual({
      aviso: "dependencia",
      etapa: "Prospecção",
    });
    expect(await mudarSituacaoDaEtapa(g, negocioId, id("Negociação informal"), "andamento", true)).toEqual({
      ok: true,
    });
    await mudarSituacaoDaEtapa(g, negocioId, id("Prospecção"), "andamento");
    const depois = await etapasDoNegocio(g, negocioId);
    expect(depois?.principal).toEqual({ nome: "Negociação informal", paralelas: 1 });
    expect(depois?.etapas.find((e) => e.nome === "Prospecção")?.inicioReal).not.toBeNull();
    const n = await dono.query(
      `select count(*)::int n from notificacao where usuario_id = $1 and tipo = 'negocio_etapa'`,
      [contas.adva],
    );
    expect(n.rows[0].n).toBe(1);
  });

  it("alcance só numa subetapa: vê só ela; incluir e remover etapas", async () => {
    const g = acesso("gestor");
    const r = await etapasDoNegocio(g, negocioId);
    const dil = r!.etapas.find((e) => e.nome === "Diligência")!;
    const juridica = dil.subetapas.find((s) => s.nome === "Diligência jurídica")!;
    await criarConta("audj", "usuario-externo");
    expect(
      await adicionarParticipante(g, negocioId, {
        pessoaId: await pessoaDe("audj"),
        perfilId: await perfilDeDeal("auditor"),
        empresaId: "",
        lado: "vendedor",
        prazo: "",
        alcance: "etapas",
        etapaIds: [juridica.id],
      }),
    ).toEqual({ ok: true });
    const visto = await etapasDoNegocio(acesso("audj"), negocioId);
    expect(visto?.etapas.map((e) => [e.nome, e.subetapas.map((s) => s.nome)])).toEqual([
      ["Diligência", ["Diligência jurídica"]],
    ]);
    await expect(
      editarEtapa(acesso("audj"), negocioId, juridica.id, {
        nome: "X",
        inicioPrevisto: "",
        fimPrevisto: "",
        inicioReal: "",
        fimReal: "",
        dependeDeId: "",
        observacoes: "",
      }),
    ).rejects.toBeInstanceOf(AcessoNegado);
    expect(await incluirEtapa(g, negocioId, { nome: "Assinatura" })).toEqual({ ok: true });
    const comNova = await etapasDoNegocio(g, negocioId);
    const nova = comNova!.etapas.find((e) => e.nome === "Assinatura")!;
    expect(await removerEtapa(g, negocioId, nova.id)).toEqual({ ok: true });
    const prospeccao = comNova!.etapas.find((e) => e.nome === "Prospecção")!;
    expect(await removerEtapa(g, negocioId, prospeccao.id)).toMatchObject({
      erro: "etapas.erros.soNaoIniciada",
    });
  });
});

describe("etapas padrão", () => {
  it("pós-closing com escala 20%; etapa criada por engano pode ser excluída", async () => {
    const a = acesso("admin", true);
    expect((await listarEtapasPadrao(a)).find((e) => e.nome === "Pós-closing")?.escala).toBe(20);
    expect(await salvarEtapaPadrao(a, { nome: "Diligência → QPA" })).toEqual({ ok: true });
    const criada = (await listarEtapasPadrao(a)).find((e) => e.nome === "Diligência → QPA")!;
    expect(await salvarEtapaPadrao(a, { id: criada.id, nome: criada.nome, escala: "3" })).toMatchObject({
      erro: "etapas.erros.escalaInvalida",
    });
    expect(await excluirEtapaPadrao(a, criada.id)).toEqual({ ok: true });
    expect((await listarEtapasPadrao(a)).some((e) => e.nome === "Diligência → QPA")).toBe(false);
    // Nova escala no padrão vale nos negócios em que a etapa não foi ajustada à mão.
    const pos = (await listarEtapasPadrao(a)).find((e) => e.nome === "Pós-closing")!;
    expect(await salvarEtapaPadrao(a, { id: pos.id, nome: pos.nome, escala: "10" })).toEqual({ ok: true });
    const doNegocio = (await etapasDoNegocio(acesso("gestor"), negocioId))!.etapas.find(
      (e) => e.nome === "Pós-closing",
    );
    expect(doNegocio?.escala).toBe(10);
  });
});

describe("kanban de negócios", () => {
  it("cartão na coluna da etapa atual; mover conclui a atual e inicia a nova", async () => {
    const g = acesso("gestor");
    const q = await quadroDeNegocios(g, { situacao: "abertos" });
    const coluna = (nome: string) => q.colunas.find((c) => c.nome === nome)!.id;
    const cartao = q.cartoes.find((c) => c.id === negocioId)!;
    expect(cartao.colunaId).toBe(coluna("Negociação informal"));
    expect(cartao.podeMover).toBe(true);
    expect(cartao.funil?.escolhida).toEqual(["Compradora A S.A."]);
    expect(await moverNegocioParaEtapa(g, negocioId, coluna("Term Sheet"))).toEqual({ ok: true });
    const depois = await quadroDeNegocios(g, { situacao: "abertos" });
    expect(depois.cartoes.find((c) => c.id === negocioId)?.colunaId).toBe(coluna("Term Sheet"));
    const etapas = (await etapasDoNegocio(g, negocioId))!.etapas;
    expect(etapas.find((e) => e.nome === "Negociação informal")?.situacao).toBe("concluida");
    // Quem não pode editar etapas não move.
    await expect(moverNegocioParaEtapa(acesso("audj"), negocioId, coluna("QPA"))).rejects.toBeInstanceOf(
      AcessoNegado,
    );
  });
});

describe("etapas: proteção do lado comprador", () => {
  it("advogado da compradora não altera etapas, salvo com 'Alterar (lado comprador)' no perfil", async () => {
    const g = acesso("gestor");
    const r = await etapasDoNegocio(acesso("adva"), negocioId);
    expect(r?.podeIncluir).toBe(false);
    expect(r?.etapas.every((e) => !e.podeEditar)).toBe(true);
    const qpa = (await etapasDoNegocio(g, negocioId))!.etapas.find((e) => e.nome === "QPA")!;
    await expect(
      mudarSituacaoDaEtapa(acesso("adva"), negocioId, qpa.id, "andamento", true),
    ).rejects.toBeInstanceOf(AcessoNegado);
    await dono.query(
      `update perfil set matriz = jsonb_set(matriz, '{etapas}', '["ver","editar","alterarComprador"]'::jsonb)
       where tenant_id = $1 and padrao = 'advogado'`,
      [tenantId],
    );
    expect((await etapasDoNegocio(acesso("adva"), negocioId))?.etapas.some((e) => e.podeEditar)).toBe(true);
  });
});

describe("data room", () => {
  const enviar = async (
    nome: string,
    conteudo: Uint8Array,
    quem: string,
    dados: Record<string, unknown> = {},
  ) => {
    const r = await iniciarEnvio(acesso(quem), negocioId, {
      titulo: "Contrato social",
      etapaId: null,
      nomeArquivo: nome,
      tamanho: conteudo.length,
      perfis: [],
      usuarios: [],
      ...dados,
    });
    if (!("url" in r)) return r;
    const put = await fetch(r.url, {
      method: "PUT",
      body: Buffer.from(conteudo),
      headers: { "content-type": "application/octet-stream" },
    });
    expect(put.ok).toBe(true);
    const fim = await concluirEnvio(acesso(quem), r.versaoId);
    return "erro" in fim ? fim : { versaoId: r.versaoId };
  };

  it("versões, lista de acesso por versão, download e exclusão em 24 h", async () => {
    const pdf = pdfComTexto(["CONTRATO SOCIAL DE TESTE"]);
    const v1 = await enviar("contrato.pdf", pdf, "gestor");
    if (!("versaoId" in v1)) throw new Error(v1.erro);
    const doGestor = await dataRoomDoNegocio(acesso("gestor"), negocioId);
    const doc = doGestor!.documentos.find((d) => d.titulo === "Contrato social")!;
    expect(doc.versoes).toHaveLength(1);
    // Sem lista de acesso, outro participante do mesmo lado não vê.
    expect(
      (await dataRoomDoNegocio(acesso("advv"), negocioId))!.documentos.some((d) => d.id === doc.id),
    ).toBe(false);
    const v2 = await enviar("contrato-v2.pdf", pdf, "gestor", {
      documentoId: doc.id,
      usuarios: [contas.advv],
    });
    if (!("versaoId" in v2)) throw new Error(v2.erro);
    const doAdvv = (await dataRoomDoNegocio(acesso("advv"), negocioId))!.documentos.find(
      (d) => d.id === doc.id,
    )!;
    expect(doAdvv.versoes.map((v) => v.numero)).toEqual([2]);
    expect(await linkDeDownload(acesso("advv"), v2.versaoId)).toMatchObject({
      url: expect.stringContaining("http"),
    });
    expect(await excluirVersao(acesso("gestor"), v2.versaoId)).toMatchObject({
      erro: "documentos.erros.naoExcluivel",
    });
    expect(await excluirVersao(acesso("gestor"), v1.versaoId)).toEqual({ ok: true });
  });

  it("recusa formato falso e bloqueia vírus (EICAR); alcance por etapa limita onde enviar", async () => {
    expect(await enviar("falso.pdf", new TextEncoder().encode("isto não é um PDF"), "gestor")).toMatchObject({
      erro: "documentos.erros.formato",
    });
    const eicar = new TextEncoder().encode(
      "X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    );
    expect(await enviar("teste.txt", eicar, "gestor", { titulo: "Vírus" })).toMatchObject({
      erro: "documentos.erros.bloqueado",
    });
    const juridica = (await etapasDoNegocio(acesso("audj"), negocioId))!.etapas[0].subetapas[0];
    const ok = await enviar("relatorio.pdf", pdfComTexto(["RELATÓRIO"]), "audj", {
      titulo: "Relatório jurídico",
      etapaId: juridica.id,
    });
    expect(ok).toMatchObject({ versaoId: expect.any(String) });
    await expect(enviar("geral.pdf", pdfComTexto(["X"]), "audj", { titulo: "Geral" })).rejects.toBeInstanceOf(
      AcessoNegado,
    );
  });
});

describe("tarefas", () => {
  it("responsável por perfil só do mesmo lado; checklist; concluir registra quem; lembrete; sem responsável ao remover", async () => {
    const g = acesso("gestor");
    const amanha = new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    });
    const advogado = await perfilDeDeal("advogado");
    const r = await criarTarefa(g, negocioId, {
      titulo: "Revisar minuta do QPA",
      descricao: "",
      etapaId: "",
      prioridade: "alta",
      prazo: amanha,
      perfis: [advogado],
      checklist: ["Revisar cláusulas", "Enviar comentários"],
    });
    if (!("id" in r)) throw new Error(r.erro);
    const doAdvv = (await tarefasDoNegocio(acesso("advv"), negocioId))!.tarefas.find((x) => x.id === r.id)!;
    expect(doAdvv.souResponsavel).toBe(true);
    // O advogado da compradora tem o mesmo perfil, mas a tarefa é do lado vendedor.
    expect((await tarefasDoNegocio(acesso("adva"), negocioId))!.tarefas.some((x) => x.id === r.id)).toBe(
      false,
    );
    expect(await marcarItem(acesso("advv"), doAdvv.checklist[0].id, true)).toEqual({ ok: true });
    expect(await mudarSituacaoDaTarefa(acesso("advv"), r.id, "concluida")).toEqual({ ok: true });
    const concluida = (await tarefasDoNegocio(g, negocioId))!.tarefas.find((x) => x.id === r.id)!;
    expect(concluida.concluidaPor).toBe("advv");
    expect(concluida.checklist.map((i) => i.feito)).toEqual([true, false]);
    // Lembrete: tarefa aberta com prazo amanhã, responsável advv (antecedência padrão 2 e 0 dias).
    const r2 = await criarTarefa(g, negocioId, {
      titulo: "Enviar certidões",
      descricao: "",
      etapaId: "",
      prioridade: "normal",
      prazo: amanha,
      usuarios: [contas.advv],
    });
    if (!("id" in r2)) throw new Error(r2.erro);
    await enviarAvisosDePrazo({ id: tenantId, slug: `ng-${sufixo}` });
    const lembretes = async (u: string) =>
      (
        await dono.query(
          `select count(*)::int n from notificacao where usuario_id = $1 and tipo = 'tarefa_prazo'`,
          [u],
        )
      ).rows[0].n;
    expect(await lembretes(contas.advv)).toBe(1);
    expect(await lembretes(contas.adva)).toBe(0);
    // Removido do negócio, deixa de ser responsável: a tarefa fica "sem responsável".
    const part = (await obterNegocio(g, negocioId))!.participantes.find((p) => p.nome === "advv")!;
    expect(await removerParticipante(g, negocioId, part.id)).toEqual({ ok: true });
    expect((await tarefasDoNegocio(g, negocioId))!.tarefas.find((x) => x.id === r2.id)?.semResponsavel).toBe(
      true,
    );
  });
});

describe("tela principal", () => {
  it("números, meus negócios, prazos (tarefas e exclusividade) e negócios por etapa", async () => {
    const g = acesso("gestor");
    const amanha = new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    });
    await criarTarefa(g, negocioId, {
      titulo: "Ligar para a compradora",
      descricao: "",
      etapaId: "",
      prioridade: "normal",
      prazo: amanha,
      usuarios: [contas.gestor],
    });
    const p = await painelDoUsuario(g);
    expect(p.numeros.negocios).toBeGreaterThanOrEqual(1);
    expect(p.numeros.minhasTarefas).toBeGreaterThanOrEqual(1);
    expect(p.negocios.map((n) => n.nome)).toContain("N-0001 Projeto Gadol");
    expect(p.prazos.some((z) => z.tipo === "tarefa" && z.texto === "Ligar para a compradora")).toBe(true);
    expect(p.porEtapa.reduce((s, e) => s + e.total, 0)).toBe(p.numeros.negocios);
    // Quem não participa de negócio nenhum vê o painel vazio.
    expect((await painelDoUsuario(acesso("curioso"))).numeros.negocios).toBe(0);
  });
});

describe("administrador dentro do negócio", () => {
  it("vê e envia documentos e vê as tarefas, mesmo sem participar", async () => {
    const dr = await dataRoomDoNegocio(acesso("admin", true), negocioId);
    expect(dr?.destinos.length).toBeGreaterThan(0);
    expect(dr?.documentos.some((d) => d.titulo === "Relatório jurídico")).toBe(true);
    expect(dr?.etapas.length).toBeGreaterThan(8);
    const tarefas = await tarefasDoNegocio(acesso("admin", true), negocioId);
    expect(tarefas?.etapas.map((e) => e.nome)).toContain("Diligência › Diligência jurídica");
  });
});

describe("data room: quem vê", () => {
  it("todos os participantes (os dois lados) e liberar depois com 'Alterar quem vê'", async () => {
    const g = acesso("gestor");
    const pdf = pdfComTexto(["QPA ASSINADO"]);
    const r = await iniciarEnvio(g, negocioId, {
      titulo: "QPA assinado",
      etapaId: null,
      nomeArquivo: "qpa.pdf",
      tamanho: pdf.length,
      perfis: [],
      usuarios: [],
      todos: true,
    });
    if (!("url" in r)) throw new Error(r.erro);
    await fetch(r.url, {
      method: "PUT",
      body: Buffer.from(pdf),
      headers: { "content-type": "application/octet-stream" },
    });
    expect(await concluirEnvio(g, r.versaoId)).toEqual({ ok: true });
    const veAdva = async () =>
      (await dataRoomDoNegocio(acesso("adva"), negocioId))!.documentos.some(
        (d) => d.titulo === "QPA assinado",
      );
    expect(await veAdva()).toBe(true); // lado comprador vê
    expect(await alterarAcessoDaVersao(g, r.versaoId, { todos: false, perfis: [], usuarios: [] })).toEqual({
      ok: true,
    });
    expect(await veAdva()).toBe(false);
    expect(
      await alterarAcessoDaVersao(g, r.versaoId, { todos: false, perfis: [], usuarios: [contas.adva] }),
    ).toEqual({
      ok: true,
    });
    expect(await veAdva()).toBe(true); // liberado à pessoa do outro lado
    // Só quem enviou (ou administrador) altera.
    await expect(
      alterarAcessoDaVersao(acesso("adva"), r.versaoId, { todos: true, perfis: [], usuarios: [] }),
    ).rejects.toBeInstanceOf(AcessoNegado);
  });
});

describe("mensageria", () => {
  const geral = { tipo: "deal" as const, id: null };

  it("canais por lado: compradoras nunca veem os canais umas das outras", async () => {
    const a = acesso("admin", true);
    const g = acesso("gestor");
    await criarConta("compb2", "usuario-externo");
    const [{ id: contato }] = (
      await dono.query(`select id from tipo_vinculo where tenant_id = $1 and padrao = 'contato'`, [tenantId])
    ).rows as { id: string }[];
    await adicionarVinculo(a, {
      pessoaId: await pessoaDe("compb2"),
      empresaId: compradoraB,
      tipoId: contato,
      cargo: "",
      percentual: "",
    });
    expect(
      await adicionarParticipante(g, negocioId, {
        pessoaId: await pessoaDe("compb2"),
        perfilId: await perfilDeDeal("representante"),
        empresaId: "",
        lado: "",
        prazo: "",
      }),
    ).toEqual({ ok: true });
    const canais = async (nome: string) =>
      (await obterConversa(acesso(nome), negocioId, geral))!.canais.map((c) => c.id).sort();
    expect(await canais("gestor")).toEqual(
      ["entre:" + compradoraA, "entre:" + compradoraB, "vendedor"].sort(),
    );
    expect(await canais("adva")).toEqual(["entre:" + compradoraA, "equipe:" + compradoraA].sort());
    expect(await canais("compb2")).toEqual(["entre:" + compradoraB, "equipe:" + compradoraB].sort());
  });

  it("envia, menciona só quem está no canal, conta não lidas e é imutável", async () => {
    const g = acesso("gestor");
    const canalB = "entre:" + compradoraB;
    const r = await enviarMensagem(g, negocioId, geral, canalB, {
      texto: "Favor enviar a proposta revisada",
      mencoes: [contas.compb2, contas.adva],
    });
    if (!("id" in r)) throw new Error(r.erro);
    const [m] = (await dono.query(`select mencoes from mensagem where id = $1`, [r.id])).rows;
    expect(m.mencoes).toEqual([contas.compb2]); // adva não está no canal da Compradora B
    const avisos = await dono.query(
      `select tipo from notificacao where usuario_id = $1 and tipo = 'mensagem_mencao'`,
      [contas.compb2],
    );
    expect(avisos.rowCount).toBe(1);
    // A equipe da Compradora A não vê nem escreve no canal da B.
    const vistoA = await obterConversa(acesso("adva"), negocioId, geral, canalB);
    expect(vistoA?.canal).not.toBe(canalB);
    expect(vistoA?.mensagens.some((x) => x.id === r.id)).toBe(false);
    expect(await enviarMensagem(acesso("adva"), negocioId, geral, canalB, { texto: "oi" })).toMatchObject({
      erro: "mensagens.erros.naoEncontrada",
    });
    expect((await minhasMensagens(acesso("adva"))).conversas.some((c) => c.canal.id === canalB)).toBe(false);
    // Não lidas da Compradora B: some ao abrir a conversa.
    expect((await minhasMensagens(acesso("compb2"))).naoLidas).toBe(1);
    const aberta = await obterConversa(acesso("compb2"), negocioId, geral, canalB);
    expect(aberta?.mensagens.map((x) => x.texto)).toEqual(["Favor enviar a proposta revisada"]);
    expect((await minhasMensagens(acesso("compb2"))).naoLidas).toBe(0);
    // Imutável: o banco recusa editar o texto (só a ligação com tarefa muda).
    await expect(
      comTenant(tenantId, (tx) => tx.update(mensagem).set({ texto: "editado" }).where(eq(mensagem.id, r.id))),
    ).rejects.toThrow();
    const lista = await conversasDoNegocio(g, negocioId);
    expect(lista?.[0]).toMatchObject({ alvo: geral, total: 1 });
  });

  it("marca como tarefa uma vez; resumo por e-mail com as não lidas", async () => {
    const g = acesso("gestor");
    const canalA = "entre:" + compradoraA;
    const r = await enviarMensagem(g, negocioId, geral, canalA, {
      texto: "Revisar a cláusula 7\nDetalhes...",
    });
    if (!("id" in r)) throw new Error(r.erro);
    const t = await mensagemParaTarefa(g, r.id);
    if (!("tarefaId" in t)) throw new Error(t.erro);
    const [tarefa] = (await dono.query(`select titulo from tarefa where id = $1`, [t.tarefaId])).rows;
    expect(tarefa.titulo).toBe("Revisar a cláusula 7");
    expect(await mensagemParaTarefa(g, r.id)).toMatchObject({ erro: "mensagens.erros.jaVirouTarefa" });
    await dono.query(`update vinculo_tenant set resumo_mensagens_em = null where tenant_id = $1`, [tenantId]);
    expect(await enviarResumosDeMensagens()).toBeGreaterThanOrEqual(1); // adva tem não lida
    const [v] = (
      await dono.query(`select resumo_mensagens_em from vinculo_tenant where usuario_id = $1`, [contas.adva])
    ).rows;
    expect(v.resumo_mensagens_em).not.toBeNull();
    expect(await excluirNegocio(acesso("admin", true), negocioId)).toMatchObject({
      erro: "negocios.erros.temConteudo",
    });
  });
});

describe("tarefas: sigilo entre compradoras", () => {
  it("tarefa da equipe da Compradora A não aparece para a Compradora B, nem por perfil", async () => {
    const representante = await perfilDeDeal("representante");
    const r = await criarTarefa(acesso("adva"), negocioId, {
      titulo: "Tarefa interna da Compradora A",
      descricao: "",
      etapaId: "",
      prazo: "",
      perfis: [representante],
    });
    if (!("id" in r)) throw new Error(r.erro);
    const [t] = (await dono.query(`select compradora_id from tarefa where id = $1`, [r.id])).rows;
    expect(t.compradora_id).toBe(compradoraA);
    const deB = await tarefasDoNegocio(acesso("compb2"), negocioId);
    expect(deB?.tarefas.some((x) => x.id === r.id)).toBe(false);
    expect(deB?.opcoes.usuarios.some((u) => u.id === contas.adva)).toBe(false);
    const deA = await tarefasDoNegocio(acesso("adva"), negocioId);
    expect(deA?.tarefas.some((x) => x.id === r.id)).toBe(true);
    expect(deA?.opcoes.usuarios.some((u) => u.id === contas.compb2)).toBe(false);
    expect((await tarefasDoNegocio(acesso("gestor"), negocioId))?.tarefas.some((x) => x.id === r.id)).toBe(
      false,
    );
  });
});

describe("data room: sigilo entre lados e compradoras", () => {
  it("acesso por perfil fica no grupo de quem enviou; listas sem as outras compradoras", async () => {
    const g = acesso("gestor");
    const adm = acesso("admin", true);
    // Advogado do lado vendedor (o "advv" saiu do negócio no teste de tarefas).
    await criarConta("advv2", "usuario-externo");
    const [{ id: contratante }] = (
      await dono.query(`select id from empresa where tenant_id = $1 and do_contratante`, [tenantId])
    ).rows as { id: string }[];
    const [{ id: contato }] = (
      await dono.query(`select id from tipo_vinculo where tenant_id = $1 and padrao = 'contato'`, [tenantId])
    ).rows as { id: string }[];
    await adicionarVinculo(adm, {
      pessoaId: await pessoaDe("advv2"),
      empresaId: contratante,
      tipoId: contato,
      cargo: "",
      percentual: "",
    });
    await adicionarParticipante(g, negocioId, {
      pessoaId: await pessoaDe("advv2"),
      perfilId: await perfilDeDeal("advogado"),
      empresaId: "",
      lado: "",
      prazo: "",
    });
    const pdf = pdfComTexto(["MEMORANDO INTERNO"]);
    const r = await iniciarEnvio(g, negocioId, {
      titulo: "Memorando dos advogados",
      etapaId: null,
      nomeArquivo: "memo.pdf",
      tamanho: pdf.length,
      perfis: [await perfilDeDeal("advogado")],
      usuarios: [],
    });
    if (!("url" in r)) throw new Error(r.erro);
    await fetch(r.url, {
      method: "PUT",
      body: Buffer.from(pdf),
      headers: { "content-type": "application/octet-stream" },
    });
    expect(await concluirEnvio(g, r.versaoId)).toEqual({ ok: true });
    const ve = async (nome: string) =>
      (await dataRoomDoNegocio(acesso(nome), negocioId))!.documentos.some(
        (d) => d.titulo === "Memorando dos advogados",
      );
    expect(await ve("advv2")).toBe(true); // advogado do lado vendedor
    expect(await ve("adva")).toBe(false); // advogado da compradora: mesmo perfil, outro lado
    const deA = await dataRoomDoNegocio(acesso("adva"), negocioId);
    expect(deA!.opcoesDeAcesso.usuarios.some((u) => u.id === contas.compb2)).toBe(false);
    expect(deA!.meuLado).not.toContain(contas.compb2);
    const deB = await dataRoomDoNegocio(acesso("compb2"), negocioId);
    expect(deB!.opcoesDeAcesso.usuarios.some((u) => u.id === contas.adva)).toBe(false);
  });
});

describe("busca de documentos", () => {
  it("acha pelo nome e pelo conteúdo, sem acentos, só o que a pessoa vê", async () => {
    const achou = async (nome: string, termo: string) => {
      const r = await buscarDocumentos(acesso(nome), { termo });
      if ("erro" in r) throw new Error(r.erro);
      return r.resultados.find((x) => x.titulo === "Memorando dos advogados");
    };
    const conteudo = await achou("advv2", "memorando interno");
    expect(conteudo?.noConteudo).toBe(true);
    expect(conteudo?.trecho).toContain("«");
    expect((await achou("advv2", "ADVOGADOS"))?.noNome).toBe(true);
    expect(await achou("advv2", "memorándo")).toBeDefined(); // acento não atrapalha
    expect(await achou("adva", "memorando interno")).toBeUndefined(); // outro lado não vê
    const noNegocio = await buscarDocumentos(acesso("advv2"), { termo: "memorando", dealId: negocioId });
    expect("resultados" in noNegocio && noNegocio.resultados.length).toBeGreaterThan(0);
    expect(await buscarDocumentos(acesso("advv2"), { termo: "m" })).toMatchObject({
      erro: "busca.erros.termoCurto",
    });
  });
});
