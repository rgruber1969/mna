/**
 * Regras puras dos pedidos de documentos (dominio.md, "Pedido de documentos:
 * estrutura observada em listas reais"): situações, situação geral do item a
 * partir das situações por período, dias em aberto e leitura das colunas de
 * uma planilha de pedido (cada solicitante usa o próprio formato).
 */

export const SITUACOES_DO_ITEM = [
  "pendente",
  "parcial",
  "em_analise",
  "entregue",
  "aprovado",
  "nao_aplicavel",
] as const;
export type SituacaoDoItem = (typeof SITUACOES_DO_ITEM)[number];

/** Assuntos comuns (as abas das listas); o pedido aceita outros. */
export const ASSUNTOS_PADRAO = [
  "Geral/Societário",
  "Contábil",
  "Fiscal",
  "Trabalhista/Folha",
  "Certidões",
  "Contratos",
  "Propriedade intelectual",
  "Contencioso",
  "Imobiliário",
  "Ambiental",
  "Seguros",
  "Regulatório",
  "Concorrencial",
  "Questionário",
] as const;

export const PRIORIDADES_PADRAO = ["Imediata", "Alta", "Média", "Baixa"];

/** Chave de período quando o pedido não tem períodos de revisão. */
export const SEM_PERIODO = "";

/** Situações de cada período do pedido (o que faltar conta como pendente). */
export function situacoesPorPeriodo(
  situacoes: Record<string, SituacaoDoItem>,
  periodos: string[],
): [string, SituacaoDoItem][] {
  const chaves = periodos.length ? periodos : [SEM_PERIODO];
  return chaves.map((p) => [p, situacoes[p] ?? "pendente"]);
}

/**
 * Situação geral do item: não aplicável se todos os períodos forem; aprovado
 * se todos os aplicáveis estiverem aprovados; entregue se todos estiverem
 * entregues ou aprovados; em análise se nenhum estiver pendente e algum
 * estiver em análise; parcial se algo já andou; senão, pendente.
 */
export function situacaoGeral(situacoes: Record<string, SituacaoDoItem>, periodos: string[]): SituacaoDoItem {
  const aplicaveis = situacoesPorPeriodo(situacoes, periodos)
    .map(([, s]) => s)
    .filter((s) => s !== "nao_aplicavel");
  if (aplicaveis.length === 0) return "nao_aplicavel";
  if (aplicaveis.every((s) => s === "aprovado")) return "aprovado";
  if (aplicaveis.every((s) => s === "entregue" || s === "aprovado")) return "entregue";
  if (aplicaveis.every((s) => s === "em_analise" || s === "entregue" || s === "aprovado"))
    return "em_analise";
  if (aplicaveis.some((s) => s !== "pendente")) return "parcial";
  return "pendente";
}

/** Item ainda em aberto (conta nos dias em aberto e nos pendentes do painel). */
export const emAberto = (s: SituacaoDoItem) => s === "pendente" || s === "parcial" || s === "em_analise";

/** Dias entre o pedido e a entrega (ou hoje, se não entregue). Datas "AAAA-MM-DD". */
export function diasEmAberto(dataPedido: string, dataEntrega: string | null, hoje: string): number {
  const fim = Date.parse(`${dataEntrega ?? hoje}T00:00:00Z`);
  const inicio = Date.parse(`${dataPedido}T00:00:00Z`);
  return Math.max(0, Math.round((fim - inicio) / 86_400_000));
}

/** Painel do pedido: totais por situação × assunto (e o total geral por situação). */
export function painelDoPedido(itens: { assunto: string; situacao: SituacaoDoItem }[]) {
  const assuntos = [...new Set(itens.map((i) => i.assunto))];
  const vazio = () =>
    Object.fromEntries(SITUACOES_DO_ITEM.map((s) => [s, 0])) as Record<SituacaoDoItem, number>;
  const porAssunto = Object.fromEntries(assuntos.map((a) => [a, vazio()]));
  const total = vazio();
  for (const i of itens) {
    porAssunto[i.assunto][i.situacao]++;
    total[i.situacao]++;
  }
  return { assuntos, porAssunto, total, itens: itens.length };
}

// --- Leitura da planilha do solicitante ----------------------------------------------------

/** Campos do item que a importação reconhece nas colunas da planilha. */
export type CampoDoItem =
  | "codigo"
  | "grupo"
  | "subgrupo"
  | "prioridade"
  | "descricao"
  | "formato"
  | "tipo"
  | "dataPedido"
  | "dataEntrega"
  | "departamento"
  | "responsavel"
  | "observacaoSolicitante"
  | "resposta"
  | "ondeObter"
  | "situacao";

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Ordem importa: o primeiro padrão que casa decide o campo. */
const PADROES: [CampoDoItem, RegExp][] = [
  ["subgrupo", /^sub ?(grupo|area|secao|categoria)/],
  ["grupo", /^(grupo|area|secao|categoria|topico)\b/],
  ["prioridade", /priori/],
  ["formato", /formato|extens/],
  ["tipo", /^tipo\b/],
  ["dataEntrega", /entreg|disponibiliz/],
  ["dataPedido", /data (do |da )?(pedido|solicitacao)|solicitado em|^data$/],
  ["departamento", /depart|setor/],
  ["responsavel", /respons/],
  ["situacao", /situa|status/],
  ["resposta", /resposta|retorno|comentario(s)? (da |do )?(vendedor|empresa|target|cliente)/],
  ["ondeObter", /onde obter|fonte|localiza/],
  ["observacaoSolicitante", /obs|coment|nota/],
  ["codigo", /^(n[o°º.]*|num(ero)?|item|cod(igo)?\.?|ref(erencia)?|#|id)$/],
  ["descricao", /descri|document|solicita|informac|pergunta|questao|pedido/],
];

/** Coluna de situação por período: um ano ("2024", "Exercício 2023") ou a data-base. */
export function periodoDaColuna(cabecalho: string): string | null {
  const c = sem(cabecalho);
  const ano = c.match(/^(exercicio |ano |fy ?)?((19|20)\d\d)$/);
  if (ano) return ano[2];
  if (/^data[- ]?base$/.test(c)) return "Data-base";
  return null;
}

export type Mapeamento = { campos: Partial<Record<CampoDoItem, number>>; periodos: Record<number, string> };

/** Mapeia o cabeçalho da planilha para os campos do item e as colunas de período. */
export function mapearColunas(cabecalho: string[]): Mapeamento {
  const campos: Partial<Record<CampoDoItem, number>> = {};
  const periodos: Record<number, string> = {};
  cabecalho.forEach((bruto, i) => {
    const c = sem(bruto ?? "");
    if (!c) return;
    const periodo = periodoDaColuna(bruto);
    if (periodo) {
      periodos[i] = periodo;
      return;
    }
    const achado = PADROES.find(([campo, re]) => campos[campo] === undefined && re.test(c));
    if (achado) campos[achado[0]] = i;
  });
  return { campos, periodos };
}

/** Linha do cabeçalho: a primeira (entre as 15 primeiras) com a descrição e mais uma coluna conhecida. */
export function linhaDoCabecalho(linhas: string[][]): number {
  for (let i = 0; i < Math.min(15, linhas.length); i++) {
    const m = mapearColunas(linhas[i]);
    if (
      m.campos.descricao !== undefined &&
      Object.keys(m.campos).length + Object.keys(m.periodos).length >= 2
    )
      return i;
  }
  return -1;
}

/** Texto de situação da planilha → situação do item (null se não reconhecer). */
export function lerSituacao(texto: string | undefined | null): SituacaoDoItem | null {
  const t = sem(texto ?? "");
  if (!t) return null;
  if (/^(n\/?a|nao aplica|nao se aplica|na)\b/.test(t)) return "nao_aplicavel";
  if (/parcial/.test(t)) return "parcial";
  if (/aprovad|ok\b|concluid/.test(t)) return "aprovado";
  if (/analise|revis/.test(t)) return "em_analise";
  if (/entregue|disponibiliz|enviad|atendid|data ?room|sim\b/.test(t)) return "entregue";
  if (/pendent|aguard|em aberto|nao\b/.test(t)) return "pendente";
  return null;
}

/** Tipo do item: pergunta quando a coluna diz ou a descrição termina com "?". */
export function lerTipo(texto: string | undefined, descricao: string): "documento" | "pergunta" {
  const t = sem(texto ?? "");
  if (/pergunta|questao|questionario|informacao/.test(t)) return "pergunta";
  if (/document/.test(t)) return "documento";
  return descricao.trim().endsWith("?") ? "pergunta" : "documento";
}

/** Data da planilha ("dd/mm/aaaa", "aaaa-mm-dd" ou número de série do Excel) → "AAAA-MM-DD". */
export function lerData(texto: string | undefined | null): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}
