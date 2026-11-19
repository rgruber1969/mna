import { afterEach, describe, expect, it, vi } from "vitest";
import type { Acesso } from "./acesso";
import { consultarCep, consultarCnpj, limparCacheDeCnpj } from "./consultas-publicas";

/** Consulta de CNPJ e CEP (BrasilAPI e ViaCEP), sem rede: as respostas são simuladas. */
const acesso = {
  area: "tenant",
  tenant: {
    id: "t",
    slug: "t",
    nome: "T",
    exigeDoisFatoresDeTodos: false,
    modoPermissoes: "perfil",
    nomeExibido: "T",
    logo: null,
  },
  usuario: {
    id: "u",
    nome: "U",
    email: "",
    temAutenticador: false,
    temPasskey: false,
    doisFatoresAtivo: false,
  },
  administrador: false,
  exigeDoisFatores: false,
  sessaoId: "s",
  segundoFatorNaSessao: false,
} as Acesso;

function simularRespostas(respostas: Record<string, unknown>) {
  const chamadas: { url: string; ua: string | null }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      chamadas.push({ url, ua: new Headers(init?.headers).get("user-agent") });
      const chave = Object.keys(respostas).find((k) => url.includes(k));
      const corpo = chave ? respostas[chave] : undefined;
      if (corpo === undefined) return new Response("erro", { status: 500 });
      return Response.json(corpo);
    }),
  );
  return chamadas;
}

afterEach(() => {
  vi.unstubAllGlobals();
  limparCacheDeCnpj();
});

describe("CNPJ", () => {
  it("BrasilAPI recusou (limite): usa a CNPJ.ws; a segunda consulta vem da memória", async () => {
    const chamadas = simularRespostas({
      "publica.cnpj.ws/cnpj/11222333000181": {
        razao_social: "EMPRESA EXEMPLO LTDA",
        estabelecimento: {
          tipo_logradouro: "AVENIDA",
          logradouro: "CENTRAL",
          cep: "20000000",
          cidade: { nome: "Rio de Janeiro" },
          estado: { sigla: "RJ" },
          atividade_principal: { id: "6911701", descricao: "Serviços advocatícios" },
        },
        socios: [
          {
            nome: "FULANA DE TAL",
            qualificacao_socio: { descricao: "Sócio-Administrador" },
            cpf_cnpj_socio: "***982247**",
          },
        ],
      },
    });
    const d = await consultarCnpj(acesso, "11.222.333/0001-81");
    expect(d).toMatchObject({
      razaoSocial: "EMPRESA EXEMPLO LTDA",
      endereco: { logradouro: "AVENIDA CENTRAL", cidade: "Rio de Janeiro", uf: "RJ" },
      socios: [
        { nome: "FULANA DE TAL", qualificacao: "Sócio-Administrador", documentoParcial: "***982247**" },
      ],
    });
    const antes = chamadas.length;
    expect(await consultarCnpj(acesso, "11222333000181")).toEqual(d);
    expect(chamadas.length).toBe(antes);
  });

  it("CNPJ.ws: deixa de fora quem saiu da sociedade (não atualizado na base mais recente)", async () => {
    simularRespostas({
      "publica.cnpj.ws/cnpj/11222333000181": {
        razao_social: "EMPRESA EXEMPLO LTDA",
        estabelecimento: {},
        socios: [
          {
            nome: "SOCIO ANTIGO",
            qualificacao_socio: { descricao: "Sócio" },
            atualizado_em: "2026-07-11T03:00:00.000Z",
          },
          {
            nome: "HOLDING DE TESTE S.A.",
            qualificacao_socio: { descricao: "Sócio" },
            tipo: "Pessoa Jurídica",
            atualizado_em: "2026-10-10T03:00:00.000Z",
          },
          {
            nome: "CICLANO ADMINISTRADOR",
            qualificacao_socio: { descricao: "Administrador " },
            atualizado_em: "2026-10-10T03:00:00.000Z",
          },
        ],
      },
    });
    const d = await consultarCnpj(acesso, "11222333000181");
    expect(d?.socios.map((s) => [s.nome, s.qualificacao, s.tipo])).toEqual([
      ["HOLDING DE TESTE S.A.", "Sócio", "pj"],
      ["CICLANO ADMINISTRADOR", "Administrador", "pf"],
    ]);
    expect(d?.sociosAtualizadosEm).toBe("2026-10-10");
  });

  it("preenche os dados e lista os sócios; manda um User-Agent genérico", async () => {
    const chamadas = simularRespostas({
      "/cnpj/v1/11222333000181": {
        razao_social: "EMPRESA EXEMPLO LTDA",
        nome_fantasia: "EXEMPLO",
        cnae_fiscal: 6911701,
        cnae_fiscal_descricao: "Serviços advocatícios",
        descricao_tipo_de_logradouro: "RUA",
        logradouro: "DAS FLORES",
        numero: "10",
        cep: "20000-000",
        municipio: "RIO DE JANEIRO",
        uf: "RJ",
        qsa: [{ nome_socio: "FULANA DE TAL", qualificacao_socio: "Sócio-Administrador" }],
      },
    });
    const d = await consultarCnpj(acesso, "11.222.333/0001-81");
    expect(d).toMatchObject({
      razaoSocial: "EMPRESA EXEMPLO LTDA",
      cnae: "6911701 - Serviços advocatícios",
      endereco: { logradouro: "RUA DAS FLORES", cep: "20000000", cidade: "RIO DE JANEIRO", uf: "RJ" },
      socios: [{ nome: "FULANA DE TAL", qualificacao: "Sócio-Administrador" }],
    });
    expect(chamadas[0].ua).toBe("consulta-cadastral/1.0");
  });

  it("CNPJ inválido nem consulta; serviço fora do ar devolve nada", async () => {
    const chamadas = simularRespostas({});
    expect(await consultarCnpj(acesso, "11.222.333/0001-82")).toBeNull();
    expect(chamadas).toHaveLength(0);
    expect(await consultarCnpj(acesso, "11.222.333/0001-81")).toBeNull();
  });

  it("só para quem está num tenant", async () => {
    await expect(consultarCnpj(null, "11222333000181")).rejects.toThrow();
  });
});

describe("CEP", () => {
  it("usa o ViaCEP", async () => {
    simularRespostas({
      "viacep.com.br/ws/01001000": {
        cep: "01001-000",
        logradouro: "Praça da Sé",
        bairro: "Sé",
        localidade: "São Paulo",
        uf: "SP",
      },
    });
    expect(await consultarCep(acesso, "01001-000")).toMatchObject({
      logradouro: "Praça da Sé",
      cidade: "São Paulo",
      uf: "SP",
    });
  });

  it("se o ViaCEP falhar, usa a BrasilAPI", async () => {
    simularRespostas({
      "/cep/v2/01001000": { city: "São Paulo", state: "SP", street: "Praça da Sé", neighborhood: "Sé" },
    });
    expect(await consultarCep(acesso, "01001000")).toMatchObject({
      cidade: "São Paulo",
      logradouro: "Praça da Sé",
    });
  });

  it("CEP inexistente ou serviços fora do ar: nada (preenchimento manual)", async () => {
    simularRespostas({ "viacep.com.br/ws/99999999": { erro: true } });
    expect(await consultarCep(acesso, "99999-999")).toBeNull();
  });
});
