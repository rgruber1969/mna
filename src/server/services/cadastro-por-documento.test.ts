import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { auth } from "@/server/auth/auth";
import type { AcessoTenant } from "./acesso";
import { listarAnexos } from "./anexos";
import { completarCadastrosPadrao } from "./cadastros-padrao";
import { confirmarCadastro, proporCadastro, type Proposta } from "./cadastro-por-documento";
import { obterEmpresa } from "./empresas";
import { encontrarDocumentos, lerDocumento } from "./leitor-de-documentos";
import { pdfComTexto } from "@/testes/pdf-de-teste";

/** Cadastro a partir de documento (ADR-0021): leitura local, proposta e confirmação. */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const sufixo = Date.now().toString(36);
let tenantId = "";
let adminId = "";

// Dados fictícios: CNPJ e CPFs válidos só pelos dígitos verificadores.
const CNPJ = "11.222.333/0001-81";
const CPF_SOCIA = "529.982.247-25";
const CPF_OUTRO = "111.444.777-35";

const CONTRATO = pdfComTexto([
  "CONTRATO SOCIAL DA EMPRESA EXEMPLO LTDA",
  `CNPJ ${CNPJ}`,
  `FULANA DE TAL, brasileira, casada, empresaria, inscrita no CPF sob o n. ${CPF_SOCIA};`,
  `BELTRANO SOUZA, brasileiro, solteiro, contador, CPF ${CPF_OUTRO};`,
  "CPF invalido que deve ser ignorado: 123.456.789-00",
]);

function acesso(): AcessoTenant {
  return {
    area: "tenant",
    tenant: {
      id: tenantId,
      slug: `pd-${sufixo}`,
      nome: "Por Documento",
      exigeDoisFatoresDeTodos: false,
      modoPermissoes: "perfil",
      nomeExibido: "Por Documento",
      logo: null,
    },
    usuario: {
      id: adminId,
      nome: "Teste",
      email: "",
      temAutenticador: false,
      temPasskey: false,
      doisFatoresAtivo: false,
    },
    administrador: true,
    exigeDoisFatores: false,
    sessaoId: "00000000-0000-0000-0000-000000000000",
    segundoFatorNaSessao: false,
  } as AcessoTenant;
}

function simularReceita() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("/cnpj/v1/11222333000181")
        ? Response.json({
            razao_social: "EMPRESA EXEMPLO LTDA",
            cep: "20000-000",
            municipio: "RIO DE JANEIRO",
            uf: "RJ",
            qsa: [
              {
                nome_socio: "FULANA DE TAL",
                qualificacao_socio: "Sócio-Administrador",
                cnpj_cpf_do_socio: "***982247**",
              },
            ],
          })
        : new Response("erro", { status: 500 }),
    ),
  );
}

beforeAll(async () => {
  const r = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Por Documento') returning id`,
    [`pd-${sufixo}`],
  );
  tenantId = r.rows[0].id;
  const ctx = await auth.$context;
  const u = await ctx.internalAdapter.createUser(
    { name: "admin", email: `admin-${sufixo}@exemplo.test`, emailVerified: true },
    { method: "admin" },
  );
  adminId = u.id;
  await dono.query(
    `insert into vinculo_tenant (tenant_id, usuario_id, situacao, administrador) values ($1, $2, 'ativo', true)`,
    [tenantId, adminId],
  );
  await completarCadastrosPadrao(tenantId);
});

afterEach(() => vi.unstubAllGlobals());

afterAll(async () => {
  await dono.query(`delete from tenant where id = $1`, [tenantId]);
  await dono.query(`delete from usuario where email like '%-${sufixo}@exemplo.test'`);
  await dono.end();
});

describe("leitor local", () => {
  it("acha CNPJ e CPFs válidos, com o nome próximo, e ignora os inválidos", async () => {
    const l = await lerDocumento(CONTRATO);
    expect(l.temTexto).toBe(true);
    expect(l.cnpjs).toEqual(["11222333000181"]);
    expect(l.cpfs).toEqual([
      { cpf: "52998224725", nomeProximo: "FULANA DE TAL" },
      { cpf: "11144477735", nomeProximo: "BELTRANO SOUZA" },
    ]);
    expect(l.categoriaSugerida).toBe("contrato-social");
  });

  it("PDF sem texto e arquivo que não é PDF não quebram", async () => {
    expect((await lerDocumento(pdfComTexto([]))).temTexto).toBe(false);
    expect(encontrarDocumentos("nada aqui").cnpjs).toEqual([]);
  });
});

describe("proposta e confirmação", () => {
  it("propõe sem gravar; confirma empresa, sócia com CPF, outra pessoa, vínculo e anexo", async () => {
    simularReceita();
    const a = acesso();
    const p = (await proporCadastro(a, { nome: "contrato.pdf", conteudo: CONTRATO })) as Proposta;
    expect(p.empresas).toHaveLength(1);
    expect(p.empresas[0]).toMatchObject({ razaoSocial: "EMPRESA EXEMPLO LTDA", existenteId: null });
    expect(p.empresas[0].socios).toEqual([
      { nome: "Fulana de Tal", qualificacao: "Sócio-Administrador", cpf: "52998224725", existenteId: null },
    ]);
    expect(p.pessoas).toEqual([{ cpf: "11144477735", nome: "Beltrano Souza", existenteId: null }]);
    const antes = await dono.query(`select count(*)::int n from empresa where tenant_id = $1`, [tenantId]);

    const r = await confirmarCadastro(
      a,
      {
        empresas: p.empresas.map((e) => ({
          ...e,
          incluir: true,
          socios: e.socios.map((s) => ({ ...s, incluir: true })),
        })),
        pessoas: p.pessoas.map((x) => ({ ...x, incluir: true })),
        anexo: { guardar: true, categoria: "contrato-social" },
      },
      { nome: "contrato.pdf", conteudo: CONTRATO },
    );
    if ("erro" in r) throw new Error(r.erro);
    expect(r).toMatchObject({
      empresasCriadas: 1,
      pessoasCriadas: 2,
      vinculosCriados: 1,
      anexoGuardado: true,
      falhas: [],
    });

    const depois = await dono.query(`select count(*)::int n from empresa where tenant_id = $1`, [tenantId]);
    expect(depois.rows[0].n).toBe(antes.rows[0].n + 1);
    const empresaId = r.destino!.split("/").at(-1)!;
    const e = await obterEmpresa(a, empresaId);
    expect(e?.vinculos.map((v) => [v.pessoa, v.tipo, v.cargo])).toEqual([
      ["Fulana de Tal", "Sócio", "Sócio-Administrador"],
    ]);
    expect(await listarAnexos(a, { tipo: "empresa", id: empresaId })).toHaveLength(1);

    // Lendo de novo: tudo aparece como já cadastrado, e confirmar não duplica.
    simularReceita();
    const p2 = (await proporCadastro(a, { nome: "contrato.pdf", conteudo: CONTRATO })) as Proposta;
    expect(p2.empresas[0].existenteId).toBe(empresaId);
    expect(p2.empresas[0].socios[0].existenteId).not.toBeNull();
    expect(p2.pessoas[0].existenteId).not.toBeNull();
    const r2 = await confirmarCadastro(
      a,
      {
        empresas: p2.empresas.map((x) => ({
          ...x,
          incluir: true,
          socios: x.socios.map((s) => ({ ...s, incluir: true })),
        })),
        pessoas: p2.pessoas.map((x) => ({ ...x, incluir: true })),
        anexo: { guardar: false, categoria: "outro" },
      },
      null,
    );
    expect(r2).toMatchObject({ empresasCriadas: 0, pessoasCriadas: 0, vinculosCriados: 0 });
  });

  it("recusa o que não é PDF e seleção inválida", async () => {
    const a = acesso();
    expect(
      await proporCadastro(a, { nome: "x.png", conteudo: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) }),
    ).toEqual({
      erro: "cadastros.porDocumento.erros.soPdf",
    });
    expect(await confirmarCadastro(a, { empresas: "x" }, null)).toEqual({
      erro: "cadastros.porDocumento.erros.selecaoInvalida",
    });
  });
});
