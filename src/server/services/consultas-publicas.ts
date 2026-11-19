import { cepValido, cnpjValido, soDigitos } from "@/config/documentos";
import { exigirTenant, type Acesso } from "./acesso";

/**
 * Consulta de CNPJ e CEP em serviços públicos e gratuitos (decisão menor
 * "Consulta de CNPJ e CEP"): BrasilAPI para CNPJ (com o quadro de sócios), com
 * a CNPJ.ws de reserva e resultado guardado na memória por 24 h (a BrasilAPI
 * limita consultas seguidas); ViaCEP para CEP, com a BrasilAPI de reserva. A
 * consulta sai do servidor;
 * só vai o número (CNPJ é público; CEP sozinho não identifica ninguém). Fora
 * do ar ou sem resposta em 5 s: devolve nada e a pessoa preenche à mão.
 * Nada do que volta é registrado em log.
 */

const TEMPO_LIMITE_MS = 5000;

export type Endereco = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/** Sócio pessoa física, pessoa jurídica (empresa sócia) ou estrangeiro. */
export type TipoDeSocio = "pf" | "pj" | "estrangeiro";

export type DadosDoCnpj = {
  razaoSocial: string;
  nomeFantasia: string;
  cnae: string;
  telefone: string;
  email: string;
  numero: string;
  endereco: Endereco;
  /** Sócios do quadro público; `documentoParcial` é o CPF mascarado pela Receita (ex.: "***456789**"). */
  socios: { nome: string; qualificacao: string; documentoParcial: string; tipo: TipoDeSocio }[];
  /** Data (AAAA-MM-DD) da base da Receita de onde veio o quadro de sócios, quando o serviço informa. */
  sociosAtualizadosEm: string | null;
};

async function buscarJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      // Sem User-Agent a BrasilAPI recusa (403). Nome genérico, sem dados do projeto.
      headers: { accept: "application/json", "user-agent": "consulta-cadastral/1.0" },
      cache: "no-store",
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** Resultados recentes de CNPJ (dado público), só na memória deste servidor. */
const VALIDADE_CACHE_CNPJ_MS = 24 * 60 * 60 * 1000;
const cacheCnpj = new Map<string, { dados: DadosDoCnpj; ate: number }>();

/** Esvazia a memória das consultas (testes). */
export function limparCacheDeCnpj(): void {
  cacheCnpj.clear();
}

/**
 * CNPJ: BrasilAPI e, se falhar (fora do ar, limite de consultas), CNPJ.ws.
 * Só para quem está num tenant (evita uso como serviço aberto).
 */
export async function consultarCnpj(acesso: Acesso | null, cnpj: string): Promise<DadosDoCnpj | null> {
  exigirTenant(acesso);
  if (!cnpjValido(cnpj)) return null;
  const numero = soDigitos(cnpj);
  const guardado = cacheCnpj.get(numero);
  if (guardado && guardado.ate > Date.now()) return guardado.dados;
  const dados = (await cnpjNaBrasilApi(numero)) ?? (await cnpjNaCnpjWs(numero));
  if (dados) {
    if (cacheCnpj.size > 1000) cacheCnpj.clear();
    cacheCnpj.set(numero, { dados, ate: Date.now() + VALIDADE_CACHE_CNPJ_MS });
  }
  return dados;
}

/** Reserva: API pública da CNPJ.ws (gratuita, sem chave; limite de 3 consultas por minuto). */
async function cnpjNaCnpjWs(numero: string): Promise<DadosDoCnpj | null> {
  const d = (await buscarJson(`https://publica.cnpj.ws/cnpj/${numero}`)) as Record<string, unknown> | null;
  if (!d || !texto(d.razao_social)) return null;
  const e = (d.estabelecimento ?? {}) as Record<string, unknown>;
  const atividade = (e.atividade_principal ?? {}) as Record<string, unknown>;
  const cidade = (e.cidade ?? {}) as Record<string, unknown>;
  const estado = (e.estado ?? {}) as Record<string, unknown>;
  const tipo = texto(e.tipo_logradouro);
  const logradouro = texto(e.logradouro);
  // A CNPJ.ws acumula as bases mensais da Receita e não apaga quem saiu da
  // sociedade: quem continua no quadro foi atualizado na base mais recente.
  // Ficam só os sócios com a data de atualização mais nova.
  const todos = (Array.isArray(d.socios) ? d.socios : []) as Record<string, unknown>[];
  const ultima = todos.map((x) => texto(x.atualizado_em)).reduce((a, b) => (b > a ? b : a), "");
  const atuais = ultima ? todos.filter((x) => texto(x.atualizado_em) === ultima) : todos;
  return {
    razaoSocial: texto(d.razao_social),
    nomeFantasia: texto(e.nome_fantasia),
    cnae: [texto(atividade.id), texto(atividade.descricao)].filter(Boolean).join(" - "),
    telefone: [texto(e.ddd1), texto(e.telefone1)].join(""),
    email: texto(e.email).toLowerCase(),
    numero: texto(e.numero),
    endereco: {
      cep: soDigitos(texto(e.cep)),
      logradouro:
        tipo && !logradouro.toUpperCase().startsWith(tipo.toUpperCase())
          ? `${tipo} ${logradouro}`
          : logradouro,
      complemento: texto(e.complemento),
      bairro: texto(e.bairro),
      cidade: texto(cidade.nome),
      uf: texto(estado.sigla),
    },
    sociosAtualizadosEm: ultima ? ultima.slice(0, 10) : null,
    socios: atuais
      .map((x) => ({
        nome: texto(x.nome),
        qualificacao: texto(((x.qualificacao_socio ?? {}) as Record<string, unknown>).descricao),
        documentoParcial: texto(x.cpf_cnpj_socio),
        tipo: (/jur[ií]dica/i.test(texto(x.tipo))
          ? "pj"
          : /estrangeir/i.test(texto(x.tipo))
            ? "estrangeiro"
            : "pf") as TipoDeSocio,
      }))
      .filter((x) => x.nome),
  };
}

async function cnpjNaBrasilApi(numero: string): Promise<DadosDoCnpj | null> {
  const d = (await buscarJson(`https://brasilapi.com.br/api/cnpj/v1/${numero}`)) as Record<
    string,
    unknown
  > | null;
  if (!d || !texto(d.razao_social)) return null;
  const tipo = texto(d.descricao_tipo_de_logradouro);
  const logradouro = texto(d.logradouro);
  return {
    razaoSocial: texto(d.razao_social),
    nomeFantasia: texto(d.nome_fantasia),
    cnae: [texto(d.cnae_fiscal), texto(d.cnae_fiscal_descricao)].filter(Boolean).join(" - "),
    telefone: texto(d.ddd_telefone_1),
    email: texto(d.email).toLowerCase(),
    numero: texto(d.numero),
    endereco: {
      cep: soDigitos(texto(d.cep)),
      logradouro:
        tipo && !logradouro.toUpperCase().startsWith(tipo.toUpperCase())
          ? `${tipo} ${logradouro}`
          : logradouro,
      complemento: texto(d.complemento),
      bairro: texto(d.bairro),
      cidade: texto(d.municipio),
      uf: texto(d.uf),
    },
    // A BrasilAPI não informa a data da base.
    sociosAtualizadosEm: null,
    socios: (Array.isArray(d.qsa) ? d.qsa : [])
      .map((s: Record<string, unknown>) => ({
        nome: texto(s.nome_socio),
        qualificacao: texto(s.qualificacao_socio),
        documentoParcial: texto(s.cnpj_cpf_do_socio),
        tipo: (texto(s.identificador_de_socio) === "1"
          ? "pj"
          : texto(s.identificador_de_socio) === "3"
            ? "estrangeiro"
            : "pf") as TipoDeSocio,
      }))
      .filter((s) => s.nome),
  };
}

/** CEP no ViaCEP; se falhar, na BrasilAPI. */
export async function consultarCep(acesso: Acesso | null, cep: string): Promise<Endereco | null> {
  exigirTenant(acesso);
  if (!cepValido(cep)) return null;
  const n = soDigitos(cep);
  const via = (await buscarJson(`https://viacep.com.br/ws/${n}/json/`)) as Record<string, unknown> | null;
  if (via && !via.erro && texto(via.localidade))
    return {
      cep: n,
      logradouro: texto(via.logradouro),
      complemento: texto(via.complemento),
      bairro: texto(via.bairro),
      cidade: texto(via.localidade),
      uf: texto(via.uf),
    };
  const br = (await buscarJson(`https://brasilapi.com.br/api/cep/v2/${n}`)) as Record<string, unknown> | null;
  if (br && texto(br.city))
    return {
      cep: n,
      logradouro: texto(br.street),
      complemento: "",
      bairro: texto(br.neighborhood),
      cidade: texto(br.city),
      uf: texto(br.state),
    };
  return null;
}
