import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { produto } from "@/config/produto";
import { obterStatusDoSistema } from "@/server/services/sistema";
import { obterAcesso } from "@/server/services/acesso";
import { lerFotoDaConta } from "@/server/services/foto-da-conta";
import { lerImagemDaMarca } from "@/server/services/marca";
import { baixarAnexo, MODOS_DE_ACESSO, type ModoDeAcesso } from "@/server/services/anexos";
import { conteudoParaVisualizar, zipDeVersoes } from "@/server/services/documentos";
import { serve as servirTarefas } from "inngest/hono";
import { inngest } from "@/server/tarefas/cliente";
import { funcoes } from "@/server/tarefas/funcoes";
import { registrarRotasV1 } from "./rotas-v1";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GUIA_DA_API } from "./guia-da-api";
import { completarExemplos } from "./exemplos";
import { protocolo, resolverArea } from "@/server/enderecos";

/** Origem (protocolo + host) do pedido, só se o host for um endereço válido da aplicação. */
const origemDoPedido = (host: string | undefined) =>
  host && resolverArea(host).tipo !== "invalido" ? `${protocolo()}://${host}` : "/";

/**
 * API REST (ADR-0004): Hono com especificação OpenAPI gerada a partir dos
 * esquemas Zod. As rotas só validam a entrada e chamam a camada de serviços.
 */
export const api = new OpenAPIHono().basePath("/api");

const StatusSchema = z
  .object({
    produto: z.string().openapi({ example: "MNA" }),
    versao: z.string().openapi({ example: "0.1.0" }),
    status: z.literal("ok"),
    horario: z.string().datetime().openapi({ example: "2026-11-17T12:00:00.000Z" }),
  })
  .openapi("StatusDoSistema");

const rotaStatus = createRoute({
  method: "get",
  path: "/status",
  tags: ["Sistema"],
  summary: "Status do sistema",
  description: "Verifica se a API está no ar. Não exige autenticação.",
  responses: {
    200: {
      description: "Sistema no ar",
      content: { "application/json": { schema: StatusSchema } },
    },
  },
});

api.openapi(rotaStatus, (c) => c.json(obterStatusDoSistema(), 200));

/**
 * Foto da conta (uso interno das telas; fora do Swagger). Exige sessão no
 * endereço e permissão de ver a pessoa (foto-da-conta.ts).
 */
api.get("/conta/foto/:usuarioId", async (c) => {
  const acesso = await obterAcesso(c.req.raw.headers);
  const foto = await lerFotoDaConta(acesso, c.req.param("usuarioId"));
  if (!foto) return c.body(null, 404);
  return c.body(foto as Uint8Array<ArrayBuffer>, 200, {
    "content-type": "image/webp",
    "cache-control": "private, max-age=86400",
    "x-content-type-options": "nosniff",
  });
});

/**
 * Download de anexo do cadastro (uso interno das telas; fora do Swagger). O
 * servidor confere a permissão, descriptografa e audita (anexos.ts); sempre
 * como anexo, nunca exibido no navegador (ADR-0016).
 */
api.get("/anexos/:id", async (c) => {
  const acesso = await obterAcesso(c.req.raw.headers);
  // ?modo=visualizar|miniatura: a página desenha a prévia; o arquivo continua indo como anexo.
  const pedido = c.req.query("modo") as ModoDeAcesso | undefined;
  const modo = pedido && MODOS_DE_ACESSO.includes(pedido) ? pedido : "baixar";
  const arquivo = await baixarAnexo(acesso, c.req.param("id"), modo).catch(() => null);
  if (!arquivo) return c.body(null, 404);
  const nome = encodeURIComponent(arquivo.nome);
  return c.body(arquivo.conteudo as Uint8Array<ArrayBuffer>, 200, {
    "content-type": arquivo.tipo,
    "content-disposition": `attachment; filename*=UTF-8''${nome}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'",
  });
});

/** Vários documentos num ZIP (telas): POST com as versões escolhidas; permissão e auditoria por versão. */
api.post("/documentos/zip", async (c) => {
  const acesso = await obterAcesso(c.req.raw.headers);
  const corpo = (await c.req.json().catch(() => null)) as { versoes?: unknown } | null;
  const versoes = Array.isArray(corpo?.versoes)
    ? corpo.versoes.filter((v): v is string => typeof v === "string")
    : [];
  const r = await zipDeVersoes(acesso, versoes).catch(() => null);
  if (!r) return c.body(null, 404);
  if ("erro" in r) return c.json({ erro: r.erro }, 400);
  return c.body(r.conteudo as Uint8Array<ArrayBuffer>, 200, {
    "content-type": "application/zip",
    "content-disposition": `attachment; filename="${r.nome}"`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
});

/** Prévia de documento do data room (PDF ou imagem), com permissão e auditoria; fora do Swagger. */
api.get("/documentos/versoes/:id/previa", async (c) => {
  const acesso = await obterAcesso(c.req.raw.headers);
  const arquivo = await conteudoParaVisualizar(acesso, c.req.param("id")).catch(() => null);
  if (!arquivo) return c.body(null, 404);
  const nome = encodeURIComponent(arquivo.nome);
  return c.body(arquivo.conteudo as Uint8Array<ArrayBuffer>, 200, {
    "content-type": arquivo.tipo,
    "content-disposition": `attachment; filename*=UTF-8''${nome}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'",
  });
});

/**
 * Imagens da marca do tenant (white label, ADR-0010). Públicas: aparecem na
 * tela de entrada, antes do login. O nome do arquivo muda a cada envio, por
 * isso o cache pode ser longo. Não aparece no Swagger.
 */
api.get("/marca/:tenantId/:arquivo", async (c) => {
  const imagem = await lerImagemDaMarca(c.req.param("tenantId"), c.req.param("arquivo"));
  if (!imagem) return c.body(null, 404);
  return c.body(imagem as Uint8Array<ArrayBuffer>, 200, {
    "content-type": "image/png",
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'",
  });
});

/**
 * Endpoint chamado pelo Inngest para executar as tarefas (ADR-0015).
 * Não aparece no Swagger: é de uso interno do orquestrador.
 */
const atenderTarefas = servirTarefas({ client: inngest, functions: funcoes });
api.on(["GET", "POST", "PUT"], "/inngest", (c) => atenderTarefas(c));

// Rotas públicas da API (chave de API ou sessão), com a mesma camada de serviços das telas.
registrarRotasV1(api);

/**
 * Raiz da API v1 (sem autenticação): só se apresenta e aponta a documentação,
 * para quem abre o endereço no navegador não ver um 404.
 */
api.get("/v1", (c) => {
  const docs = process.env.NODE_ENV !== "production" || process.env.API_DOCS_ENABLED === "true";
  return c.json({
    api: `API ${produto.nome}`,
    versao: "v1",
    autenticacao: "Authorization: Bearer chv_... (chave criada em Configurações › Chaves de API)",
    ...(docs ? { documentacao: "/api/referencia", swagger: "/api/docs", openapi: "/api/openapi.json" } : {}),
    exemplo: "GET /api/v1/negocios",
  });
});

/**
 * Documentação da API. Fora da produção, sempre disponível; em produção,
 * só com API_DOCS_ENABLED=true (ASVS V13.4: evitar exposição desnecessária).
 */
const documentacaoHabilitada =
  process.env.NODE_ENV !== "production" || process.env.API_DOCS_ENABLED === "true";

if (documentacaoHabilitada) {
  // Especificação OpenAPI com o endereço deste escritório (para os exemplos de chamada
  // saírem completos) e os exemplos de chamada e de retorno (exemplos.ts).
  api.get("/openapi.json", (c) => {
    const doc = api.getOpenAPI31Document({
      openapi: "3.1.0",
      info: {
        title: `API ${produto.nome}`,
        version: produto.versao,
        // O guia de integração vira a introdução da página de referência.
        description: GUIA_DA_API,
      },
      // Host do pedido (o Next reescreve a URL por dentro); só entra no documento, se for válido.
      servers: [{ url: origemDoPedido(c.req.header("host")), description: "Este escritório" }],
    });
    return c.json(completarExemplos(doc as never));
  });
  api.get("/docs", swaggerUI({ url: "/api/openapi.json" }));

  /**
   * Referência amigável da API (Scalar, decisão de 2026-11-27): o mesmo
   * OpenAPI, com o guia como introdução, busca e "testar" com a chave. O
   * script vem do pacote e é servido por aqui (sem CDN externo).
   */
  let scalar: Promise<Buffer> | null = null;
  api.get("/referencia/scalar.js", async (c) => {
    // Caminho no disco (o pacote não exporta o arquivo como módulo); no build de
    // produção ele vai junto por outputFileTracingIncludes (next.config.ts).
    scalar ??= readFile(
      path.join(process.cwd(), "node_modules/@scalar/api-reference/dist/browser/standalone.js"),
    );
    return c.body(new Uint8Array(await scalar), 200, {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    });
  });
  api.get("/referencia", (c) => {
    const config = JSON.stringify({
      theme: "default",
      // Nada sai daqui para o Scalar: sem barra de desenvolvedor (propaganda), sem IA,
      // sem telemetria e sem fontes externas (as do sistema operacional bastam).
      showDeveloperTools: "never",
      showToolbar: "never",
      telemetry: false,
      agent: { disabled: true },
      withDefaultFonts: false,
      hideClientButton: false,
      defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
      metaData: { title: `API ${produto.nome}` },
    }).replace(/</g, "\\u003c");
    const titulo = `API ${produto.nome}`.replace(/[<>&"]/g, "");
    return c.html(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${titulo}</title></head><body><script id="api-reference" data-url="/api/openapi.json" data-configuration='${config.replace(/'/g, "&#39;")}'></script><script src="/api/referencia/scalar.js"></script></body></html>`,
    );
  });
}
