/** Layout do diagrama das etapas (item 10): colunas, posições e tamanhos, sem React (testável). */

export type EtapaDoDiagrama = {
  id: string;
  nome: string;
  situacao: "nao_iniciada" | "andamento" | "concluida" | "pulada";
  inicioPrevisto: string | null;
  fimPrevisto: string | null;
  inicioReal: string | null;
  fimReal: string | null;
  dependeDeId: string | null;
  dependeDe: string | null;
  subetapas: EtapaDoDiagrama[];
};

export const LARGURA = 210;
export const CABECALHO = 58;
export const SUB = 26;
export const ESPACO_X = 64;
export const ESPACO_Y = 22;
export const MARGEM = 20;

export type Caixa = { etapa: EtapaDoDiagrama; coluna: number; x: number; y: number; altura: number };

/** Colunas: depende de outra → coluna seguinte à dela; sem dependência → em paralelo com a anterior. */
export function montarDiagrama(etapas: EtapaDoDiagrama[]): {
  caixas: Caixa[];
  largura: number;
  altura: number;
} {
  const coluna = new Map<string, number>();
  etapas.forEach((e, i) => {
    const anterior = i > 0 ? (coluna.get(etapas[i - 1].id) ?? 0) : 0;
    const dep = e.dependeDeId ? coluna.get(e.dependeDeId) : undefined;
    coluna.set(e.id, i === 0 ? 0 : e.dependeDeId ? (dep ?? anterior) + 1 : anterior);
  });
  const ocupado: number[] = [];
  const caixas = etapas.map((e) => {
    const c = coluna.get(e.id) ?? 0;
    const altura = CABECALHO + (e.subetapas.length ? e.subetapas.length * SUB + 8 : 0);
    const y = ocupado[c] ?? MARGEM;
    ocupado[c] = y + altura + ESPACO_Y;
    return { etapa: e, coluna: c, x: MARGEM + c * (LARGURA + ESPACO_X), y, altura };
  });
  const colunas = Math.max(1, ...caixas.map((c) => c.coluna + 1));
  return {
    caixas,
    largura: MARGEM * 2 + colunas * LARGURA + (colunas - 1) * ESPACO_X,
    altura: Math.max(...ocupado.filter(Boolean), MARGEM + CABECALHO + ESPACO_Y) - ESPACO_Y + MARGEM,
  };
}
