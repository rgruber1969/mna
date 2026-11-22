import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { AcessoNegado, obterAcesso, type Acesso } from "@/server/services/acesso";
import { buscarDocumentos } from "@/server/services/busca-de-documentos";
import { dataRoomDoNegocio, linkDeDownload } from "@/server/services/documentos";
import { ORDENS_DE_EMPRESAS, obterEmpresa, paginaDeEmpresas } from "@/server/services/empresas";
import { conversasDoNegocio, enviarMensagem, lerAlvo, obterConversa } from "@/server/services/mensagens";
import { ORDENS_DE_NEGOCIOS, obterNegocio, paginaDeNegocios } from "@/server/services/negocios";
import { ORDENS_DE_PESSOAS, obterPessoa, paginaDePessoas } from "@/server/services/pessoas";
import { criarTarefa, PRIORIDADES, tarefasDoNegocio } from "@/server/services/tarefas";

/**
 * API REST v1 (itens 25 e 26; ADR-0004, ADR-0013). Autenticação por chave de
 * API (`Authorization: Bearer chv_…`, gerada por administradores) ou pela
 * sessão das telas. As rotas só validam a entrada e chamam a camada de
 * serviços: valem exatamente as mesmas permissões e a mesma auditoria das
 * telas. Dados sensíveis saem mascarados, como na tela.
 */

const Qualquer = z.unknown().openapi({ type: "object" });
const Erro = z.object({ erro: z.string() }).openapi("Erro");
const Id = z.object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) });
const seguranca = [{ chaveDeApi: [] }];

const respostas = (descricao: string) => ({
  200: { description: descricao, content: { "application/json": { schema: Qualquer } } },
  400: { description: "Dados inválidos", content: { "application/json": { schema: Erro } } },
  401: { description: "Sem chave ou chave inválida", content: { "application/json": { schema: Erro } } },
  403: { description: "Sem permissão", content: { "application/json": { schema: Erro } } },
  404: { description: "Não encontrado", content: { "application/json": { schema: Erro } } },
});

const Pagina = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  busca: z.string().max(200).optional(),
});

/** Executa com o acesso da chave (ou da sessão); traduz negação e erro de serviço em HTTP. */
async function comAcesso(c: Context, fn: (a: Acesso) => Promise<unknown>) {
  const a = await obterAcesso(c.req.raw.headers);
  if (!a || a.area !== "tenant") return c.json({ erro: "nao_autenticado" }, 401);
  try {
    const r = await fn(a);
    if (r === null || r === undefined) return c.json({ erro: "nao_encontrado" }, 404);
    if (typeof r === "object" && r && "erro" in r)
      return c.json({ erro: String((r as { erro: string }).erro) }, 400);
    return c.json(r as object, 200);
  } catch (e) {
    if (e instanceof AcessoNegado) return c.json({ erro: "sem_permissao" }, 403);
    throw e;
  }
}

export function registrarRotasV1(api: OpenAPIHono) {
  api.openAPIRegistry.registerComponent("securitySchemes", "chaveDeApi", {
    type: "http",
    scheme: "bearer",
    description: "Chave de API gerada por um administrador do tenant (Administração › Chaves de API).",
  });

  // --- Negócios ------------------------------------------------------------------------------
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/negocios",
      tags: ["Negócios"],
      summary: "Negócios que a chave vê",
      security: seguranca,
      request: { query: Pagina.extend({ situacao: z.string().optional() }) },
      responses: respostas("Página de negócios"),
    }),
    (c) => {
      const q = c.req.valid("query");
      return comAcesso(c, (a) =>
        paginaDeNegocios(
          a,
          { busca: q.busca, situacao: q.situacao },
          { pagina: q.pagina, porPagina: q.porPagina, ordem: ORDENS_DE_NEGOCIOS[0], direcao: "asc" },
        ),
      ) as never;
    },
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/negocios/{id}",
      tags: ["Negócios"],
      summary: "Detalhe do negócio (empresas e participantes visíveis)",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Negócio"),
    }),
    (c) => comAcesso(c, (a) => obterNegocio(a, c.req.valid("param").id)) as never,
  );

  // --- Documentos ----------------------------------------------------------------------------
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/negocios/{id}/documentos",
      tags: ["Documentos"],
      summary: "Documentos e versões que a chave vê no negócio",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Documentos"),
    }),
    (c) =>
      comAcesso(c, async (a) => {
        const dr = await dataRoomDoNegocio(a, c.req.valid("param").id);
        return dr && { documentos: dr.documentos, categorias: dr.categorias, etapas: dr.etapas };
      }) as never,
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/documentos/versoes/{id}/download",
      tags: ["Documentos"],
      summary: "Link temporário de download da versão (auditado)",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Link temporário"),
    }),
    (c) => comAcesso(c, (a) => linkDeDownload(a, c.req.valid("param").id)) as never,
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/busca/documentos",
      tags: ["Documentos"],
      summary: "Busca de documentos por nome ou conteúdo (só o que a chave vê)",
      security: seguranca,
      request: {
        query: z.object({ q: z.string().min(2).max(200), negocio: z.uuid().optional() }),
      },
      responses: respostas("Resultados"),
    }),
    (c) => {
      const q = c.req.valid("query");
      return comAcesso(c, (a) => buscarDocumentos(a, { termo: q.q, dealId: q.negocio ?? null })) as never;
    },
  );

  // --- Tarefas -------------------------------------------------------------------------------
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/negocios/{id}/tarefas",
      tags: ["Tarefas"],
      summary: "Tarefas que a chave vê no negócio",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Tarefas"),
    }),
    (c) =>
      comAcesso(c, async (a) => {
        const q = await tarefasDoNegocio(a, c.req.valid("param").id);
        return q && { tarefas: q.tarefas };
      }) as never,
  );
  api.openapi(
    createRoute({
      method: "post",
      path: "/v1/negocios/{id}/tarefas",
      tags: ["Tarefas"],
      summary: "Cria uma tarefa no negócio",
      security: seguranca,
      request: {
        params: Id,
        body: {
          content: {
            "application/json": {
              schema: z.object({
                titulo: z.string().min(2).max(200),
                descricao: z.string().max(4000).optional(),
                etapaId: z.uuid().optional(),
                prazo: z
                  .string()
                  .regex(/^\d{4}-\d{2}-\d{2}$/)
                  .optional(),
                prioridade: z.enum(PRIORIDADES).optional(),
              }),
            },
          },
        },
      },
      responses: respostas("Tarefa criada"),
    }),
    (c) => {
      const b = c.req.valid("json");
      return comAcesso(c, (a) =>
        criarTarefa(a, c.req.valid("param").id, {
          titulo: b.titulo,
          descricao: b.descricao ?? "",
          etapaId: b.etapaId ?? "",
          prazo: b.prazo ?? "",
          prioridade: b.prioridade,
        }),
      ) as never;
    },
  );

  // --- Mensagens -----------------------------------------------------------------------------
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/negocios/{id}/conversas",
      tags: ["Mensagens"],
      summary: "Conversas do negócio (geral, etapas, documentos e tarefas)",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Conversas"),
    }),
    (c) => comAcesso(c, (a) => conversasDoNegocio(a, c.req.valid("param").id)) as never,
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/negocios/{id}/mensagens",
      tags: ["Mensagens"],
      summary: "Mensagens de uma conversa, por canal",
      description: 'conversa: "deal:-" (geral), "etapa:<id>", "versao:<id>" ou "tarefa:<id>".',
      security: seguranca,
      request: {
        params: Id,
        query: z.object({ conversa: z.string().default("deal:-"), canal: z.string().optional() }),
      },
      responses: respostas("Conversa"),
    }),
    (c) => {
      const q = c.req.valid("query");
      const alvo = lerAlvo(q.conversa);
      return comAcesso(c, async (a) =>
        alvo ? obterConversa(a, c.req.valid("param").id, alvo, q.canal) : null,
      ) as never;
    },
  );
  api.openapi(
    createRoute({
      method: "post",
      path: "/v1/negocios/{id}/mensagens",
      tags: ["Mensagens"],
      summary: "Envia uma mensagem (imutável) numa conversa e canal",
      security: seguranca,
      request: {
        params: Id,
        body: {
          content: {
            "application/json": {
              schema: z.object({
                conversa: z.string().default("deal:-"),
                canal: z.string(),
                texto: z.string().min(1).max(5000),
                mencoes: z.array(z.uuid()).max(50).optional(),
              }),
            },
          },
        },
      },
      responses: respostas("Mensagem enviada"),
    }),
    (c) => {
      const b = c.req.valid("json");
      const alvo = lerAlvo(b.conversa);
      return comAcesso(c, async (a) =>
        alvo
          ? enviarMensagem(a, c.req.valid("param").id, alvo, b.canal, {
              texto: b.texto,
              mencoes: b.mencoes ?? [],
            })
          : null,
      ) as never;
    },
  );

  // --- Cadastros -----------------------------------------------------------------------------
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/empresas",
      tags: ["Cadastros"],
      summary: "Empresas",
      security: seguranca,
      request: { query: Pagina },
      responses: respostas("Página de empresas"),
    }),
    (c) => {
      const q = c.req.valid("query");
      return comAcesso(c, (a) =>
        paginaDeEmpresas(
          a,
          { busca: q.busca },
          { pagina: q.pagina, porPagina: q.porPagina, ordem: ORDENS_DE_EMPRESAS[0], direcao: "asc" },
        ),
      ) as never;
    },
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/empresas/{id}",
      tags: ["Cadastros"],
      summary: "Detalhe da empresa",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Empresa"),
    }),
    (c) => comAcesso(c, (a) => obterEmpresa(a, c.req.valid("param").id)) as never,
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/pessoas",
      tags: ["Cadastros"],
      summary: "Pessoas",
      security: seguranca,
      request: { query: Pagina },
      responses: respostas("Página de pessoas"),
    }),
    (c) => {
      const q = c.req.valid("query");
      return comAcesso(c, (a) =>
        paginaDePessoas(
          a,
          { busca: q.busca },
          { pagina: q.pagina, porPagina: q.porPagina, ordem: ORDENS_DE_PESSOAS[0], direcao: "asc" },
        ),
      ) as never;
    },
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/pessoas/{id}",
      tags: ["Cadastros"],
      summary: "Detalhe da pessoa (dados sensíveis mascarados)",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Pessoa"),
    }),
    (c) => comAcesso(c, (a) => obterPessoa(a, c.req.valid("param").id)) as never,
  );
}
