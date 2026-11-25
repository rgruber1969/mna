import { estaLigada } from "@/config/funcionalidades";
import { tradutor, type ErroDeServico } from "@/i18n/servidor";
import { exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import { buscarDocumentos } from "./busca-de-documentos";
import { auditar } from "./empresas";
import { quadroDeNegocios, type CartaoDoQuadro } from "./negocios-kanban";
import { ofertasDoNegocio } from "./ofertas";
import { minhasTarefasAbertas } from "./painel";
import { pedidosDoNegocio } from "./pedidos";
import { totalNominal } from "@/config/ofertas";

/**
 * "Pergunte ao sistema" (tela principal), **simulado**: sem IA. Reconhece por
 * palavras-chave alguns tipos de pergunta e responde com os dados reais da
 * pessoa, pelos mesmos serviços e permissões das telas (nada sai do
 * servidor). Pergunta que não reconhece recebe a lista do que sabe
 * responder. A versão com IA (pelo MCP) usará as mesmas respostas como
 * ferramentas (backlog).
 */

export type ItemDaResposta = { rotulo: string; detalhe?: string; href?: string };
export type RespostaDoAssistente = {
  /** Tipo reconhecido ("ajuda" quando não reconheceu). */
  tipo: TipoDePergunta;
  texto: string;
  itens: ItemDaResposta[];
};
export type TipoDePergunta =
  | "atrasados"
  | "tarefas"
  | "documentos"
  | "pedidos"
  | "ofertas"
  | "closing"
  | "negocio"
  | "carteira"
  | "ajuda";

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** Codinome do negócio a partir do nome visível ("N-0009 Projeto Jatobá" → "projeto jatoba"). */
const codinome = (nome: string) => sem(nome.replace(/^N-\d+\s+/, ""));

/** Negócio citado na pergunta: pelo codinome (ou parte final dele, ex.: "Jatobá") ou pelo número ("N-0009"). */
function negocioCitado(pergunta: string, cartoes: CartaoDoQuadro[]): CartaoDoQuadro | null {
  const p = sem(pergunta);
  const porNumero = p.match(/n-?0*(\d{1,6})\b/);
  if (porNumero) {
    const n = Number(porNumero[1]);
    const achado = cartoes.find((c) => c.numero === n);
    if (achado) return achado;
  }
  // O mais longo primeiro ("projeto jatoba" antes de "jatoba").
  const candidatos = cartoes
    .flatMap((c) => {
      const nome = codinome(c.nome);
      const partes = nome.split(/\s+/).filter((x) => x.length >= 4 && x !== "projeto");
      return [nome, ...partes].map((chave) => ({ chave, c }));
    })
    .sort((x, y) => y.chave.length - x.chave.length);
  return (
    candidatos.find(({ chave }) =>
      new RegExp(`\\b${chave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(p),
    )?.c ?? null
  );
}

/** Tipo da pergunta pelas palavras-chave (a ordem importa: o mais específico primeiro). */
export function tipoDaPergunta(pergunta: string): TipoDePergunta {
  const p = sem(pergunta);
  if (
    /\b(documento|documentos|arquivo|arquivos|contrato social|cita|mencion|fala de|sobre)\b/.test(p) &&
    /\b(sobre|com|que cit|mencion|fal)/.test(p)
  )
    return "documentos";
  if (/\bpedido|diligencia|pendente de entrega|lista de documentos/.test(p)) return "pedidos";
  if (/\boferta|proposta|lance|preco oferecido/.test(p)) return "ofertas";
  if (/\bclosing|fechamento|fechar|assinatura do (qpa|spa)/.test(p)) return "closing";
  if (/\btarefa|afazer|a fazer|pendencia|minha semana|o que tenho/.test(p)) return "tarefas";
  if (/\batrasad|vencid|prazo|risco|parad/.test(p)) return "atrasados";
  if (/\bcarteira|valor total|quanto vale|soma|total dos negocios/.test(p)) return "carteira";
  if (/\bresumo|situacao|como esta|andamento|etapa/.test(p)) return "negocio";
  return "ajuda";
}

/** Termo procurado nos documentos ("documentos sobre multa" → "multa"). */
export function termoDaBusca(pergunta: string): string {
  // Na pergunta original (com acentos), para mostrar o termo como foi digitado; a busca ignora acentos.
  const m = pergunta
    .trim()
    .match(
      /(?:sobre|com|cit\w*|mencion\w*|fal\w* de|fal\w* sobre)\s+(?:a |o |as |os )?["“]?([\p{L}\p{N}][\p{L}\p{N} -]{1,60}?)["”]?(?:\s+(?:no|na|do|da|em)\s+.*)?[?.!]*$/iu,
    );
  return (m?.[1] ?? "").trim();
}

export async function responderPergunta(
  acesso: Acesso | null,
  pergunta: string,
): Promise<RespostaDoAssistente | ErroDeServico> {
  const a = exigirTenant(acesso);
  if (!estaLigada("assistente")) return { erro: "assistente.erros.desligado" };
  const texto = pergunta.trim().slice(0, 300);
  if (texto.length < 3) return { erro: "assistente.erros.curta" };
  const tr = await tradutor();
  const t = (k: string, p?: Record<string, string | number>) => tr(`assistente.respostas.${k}`, p);
  const tipo = tipoDaPergunta(texto);
  const resposta = await responder(a, tipo, texto, t);
  // Auditoria sem o texto da pergunta (pode conter dados pessoais): só o tipo reconhecido.
  await auditar(a, "assistente.pergunta", "tenant", a.tenant.id, { tipo: resposta.tipo, simulada: true });
  return resposta;
}

async function responder(
  a: AcessoTenant,
  tipo: TipoDePergunta,
  pergunta: string,
  t: (k: string, p?: Record<string, string | number>) => string,
): Promise<RespostaDoAssistente> {
  const quadro = await quadroDeNegocios(a, { situacao: "abertos" }).catch(() => null);
  const cartoes = quadro?.cartoes ?? [];
  const citado = negocioCitado(pergunta, cartoes);
  const link = (c: CartaoDoQuadro, aba?: string) => `/negocios/${c.id}${aba ? `?aba=${aba}` : ""}`;

  if (tipo === "atrasados") {
    const lista = cartoes.filter((c) => c.nivelDoPrazo === "atrasado" || c.nivelDoPrazo === "proximo");
    if (lista.length === 0) return { tipo, texto: t("semAtrasados"), itens: [] };
    const atrasados = lista.filter((c) => c.nivelDoPrazo === "atrasado").length;
    return {
      tipo,
      texto: t("atrasados", { atrasados, proximos: lista.length - atrasados }),
      itens: lista.map((c) => ({
        rotulo: c.nome,
        detalhe: `${c.etapa ?? t("semEtapa")} · ${t(c.nivelDoPrazo === "atrasado" ? "venceu" : "vence", { data: br(c.prazo) })}`,
        href: link(c, "etapas"),
      })),
    };
  }

  if (tipo === "tarefas") {
    const tarefas = await minhasTarefasAbertas(a).catch(() => []);
    if (tarefas.length === 0) return { tipo, texto: t("semTarefas"), itens: [] };
    const atrasadas = tarefas.filter((x) => x.atrasada).length;
    return {
      tipo,
      texto: t("tarefas", { n: tarefas.length, atrasadas }),
      itens: tarefas.slice(0, 10).map((x) => ({
        rotulo: x.titulo,
        detalhe: `${x.negocio} · ${x.prazo ? t(x.atrasada ? "venceu" : "vence", { data: br(x.prazo) }) : t("semPrazo")}`,
        href: x.link,
      })),
    };
  }

  if (tipo === "documentos") {
    const termo = termoDaBusca(pergunta);
    if (termo.length < 2) return { tipo, texto: t("documentosSemTermo"), itens: [] };
    const r = await buscarDocumentos(a, { termo, dealId: citado?.id ?? null });
    const resultados = "erro" in r ? [] : r.resultados;
    if (resultados.length === 0) return { tipo, texto: t("semDocumentos", { termo }), itens: [] };
    return {
      tipo,
      texto: t("documentos", {
        n: resultados.length,
        termo,
        onde: citado ? citado.nome : t("todosOsNegocios"),
      }),
      itens: resultados.slice(0, 8).map((d) => ({
        rotulo: d.titulo,
        detalhe: d.trecho ? `${d.negocio} · ${d.trecho.replace(/[«»]/g, "")}` : d.negocio,
        href: `/negocios/${d.dealId}?aba=documentos`,
      })),
    };
  }

  if (tipo === "pedidos") {
    const alvo = citado ? [citado] : cartoes.slice(0, 15);
    const itens: ItemDaResposta[] = [];
    let abertos = 0;
    for (const c of alvo) {
      const p = await pedidosDoNegocio(a, c.id).catch(() => null);
      for (const x of p?.pedidos ?? [])
        if (x.abertos > 0) {
          abertos += x.abertos;
          itens.push({
            rotulo: `${c.nome} · ${x.titulo}`,
            detalhe: t("pedidoAbertos", { abertos: x.abertos, itens: x.itens }),
            href: `/negocios/${c.id}?aba=pedidos&pedido=${x.id}`,
          });
        }
    }
    if (itens.length === 0) return { tipo, texto: t("semPedidos"), itens: [] };
    return { tipo, texto: t("pedidos", { abertos, pedidos: itens.length }), itens };
  }

  if (tipo === "ofertas") {
    if (!citado) return { tipo, texto: t("qualNegocio"), itens: sugestoesDeNegocios(cartoes, t) };
    const o = await ofertasDoNegocio(a, citado.id).catch(() => null);
    const lista = o?.ofertas ?? [];
    if (lista.length === 0) return { tipo, texto: t("semOfertas", { negocio: citado.nome }), itens: [] };
    const maior = Math.max(...lista.map((x) => totalNominal(x)));
    return {
      tipo,
      texto: t("ofertas", { n: lista.length, negocio: citado.nome, maior: reais(maior) }),
      itens: lista.map((x) => ({
        rotulo: `${x.compradora} · ${t("rodada", { n: x.rodada })}${x.aceita ? ` · ${t("escolhida")}` : ""}`,
        detalhe: `${br(x.data)} · ${reais(totalNominal(x))}`,
        href: link(citado, "compradoras"),
      })),
    };
  }

  if (tipo === "closing" || tipo === "negocio") {
    if (!citado) return { tipo, texto: t("qualNegocio"), itens: sugestoesDeNegocios(cartoes, t) };
    const c = citado;
    const partes = [
      t("situacaoDoNegocio", { negocio: c.nome, etapa: c.etapa ?? t("semEtapa") }),
      c.previsaoFechamento ? t("previsao", { data: br(c.previsaoFechamento) }) : t("semPrevisao"),
      c.fimDaEtapa ? t("fimDaEtapa", { data: br(c.fimDaEtapa) }) : "",
      c.valorEstimado ? t("valor", { valor: reais(c.valorEstimado) }) : "",
      c.progresso.total ? t("progresso", { feitas: c.progresso.feitas, total: c.progresso.total }) : "",
    ].filter(Boolean);
    return {
      tipo,
      texto: partes.join(" "),
      itens: [{ rotulo: t("abrirNegocio", { negocio: c.nome }), href: link(c) }],
    };
  }

  if (tipo === "carteira") {
    const comValor = cartoes.filter((c) => c.valorEstimado);
    const total = comValor.reduce((s, c) => s + (c.valorEstimado ?? 0), 0);
    return {
      tipo,
      texto: t("carteira", { n: cartoes.length, total: reais(total), comValor: comValor.length }),
      itens: comValor
        .sort((x, y) => (y.valorEstimado ?? 0) - (x.valorEstimado ?? 0))
        .slice(0, 8)
        .map((c) => ({ rotulo: c.nome, detalhe: reais(c.valorEstimado ?? 0), href: link(c) })),
    };
  }

  return { tipo: "ajuda", texto: t("ajuda"), itens: [] };
}

function sugestoesDeNegocios(
  cartoes: CartaoDoQuadro[],
  t: (k: string, p?: Record<string, string | number>) => string,
) {
  return cartoes.slice(0, 6).map((c) => ({ rotulo: c.nome, detalhe: t("citeONegocio") }));
}
