import { z } from "zod";

/**
 * Catálogo de recursos (itens de menu) e ações, definido no código
 * (ADR-0013, elemento 1; docs/projeto/perfis-e-permissoes.md).
 *
 * Os identificadores são únicos entre as duas camadas, para que o verificador
 * saiba, pelo recurso, se a pergunta é sobre o tenant ou sobre um deal.
 */

export const ACOES = {
  ver: "Ver",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
  baixar: "Baixar",
  comentar: "Comentar",
  aprovar: "Aprovar",
  liberar: "Liberar ao comprador",
} as const;
export type Acao = keyof typeof ACOES;

/** Abreviação de cada ação nas tabelas (legenda em perfis-e-permissoes.md). */
export const SIGLAS: Record<Acao, string> = {
  ver: "V",
  criar: "C",
  editar: "E",
  excluir: "X",
  baixar: "B",
  comentar: "Co",
  aprovar: "Ap",
  liberar: "Li",
};

export type Camada = "tenant" | "deal";

type DefinicaoDoRecurso = { nome: string; camada: Camada; acoes: readonly Acao[]; nota?: string };

const VCEX = ["ver", "criar", "editar", "excluir"] as const;
const VCEXB = ["ver", "criar", "editar", "excluir", "baixar"] as const;

export const RECURSOS = {
  // --- Camada do tenant (fora dos deals) -------------------------------------
  painel: { nome: "Painel", camada: "tenant", acoes: ["ver"] },
  deals: {
    nome: "Deals (lista)",
    camada: "tenant",
    acoes: VCEX,
    nota: "A lista mostra só os deals em que a pessoa participa.",
  },
  valuations: { nome: "Valuations avulsos", camada: "tenant", acoes: VCEXB },
  empresas: { nome: "Empresas e pessoas", camada: "tenant", acoes: VCEXB },
  cadastros: {
    nome: "Cadastros gerais",
    camada: "tenant",
    acoes: VCEX,
    nota: "Etapas padrão, catálogo de documentos, templates e papéis de empresa.",
  },
  auditoria: { nome: "Auditoria", camada: "tenant", acoes: ["ver"] },

  // --- Camada do deal (dentro de cada deal, conforme a participação) ---------
  deal: { nome: "Deal e participantes", camada: "deal", acoes: ["ver", "editar"] },
  etapas: { nome: "Etapas", camada: "deal", acoes: VCEX },
  documentos: {
    nome: "Documentos",
    camada: "deal",
    acoes: VCEXB,
    nota: "Só nas versões a que a pessoa recebeu acesso de quem as enviou.",
  },
  tarefas: { nome: "Tarefas", camada: "deal", acoes: VCEX },
  mensagens: { nome: "Mensagens", camada: "deal", acoes: ["ver", "criar"], nota: "Mensagens são imutáveis." },
  contratos: { nome: "Contratos", camada: "deal", acoes: VCEXB },
  ebook: {
    nome: "E-book / OnePager",
    camada: "deal",
    acoes: [...VCEXB, "comentar", "aprovar", "liberar"],
  },
  ofertas: { nome: "Ofertas", camada: "deal", acoes: VCEX },
} as const satisfies Record<string, DefinicaoDoRecurso>;

export type Recurso = keyof typeof RECURSOS;

/** Matriz recurso × ações concedidas (o que não está aqui é negado). */
export type Matriz = Partial<Record<Recurso, Acao[]>>;

export function recursosDaCamada(camada: Camada): Recurso[] {
  return (Object.keys(RECURSOS) as Recurso[]).filter((r) => RECURSOS[r].camada === camada);
}

export function acoesDoRecurso(recurso: Recurso): readonly Acao[] {
  return RECURSOS[recurso].acoes;
}

const ehRecurso = (r: string): r is Recurso => Object.hasOwn(RECURSOS, r);

/**
 * Limpa uma matriz vinda de fora (formulário, banco): mantém só recursos da
 * camada e ações aplicáveis a cada um, sem repetição e na ordem do catálogo.
 */
export function normalizarMatriz(entrada: unknown, camada: Camada): Matriz {
  const bruta = z.record(z.string(), z.array(z.string())).catch({}).parse(entrada);
  const matriz: Matriz = {};
  for (const [recurso, acoes] of Object.entries(bruta)) {
    if (!ehRecurso(recurso) || RECURSOS[recurso].camada !== camada) continue;
    const validas = RECURSOS[recurso].acoes.filter((a) => acoes.includes(a));
    if (validas.length > 0) matriz[recurso] = [...validas];
  }
  return matriz;
}

/** Soma de matrizes (ADR-0013, elemento 6): tudo o que cada uma concede. */
export function somarMatrizes(matrizes: Matriz[]): Matriz {
  const soma: Matriz = {};
  for (const m of matrizes)
    for (const [recurso, acoes] of Object.entries(m) as [Recurso, Acao[]][]) {
      const atual = new Set([...(soma[recurso] ?? []), ...acoes]);
      soma[recurso] = RECURSOS[recurso].acoes.filter((a) => atual.has(a));
    }
  return soma;
}

export function concede(matriz: Matriz, recurso: Recurso, acao: Acao): boolean {
  return matriz[recurso]?.includes(acao) ?? false;
}
