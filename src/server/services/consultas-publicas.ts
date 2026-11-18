import { cepValido, cnpjValido, soDigitos } from "@/config/documentos";
import { exigirTenant, type Acesso } from "./acesso";

/**
 * Consulta de CNPJ e CEP em serviços públicos e gratuitos (decisão menor
 * "Consulta de CNPJ e CEP"): BrasilAPI para CNPJ (com o quadro de sócios) e
 * ViaCEP para CEP, com a BrasilAPI de reserva. A consulta sai do servidor;
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

export type DadosDoCnpj = {
  razaoSocial: string;
  nomeFantasia: string;
  cnae: string;
  telefone: string;
  email: string;
  numero: string;
  endereco: Endereco;
  socios: { nome: string; qualificacao: string }[];
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

/** CNPJ na BrasilAPI. Só para quem está num tenant (evita uso como serviço aberto). */
export async function consultarCnpj(acesso: Acesso | null, cnpj: string): Promise<DadosDoCnpj | null> {
  exigirTenant(acesso);
  if (!cnpjValido(cnpj)) return null;
  const d = (await buscarJson(`https://brasilapi.com.br/api/cnpj/v1/${soDigitos(cnpj)}`)) as Record<
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
    socios: (Array.isArray(d.qsa) ? d.qsa : [])
      .map((s: Record<string, unknown>) => ({
        nome: texto(s.nome_socio),
        qualificacao: texto(s.qualificacao_socio),
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
