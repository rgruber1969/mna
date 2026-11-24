/**
 * Valuation de demonstração (item 18, **simulado**): um valuation fictício
 * completo, com os 5 métodos do domínio (dominio.md, "Valuation"), ponderação,
 * cenários, sensibilidade, faixa mínimo–máximo e rateio entre vendedoras.
 * Os números são fixos e fictícios; as contas são as mesmas que a versão real
 * vai usar, para a tela ser aproveitada. Valores em reais.
 */

export const METODOS = ["dcf", "multiplos", "transacoes", "patrimonial", "regraDeBolso"] as const;
export type Metodo = (typeof METODOS)[number];
export const CENARIOS = ["pessimista", "base", "otimista"] as const;
export type Cenario = (typeof CENARIOS)[number];

export type DadosDoValuation = {
  titulo: string;
  empresa: string;
  dataBase: string;
  versao: number;
  /** DRE de 3 anos (histórico). */
  dre: { ano: number; receita: number; ebitda: number; lucroLiquido: number }[];
  /** Projeção de 5 anos: crescimento da receita e margem EBITDA (cenário base). */
  projecao: { ano: number; crescimento: number; margemEbitda: number }[];
  /** Fluxo de caixa livre como fração do EBITDA (depois de impostos, capex e capital de giro). */
  conversaoDeCaixa: number;
  wacc: number;
  crescimentoPerpetuo: number;
  dividaLiquida: number;
  contingencias: number;
  regimeTributario: string;
  receitaRecorrenteAnual: number;
  patrimonioLiquidoAjustado: number;
  multiplos: { evEbitda: number; evReceita: number; evArr: number };
  transacoes: { alvo: string; ano: number; evEbitda: number }[];
  /** Regra de bolso do setor: múltiplo da receita recorrente anual. */
  regraDeBolso: number;
  /** Pesos por método (soma 100). */
  pesos: Record<Metodo, number>;
  /** Variação dos cenários sobre o base (pontos percentuais). */
  cenarios: Record<Cenario, { crescimento: number; margem: number }>;
  faixa: { minimo: number; maximo: number };
  tese: { setor: string; ebitda: string; faturamento: string; fontes: string[] };
  vendedoras: { nome: string; percentual: number }[];
  criterioRateio: string;
};

export const VALUATION_DE_EXEMPLO: DadosDoValuation = {
  titulo: "Valuation de demonstração",
  empresa: "Empresa Exemplo Software Ltda (fictícia)",
  dataBase: "2026-09-30",
  versao: 2,
  dre: [
    { ano: 2023, receita: 42_000_000, ebitda: 7_100_000, lucroLiquido: 3_900_000 },
    { ano: 2024, receita: 49_500_000, ebitda: 8_900_000, lucroLiquido: 4_800_000 },
    { ano: 2025, receita: 57_800_000, ebitda: 10_800_000, lucroLiquido: 6_000_000 },
  ],
  projecao: [
    { ano: 2026, crescimento: 15, margemEbitda: 19 },
    { ano: 2027, crescimento: 13, margemEbitda: 20 },
    { ano: 2028, crescimento: 11, margemEbitda: 21 },
    { ano: 2029, crescimento: 9, margemEbitda: 21.5 },
    { ano: 2030, crescimento: 7, margemEbitda: 22 },
  ],
  conversaoDeCaixa: 0.55,
  wacc: 14.5,
  crescimentoPerpetuo: 4,
  dividaLiquida: 6_500_000,
  contingencias: 1_200_000,
  regimeTributario: "Lucro real",
  receitaRecorrenteAnual: 41_000_000,
  patrimonioLiquidoAjustado: 24_000_000,
  multiplos: { evEbitda: 7.5, evReceita: 1.5, evArr: 2.2 },
  transacoes: [
    { alvo: "Transação A (fictícia)", ano: 2024, evEbitda: 8.2 },
    { alvo: "Transação B (fictícia)", ano: 2025, evEbitda: 6.9 },
    { alvo: "Transação C (fictícia)", ano: 2025, evEbitda: 7.8 },
    { alvo: "Transação D (fictícia)", ano: 2026, evEbitda: 9.1 },
  ],
  regraDeBolso: 1.8,
  pesos: { dcf: 35, multiplos: 25, transacoes: 20, patrimonial: 5, regraDeBolso: 15 },
  cenarios: {
    pessimista: { crescimento: -4, margem: -2 },
    base: { crescimento: 0, margem: 0 },
    otimista: { crescimento: 3, margem: 1.5 },
  },
  faixa: { minimo: 62_000_000, maximo: 85_000_000 },
  tese: {
    setor: "Software de gestão B2B (SaaS)",
    ebitda: "6x a 9x o EBITDA",
    faturamento: "1,2x a 2,0x a receita recorrente anual",
    fontes: ["Relatório setorial de exemplo (fictício)", "Base de transações de exemplo (fictícia)"],
  },
  vendedoras: [
    { nome: "Vendedora A (fictícia)", percentual: 70 },
    { nome: "Vendedora B (fictícia)", percentual: 30 },
  ],
  criterioRateio: "faturamento de cada empresa sobre o do grupo em 2025",
};

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Fluxo de caixa descontado: valor da firma (EV) pela projeção, WACC e perpetuidade. */
export function evPorFluxoDeCaixa(
  v: DadosDoValuation,
  ajuste: { crescimento: number; margem: number } = { crescimento: 0, margem: 0 },
  wacc = v.wacc,
  g = v.crescimentoPerpetuo,
): number {
  const w = wacc / 100;
  let receita = v.dre[v.dre.length - 1].receita;
  let ev = 0;
  let ultimoFluxo = 0;
  v.projecao.forEach((p, i) => {
    receita *= 1 + (p.crescimento + ajuste.crescimento) / 100;
    ultimoFluxo = receita * ((p.margemEbitda + ajuste.margem) / 100) * v.conversaoDeCaixa;
    ev += ultimoFluxo / (1 + w) ** (i + 1);
  });
  const perpetuidade = (ultimoFluxo * (1 + g / 100)) / (w - g / 100);
  return ev + perpetuidade / (1 + w) ** v.projecao.length;
}

/** Valor do equity por método (EV menos dívida líquida e contingências; patrimonial direto). */
export function valoresPorMetodo(
  v: DadosDoValuation,
  ajuste: { crescimento: number; margem: number } = { crescimento: 0, margem: 0 },
): Record<Metodo, number> {
  const ultimo = v.dre[v.dre.length - 1];
  // Os cenários (ajuste de crescimento e margem) só mudam o fluxo de caixa descontado.
  const descontos = v.dividaLiquida + v.contingencias;
  const evMultiplos =
    (v.multiplos.evEbitda * ultimo.ebitda +
      v.multiplos.evReceita * ultimo.receita +
      v.multiplos.evArr * v.receitaRecorrenteAnual) /
    3;
  return {
    dcf: evPorFluxoDeCaixa(v, ajuste) - descontos,
    multiplos: evMultiplos - descontos,
    transacoes: mediana(v.transacoes.map((t) => t.evEbitda)) * ultimo.ebitda - descontos,
    patrimonial: v.patrimonioLiquidoAjustado,
    regraDeBolso: v.regraDeBolso * v.receitaRecorrenteAnual - descontos,
  };
}

export function ponderar(valores: Record<Metodo, number>, pesos: Record<Metodo, number>): number {
  return METODOS.reduce((soma, m) => soma + (valores[m] * pesos[m]) / 100, 0);
}

export type ResultadoDoValuation = {
  valores: Record<Metodo, number>;
  ponderado: number;
  somaDosPesos: number;
  cenarios: Record<Cenario, number>;
  /** Equity pelo DCF para WACC (linhas) × crescimento na perpetuidade (colunas). */
  sensibilidade: { waccs: number[]; crescimentos: number[]; valores: number[][] };
  rateio: { nome: string; percentual: number; valor: number }[];
};

export function resultadoDoValuation(v: DadosDoValuation): ResultadoDoValuation {
  const valores = valoresPorMetodo(v);
  const ponderado = ponderar(valores, v.pesos);
  const cenarios = Object.fromEntries(
    CENARIOS.map((c) => [c, ponderar(valoresPorMetodo(v, v.cenarios[c]), v.pesos)]),
  ) as Record<Cenario, number>;
  const waccs = [-1, -0.5, 0, 0.5, 1].map((d) => v.wacc + d);
  const crescimentos = [-1, -0.5, 0, 0.5, 1].map((d) => v.crescimentoPerpetuo + d);
  const descontos = v.dividaLiquida + v.contingencias;
  return {
    valores,
    ponderado,
    somaDosPesos: METODOS.reduce((s, m) => s + v.pesos[m], 0),
    cenarios,
    sensibilidade: {
      waccs,
      crescimentos,
      valores: waccs.map((w) => crescimentos.map((g) => evPorFluxoDeCaixa(v, undefined, w, g) - descontos)),
    },
    rateio: v.vendedoras.map((x) => ({ ...x, valor: (ponderado * x.percentual) / 100 })),
  };
}

/** Receita e EBITDA projetados ano a ano (cenário base), para a tabela de premissas. */
export function projecaoDoValuation(v: DadosDoValuation) {
  return v.projecao.reduce<
    { ano: number; crescimento: number; margemEbitda: number; receita: number; ebitda: number }[]
  >((lista, p) => {
    const anterior = lista.length ? lista[lista.length - 1].receita : v.dre[v.dre.length - 1].receita;
    const receita = anterior * (1 + p.crescimento / 100);
    return [...lista, { ...p, receita, ebitda: (receita * p.margemEbitda) / 100 }];
  }, []);
}
