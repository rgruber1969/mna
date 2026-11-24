/**
 * Paginação das listas (decisão menor "Listas"): numerada, feita no
 * servidor, com página, tamanho e ordem no endereço da página. Usada por
 * todas as listas (serviços e telas).
 */

export const TAMANHOS_DE_PAGINA = [10, 25, 50, 100] as const;
export const TAMANHO_PADRAO = 25;

export type Direcao = "asc" | "desc";

export type PedidoDePagina<O extends string = string> = {
  pagina: number;
  porPagina: number;
  ordem: O;
  direcao: Direcao;
};

export type Pagina<T> = { itens: T[]; total: number; pagina: number; porPagina: number };

type Parametros = Record<string, string | string[] | undefined>;

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Lê página, tamanho e ordem do endereço, sempre com valores válidos. */
export function lerPedido<O extends string>(
  parametros: Parametros,
  ordens: readonly O[],
  ordemPadrao: O,
  direcaoPadrao: Direcao = "asc",
  /** Tamanho padrão da página desta lista (telas pesadas usam 10). */
  porPaginaPadrao: number = TAMANHO_PADRAO,
): PedidoDePagina<O> {
  const pagina = Math.max(1, Math.floor(Number(um(parametros.pagina)) || 1));
  const tamanho = Number(um(parametros.porPagina));
  const porPagina = (TAMANHOS_DE_PAGINA as readonly number[]).includes(tamanho) ? tamanho : porPaginaPadrao;
  const pedida = um(parametros.ordem) as O | undefined;
  const ordem = pedida && ordens.includes(pedida) ? pedida : ordemPadrao;
  const dir = um(parametros.direcao);
  const direcao: Direcao = dir === "asc" || dir === "desc" ? dir : direcaoPadrao;
  return { pagina, porPagina, ordem, direcao };
}

/** Deslocamento no banco para o pedido (a página pedida além do fim volta para a última). */
export function limites(
  pedido: PedidoDePagina,
  total: number,
): { limite: number; deslocamento: number; pagina: number } {
  const ultima = Math.max(1, Math.ceil(total / pedido.porPagina));
  const pagina = Math.min(pedido.pagina, ultima);
  return { limite: pedido.porPagina, deslocamento: (pagina - 1) * pedido.porPagina, pagina };
}

/** Pagina uma lista já montada em memória (listas pequenas por natureza, ex.: usuários). */
export function paginarEmMemoria<T>(itens: T[], pedido: PedidoDePagina): Pagina<T> {
  const { limite, deslocamento, pagina } = limites(pedido, itens.length);
  return {
    itens: itens.slice(deslocamento, deslocamento + limite),
    total: itens.length,
    pagina,
    porPagina: limite,
  };
}

/** Endereço da lista com os parâmetros atuais e as mudanças pedidas (vazios saem). */
export function enderecoDaLista(
  caminho: string,
  atuais: Parametros,
  mudancas: Record<string, string | number | null>,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(atuais)) {
    const valor = um(v);
    if (valor) p.set(k, valor);
  }
  for (const [k, v] of Object.entries(mudancas)) {
    if (v === null || v === "") p.delete(k);
    else p.set(k, String(v));
  }
  const q = p.toString();
  return q ? `${caminho}?${q}` : caminho;
}
