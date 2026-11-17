import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { produto } from "@/config/produto";
import { obterStatusDoSistema } from "@/server/services/sistema";

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
