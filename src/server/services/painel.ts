import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { comTenant } from "@/server/db/cliente";
import { deal, participacaoDeal, pessoa } from "@/server/db/esquema";
import { exigirTenant, type Acesso } from "./acesso";
import { hojeEmSaoPaulo, obterDiasDeAvisoDoPrazo, somarDias } from "./negocios-andamento";
import { nivelDoPrazo, type NivelDoPrazo } from "@/config/prazos";
import { quadroDeNegocios } from "./negocios-kanban";
import { nomeVisivel, visaoDoNegocio } from "./negocios";
import { minhasNotificacoes, type Notificacao } from "./notificacoes";
import { concede } from "./permissoes/catalogo";
import { pode } from "./permissoes/verificador";
import { tarefasDoNegocio } from "./tarefas";

/**
 * Tela principal (item 14; propostas de layout v3): frase de resumo, números
 * com o semáforo dos prazos (vencidos, vencem em até N dias, em dia),
 * progresso dos meus negócios e "Precisa de você" (prazos e mensagens) com a
 * faixa da semana. Tudo filtrado pelo que a pessoa vê (participação, sigilo
 * e permissões de cada negócio).
 */

export type Prazo = {
  data: string;
  tipo: "tarefa" | "etapa" | "exclusividade" | "participacao";
  texto: string;
  negocio: string;
  link: string;
  atrasado: boolean;
  nivel: NivelDoPrazo;
};

export type NegocioDoPainel = {
  id: string;
  nome: string;
  etapa: string | null;
  situacao: string;
  progresso: { feitas: number; total: number };
  fimDaEtapa: string | null;
  nivel: NivelDoPrazo | null;
  valorEstimado: number | null;
};

export type Painel = {
  hoje: string;
  diasDeAviso: number;
  numeros: {
    negocios: number;
    /** Soma dos valores estimados (null = nenhum negócio com valor). */
    carteira: number | null;
    minhasTarefas: number;
    atrasadas: number;
    prazosDaSemana: number;
    vencidos: number;
    proximos: number;
    emDia: number;
  };
  negocios: NegocioDoPainel[];
  alertas: Notificacao[];
  /** Todos os prazos abertos que a pessoa acompanha, do mais antigo ao mais distante. */
  prazos: Prazo[];
  /** Segunda a domingo da semana atual, com a situação de cada prazo do dia. */
  semana: { data: string; niveis: NivelDoPrazo[] }[];
  porEtapa: { nome: string; total: number }[];
  veNegocios: boolean;
  podeCriar: boolean;
};

export async function painelDoUsuario(acesso: Acesso | null): Promise<Painel> {
  const a = exigirTenant(acesso);
  const hoje = hojeEmSaoPaulo();
  const daquiA7 = somarDias(hoje, 7);
  const daquiA30 = somarDias(hoje, 30);
  const [veNegocios, podeCriar] = await Promise.all([pode(a, "deals", "ver"), pode(a, "deals", "criar")]);
  const [quadro, alertas, diasDeAviso] = await Promise.all([
    veNegocios ? quadroDeNegocios(a, { situacao: "abertos" }) : null,
    minhasNotificacoes(a, 10),
    obterDiasDeAvisoDoPrazo(a),
  ]);
  const nivel = (data: string) => nivelDoPrazo(data, hoje, diasDeAviso)!;
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
      if (t.prazo)
        prazos.push({
          data: t.prazo,
          tipo: "tarefa",
          texto: t.titulo,
          negocio: c.nome,
          link: `/negocios/${c.id}?aba=tarefas`,
          atrasado: atrasada,
          nivel: nivel(t.prazo),
        });
    }
    // Fim previsto da etapa em andamento dos negócios que a pessoa acompanha.
    if (c.situacao === "andamento" && c.fimDaEtapa && c.etapa)
      prazos.push({
        data: c.fimDaEtapa,
        tipo: "etapa",
        texto: c.etapa,
        negocio: c.nome,
        link: `/negocios/${c.id}?aba=etapas`,
        atrasado: c.fimDaEtapa < hoje,
        nivel: nivel(c.fimDaEtapa),
      });
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
        nivel: nivel(d.fim),
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
        nivel: nivel(p.prazo),
      });
    }
  }
  prazos.sort((x, y) => x.data.localeCompare(y.data));
  const porEtapa = [{ id: "a-iniciar", nome: "" }, ...(quadro?.colunas ?? [])].map((col) => ({
    nome: col.nome,
    total: cartoes.filter((c) => c.colunaId === col.id).length,
  }));
  // Semana atual, de segunda a domingo.
  const diaDaSemana = (new Date(`${hoje}T12:00:00Z`).getUTCDay() + 6) % 7;
  const segunda = somarDias(hoje, -diaDaSemana);
  const semana = Array.from({ length: 7 }, (_, i) => {
    const data = somarDias(segunda, i);
    return { data, niveis: prazos.filter((p) => p.data === data).map((p) => p.nivel) };
  });
  const valores = cartoes.map((c) => c.valorEstimado).filter((v): v is number => v !== null);
  const ordemDoNivel = { atrasado: 0, proximo: 1, emDia: 2 } as const;
  return {
    hoje,
    diasDeAviso,
    numeros: {
      negocios: cartoes.length,
      carteira: valores.length ? valores.reduce((x, y) => x + y, 0) : null,
      minhasTarefas,
      atrasadas,
      prazosDaSemana: prazos.filter((p) => p.data >= hoje && p.data <= daquiA7).length,
      vencidos: prazos.filter((p) => p.nivel === "atrasado").length,
      proximos: prazos.filter((p) => p.nivel === "proximo").length,
      emDia: prazos.filter((p) => p.nivel === "emDia").length,
    },
    // Os mais urgentes primeiro (vencidos, depois os que vencem logo), e então pelo número.
    negocios: [...cartoes]
      .sort(
        (x, y) =>
          (x.nivelDoPrazo ? ordemDoNivel[x.nivelDoPrazo] : 3) - (y.nivelDoPrazo ? ordemDoNivel[y.nivelDoPrazo] : 3) ||
          (x.prazo ?? "9999").localeCompare(y.prazo ?? "9999"),
      )
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        etapa: c.etapa,
        situacao: c.situacao,
        progresso: c.progresso,
        fimDaEtapa: c.fimDaEtapa,
        nivel: c.fimDaEtapa && c.situacao === "andamento" ? nivel(c.fimDaEtapa) : null,
        valorEstimado: c.valorEstimado,
      })),
    alertas: alertas.itens,
    prazos,
    semana,
    porEtapa,
    veNegocios,
    podeCriar,
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
