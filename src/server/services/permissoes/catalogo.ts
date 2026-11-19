import { z } from "zod";

/**
 * Catálogo de recursos (itens de menu) e ações, definido no código
 * (ADR-0013, elemento 1; docs/projeto/perfis-e-permissoes.md).
 *
 * Os identificadores são únicos entre as duas camadas, para que o verificador
 * saiba, pelo recurso, se a pergunta é sobre o tenant ou sobre um deal.
 */

export const ACOES = [
  "ver",
  "criar",
  "editar",
  "excluir",
  "baixar",
  "comentar",
  "aprovar",
  "liberar",
] as const;
export type Acao = (typeof ACOES)[number];

export type Camada = "tenant" | "deal";

/**
 * `nota`: o recurso tem uma observação exibida na matriz. Os nomes dos
 * recursos, das ações e as notas ficam nas mensagens (administracao.permissoes),
 * traduzidos onde são exibidos.
 */
type DefinicaoDoRecurso = { camada: Camada; acoes: readonly Acao[]; nota?: true };

const VCEX = ["ver", "criar", "editar", "excluir"] as const;
const VCEXB = ["ver", "criar", "editar", "excluir", "baixar"] as const;

export const RECURSOS = {
  // --- Camada do tenant (fora dos deals) -------------------------------------
  painel: { camada: "tenant", acoes: ["ver"] },
  deals: {
    camada: "tenant",
    acoes: VCEX,
    nota: true,
  },
  valuations: { camada: "tenant", acoes: VCEXB },
  empresas: { camada: "tenant", acoes: VCEXB },
  cadastros: {
    camada: "tenant",
    acoes: VCEX,
    nota: true,
  },
  auditoria: { camada: "tenant", acoes: ["ver"] },

  // --- Camada do deal (dentro de cada deal, conforme a participação) ---------
  deal: { camada: "deal", acoes: ["ver", "editar"] },
  funil: { camada: "deal", acoes: ["ver", "editar"], nota: true },
  etapas: { camada: "deal", acoes: VCEX },
  documentos: {
    camada: "deal",
    acoes: VCEXB,
    nota: true,
  },
  tarefas: { camada: "deal", acoes: VCEX },
  mensagens: { camada: "deal", acoes: ["ver", "criar"], nota: true },
  contratos: { camada: "deal", acoes: VCEXB },
  ebook: {
    camada: "deal",
    acoes: [...VCEXB, "comentar", "aprovar", "liberar"],
  },
  ofertas: { camada: "deal", acoes: VCEX },
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
