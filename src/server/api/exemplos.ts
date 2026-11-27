import EXEMPLOS from "./exemplos-da-api.json";

/**
 * Exemplos da documentação da API (página /api/referencia e Swagger): a
 * chamada (endereço deste escritório, identificadores, filtros e corpos) e o
 * retorno, com dados do tenant de demonstração (fictícios), gerados por
 * `pnpm api:exemplos`. Só mexe no documento OpenAPI, nunca nas rotas.
 */

type Json = Record<string, unknown>;
type Operacao = {
  parameters?: { name: string; in: string; example?: unknown }[];
  requestBody?: { content?: Record<string, { example?: unknown }> };
  responses?: Record<string, { content?: Record<string, { example?: unknown }> }>;
};

const ex = EXEMPLOS as Record<string, Json | Json[] | undefined>;
const lista = (v: unknown, campo: string) => ((v as Json | undefined)?.[campo] as Json[] | undefined) ?? [];
const id = (v: unknown) => (v as Json | undefined)?.id as string | undefined;

const negocio = id(ex["get /v1/negocios/{id}"]);
const pedido = ex["get /v1/pedidos/{id}"] as Json | undefined;
const documento = lista(ex["get /v1/negocios/{id}/documentos"], "documentos")[0];
const versao = lista(documento, "versoes")[0];
const oferta = lista(ex["get /v1/negocios/{id}/ofertas"], "ofertas")[0];

/** Identificador de exemplo para o {id} de cada caminho (o mais específico primeiro). */
const IDS: [RegExp, string | undefined][] = [
  [/^\/api\/v1\/negocios\/\{id\}/, negocio],
  [/^\/api\/v1\/pedidos\/itens\/\{id\}/, id(lista(pedido, "itens")[0])],
  [/^\/api\/v1\/pedidos\/\{id\}/, id(pedido)],
  [/^\/api\/v1\/empresas\/\{id\}/, id(ex["get /v1/empresas/{id}"])],
  [/^\/api\/v1\/pessoas\/\{id\}/, id(ex["get /v1/pessoas/{id}"])],
  [/^\/api\/v1\/contratos\/\{id\}/, id(lista(ex["get /v1/contratos"], "contratos")[0])],
  [/^\/api\/v1\/documentos\/versoes\/\{id\}/, id(versao)],
  [/^\/api\/v1\/documentos\/\{id\}/, id(documento)],
];

/** Filtros de exemplo (query) por caminho. */
const FILTROS: Record<string, Json> = {
  "/api/v1/negocios": { situacao: "abertos", busca: "Jatobá" },
  "/api/v1/busca/documentos": { q: "receita", negocio },
  "/api/v1/empresas": { busca: "Madeireira" },
  "/api/v1/pessoas": { busca: "Ana" },
};

/** Corpos de exemplo das criações (POST). */
const CORPOS: Record<string, Json> = {
  "/api/v1/negocios/{id}/tarefas": {
    titulo: "Revisar minuta do SPA",
    descricao: "Conferir as cláusulas de earnout",
    prazo: "2026-12-15",
    prioridade: "alta",
  },
  "/api/v1/negocios/{id}/pedidos": {
    titulo: "Diligência contábil e fiscal",
    data: "2026-12-01",
    compradoraId: oferta?.compradoraId,
    periodos: "2024, 2025",
  },
  "/api/v1/pedidos/{id}/itens": {
    rodadaId: id(lista(pedido, "rodadas")[0]),
    assunto: "Fiscal",
    codigo: "2.1",
    descricao: "Certidões negativas federais, estaduais e municipais",
    tipo: "documento",
    dataPedido: "2026-12-01",
  },
  "/api/v1/pedidos/itens/{id}/situacao": { periodo: "2025", situacao: "entregue" },
  "/api/v1/negocios/{id}/ofertas": {
    compradoraId: oferta?.compradoraId,
    data: "2026-12-01",
    instrumento: "loi",
    parcelaVista: "10000000.00",
    parcelas: [{ valor: "5000000.00", data: "2027-12-31" }],
  },
};

export function completarExemplos(doc: { paths?: Record<string, Record<string, Operacao>> }) {
  for (const [caminho, metodos] of Object.entries(doc.paths ?? {})) {
    const semApi = caminho.replace(/^\/api/, "");
    for (const [metodo, op] of Object.entries(metodos)) {
      for (const p of op.parameters ?? []) {
        if (p.in === "path" && p.name === "id") {
          const valor = IDS.find(([re]) => re.test(caminho))?.[1];
          if (valor) p.example = valor;
        }
        if (p.in === "query" && FILTROS[caminho]?.[p.name] !== undefined)
          p.example = FILTROS[caminho][p.name];
      }
      const corpo = metodo === "post" ? CORPOS[caminho] : undefined;
      const json = op.requestBody?.content?.["application/json"];
      if (corpo && json) json.example = corpo;
      const retorno = ex[`${metodo} ${semApi}`];
      const ok = op.responses?.["200"]?.content?.["application/json"];
      if (retorno && ok) ok.example = retorno;
    }
  }
  return doc;
}
