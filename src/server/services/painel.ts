import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { comTenant } from "@/server/db/cliente";
import { deal, participacaoDeal, pessoa } from "@/server/db/esquema";
import { exigirTenant, type Acesso } from "./acesso";
import { hojeEmSaoPaulo, somarDias } from "./negocios-andamento";
import { quadroDeNegocios } from "./negocios-kanban";
import { nomeVisivel, visaoDoNegocio } from "./negocios";
import { minhasNotificacoes, type Notificacao } from "./notificacoes";
import { concede } from "./permissoes/catalogo";
import { pode } from "./permissoes/verificador";
import { tarefasDoNegocio } from "./tarefas";

/**
 * Tela principal (item 14; resposta P1): números do topo, meus negócios,
 * últimos alertas, prazos e negócios por etapa. Tudo filtrado pelo que a
 * pessoa vê (participação, sigilo e permissões de cada negócio).
 */

export type Prazo = {
  data: string;
  tipo: "tarefa" | "exclusividade" | "participacao";
  texto: string;
  negocio: string;
  link: string;
  atrasado: boolean;
};

export type Painel = {
  numeros: { negocios: number; minhasTarefas: number; atrasadas: number; prazosDaSemana: number };
  negocios: { id: string; nome: string; etapa: string | null; situacao: string }[];
  alertas: Notificacao[];
  prazos: Prazo[];
  porEtapa: { nome: string; total: number }[];
  veNegocios: boolean;
};

export async function painelDoUsuario(acesso: Acesso | null): Promise<Painel> {
  const a = exigirTenant(acesso);
  const hoje = hojeEmSaoPaulo();
  const daquiA7 = somarDias(hoje, 7);
  const daquiA30 = somarDias(hoje, 30);
  const veNegocios = await pode(a, "deals", "ver");
  const [quadro, alertas] = await Promise.all([
    veNegocios ? quadroDeNegocios(a, { situacao: "abertos" }) : null,
    minhasNotificacoes(a, 10),
  ]);
  const cartoes = quadro?.cartoes ?? [];
  const prazos: Prazo[] = [];
  let minhasTarefas = 0;
  let atrasadas = 0;
  for (const c of cartoes) {
    const tarefas = await tarefasDoNegocio(a, c.id);
    for (const t of tarefas?.tarefas ?? []) {
      if (!t.souResponsavel || ["concluida", "cancelada"].includes(t.situacao)) continue;
      minhasTarefas++;
      const atrasada = Boolean(t.prazo && t.prazo < hoje);
      if (atrasada) atrasadas++;
      if (t.prazo && t.prazo <= daquiA30)
        prazos.push({
          data: t.prazo,
          tipo: "tarefa",
          texto: t.titulo,
          negocio: c.nome,
          link: `/negocios/${c.id}?aba=tarefas`,
          atrasado: atrasada,
        });
    }
  }
  const ids = cartoes.map((c) => c.id);
  if (ids.length) {
    // Fim da exclusividade: só para o lado vendedor (e administradores).
    const comExclusividade = await comTenant(a.tenant.id, (tx) =>
      tx
        .select({ id: deal.id, numero: deal.numero, codinome: deal.codinome, fim: deal.exclusividadeFim })
        .from(deal)
        .where(and(inArray(deal.id, ids), isNotNull(deal.exclusividadeFim))),
    );
    for (const d of comExclusividade) {
      if (!d.fim || d.fim < hoje || d.fim > daquiA30) continue;
      const { visao } = await visaoDoNegocio(a, d.id);
      if (!visao.administrador && !visao.lados.has("vendedor")) continue;
      prazos.push({
        data: d.fim,
        tipo: "exclusividade",
        texto: "",
        negocio: nomeVisivel(d.numero, d.codinome),
        link: `/negocios/${d.id}?aba=exclusividade`,
        atrasado: false,
      });
    }
    // Prazos de participação: os próprios e, para quem gere os participantes, os de todos.
    const participacoes = await comTenant(a.tenant.id, (tx) =>
      tx
        .select({
          dealId: participacaoDeal.dealId,
          prazo: participacaoDeal.prazo,
          nome: pessoa.nome,
          usuarioId: pessoa.usuarioId,
        })
        .from(participacaoDeal)
        .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
        .where(
          and(
            inArray(participacaoDeal.dealId, ids),
            isNotNull(participacaoDeal.prazo),
            sql`${participacaoDeal.cortadaEm} is null`,
          ),
        ),
    );
    for (const p of participacoes) {
      if (!p.prazo || p.prazo < hoje || p.prazo > daquiA30) continue;
      const c = cartoes.find((x) => x.id === p.dealId)!;
      const proprio = p.usuarioId === a.usuario.id;
      if (!proprio) {
        const { visao } = await visaoDoNegocio(a, p.dealId);
        if (!visao.administrador && !concede(visao.matriz, "deal", "editar")) continue;
      }
      prazos.push({
        data: p.prazo,
        tipo: "participacao",
        texto: p.nome,
        negocio: c.nome,
        link: `/negocios/${p.dealId}?aba=participantes`,
        atrasado: false,
      });
    }
  }
  prazos.sort((x, y) => x.data.localeCompare(y.data));
  const porEtapa = [{ id: "a-iniciar", nome: "" }, ...(quadro?.colunas ?? [])].map((col) => ({
    nome: col.nome,
    total: cartoes.filter((c) => c.colunaId === col.id).length,
  }));
  return {
    numeros: {
      negocios: cartoes.length,
      minhasTarefas,
      atrasadas,
      prazosDaSemana: prazos.filter((p) => p.data >= hoje && p.data <= daquiA7).length,
    },
    negocios: cartoes
      .slice(0, 8)
      .map((c) => ({ id: c.id, nome: c.nome, etapa: c.etapa, situacao: c.situacao })),
    alertas: alertas.itens,
    prazos: prazos.slice(0, 12),
    porEtapa,
    veNegocios,
  };
}

export type MinhaTarefa = {
  titulo: string;
  negocio: string;
  prazo: string | null;
  situacao: string;
  atrasada: boolean;
  link: string;
};

/** Tarefas abertas em que a pessoa é responsável, em todos os negócios em aberto que ela vê. */
export async function minhasTarefasAbertas(acesso: Acesso | null): Promise<MinhaTarefa[]> {
  const a = exigirTenant(acesso);
  const hoje = hojeEmSaoPaulo();
  if (!(await pode(a, "deals", "ver"))) return [];
  const quadro = await quadroDeNegocios(a, { situacao: "abertos" });
  const lista: MinhaTarefa[] = [];
  for (const c of quadro?.cartoes ?? []) {
    const tarefas = await tarefasDoNegocio(a, c.id);
    for (const t of tarefas?.tarefas ?? []) {
      if (!t.souResponsavel || ["concluida", "cancelada"].includes(t.situacao)) continue;
      lista.push({
        titulo: t.titulo,
        negocio: c.nome,
        prazo: t.prazo,
        situacao: t.situacao,
        atrasada: Boolean(t.prazo && t.prazo < hoje),
        link: `/negocios/${c.id}?aba=tarefas`,
      });
    }
  }
  return lista.sort((x, y) => (x.prazo ?? "9999").localeCompare(y.prazo ?? "9999"));
}
