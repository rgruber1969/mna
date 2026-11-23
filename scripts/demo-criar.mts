// Tenant de DEMONSTRAÇÃO para conferir telas (só dados fictícios, @exemplo.test).
// Cria (ou recria) o tenant "demo" com 9 negócios em etapas diferentes, prazos
// vencidos, próximos e em dia, tarefas e compradoras no funil. Ambiente local.
// Uso: pnpm demo:criar   →   http://exemplo.localhost:3000 (entrada de desenvolvimento
// com demo@exemplo.test).
import pg from "pg";
import { completarCadastrosPadrao } from "@/server/services/cadastros-padrao";
import { criarNegocio, listarTiposDeOperacao } from "@/server/services/negocios";
import { criarTarefa } from "@/server/services/tarefas";
import type { AcessoTenant } from "@/server/services/acesso";

if (process.env.NODE_ENV === "production") {
  console.error("Só no ambiente local.");
  process.exit(1);
}
const SLUG = "exemplo";
const EMAIL = "demo@exemplo.test";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO });
const um = async <T extends pg.QueryResultRow>(sql: string, p: unknown[] = []) =>
  (await db.query<T>(sql, p)).rows[0];

const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const dia = (n: number) => {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

await db.query(`delete from tenant where slug = $1`, [SLUG]);
await db.query(`delete from usuario where email = $1`, [EMAIL]);
const t = await um<{ id: string }>(
  `insert into tenant (slug, nome) values ($1, 'Escritório Exemplo') returning id`,
  [SLUG],
);
const u = await um<{ id: string }>(
  `insert into usuario (nome, email, email_verificado) values ('Ana Ribeiro', $1, true) returning id`,
  [EMAIL],
);
await db.query(`insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $2, 'ativo')`, [
  t.id,
  u.id,
]);
await completarCadastrosPadrao(t.id);
await db.query(
  `insert into perfil_usuario (tenant_id, usuario_id, perfil_id)
   select $1, $2, id from perfil where tenant_id = $1 and padrao = 'gestor-contratante'`,
  [t.id, u.id],
);

const acesso = {
  area: "tenant",
  tenant: {
    id: t.id,
    slug: SLUG,
    nome: "Escritório Exemplo",
    exigeDoisFatoresDeTodos: false,
    modoPermissoes: "perfil",
    nomeExibido: "Escritório Exemplo",
    logo: null,
  },
  usuario: {
    id: u.id,
    nome: "Ana Ribeiro",
    email: EMAIL,
    temAutenticador: false,
    temPasskey: false,
    doisFatoresAtivo: false,
  },
  administrador: false,
  exigeDoisFatores: false,
  sessaoId: "00000000-0000-0000-0000-000000000000",
  segundoFatorNaSessao: false,
} as AcessoTenant;

const tipo = (await listarTiposDeOperacao(acesso)).find((x) => !x.comPercentual)!.id;
const papel = (padrao: string) =>
  um<{ id: string }>(`select id from papel_empresa where tenant_id = $1 and padrao = $2`, [t.id, padrao]);
const advisor = (await papel("advisor-vendedora"))!.id;
const compradoraPapel = (await papel("compradora"))!.id;

// [codinome, vendedora, ordem da etapa atual (0 = não iniciada), dias até o fim da etapa, valor em milhões, compradoras por situação]
const NEGOCIOS: [string, string, number, number | null, number, Record<string, number>][] = [
  [
    "Projeto Carvalho",
    "Agro Vale do Sul Ltda.",
    4,
    -2,
    48,
    { prospectada: 4, teaser: 3, nda: 3, proposta: 2 },
  ],
  ["Projeto Aurora", "Clínica Horizonte S.A.", 3, 19, 22.5, { prospectada: 3, teaser: 2, nda: 1 }],
  ["Projeto Tamar", "Laticínios Serra Azul Ltda.", 0, null, 18, {}],
  ["Projeto Cedro", "Metalúrgica Brasa S.A.", 5, 4, 120, { escolhida: 1 }],
  ["Projeto Ipê", "TecnoLog S.A.", 7, 25, 67.3, { escolhida: 1 }],
  ["Projeto Lince", "Transportes Ágata Ltda.", 8, null, 52, { escolhida: 1 }],
  ["Projeto Baobá", "Rede Farma Norte Ltda.", 1, null, 13, {}],
  ["Projeto Safira", "Grupo Martinelli S.A.", 4, 27, 36, { prospectada: 3, teaser: 3, nda: 2, proposta: 2 }],
  ["Projeto Jatobá", "Madeireira Pinhal Ltda.", 3, 4, 15.8, { prospectada: 2, teaser: 2, nda: 1 }],
];

let n = 0;
for (const [codinome, vendedoraNome, etapaAtual, diasFim, valor, funil] of NEGOCIOS) {
  const vend = await um<{ id: string }>(
    `insert into empresa (tenant_id, razao_social) values ($1, $2) returning id`,
    [t.id, vendedoraNome],
  );
  const r = await criarNegocio(acesso, {
    codinome,
    nomeInterno: `Venda ${vendedoraNome.split(" ")[0]} 2026`,
    tipoOperacaoId: tipo,
    percentual: "",
    papelContratanteId: advisor,
    objeto: "empresas",
    vendedoras: [vend!.id],
    grupoId: "",
    dataInicio: dia(-90 + n * 3),
  });
  if (!("id" in r)) throw new Error(`${codinome}: ${r.erro}`);
  n++;
  const previsao = dia(diasFim === null ? 200 : 60 + n * 15);
  await db.query(`update deal set valor_estimado = $2, previsao_fechamento = $3 where id = $1`, [
    r.id,
    valor * 1_000_000,
    previsao,
  ]);
  // Etapas principais: as anteriores concluídas (uma com atraso), a atual em andamento.
  const etapas = (
    await db.query<{ id: string; ordem: number }>(
      `select e.id, row_number() over (order by e.ordem)::int as ordem from deal_etapa e where e.deal_id = $1 and e.pai_id is null order by e.ordem`,
      [r.id],
    )
  ).rows;
  let atual: string | null = null;
  for (const e of etapas) {
    const passo = e.ordem;
    if (etapaAtual && passo < etapaAtual) {
      const fimPrev = dia(-80 + passo * 10);
      const fimReal = passo === 2 && codinome === "Projeto Carvalho" ? dia(-80 + passo * 10 + 7) : fimPrev;
      await db.query(
        `update deal_etapa set situacao = 'concluida', inicio_real = $2, fim_previsto = $3, fim_real = $4 where id = $1`,
        [e.id, dia(-90 + passo * 10), fimPrev, fimReal],
      );
    } else if (passo === etapaAtual) {
      atual = e.id;
      await db.query(
        `update deal_etapa set situacao = 'andamento', inicio_real = $2, fim_previsto = $3 where id = $1`,
        [e.id, dia(-30), diasFim === null ? null : dia(diasFim)],
      );
    } else {
      await db.query(`update deal_etapa set fim_previsto = $2 where id = $1`, [e.id, dia(30 + passo * 25)]);
    }
  }
  // Compradoras no funil.
  let c = 0;
  for (const [situacao, qtd] of Object.entries(funil)) {
    for (let i = 0; i < qtd; i++) {
      c++;
      const emp = await um<{ id: string }>(
        `insert into empresa (tenant_id, razao_social) values ($1, $2) returning id`,
        [t.id, `Compradora ${String.fromCharCode(64 + c)} de ${codinome.replace("Projeto ", "")} S.A.`],
      );
      await db.query(
        `insert into deal_empresa (tenant_id, deal_id, empresa_id, papel_id, situacao_funil) values ($1, $2, $3, $4, $5)`,
        [t.id, r.id, emp!.id, compradoraPapel, situacao],
      );
    }
  }
  // Tarefas da coordenadora.
  const tarefas: [string, number][] =
    codinome === "Projeto Carvalho"
      ? [
          ["Responder Q&A financeiro da Compradora B", -2],
          ["Atualizar laudo ambiental", 10],
          ["Conferir certidões negativas", 14],
        ]
      : codinome === "Projeto Cedro"
        ? [
            ["Revisar minuta do SPA", 3],
            ["Enviar disclosure schedules", 12],
          ]
        : codinome === "Projeto Aurora"
          ? [["Preparar teaser revisado", 9]]
          : [];
  for (const [titulo, d] of tarefas) {
    const tr = await criarTarefa(acesso, r.id, {
      titulo,
      descricao: "",
      etapaId: atual ?? "",
      prazo: dia(d),
      usuarios: [u.id],
    });
    if (!("id" in tr)) throw new Error(`${titulo}: ${tr.erro}`);
  }
}
// Exclusividade do Cedro vence em 2 dias.
await db.query(
  `update deal set exclusividade_inicio = $2, exclusividade_fim = $3 where tenant_id = $1 and codinome = 'Projeto Cedro'`,
  [t.id, dia(-58), dia(2)],
);
await db.end();
console.log(`Tenant de demonstração pronto: http://${SLUG}.localhost:3000 (entrar com ${EMAIL}).`);
process.exit(0);
