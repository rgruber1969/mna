// Gera os exemplos de resposta da página de referência da API (/api/referencia)
// a partir do tenant de DEMONSTRAÇÃO "exemplo" (só dados fictícios, @exemplo.test).
// Cria uma chave temporária (administradora, para ver tudo), chama cada rota GET
// pela própria API, resume as respostas (2 itens por lista, textos curtos) e grava
// em src/server/api/exemplos-da-api.json. No fim, revoga a chave.
// Uso: pnpm api:exemplos   (com o banco local no ar e o tenant de demonstração criado)
import fs from "node:fs";
import pg from "pg";
import type { AcessoTenant } from "@/server/services/acesso";
import { criarChave, listarChaves, revogarChave } from "@/server/services/chaves-api";
import { api } from "@/server/api/app";
import { obterNegocio, paginaDeNegocios, ORDENS_DE_NEGOCIOS } from "@/server/services/negocios";
import { dataRoomDoNegocio } from "@/server/services/documentos";
import { tarefasDoNegocio } from "@/server/services/tarefas";
import { conversasDoNegocio } from "@/server/services/mensagens";
import { ofertasDoNegocio } from "@/server/services/ofertas";
import { obterPedido, pedidosDoNegocio } from "@/server/services/pedidos";
import { ebookDoNegocio } from "@/server/services/ebook";

const SLUG = "exemplo";
const HOST = `${SLUG}.${process.env.APP_DOMINIO ?? "localhost:3000"}`;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO });

const [t] = (
  await db.query<{ id: string; nome: string }>(`select id, nome from tenant where slug = $1`, [SLUG])
).rows;
if (!t) throw new Error(`Tenant "${SLUG}" não existe: rode pnpm demo:criar.`);
const [perfil] = (
  await db.query<{ id: string }>(
    `select id from perfil where tenant_id = $1 and padrao = 'gestor-contratante'`,
    [t.id],
  )
).rows;
const [demo] = (await db.query<{ id: string }>(`select id from usuario where email = 'demo@exemplo.test'`))
  .rows;
if (!demo) throw new Error("Usuário demo@exemplo.test não existe: rode pnpm demo:criar.");
const admin = {
  area: "tenant",
  tenant: { id: t.id, slug: SLUG, nome: t.nome, nomeExibido: t.nome, modoPermissoes: "perfil" },
  usuario: { id: demo.id, nome: "Demonstração", email: "" },
  administrador: true,
} as unknown as AcessoTenant;

const r = await criarChave(admin, {
  nome: `Exemplos da documentação ${Date.now()}`,
  perfilId: perfil.id,
  expiraEm: "",
});
if (!("segredo" in r)) throw new Error(r.erro);
const segredo = r.segredo;
const chave = (await listarChaves(admin)).find((c) => segredo.startsWith(c.prefixo))!;
// Usuário de serviço como administrador do tenant de demonstração: os exemplos mostram tudo.
await db.query(
  `update vinculo_tenant set administrador = true where tenant_id = $1 and usuario_id = (select usuario_id from chave_api where id = $2)`,
  [t.id, chave.id],
);

async function get(caminho: string): Promise<unknown> {
  const res = await api.request(`/api${caminho}`, {
    headers: { host: HOST, authorization: `Bearer ${segredo}` },
  });
  return res.status === 200 ? res.json() : null;
}

/** Resume: listas com até 2 itens, textos longos cortados. */
function resumir(v: unknown, nivel = 0): unknown {
  if (Array.isArray(v)) return v.slice(0, 2).map((x) => resumir(x, nivel + 1));
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resumir(x, nivel + 1)]));
  if (typeof v === "string" && v.length > 160) return `${v.slice(0, 157)}...`;
  return v;
}

const exemplos: Record<string, unknown> = {};
const guardar = (chaveRota: string, valor: unknown) => {
  if (valor) exemplos[chaveRota] = resumir(valor);
};
const primeiro = (v: unknown, campo = "itens") =>
  ((v as Record<string, { id: string }[]> | null)?.[campo] ?? [])[0]?.id as string | undefined;

try {
  const negocios = await paginaDeNegocios(
    admin,
    { busca: undefined, situacao: undefined },
    { pagina: 1, porPagina: 2, ordem: ORDENS_DE_NEGOCIOS[0], direcao: "asc" },
  );
  guardar("get /v1/negocios", negocios);
  // Negócio com mais conteúdo (pedidos e ofertas) para os exemplos: o Jatobá (N-0009), se houver.
  const todos = await paginaDeNegocios(
    admin,
    { busca: undefined, situacao: undefined },
    { pagina: 1, porPagina: 100, ordem: ORDENS_DE_NEGOCIOS[0], direcao: "asc" },
  );
  const lista = (todos as unknown as { itens: { id: string; numero?: number }[] }).itens;
  const negocioId = (lista.find((n) => n.numero === 9) ?? lista[0])?.id;
  if (negocioId) {
    guardar("get /v1/negocios/{id}", await obterNegocio(admin, negocioId));
    const dr = await dataRoomDoNegocio(admin, negocioId);
    guardar(
      "get /v1/negocios/{id}/documentos",
      dr && { documentos: dr.documentos, categorias: dr.categorias, etapas: dr.etapas },
    );
    const tq = await tarefasDoNegocio(admin, negocioId);
    guardar("get /v1/negocios/{id}/tarefas", tq && { tarefas: tq.tarefas });
    guardar("get /v1/negocios/{id}/conversas", await conversasDoNegocio(admin, negocioId));
    guardar("get /v1/negocios/{id}/ofertas", await ofertasDoNegocio(admin, negocioId));
    const pedidos = await pedidosDoNegocio(admin, negocioId);
    guardar("get /v1/negocios/{id}/pedidos", pedidos);
    const pedidoId = (pedidos as { pedidos?: { id: string }[] } | null)?.pedidos?.[0]?.id;
    if (pedidoId) guardar("get /v1/pedidos/{id}", await obterPedido(admin, pedidoId));
    guardar("get /v1/negocios/{id}/ebook", await ebookDoNegocio(admin, negocioId));
  }
  const empresas = await get("/v1/empresas?porPagina=2");
  guardar("get /v1/empresas", empresas);
  const empresaId = primeiro(empresas);
  if (empresaId) guardar("get /v1/empresas/{id}", await get(`/v1/empresas/${empresaId}`));
  const pessoas = await get("/v1/pessoas?porPagina=2");
  guardar("get /v1/pessoas", pessoas);
  const pessoaId = primeiro(pessoas);
  if (pessoaId) guardar("get /v1/pessoas/{id}", await get(`/v1/pessoas/${pessoaId}`));
  const contratos = await get("/v1/contratos");
  guardar("get /v1/contratos", contratos);
  guardar("get /v1/busca/documentos", await get("/v1/busca/documentos?q=receita"));
  guardar("get /v1/resumos/mensagens", await get("/v1/resumos/mensagens"));
  guardar("get /v1/auditoria", await get("/v1/auditoria?porPagina=2"));
  guardar("get /v1/templates", await get("/v1/templates"));
} finally {
  await revogarChave(admin, chave.id);
  await db.end();
}

fs.writeFileSync("src/server/api/exemplos-da-api.json", JSON.stringify(exemplos, null, 2) + "\n");
console.log(`Exemplos gravados: ${Object.keys(exemplos).length} rotas.`);
for (const k of Object.keys(exemplos)) console.log(" -", k);
process.exit(0);
