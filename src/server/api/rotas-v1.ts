import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { ORDENS_DA_AUDITORIA, paginaDaAuditoria } from "@/server/services/auditoria";
import type { Context } from "hono";
import { AcessoNegado, obterAcesso, type Acesso } from "@/server/services/acesso";
import { buscarDocumentos } from "@/server/services/busca-de-documentos";
import { dataRoomDoNegocio, linkDeDownload } from "@/server/services/documentos";
import { ORDENS_DE_EMPRESAS, obterEmpresa, paginaDeEmpresas } from "@/server/services/empresas";
import { conversasDoNegocio, enviarMensagem, lerAlvo, obterConversa } from "@/server/services/mensagens";
import { ORDENS_DE_NEGOCIOS, obterNegocio, paginaDeNegocios } from "@/server/services/negocios";
import { ORDENS_DE_PESSOAS, obterPessoa, paginaDePessoas } from "@/server/services/pessoas";
import { resumoDasMensagens, resumoDoDocumento } from "@/server/services/resumos";
import { criarTarefa, PRIORIDADES, tarefasDoNegocio } from "@/server/services/tarefas";
import {
  criarContrato,
  linkDoArquivoDoContrato,
  listarContratos,
  obterContrato,
  CRITERIOS_VARIAVEIS,
  PERIODICIDADES,
  TIPOS_DE_CONTRATO,
} from "@/server/services/contratos";
import {
  criarOferta,
  INSTRUMENTOS,
  linkDoArquivoDaOferta,
  ofertasDoNegocio,
} from "@/server/services/ofertas";
import {
  criarPedido,
  definirSituacaoDoItem,
  obterPedido,
  pedidosDoNegocio,
  salvarItem,
} from "@/server/services/pedidos";
import { SITUACOES_DO_ITEM } from "@/config/pedidos";

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

  // --- Resumos (local, sem IA) ----------------------------------------------------------------
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/resumos/mensagens",
      tags: ["Resumos"],
      summary: "Resumo das mensagens não lidas (geral ou de um negócio)",
      security: seguranca,
      request: { query: z.object({ negocio: z.uuid().optional() }) },
      responses: respostas("Resumo"),
    }),
    (c) => comAcesso(c, (a) => resumoDasMensagens(a, c.req.valid("query").negocio ?? null)) as never,
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/documentos/{id}/resumo",
      tags: ["Resumos"],
      summary: "Resumo do histórico de um documento (versões, mudanças e comentários)",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Resumo"),
    }),
    (c) => comAcesso(c, (a) => resumoDoDocumento(a, c.req.valid("param").id)) as never,
  );

  // --- Auditoria (item 20) ------------------------------------------------------------------
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/auditoria",
      tags: ["Auditoria"],
      summary:
        "Eventos de auditoria do tenant (permissão Auditoria × ver); padrão: do mais recente ao mais antigo",
      security: seguranca,
      request: {
        query: Pagina.extend({
          de: z.string().optional(),
          ate: z.string().optional(),
          assunto: z.string().max(40).optional(),
          ator: z.uuid().optional(),
          negocio: z.uuid().optional(),
          busca: z.string().max(100).optional(),
          ordem: z.enum(ORDENS_DA_AUDITORIA).optional(),
          direcao: z.enum(["asc", "desc"]).optional(),
        }),
      },
      responses: respostas("Página de eventos"),
    }),
    (c) => {
      const q = c.req.valid("query");
      return comAcesso(c, (a) =>
        paginaDaAuditoria(
          a,
          { de: q.de, ate: q.ate, assunto: q.assunto, ator: q.ator, negocio: q.negocio, busca: q.busca },
          {
            pagina: q.pagina,
            porPagina: q.porPagina,
            ordem: q.ordem ?? "ocorridoEm",
            direcao: q.direcao ?? (q.ordem ? "asc" : "desc"),
          },
        ),
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

  // --- Contratos -----------------------------------------------------------------------------
  const DadosContratoApi = z.object({
    dealId: z.uuid().nullable().optional(),
    tipo: z.enum(TIPOS_DE_CONTRATO),
    titulo: z.string().min(2).max(200),
    objeto: z.string().max(5000).optional(),
    dataAssinatura: z.string().optional(),
    inicio: z.string().optional(),
    fim: z.string().optional(),
    exclusivo: z.boolean().optional(),
    exclusividadeAte: z.string().optional(),
    honorarioFixo: z.string().optional(),
    periodicidade: z.enum(PERIODICIDADES).optional(),
    retainerDescontado: z.boolean().optional(),
    honorarioVariavel: z.boolean().optional(),
    variavelCriterio: z.enum(CRITERIOS_VARIAVEIS).optional(),
    variavelValorHora: z.string().optional(),
    variavelPercentual: z.string().optional(),
    variavelBase: z.string().max(1000).optional(),
    variavelTeto: z.string().optional(),
    variavelDiaApuracao: z.string().optional(),
    successFeePercentual: z.string().optional(),
    successFeeMinimo: z.string().optional(),
    formaPagamento: z.string().max(1000).optional(),
    contaBancariaId: z.uuid().optional(),
    meioRecebimento: z.enum(["conta", "pix"]).optional(),
    observacoes: z.string().max(5000).optional(),
    contratantes: z.array(z.uuid()).min(1),
    contratadas: z.array(z.uuid()).min(1),
    perfis: z.array(z.uuid()).optional(),
    usuarios: z.array(z.uuid()).optional(),
  });
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/contratos",
      tags: ["Contratos"],
      summary: "Contratos que a chave vê (todos, de um negócio ou só os avulsos)",
      security: seguranca,
      request: {
        query: z.object({
          negocio: z.uuid().optional(),
          avulsos: z.enum(["sim"]).optional(),
        }),
      },
      responses: respostas("Contratos"),
    }),
    (c) => {
      const q = c.req.valid("query");
      return comAcesso(c, async (a) => ({
        contratos: await listarContratos(
          a,
          q.negocio ? { dealId: q.negocio } : q.avulsos ? { dealId: null } : {},
        ),
      })) as never;
    },
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/contratos/{id}",
      tags: ["Contratos"],
      summary: "Detalhe do contrato (conta da contratada mascarada)",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Contrato"),
    }),
    (c) => comAcesso(c, (a) => obterContrato(a, c.req.valid("param").id)) as never,
  );
  api.openapi(
    createRoute({
      method: "post",
      path: "/v1/contratos",
      tags: ["Contratos"],
      summary: "Cria um contrato (no negócio ou avulso); valores no formato 1234.56",
      security: seguranca,
      request: { body: { content: { "application/json": { schema: DadosContratoApi } } } },
      responses: respostas("Contrato criado"),
    }),
    (c) => comAcesso(c, (a) => criarContrato(a, c.req.valid("json"))) as never,
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/contratos/arquivos/{id}/download",
      tags: ["Contratos"],
      summary: "Link temporário para baixar uma versão do arquivo do contrato (auditado)",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Link"),
    }),
    (c) => comAcesso(c, (a) => linkDoArquivoDoContrato(a, c.req.valid("param").id)) as never,
  );

  // --- Ofertas -------------------------------------------------------------------------------
  const DataApi = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/negocios/{id}/ofertas",
      tags: ["Ofertas"],
      summary: "Ofertas que a chave vê no negócio, com rateio e se a lista está completa",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Ofertas"),
    }),
    (c) => comAcesso(c, (a) => ofertasDoNegocio(a, c.req.valid("param").id)) as never,
  );
  api.openapi(
    createRoute({
      method: "post",
      path: "/v1/negocios/{id}/ofertas",
      tags: ["Ofertas"],
      summary: "Registra uma oferta (ou contraproposta, com anteriorId); valores no formato 1234.56",
      security: seguranca,
      request: {
        params: Id,
        body: {
          content: {
            "application/json": {
              schema: z.object({
                compradoraId: z.uuid(),
                anteriorId: z.uuid().optional(),
                data: DataApi,
                instrumento: z.enum(INSTRUMENTOS),
                enterpriseValue: z.string().optional(),
                equityValue: z.string().optional(),
                parcelaVista: z.string().optional(),
                parcelas: z.array(z.object({ valor: z.string(), data: DataApi })).optional(),
                earnout: z.string().max(3000).optional(),
                earnoutValor: z.string().optional(),
                retencao: z.string().max(3000).optional(),
                retencaoValor: z.string().optional(),
                condicoesPrecedentes: z.string().max(3000).optional(),
                validade: z.string().optional(),
                garantiasCompradora: z.string().max(3000).optional(),
                garantiasVendedora: z.string().max(3000).optional(),
                correcaoParcelas: z.string().max(3000).optional(),
                condicoesTransicao: z.string().max(3000).optional(),
                exclusividade: z.string().max(500).optional(),
                naoConcorrencia: z.string().max(500).optional(),
                observacoes: z.string().max(5000).optional(),
                perfis: z.array(z.uuid()).optional(),
                usuarios: z.array(z.uuid()).optional(),
              }),
            },
          },
        },
      },
      responses: respostas("Oferta registrada"),
    }),
    (c) => comAcesso(c, (a) => criarOferta(a, c.req.valid("param").id, c.req.valid("json"))) as never,
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/ofertas/arquivos/{id}/download",
      tags: ["Ofertas"],
      summary: "Link temporário para baixar um arquivo da oferta (auditado)",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Link"),
    }),
    (c) => comAcesso(c, (a) => linkDoArquivoDaOferta(a, c.req.valid("param").id)) as never,
  );

  // --- Pedidos de documentos (D4) ----------------------------------------------------------------
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/negocios/{id}/pedidos",
      tags: ["Pedidos de documentos"],
      summary: "Pedidos de documentos que a chave vê no negócio, com os totais por situação",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Pedidos"),
    }),
    (c) => comAcesso(c, (a) => pedidosDoNegocio(a, c.req.valid("param").id)) as never,
  );
  api.openapi(
    createRoute({
      method: "post",
      path: "/v1/negocios/{id}/pedidos",
      tags: ["Pedidos de documentos"],
      summary: "Cria um pedido de documentos (períodos separados por vírgula)",
      security: seguranca,
      request: {
        params: Id,
        body: {
          content: {
            "application/json": {
              schema: z.object({
                titulo: z.string().max(160),
                data: DataApi,
                compradoraId: z.uuid().optional(),
                solicitanteId: z.uuid().optional(),
                solicitantePessoas: z.string().max(500).optional(),
                dataBase: DataApi.optional(),
                periodos: z.string().max(300).optional(),
                amostragem: z.string().max(300).optional(),
                descricao: z.string().max(2000).optional(),
              }),
            },
          },
        },
      },
      responses: respostas("Pedido criado"),
    }),
    (c) => comAcesso(c, (a) => criarPedido(a, c.req.valid("param").id, c.req.valid("json"))) as never,
  );
  api.openapi(
    createRoute({
      method: "get",
      path: "/v1/pedidos/{id}",
      tags: ["Pedidos de documentos"],
      summary: "Pedido com rodadas, itens (situação por período, documentos que a chave vê) e painel",
      security: seguranca,
      request: { params: Id },
      responses: respostas("Pedido"),
    }),
    (c) => comAcesso(c, (a) => obterPedido(a, c.req.valid("param").id)) as never,
  );
  const ItemApi = z.object({
    rodadaId: z.uuid(),
    assunto: z.string().max(80),
    codigo: z.string().max(40).optional(),
    grupo: z.string().max(160).optional(),
    subgrupo: z.string().max(160).optional(),
    prioridade: z.string().max(40).optional(),
    descricao: z.string().max(4000),
    formato: z.string().max(80).optional(),
    tipo: z.enum(["documento", "pergunta"]).optional(),
    dataPedido: DataApi,
    dataEntrega: DataApi.optional(),
    departamento: z.string().max(120).optional(),
    responsavelId: z.uuid().optional(),
    observacaoSolicitante: z.string().max(4000).optional(),
    resposta: z.string().max(4000).optional(),
    ondeObter: z.string().max(1000).optional(),
    situacoes: z.record(z.string().max(30), z.enum(SITUACOES_DO_ITEM)).optional(),
  });
  api.openapi(
    createRoute({
      method: "post",
      path: "/v1/pedidos/{id}/itens",
      tags: ["Pedidos de documentos"],
      summary: "Inclui um item no pedido",
      security: seguranca,
      request: { params: Id, body: { content: { "application/json": { schema: ItemApi } } } },
      responses: respostas("Item incluído"),
    }),
    (c) => comAcesso(c, (a) => salvarItem(a, c.req.valid("param").id, null, c.req.valid("json"))) as never,
  );
  api.openapi(
    createRoute({
      method: "post",
      path: "/v1/pedidos/itens/{id}/situacao",
      tags: ["Pedidos de documentos"],
      summary: "Muda a situação de um período do item (periodo vazio quando o pedido não tem períodos)",
      security: seguranca,
      request: {
        params: Id,
        body: {
          content: {
            "application/json": {
              schema: z.object({ periodo: z.string().max(30), situacao: z.enum(SITUACOES_DO_ITEM) }),
            },
          },
        },
      },
      responses: respostas("Situação alterada"),
    }),
    (c) =>
      comAcesso(c, (a) => {
        const { periodo, situacao } = c.req.valid("json");
        return definirSituacaoDoItem(a, c.req.valid("param").id, periodo, situacao);
      }) as never,
  );
}
