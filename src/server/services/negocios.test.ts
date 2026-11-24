import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { auth } from "@/server/auth/auth";
import { AcessoNegado, type AcessoTenant } from "./acesso";
import { completarCadastrosPadrao } from "./cadastros-padrao";
import { criarEmpresa, criarGrupo, excluirEmpresa } from "./empresas";
import {
  avisarFinanceiro,
  concluirArquivoDoContrato,
  criarContrato,
  editarContrato,
  excluirContrato,
  iniciarArquivoDoContrato,
  linkDoArquivoDoContrato,
  listarContratos,
  obterContrato,
  successFeeEstimado,
} from "./contratos";
import { criarOferta, excluirOferta, ofertasDoNegocio, salvarRateioDoNegocio } from "./ofertas";
import { ratear, totalNominal, valorPresente } from "@/config/ofertas";
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
  obterDiasDeAvisoDoPrazo,
  salvarDiasDeAvisoDoPrazo,
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
  reordenarEtapas,
  reordenarEtapasPadrao,
  salvarEtapaPadrao,
} from "./etapas";
import { moverNegocioParaEtapa, quadroDeNegocios } from "./negocios-kanban";
import {
  alterarAcessoDaVersao,
  concluirEnvio,
  dataRoomDoNegocio,
  editarComentarioDaVersao,
  editarDocumento,
  zipDeVersoes,
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
import { resumoDasMensagens, resumoDoDocumento } from "./resumos";
import { anexoParaDocumento, concluirAnexo, iniciarAnexo, linkDoAnexo } from "./mensagens-anexos";
import { criarChave, listarChaves, revogarChave } from "./chaves-api";
import { api } from "@/server/api/app";
import { unzipSync } from "fflate";

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

  it("auditoria: consulta com filtros, só com a permissão; limpeza simulada exporta PDF e XLSX sem apagar", async () => {
    const { paginaDaAuditoria, opcoesDaAuditoria, exportarLimpezaDaAuditoria, retencaoDaAuditoria } =
      await import("./auditoria");
    const pedido = { pagina: 1, porPagina: 25, ordem: "ocorridoEm" as const, direcao: "desc" as const };
    const tudo = await paginaDaAuditoria(acesso("admin", true), {}, pedido);
    expect(tudo.total).toBeGreaterThan(0);
    const doNegocio = await paginaDaAuditoria(acesso("admin", true), { negocio: negocioId }, pedido);
    expect(doNegocio.itens.length).toBeGreaterThan(0);
    expect(doNegocio.itens.every((e) => e.alvoId === negocioId && e.negocio)).toBe(true);
    const deNegocios = await paginaDaAuditoria(acesso("admin", true), { assunto: "negocio" }, pedido);
    expect(deNegocios.itens.every((e) => e.tipo.startsWith("negocio."))).toBe(true);
    // Busca por termo (tipo, detalhes, pessoa ou negócio) e ordenação por coluna.
    const porTermo = await paginaDaAuditoria(acesso("admin", true), { busca: "NEGOCIO.CRIADO" }, pedido);
    expect(porTermo.total).toBeGreaterThan(0);
    expect(porTermo.itens.every((e) => e.tipo === "negocio.criado")).toBe(true);
    const nada = await paginaDaAuditoria(acesso("admin", true), { busca: "%_inexistente_%" }, pedido);
    expect(nada.total).toBe(0);
    const porTipo = await paginaDaAuditoria(
      acesso("admin", true),
      {},
      { ...pedido, ordem: "tipo", direcao: "asc" },
    );
    const tipos = porTipo.itens.map((e) => e.tipo);
    expect(tipos).toEqual([...tipos].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
    for (const ordem of ["ator", "sobre"] as const) {
      const p = await paginaDaAuditoria(acesso("admin", true), {}, { ...pedido, ordem });
      expect(p.total).toBe(tudo.total);
    }
    expect((await opcoesDaAuditoria(acesso("admin", true))).assuntos).toContain("negocio");
    expect((await retencaoDaAuditoria(acesso("admin", true))).meses).toBe(60);
    const pdf = await exportarLimpezaDaAuditoria(acesso("admin", true), "pdf");
    if ("erro" in pdf) throw new Error(pdf.erro);
    expect(Buffer.from(pdf.conteudo, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    const xlsx = await exportarLimpezaDaAuditoria(acesso("admin", true), "xlsx");
    if ("erro" in xlsx) throw new Error(xlsx.erro);
    expect(Buffer.from(xlsx.conteudo, "base64").subarray(0, 2).toString()).toBe("PK");
    expect((await paginaDaAuditoria(acesso("admin", true), {}, pedido)).total).toBeGreaterThanOrEqual(
      tudo.total,
    );
    await expect(exportarLimpezaDaAuditoria(acesso("gestor"), "pdf")).rejects.toThrow();
  });

  it("exportação do negócio em PDF (simulada): só administradores, auditada", async () => {
    const { exportarNegocio } = await import("./exportacao-do-negocio");
    const r = await exportarNegocio(acesso("admin", true), negocioId);
    if ("erro" in r) throw new Error(r.erro);
    expect(Buffer.from(r.conteudo, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.nome).toMatch(/demonstracao.pdf$/);
    await expect(exportarNegocio(acesso("gestor"), negocioId)).rejects.toThrow();
  });

  it("configurações: dias do amarelo no semáforo dos prazos (administradores salvam, todos leem)", async () => {
    expect(await obterDiasDeAvisoDoPrazo(acesso("gestor"))).toBe(7);
    expect(await salvarDiasDeAvisoDoPrazo(acesso("admin", true), "0")).toMatchObject({
      erro: "negocios.erros.diasDeAvisoDoPrazoInvalidos",
    });
    expect(await salvarDiasDeAvisoDoPrazo(acesso("admin", true), "31")).toHaveProperty("erro");
    await expect(salvarDiasDeAvisoDoPrazo(acesso("gestor"), "5")).rejects.toThrow();
    expect(await salvarDiasDeAvisoDoPrazo(acesso("admin", true), "10")).toEqual({ ok: true });
    expect(await obterDiasDeAvisoDoPrazo(acesso("gestor"))).toBe(10);
    await salvarDiasDeAvisoDoPrazo(acesso("admin", true), "7");
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
    // Arrastar: nova ordem das etapas principais (só com o conjunto completo das irmãs).
    const principais = (await etapasDoNegocio(g, negocioId))!.etapas.map((e) => e.id);
    const invertida = [...principais].reverse();
    expect(await reordenarEtapas(g, negocioId, null, invertida.slice(1))).toMatchObject({
      erro: "etapas.erros.ordemInvalida",
    });
    expect(await reordenarEtapas(g, negocioId, null, invertida)).toEqual({ ok: true });
    expect((await etapasDoNegocio(g, negocioId))!.etapas.map((e) => e.id)).toEqual(invertida);
    expect(await reordenarEtapas(g, negocioId, null, principais)).toEqual({ ok: true });
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
    // Arrastar em Configurações: troca a ordem das principais e volta.
    const ids = (await listarEtapasPadrao(a)).map((e) => e.id);
    const trocada = [ids[1], ids[0], ...ids.slice(2)];
    expect(await reordenarEtapasPadrao(a, null, trocada)).toEqual({ ok: true });
    expect((await listarEtapasPadrao(a)).map((e) => e.id)).toEqual(trocada);
    expect(await reordenarEtapasPadrao(a, null, [ids[0]])).toMatchObject({
      erro: "etapas.erros.ordemInvalida",
    });
    expect(await reordenarEtapasPadrao(a, null, ids)).toEqual({ ok: true });
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

describe("data room: editar título, categoria e comentário", () => {
  it("quem enviou edita; quem não vê não acha; comentário só de quem enviou", async () => {
    const g = acesso("gestor");
    const dr = await dataRoomDoNegocio(g, negocioId);
    const memo = dr!.documentos.find((d) => d.titulo === "Memorando dos advogados")!;
    expect(memo.podeEditar).toBe(true);
    expect(await editarDocumento(g, memo.id, { titulo: "Memorando revisado", categoriaId: "" })).toEqual({
      ok: true,
    });
    expect(await editarDocumento(acesso("adva"), memo.id, { titulo: "X" })).toMatchObject({
      erro: "documentos.erros.naoEncontrado",
    });
    expect(await editarDocumento(g, memo.id, { titulo: " " })).toMatchObject({ campo: "titulo" });
    const v = memo.versoes[0].id;
    expect(await editarComentarioDaVersao(g, v, "Versão para os advogados")).toEqual({ ok: true });
    await expect(editarComentarioDaVersao(acesso("advv2"), v, "outro")).rejects.toBeInstanceOf(AcessoNegado);
    const depois = (await dataRoomDoNegocio(g, negocioId))!.documentos.find((d) => d.id === memo.id)!;
    expect(depois.titulo).toBe("Memorando revisado");
    expect(depois.versoes[0].comentario).toBe("Versão para os advogados");
  });
});

describe("API com chave de API", () => {
  it("só administrador cria; a chave vê o que o perfil e a participação permitem; revogar corta na hora", async () => {
    const adm = acesso("admin", true);
    await expect(criarChave(acesso("gestor"), { nome: "X", perfilId: "", expiraEm: "" })).rejects.toThrow();
    const [{ id: perfilGestor }] = (
      await dono.query(
        `select id from perfil where tenant_id = $1 and padrao = 'gestor-contratante' and camada = 'tenant'`,
        [tenantId],
      )
    ).rows as { id: string }[];
    const r = await criarChave(adm, { nome: "Integração de teste", perfilId: perfilGestor, expiraEm: "" });
    if (!("segredo" in r)) throw new Error(r.erro);
    expect(r.segredo.startsWith("chv_")).toBe(true);
    const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
    const chamar = (caminho: string, segredo = r.segredo, host = `ng-${sufixo}.${dominio}`) =>
      api.request(`/api${caminho}`, { headers: { host, authorization: `Bearer ${segredo}` } });
    // Sem participação: a lista de negócios vem vazia e o negócio não abre.
    const vazia = await chamar("/v1/negocios");
    expect(vazia.status).toBe(200);
    expect(((await vazia.json()) as { total: number }).total).toBe(0);
    expect((await chamar(`/v1/negocios/${negocioId}`)).status).toBe(403);
    // Incluída como participante (pessoa "Chave de API: …"), passa a ver o negócio.
    const [{ id: pessoaDaChave }] = (
      await dono.query(
        `select id from pessoa where tenant_id = $1 and nome = 'Chave de API: Integração de teste'`,
        [tenantId],
      )
    ).rows as { id: string }[];
    expect(
      await adicionarParticipante(acesso("gestor"), negocioId, {
        pessoaId: pessoaDaChave,
        perfilId: await perfilDeDeal("coordenador-deal"),
        empresaId: "",
        lado: "vendedor",
        prazo: "",
      }),
    ).toEqual({ ok: true });
    const negocio = await chamar(`/v1/negocios/${negocioId}`);
    expect(negocio.status).toBe(200);
    expect(((await negocio.json()) as { nome: string }).nome).toBe("N-0001 Projeto Gadol");
    expect((await chamar(`/v1/negocios/${negocioId}/documentos`)).status).toBe(200);
    // Chave inválida, de outro endereço ou revogada: 401.
    expect((await chamar("/v1/negocios", "chv_invalida")).status).toBe(401);
    expect((await chamar("/v1/negocios", r.segredo, `outro-${sufixo}.${dominio}`)).status).toBe(401);
    const [{ id: chaveId }] = (await dono.query(`select id from chave_api where tenant_id = $1`, [tenantId]))
      .rows as { id: string }[];
    expect(await revogarChave(adm, chaveId)).toEqual({ ok: true });
    expect((await chamar("/v1/negocios")).status).toBe(401);
    expect((await listarChaves(adm))[0].situacao).toBe("revogada");
  });
});

describe("data room: vários documentos num ZIP", () => {
  it("inclui só o que a pessoa pode baixar, com auditoria por versão", async () => {
    const g = acesso("gestor");
    const dr = await dataRoomDoNegocio(g, negocioId);
    const ids = dr!.documentos.map((d) => d.versoes[0].id);
    const r = await zipDeVersoes(g, ids);
    if (!("conteudo" in r)) throw new Error(r.erro);
    const nomes = Object.keys(unzipSync(r.conteudo));
    expect(nomes.length).toBe(r.incluidas);
    expect(nomes.some((n) => n.startsWith("Memorando revisado (v1)"))).toBe(true);
    // A equipe da compradora não vê o memorando do lado vendedor: fica de fora.
    const memo = dr!.documentos.find((d) => d.titulo === "Memorando revisado")!.versoes[0].id;
    expect(await zipDeVersoes(acesso("adva"), [memo])).toMatchObject({
      erro: "documentos.erros.nadaParaBaixar",
    });
    expect(await zipDeVersoes(g, [])).toMatchObject({ erro: "documentos.erros.escolhaDocumentos" });
  });
});

describe("resumos automáticos (local, sem IA)", () => {
  it("resume as não lidas de quem as tem e o histórico de um documento visível", async () => {
    const r = await resumoDasMensagens(acesso("adva"));
    expect(r.naoLidas).toBeGreaterThan(0);
    expect(r.trechos[0].trecho).toContain("cláusula 7");
    const dr = await dataRoomDoNegocio(acesso("gestor"), negocioId);
    const memo = dr!.documentos.find((d) => d.titulo === "Memorando revisado")!;
    const h = await resumoDoDocumento(acesso("gestor"), memo.id);
    expect(h).toMatchObject({ versoes: 1, autores: ["gestor"] });
    expect(await resumoDoDocumento(acesso("adva"), memo.id)).toBeNull(); // não vê o documento
  });
});

describe("anexos das mensagens", () => {
  it("envia com antivírus, liga à mensagem, só quem vê o canal baixa e vira documento", async () => {
    const g = acesso("gestor");
    const pdf = pdfComTexto(["MINUTA ANEXADA NA CONVERSA"]);
    const i = await iniciarAnexo(g, negocioId, { nomeArquivo: "minuta.pdf", tamanho: pdf.length });
    if (!("url" in i)) throw new Error(i.erro);
    await fetch(i.url, {
      method: "PUT",
      body: Buffer.from(pdf),
      headers: { "content-type": "application/octet-stream" },
    });
    expect(await concluirAnexo(g, i.anexoId)).toEqual({ ok: true });
    const geral = { tipo: "deal" as const, id: null };
    const m = await enviarMensagem(g, negocioId, geral, "vendedor", {
      texto: "Segue a minuta",
      anexos: [i.anexoId],
    });
    if (!("id" in m)) throw new Error(m.erro);
    const conversa = await obterConversa(g, negocioId, geral, "vendedor");
    expect(conversa?.mensagens.at(-1)?.anexos.map((x) => x.nome)).toEqual(["minuta.pdf"]);
    expect("url" in (await linkDoAnexo(acesso("advv2"), i.anexoId))).toBe(true); // lado vendedor
    expect(await linkDoAnexo(acesso("adva"), i.anexoId)).toMatchObject({
      erro: "mensagens.erros.naoEncontrada",
    });
    const doc = await anexoParaDocumento(g, i.anexoId);
    if (!("versaoId" in doc)) throw new Error(doc.erro);
    const dr = await dataRoomDoNegocio(g, negocioId);
    expect(dr!.documentos.some((d) => d.titulo === "minuta" && d.versoes[0].id === doc.versaoId)).toBe(true);
  });
});

describe("contratos de serviço", () => {
  it("success fee estimado: percentual, mínimo e retainer descontado", () => {
    const c = { successFeePercentual: "2", successFeeMinimo: "150000", retainerDescontado: false };
    expect(successFeeEstimado(c, 10_000_000)).toBe(200_000);
    expect(successFeeEstimado(c, 1_000_000)).toBe(150_000);
    expect(successFeeEstimado({ ...c, retainerDescontado: true }, 10_000_000, 50_000)).toBe(150_000);
    expect(successFeeEstimado({ ...c, successFeePercentual: null, successFeeMinimo: null }, 1)).toBeNull();
  });

  it("no negócio: lista de acesso por perfil só no lado de quem criou; arquivo com antivírus e download auditado", async () => {
    const g = acesso("gestor");
    const adm = acesso("admin", true);
    const [{ id: contratante }] = (
      await dono.query(`select id from empresa where tenant_id = $1 and do_contratante`, [tenantId])
    ).rows as { id: string }[];
    const base = {
      dealId: negocioId,
      tipo: "mandato" as const,
      titulo: "Mandato de venda",
      contratantes: [vendedora],
      contratadas: [contratante],
      inicio: "2026-01-01",
      fim: "2026-12-31",
      honorarioFixo: "20.000,00",
      periodicidade: "mensal" as const,
      retainerDescontado: true,
      successFeePercentual: "3,5",
      successFeeMinimo: "500000",
      perfis: [await perfilDeDeal("advogado")],
    };
    expect(await criarContrato(g, { ...base, contratadas: [] })).toMatchObject({
      erro: "contratos.erros.contratadaObrigatoria",
    });
    expect(await criarContrato(g, { ...base, fim: "2025-12-31" })).toMatchObject({
      erro: "contratos.erros.fimAntesDoInicio",
    });
    const r = await criarContrato(g, base);
    if (!("id" in r)) throw new Error(r.erro);
    const c = await obterContrato(g, r.id);
    expect(c).toMatchObject({ honorarioFixo: "20000.00", successFeePercentual: "3.5000", podeEditar: true });
    // Honorários variáveis apurados por mês, combinados com os fixos.
    expect(await criarContrato(g, { ...base, honorarioVariavel: true })).toMatchObject({
      erro: "contratos.erros.criterioObrigatorio",
    });
    expect(
      await criarContrato(g, { ...base, honorarioVariavel: true, variavelCriterio: "horas" }),
    ).toMatchObject({ erro: "contratos.erros.valorHoraObrigatorio" });
    expect(
      await criarContrato(g, {
        ...base,
        honorarioVariavel: true,
        variavelCriterio: "percentual",
        variavelPercentual: "2",
      }),
    ).toMatchObject({ erro: "contratos.erros.baseObrigatoria" });
    const comVariavel = await criarContrato(g, {
      ...base,
      honorarioVariavel: true,
      variavelCriterio: "horas",
      variavelValorHora: "850,00",
      variavelBase: "ignorada",
      variavelTeto: "40.000,00",
      variavelDiaApuracao: "25",
    });
    if (!("id" in comVariavel)) throw new Error(comVariavel.erro);
    expect(await obterContrato(g, comVariavel.id)).toMatchObject({
      honorarioFixo: "20000.00",
      honorarioVariavel: true,
      variavelCriterio: "horas",
      variavelValorHora: "850.00",
      variavelBase: null,
      variavelTeto: "40000.00",
      variavelDiaApuracao: 25,
      meioRecebimento: "conta",
    });
    expect(
      await criarContrato(g, { ...base, variavelDiaApuracao: "31", honorarioVariavel: true }),
    ).toHaveProperty("erro");
    // PIX: só com uma conta da contratada que tenha chave PIX.
    const [{ id: semPix }] = (
      await dono.query(
        `insert into conta_bancaria (tenant_id, empresa_id, banco_nome) values ($1, $2, 'Banco Exemplo') returning id`,
        [tenantId, contratante],
      )
    ).rows as { id: string }[];
    expect(
      await criarContrato(g, { ...base, contaBancariaId: semPix, meioRecebimento: "pix" }),
    ).toMatchObject({ erro: "contratos.erros.contaSemPix" });
    await excluirContrato(g, comVariavel.id);
    expect(c!.contratantes).toEqual(["Vendedora Exemplo Ltda"]);
    const ve = async (nome: string) =>
      (await listarContratos(acesso(nome), { dealId: negocioId })).some((x) => x.id === r.id);
    expect(await ve("advv2")).toBe(true); // advogado do lado vendedor
    expect(await ve("adva")).toBe(false); // advogado da compradora: mesmo perfil, outro lado
    expect(await obterContrato(acesso("adva"), r.id)).toBeNull();
    // Arquivo
    const pdf = pdfComTexto(["CONTRATO DE MANDATO"]);
    const i = await iniciarArquivoDoContrato(g, r.id, { nomeArquivo: "mandato.pdf", tamanho: pdf.length });
    if (!("url" in i)) throw new Error(i.erro);
    await fetch(i.url, {
      method: "PUT",
      body: Buffer.from(pdf),
      headers: { "content-type": "application/octet-stream" },
    });
    expect(await concluirArquivoDoContrato(g, i.arquivoId)).toEqual({ ok: true });
    expect((await obterContrato(g, r.id))!.arquivosLista.map((x) => x.numero)).toEqual([1]);
    expect("url" in (await linkDoArquivoDoContrato(acesso("advv2"), i.arquivoId))).toBe(true);
    expect(await linkDoArquivoDoContrato(acesso("adva"), i.arquivoId)).toMatchObject({
      erro: "contratos.erros.naoEncontrado",
    });
    const baixados = await dono.query(
      `select count(*)::int as n from evento_auditoria where tenant_id = $1 and tipo = 'contrato.arquivo_baixado'`,
      [tenantId],
    );
    expect(baixados.rows[0].n).toBe(1);
    // Empresa parte de contrato não pode ser excluída.
    expect(await excluirEmpresa(adm, vendedora)).toMatchObject({ erro: "cadastros.erros.empresaEmContrato" });
    // Financeiro: sem e-mail no cadastro, avisa; com e-mail, envia.
    expect(await avisarFinanceiro(g, r.id)).toMatchObject({ erro: "contratos.erros.semEmailFinanceiro" });
    await dono.query(`update empresa set email_financeiro = $1 where id = $2`, [
      email("financeiro"),
      contratante,
    ]);
    expect(await avisarFinanceiro(g, r.id)).toEqual({ enviados: 1 });
    expect((await obterContrato(g, r.id))!.financeiroAvisadoEm).not.toBeNull();
  }, 20_000);

  it("avulso: só quem pode criar negócios cria; vê quem criou e a lista; depois é ligado a um negócio", async () => {
    const g = acesso("gestor");
    const [{ id: contratante }] = (
      await dono.query(`select id from empresa where tenant_id = $1 and do_contratante`, [tenantId])
    ).rows as { id: string }[];
    const dados = {
      tipo: "honorarios" as const,
      titulo: "Honorários do escritório",
      contratantes: [vendedora],
      contratadas: [contratante],
    };
    expect(await criarContrato(acesso("advv2"), dados)).toMatchObject({ erro: "erros.acessoNegado" });
    const r = await criarContrato(g, dados);
    if (!("id" in r)) throw new Error(r.erro);
    expect((await listarContratos(g, { dealId: null })).some((x) => x.id === r.id)).toBe(true);
    expect(await obterContrato(acesso("advv2"), r.id)).toBeNull();
    expect(await obterContrato(acesso("admin", true), r.id)).not.toBeNull();
    // Liga ao negócio, liberando para os advogados do lado vendedor.
    expect(
      await editarContrato(g, r.id, {
        ...dados,
        dealId: negocioId,
        perfis: [await perfilDeDeal("advogado")],
      }),
    ).toEqual({ ok: true });
    expect((await obterContrato(acesso("advv2"), r.id))?.dealId).toBe(negocioId);
    expect(await editarContrato(g, r.id, { ...dados, dealId: null })).toMatchObject({
      erro: "contratos.erros.negocioNaoMuda",
    });
    expect(await excluirContrato(acesso("advv2"), r.id)).toMatchObject({ erro: "erros.acessoNegado" });
    expect(await excluirContrato(g, r.id)).toEqual({ ok: true });
  });
});

describe("ofertas recebidas", () => {
  it("cálculos: total, valor presente e rateio com arredondamento", () => {
    const o = {
      data: "2026-01-01",
      enterpriseValue: null,
      equityValue: "5000",
      parcelaVista: "1000",
      parcelas: [{ valor: "1100", data: "2027-01-01" }],
      earnoutValor: null,
    };
    expect(totalNominal(o)).toBe(2100);
    expect(valorPresente(o, 10)).toBe(2000);
    expect(totalNominal({ ...o, parcelaVista: null, parcelas: [] })).toBe(5000);
    expect(
      ratear(100, [
        { empresaId: "a", percentual: "33.33" },
        { empresaId: "b", percentual: "66.67" },
      ]).map((x) => x.valor),
    ).toEqual([33.33, 66.67]);
  });

  it("lista de acesso, sigilo entre compradoras, rodadas, funil e rateio", async () => {
    const g = acesso("gestor");
    await dono.query(
      `update deal_empresa set situacao_funil = 'nda' where deal_id = $1 and empresa_id = $2 and situacao_funil is not null`,
      [negocioId, compradoraB],
    );
    const base = {
      compradoraId: compradoraA,
      data: "2026-11-01",
      instrumento: "loi" as const,
      parcelaVista: "10.000.000,00",
      parcelas: [{ valor: "5.000.000,00", data: "2027-11-01" }],
      perfis: [await perfilDeDeal("advogado")],
      usuarios: [contas.compb2],
    };
    expect(await criarOferta(g, negocioId, { ...base, parcelas: [{ valor: "1", data: "" }] })).toMatchObject({
      erro: "ofertas.erros.parcelaIncompleta",
    });
    const r = await criarOferta(g, negocioId, base);
    if (!("id" in r)) throw new Error(r.erro);
    const ve = async (nome: string, id: string) =>
      Boolean((await ofertasDoNegocio(acesso(nome), negocioId))?.ofertas.some((o) => o.id === id));
    expect(await ve("advv2", r.id)).toBe(true); // advogado do lado vendedor
    expect(await ve("adva", r.id)).toBe(false); // mesmo perfil, lado da compradora
    expect(await ve("compb2", r.id)).toBe(false); // outra compradora, mesmo na lista
    // Contraproposta: rodada 2 da mesma compradora.
    const r2 = await criarOferta(g, negocioId, { ...base, anteriorId: r.id, parcelaVista: "12.000.000" });
    if (!("id" in r2)) throw new Error(r2.erro);
    const lista = await ofertasDoNegocio(g, negocioId);
    expect(lista!.ofertas.find((o) => o.id === r2.id)?.rodada).toBe(2);
    expect(lista!.completa).toBe(true);
    expect(
      await criarOferta(g, negocioId, { ...base, compradoraId: compradoraB, anteriorId: r.id }),
    ).toMatchObject({ erro: "ofertas.erros.anteriorInvalida" });
    // Oferta da Compradora B: ela vê a sua; o funil vai a "Proposta recebida".
    const rb = await criarOferta(g, negocioId, { ...base, compradoraId: compradoraB, perfis: [] });
    if (!("id" in rb)) throw new Error(rb.erro);
    expect(await ve("compb2", rb.id)).toBe(true);
    const funil = await dono.query(
      `select situacao_funil from deal_empresa where deal_id = $1 and empresa_id = $2 and situacao_funil is not null`,
      [negocioId, compradoraB],
    );
    expect(funil.rows[0]?.situacao_funil).toBe("proposta");
    expect((await ofertasDoNegocio(acesso("compb2"), negocioId))!.completa).toBe(false);
    // Rateio do negócio: soma 100.
    expect(
      await salvarRateioDoNegocio(g, negocioId, {
        percentuais: [{ empresaId: vendedora, percentual: "90" }],
        criterio: "faturamento",
      }),
    ).toMatchObject({ erro: "ofertas.erros.rateioInvalido" });
    expect(
      await salvarRateioDoNegocio(g, negocioId, {
        percentuais: [{ empresaId: vendedora, percentual: "100" }],
        criterio: "faturamento",
      }),
    ).toEqual({ ok: true });
    const comRateio = await ofertasDoNegocio(g, negocioId);
    expect(comRateio!.ofertas[0].rateio[0]).toMatchObject({ empresaId: vendedora, percentual: "100.0000" });
    expect(comRateio!.criterioDoNegocio).toBe("faturamento");
    expect(
      await salvarRateioDoNegocio(acesso("adva"), negocioId, { percentuais: [], criterio: "" }),
    ).toMatchObject({
      erro: expect.any(String),
    });
    expect(await excluirOferta(acesso("adva"), r2.id)).toMatchObject({ erro: "ofertas.erros.naoEncontrada" });
    expect(await excluirOferta(g, r2.id)).toEqual({ ok: true });
  });
});

describe("API: contratos e ofertas", () => {
  it("a chave participante lê ofertas e contratos do negócio e registra uma oferta", async () => {
    const adm = acesso("admin", true);
    const [{ id: perfilGestor }] = (
      await dono.query(
        `select id from perfil where tenant_id = $1 and padrao = 'gestor-contratante' and camada = 'tenant'`,
        [tenantId],
      )
    ).rows as { id: string }[];
    const r = await criarChave(adm, { nome: "Integração 2", perfilId: perfilGestor, expiraEm: "" });
    if (!("segredo" in r)) throw new Error(r.erro);
    const [{ id: pessoaDaChave }] = (
      await dono.query(`select id from pessoa where tenant_id = $1 and nome = 'Chave de API: Integração 2'`, [
        tenantId,
      ])
    ).rows as { id: string }[];
    await adicionarParticipante(acesso("gestor"), negocioId, {
      pessoaId: pessoaDaChave,
      perfilId: await perfilDeDeal("coordenador-deal"),
      empresaId: "",
      lado: "vendedor",
      prazo: "",
    });
    const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
    const host = `ng-${sufixo}.${dominio}`;
    const chamar = (caminho: string, corpo?: unknown) =>
      api.request(`/api${caminho}`, {
        method: corpo ? "POST" : "GET",
        headers: { host, authorization: `Bearer ${r.segredo}`, "content-type": "application/json" },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    const criada = await chamar(`/v1/negocios/${negocioId}/ofertas`, {
      compradoraId: compradoraB,
      data: "2026-11-20",
      instrumento: "term_sheet",
      parcelaVista: "1000000",
    });
    expect(criada.status).toBe(200);
    const { id } = (await criada.json()) as { id: string };
    const lista = await chamar(`/v1/negocios/${negocioId}/ofertas`);
    expect(lista.status).toBe(200);
    expect(((await lista.json()) as { ofertas: { id: string }[] }).ofertas.some((o) => o.id === id)).toBe(
      true,
    );
    const contratos = await chamar(`/v1/contratos?negocio=${negocioId}`);
    expect(contratos.status).toBe(200);
    expect(Array.isArray(((await contratos.json()) as { contratos: unknown[] }).contratos)).toBe(true);
    const pedidos = await chamar(`/v1/negocios/${negocioId}/pedidos`);
    expect(pedidos.status).toBe(200);
    const novoPedido = await chamar(`/v1/negocios/${negocioId}/pedidos`, {
      titulo: "Pela API",
      data: "2026-11-22",
    });
    expect(novoPedido.status).toBe(200);
    const { id: pedidoId } = (await novoPedido.json()) as { id: string };
    const detalhe = await chamar(`/v1/pedidos/${pedidoId}`);
    expect(((await detalhe.json()) as { titulo: string }).titulo).toBe("Pela API");
  });
});

describe("pedidos de documentos", () => {
  it("sigilo entre compradoras, rodadas, situação por período, data room, conversa, planilha e rediligência", async () => {
    const {
      criarPedido,
      criarPedidoPorRediligencia,
      criarRodada,
      definirSituacaoDoItem,
      excluirPedido,
      exportarPedido,
      importarPlanilhaDoPedido,
      ligarDocumentoAoItem,
      obterPedido,
      pedidosDoNegocio,
      salvarItem,
    } = await import("./pedidos");
    const { planilhaComAbas } = await import("@/server/arquivos/planilha-simples");
    const { lerPlanilha } = await import("@/server/arquivos/planilha-leitura");
    const g = acesso("gestor");
    // Pedido da Compradora A, criado pelo advogado dela (do lado comprador, só a própria compradora).
    expect(
      await criarPedido(acesso("adva"), negocioId, {
        titulo: "Diligência jurídica",
        data: "2026-11-01",
        compradoraId: compradoraB,
      }),
    ).toMatchObject({ erro: "pedidos.erros.compradoraInvalida" });
    const pa = await criarPedido(acesso("adva"), negocioId, {
      titulo: "Diligência jurídica",
      data: "2026-11-01",
      compradoraId: compradoraA,
      periodos: "2024, 2025",
    });
    if (!("id" in pa)) throw new Error(pa.erro);
    const ve = async (nome: string) =>
      Boolean((await pedidosDoNegocio(acesso(nome), negocioId))?.pedidos.some((p) => p.id === pa.id));
    expect(await ve("gestor")).toBe(true);
    expect(await ve("adva")).toBe(true);
    expect(await ve("compb2")).toBe(false);
    expect(await obterPedido(acesso("compb2"), pa.id)).toBeNull();
    // Item com situação por período: a geral é derivada.
    const d0 = await obterPedido(g, pa.id);
    const rodada1 = d0!.rodadas[0].id;
    expect(d0!.rodadas[0].nome).toBe("Lista inicial");
    const item = await salvarItem(acesso("adva"), pa.id, null, {
      rodadaId: rodada1,
      assunto: "Contencioso",
      codigo: "3.1",
      descricao: "Relação de processos judiciais",
      dataPedido: "2026-11-01",
      situacoes: { "2024": "entregue", "2030": "aprovado" },
    });
    if (!("id" in item)) throw new Error(item.erro);
    let d = await obterPedido(g, pa.id);
    expect(d!.itens[0]).toMatchObject({ situacao: "parcial", situacoes: { "2024": "entregue" } });
    expect(await definirSituacaoDoItem(g, item.id, "2025", "nao_aplicavel")).toEqual({ ok: true });
    d = await obterPedido(g, pa.id);
    expect(d!.itens[0].situacao).toBe("entregue");
    expect(d!.itens[0].dataEntrega).not.toBeNull();
    expect(d!.painel.porAssunto.Contencioso.entregue).toBe(1);
    // Data room: só documentos que a pessoa vê.
    const docs = (await dataRoomDoNegocio(g, negocioId))!.documentos;
    expect(docs.length).toBeGreaterThan(0);
    expect(await ligarDocumentoAoItem(g, item.id, docs[0].id, true)).toEqual({ ok: true });
    expect((await obterPedido(g, pa.id))!.itens[0].documentos.map((x) => x.id)).toEqual([docs[0].id]);
    // Conversa do item na mensageria: a Compradora B não abre.
    const alvo = { tipo: "pedidoItem" as const, id: item.id };
    expect((await obterConversa(acesso("adva"), negocioId, alvo))?.rotulo).toContain("3.1");
    expect(await obterConversa(acesso("compb2"), negocioId, alvo)).toBeNull();
    expect(
      await enviarMensagem(acesso("adva"), negocioId, alvo, "entre:" + compradoraA, { texto: "Falta 2025?" }),
    ).toMatchObject({ id: expect.any(String) });
    // Rodada complementar e importação da planilha do solicitante.
    const r2 = await criarRodada(g, pa.id, "Complementar 1", "2026-11-10");
    if (!("id" in r2)) throw new Error(r2.erro);
    const xlsx = planilhaComAbas([
      { nome: "Capa", linhas: [["Lista de diligência"], ["Projeto"]] },
      {
        nome: "Fiscal",
        linhas: [
          ["Pedido de documentos"],
          [],
          ["Item", "Documento solicitado", "Prioridade", "2024", "2025", "Comentários"],
          ["A - Tributos federais", "", "", "", "", ""],
          ["A.1", "DCTF dos últimos 5 anos", "Alta", "Entregue", "Pendente", "Enviar recibos"],
          ["A.2", "Há autuações fiscais?", "Média", "N/A", "N/A", ""],
        ],
      },
      {
        nome: "Contencioso",
        linhas: [
          ["Item", "Documento solicitado"],
          ["3.1", "Repetido"],
          ["3.2", "Acordos"],
        ],
      },
    ]);
    const base64 = Buffer.from(xlsx).toString("base64");
    const simulada = await importarPlanilhaDoPedido(g, pa.id, base64, { simular: true, rodada: "nova" });
    if (!("abas" in simulada)) throw new Error(simulada.erro);
    expect(simulada.total).toBe(3);
    expect(simulada.abas.find((x) => x.aba === "Capa")?.ignorada).toBe(true);
    expect(simulada.abas.find((x) => x.aba === "Contencioso")?.existentes).toBe(1);
    expect((await obterPedido(g, pa.id))!.itens).toHaveLength(1);
    const imp = await importarPlanilhaDoPedido(g, pa.id, base64, { simular: false, rodada: r2.id });
    if (!("abas" in imp)) throw new Error(imp.erro);
    d = await obterPedido(g, pa.id);
    const a1 = d!.itens.find((i) => i.codigo === "A.1")!;
    expect(a1).toMatchObject({
      assunto: "Fiscal",
      grupo: "A - Tributos federais",
      prioridade: "Alta",
      situacao: "parcial",
    });
    expect(a1.rodadaId).toBe(r2.id);
    expect(d!.itens.find((i) => i.codigo === "A.2")).toMatchObject({
      tipo: "pergunta",
      situacao: "nao_aplicavel",
    });
    // Exportação: a planilha volta no formato do solicitante, respondida.
    const exp = await exportarPedido(g, pa.id);
    if (!("conteudo" in exp)) throw new Error(exp.erro);
    const abas = lerPlanilha(new Uint8Array(Buffer.from(exp.conteudo, "base64")));
    expect(abas.map((x) => x.nome)).toEqual(["Painel", "Contencioso", "Fiscal"]);
    const fiscal = abas.find((x) => x.nome === "Fiscal")!;
    expect(fiscal.linhas[0].slice(0, 6)).toEqual([
      "Item",
      "Documento solicitado",
      "Prioridade",
      "2024",
      "2025",
      "Comentários",
    ]);
    expect(fiscal.linhas[1].slice(0, 5)).toEqual([
      "A.1",
      "DCTF dos últimos 5 anos",
      "Alta",
      "Entregue",
      "Pendente",
    ]);
    expect(await exportarPedido(acesso("compb2"), pa.id)).toMatchObject({
      erro: "pedidos.erros.naoEncontrado",
    });
    // Rediligência: outro negócio da mesma vendedora começa do pedido anterior.
    const { tipos } = await opcoesParaNovoNegocio(g);
    const outro = await criarNegocio(g, {
      codinome: "Projeto Rediligência",
      nomeInterno: "Rediligência da vendedora",
      tipoOperacaoId: tipos.find((t) => t.nome === "Aquisição total")!.id,
      percentual: "",
      papelContratanteId: await papel("escritorio-vendedora"),
      objeto: "empresas",
      vendedoras: [vendedora],
      grupoId: "",
      dataInicio: "2026-11-20",
    });
    if (!("id" in outro)) throw new Error(outro.erro);
    const lista = await pedidosDoNegocio(g, outro.id);
    expect(lista!.anteriores.some((p) => p.id === pa.id)).toBe(true);
    const novo = await criarPedidoPorRediligencia(g, outro.id, pa.id, {
      titulo: "Rediligência",
      data: "2026-11-21",
    });
    if (!("id" in novo)) throw new Error(novo.erro);
    const copia = await obterPedido(g, novo.id);
    expect(copia!.itens).toHaveLength(4);
    expect(copia!.periodos).toEqual(["2024", "2025"]);
    expect(copia!.itens.every((i) => i.situacao === "pendente" && i.documentos.length === 0)).toBe(true);
    expect(copia!.itens.find((i) => i.codigo === "3.1")!.resposta).toContain(docs[0].titulo);
    expect(copia!.origem).toContain("Diligência jurídica");
    expect(await excluirNegocio(g, outro.id)).toEqual({ ok: true });
    expect(await excluirPedido(acesso("compb2"), pa.id)).toMatchObject({
      erro: "pedidos.erros.naoEncontrado",
    });
  });
});

describe("templates DOCX (item 13, simulado)", () => {
  it("gera o DOCX de exemplo com os campos do negócio e do contrato que a pessoa vê, auditado", async () => {
    const { gerarDocumentoDoTemplate, telaDeTemplates } = await import("./templates");
    const adm = acesso("admin", true);
    const tela = await telaDeTemplates(adm);
    if ("erro" in tela) throw new Error(tela.erro);
    expect(tela.templates.map((x) => x.codigo)).toEqual([
      "nda",
      "term-sheet",
      "procuracao",
      "mandato",
      "honorarios",
    ]);
    expect(tela.negocios.some((n) => n.id === negocioId)).toBe(true);
    const r = await gerarDocumentoDoTemplate(adm, "nda", negocioId);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.nome).toMatch(/^nda-.*-demonstracao\.docx$/);
    const zip = unzipSync(Buffer.from(r.conteudo, "base64"));
    expect(Object.keys(zip)).toEqual(expect.arrayContaining(["[Content_Types].xml", "word/document.xml"]));
    const xml = new TextDecoder().decode(zip["word/document.xml"]);
    const n = await obterNegocio(adm, negocioId);
    expect(xml).toContain(n!.nome.replace(/&/g, "&amp;"));
    expect(xml).toContain("DEMONSTRAÇÃO");
    const [ev] = (
      await dono.query(
        `select alvo_tipo, detalhes from evento_auditoria where tenant_id = $1 and tipo = 'template.gerado'`,
        [tenantId],
      )
    ).rows;
    expect(ev).toMatchObject({ alvo_tipo: "deal", detalhes: { template: "nda", simulada: true } });
    // Quem não vê o negócio não gera; template de contrato não aceita negócio.
    expect(await gerarDocumentoDoTemplate(acesso("curioso"), "nda", negocioId)).toMatchObject({
      erro: "templates.erros.negocioObrigatorio",
    });
    expect(await gerarDocumentoDoTemplate(adm, "mandato", negocioId)).toMatchObject({
      erro: "templates.erros.contratoObrigatorio",
    });
    expect(await gerarDocumentoDoTemplate(adm, "inexistente", negocioId)).toMatchObject({
      erro: "templates.erros.templateInexistente",
    });
    if (tela.contratos.length) {
      const c = await gerarDocumentoDoTemplate(adm, "mandato", tela.contratos[0].id);
      if ("erro" in c) throw new Error(c.erro);
      expect(c.nome).toMatch(/^mandato-/);
    }
  });
});

describe("e-book e OnePager (item 19, simulado: fluxo real)", () => {
  it("advisor cria, vendedora comenta e aprova, liberação ao comprador respeita o NDA", async () => {
    const eb = await import("./ebook");
    const g = acesso("gestor");
    const adm = acesso("admin", true);
    const { tipos } = await opcoesParaNovoNegocio(g);
    const novo = await criarNegocio(g, {
      codinome: "Projeto Ebook",
      nomeInterno: "Venda com e-book",
      tipoOperacaoId: tipos.find((t) => t.nome === "Aquisição total")!.id,
      percentual: "",
      papelContratanteId: await papel("escritorio-vendedora"),
      objeto: "empresas",
      vendedoras: [vendedora],
      grupoId: "",
      dataInicio: "2026-11-23",
    });
    if (!("id" in novo)) throw new Error(novo.erro);
    const dealId = novo.id;
    for (const c of [compradoraA, compradoraB])
      await adicionarEmpresaAoNegocio(g, dealId, { empresaId: c, papelId: await papel("compradora") });
    await criarConta("repv", "usuario-externo");
    const [{ id: contato }] = (
      await dono.query(`select id from tipo_vinculo where tenant_id = $1 and padrao = 'contato'`, [tenantId])
    ).rows as { id: string }[];
    await adicionarVinculo(adm, {
      pessoaId: await pessoaDe("repv"),
      empresaId: vendedora,
      tipoId: contato,
      cargo: "",
      percentual: "",
    });
    const representante = await perfilDeDeal("representante");
    for (const [nome, empresaId] of [
      ["repv", vendedora],
      ["externo", compradoraA],
      ["compradorb", compradoraB],
    ])
      expect(
        await adicionarParticipante(g, dealId, {
          pessoaId: await pessoaDe(nome),
          perfilId: representante,
          empresaId,
          lado: "",
          prazo: "",
        }),
      ).toEqual({ ok: true });
    const funil = await funilDoNegocio(g, dealId);
    const cartaoA = funil!.cartoes.find((c) => c.nome === "Compradora A S.A.")!;
    await alterarSituacaoNoFunil(g, dealId, { dealEmpresaId: cartaoA.id, situacao: "nda" });

    // O coordenador (lado vendedor) cria versões numeradas por material.
    const v1 = await eb.criarVersaoDoEbook(g, dealId, { material: "ebook_teaser", identidade: "vendedora" });
    const v2 = await eb.criarVersaoDoEbook(g, dealId, { material: "ebook_teaser" });
    if ("erro" in v1 || "erro" in v2) throw new Error("versão não criada");
    expect([v1.numero, v2.numero]).toEqual([1, 2]);
    expect(await eb.criarVersaoDoEbook(g, dealId, { material: "outro" as never })).toMatchObject({
      erro: "ebook.erros.materialInvalido",
    });
    // A compradora não vê nada antes da liberação; quem não participa nem vê a aba.
    expect((await eb.ebookDoNegocio(acesso("externo"), dealId))!.materiais).toEqual([]);
    expect(await eb.ebookDoNegocio(acesso("curioso"), dealId)).toBeNull();
    expect(await eb.comentarVersaoDoEbook(acesso("externo"), v1.id, "Quero ver")).toMatchObject({
      erro: "ebook.erros.naoEncontrado",
    });
    // Revisão: a vendedora comenta e aprova; o coordenador não comenta nem libera antes da aprovação.
    expect(await eb.comentarVersaoDoEbook(acesso("repv"), v1.id, "Ajustar os números do sumário")).toEqual({
      ok: true,
    });
    expect(await eb.comentarVersaoDoEbook(g, v1.id, "Feito")).toMatchObject({
      erro: "ebook.erros.semPermissao",
    });
    expect(await eb.liberarVersaoDoEbook(g, v1.id)).toMatchObject({ erro: "ebook.erros.situacaoNaoPermite" });
    expect(await eb.aprovarVersaoDoEbook(acesso("repv"), v1.id)).toEqual({ ok: true });
    expect(await eb.liberarVersaoDoEbook(acesso("repv"), v1.id)).toMatchObject({
      erro: "ebook.erros.semPermissao",
    });
    // Teaser liberado: as duas compradoras são avisadas.
    expect(await eb.liberarVersaoDoEbook(g, v1.id)).toEqual({ ok: true, avisados: 2 });
    const vistoA = await eb.ebookDoNegocio(acesso("externo"), dealId);
    expect(vistoA!.materiais.map((m) => [m.material, m.versoes.map((v) => v.numero)])).toEqual([
      ["ebook_teaser", [1]],
    ]);
    expect(vistoA!.materiais[0].versoes[0].comentarios).toEqual([]);
    const pdf = await eb.pdfDaVersaoDoEbook(acesso("externo"), v1.id);
    if ("erro" in pdf) throw new Error(pdf.erro);
    expect(Buffer.from(pdf.conteudo, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    expect(await eb.pdfDaVersaoDoEbook(acesso("externo"), v2.id)).toMatchObject({
      erro: "ebook.erros.naoEncontrado",
    });
    // Completo: só a compradora que passou do NDA recebe.
    const c1 = await eb.criarVersaoDoEbook(g, dealId, { material: "ebook_completo", incluiValuation: true });
    if ("erro" in c1) throw new Error(c1.erro);
    await eb.aprovarVersaoDoEbook(acesso("repv"), c1.id);
    expect(await eb.liberarVersaoDoEbook(g, c1.id)).toEqual({ ok: true, avisados: 1 });
    expect((await eb.ebookDoNegocio(acesso("externo"), dealId))!.materiais.map((m) => m.material)).toEqual([
      "ebook_teaser",
      "ebook_completo",
    ]);
    expect((await eb.ebookDoNegocio(acesso("compradorb"), dealId))!.materiais.map((m) => m.material)).toEqual(
      ["ebook_teaser"],
    );
    const avisos = (
      await dono.query(
        `select usuario_id from notificacao where tenant_id = $1 and tipo = 'ebook_liberado'`,
        [tenantId],
      )
    ).rows.map((r) => r.usuario_id);
    expect(avisos.filter((u) => u === contas.externo)).toHaveLength(2);
    expect(avisos.filter((u) => u === contas.compradorb)).toHaveLength(1);
    // Lado vendedor vê tudo, com os comentários; só se exclui versão em revisão.
    const doVendedor = await eb.ebookDoNegocio(acesso("repv"), dealId);
    expect(doVendedor!.materiais).toHaveLength(4);
    expect(doVendedor!.materiais[0].versoes.find((v) => v.numero === 1)!.comentarios[0].texto).toBe(
      "Ajustar os números do sumário",
    );
    expect(await eb.excluirVersaoDoEbook(g, v1.id)).toMatchObject({ erro: "ebook.erros.situacaoNaoPermite" });
    expect(await eb.excluirVersaoDoEbook(g, v2.id)).toEqual({ ok: true });
    const tiposAuditados = (
      await dono.query(
        `select distinct tipo from evento_auditoria where tenant_id = $1 and alvo_id = $2 and tipo like 'ebook.%'`,
        [tenantId, dealId],
      )
    ).rows.map((r) => r.tipo);
    expect(tiposAuditados.sort()).toEqual([
      "ebook.aprovado",
      "ebook.baixado",
      "ebook.comentado",
      "ebook.excluido",
      "ebook.liberado",
      "ebook.versao_criada",
    ]);
  });
});
