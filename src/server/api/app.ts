import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { produto } from "@/config/produto";
import { obterStatusDoSistema } from "@/server/services/sistema";
import { obterAcesso } from "@/server/services/acesso";
import { lerFotoDaConta } from "@/server/services/foto-da-conta";
import { lerImagemDaMarca } from "@/server/services/marca";
import { baixarAnexo } from "@/server/services/anexos";
import { serve as servirTarefas } from "inngest/hono";
import { inngest } from "@/server/tarefas/cliente";
import { funcoes } from "@/server/tarefas/funcoes";

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
  const arquivo = await baixarAnexo(acesso, c.req.param("id")).catch(() => null);
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

/**
 * Documentação da API. Fora da produção, sempre disponível; em produção,
 * só com API_DOCS_ENABLED=true (ASVS V13.4: evitar exposição desnecessária).
 */
const documentacaoHabilitada =
  process.env.NODE_ENV !== "production" || process.env.API_DOCS_ENABLED === "true";

if (documentacaoHabilitada) {
  api.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: `API ${produto.nome}`,
      version: produto.versao,
      description: "API REST da plataforma.",
    },
  });
  api.get("/docs", swaggerUI({ url: "/api/openapi.json" }));
}
