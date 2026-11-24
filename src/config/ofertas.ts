/**
 * Cálculos puros das ofertas (O3 e O4), usados no servidor e na tela de
 * comparação: total nominal, valor presente e rateio entre vendedoras.
 */

export type ValoresDaOferta = {
  data: string;
  enterpriseValue: string | null;
  equityValue: string | null;
  parcelaVista: string | null;
  /** Parcela em data fixa (`data`) ou em meses após o closing (`meses`). */
  parcelas: { valor: string; data: string; meses?: number | null }[];
  earnoutValor: string | null;
};

/** "AAAA-MM-DD" somado de meses (o dia fica no último dia do mês, se precisar). */
export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/**
 * Vencimento da parcela: a data fixa ou o closing + meses. Sem closing
 * informado, vale a previsão de fechamento (ou a data da oferta).
 */
export function vencimento(p: { data: string; meses?: number | null }, closing: string): string {
  return p.meses ? somarMeses(closing, p.meses) : p.data;
}

const n = (v: string | null | undefined) => (v ? Number(v) : 0);
const centavos = (v: number) => Math.round(v * 100) / 100;

/**
 * Soma da estrutura de pagamento (à vista + parcelas + earnout estimado);
 * sem estrutura informada, vale o equity value (ou o enterprise value).
 */
export function totalNominal(o: ValoresDaOferta): number {
  const estrutura = n(o.parcelaVista) + o.parcelas.reduce((s, p) => s + n(p.valor), 0) + n(o.earnoutValor);
  return centavos(estrutura > 0 ? estrutura : n(o.equityValue) || n(o.enterpriseValue));
}

/**
 * Valor presente no closing (a parcela à vista é paga nele): parcelas
 * trazidas pela taxa anual informada (% a.a., juros compostos por dias
 * corridos / 365). `closing` é a data do closing ou a previsão de fechamento
 * do negócio; sem ela, a data da oferta. O earnout entra pelo valor
 * estimado, sem desconto (não tem data certa).
 */
export function valorPresente(o: ValoresDaOferta, taxaAnual: number, closing?: string | null): number {
  const estrutura = n(o.parcelaVista) + o.parcelas.reduce((s, p) => s + n(p.valor), 0) + n(o.earnoutValor);
  if (estrutura === 0) return totalNominal(o);
  const dataBase = closing || o.data;
  const base = Date.parse(dataBase);
  const fator = 1 + taxaAnual / 100;
  const parcelas = o.parcelas.reduce((s, p) => {
    const dias = Math.max(0, (Date.parse(vencimento(p, dataBase)) - base) / 86_400_000);
    return s + n(p.valor) / Math.pow(fator, dias / 365);
  }, 0);
  return centavos(n(o.parcelaVista) + parcelas + n(o.earnoutValor));
}

/** Divide um valor pelos percentuais; a última vendedora absorve o arredondamento. */
export function ratear(
  valor: number,
  rateio: { empresaId: string; percentual: string }[],
): { empresaId: string; percentual: number; valor: number }[] {
  let restante = centavos(valor);
  return rateio.map((r, i) => {
    const parte = i === rateio.length - 1 ? restante : centavos((valor * Number(r.percentual)) / 100);
    restante = centavos(restante - parte);
    return { empresaId: r.empresaId, percentual: Number(r.percentual), valor: parte };
  });
}

/**
 * Número digitado em formato brasileiro ou simples: "1.234,56", "12.000.000",
 * "1234.56" ou "1234,5". Vazio vira null; o resto é validado por quem chama.
 */
export function lerNumero(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (s.includes(",")) return s.replace(/\./g, "").replace(",", ".");
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return s.replace(/\./g, "");
  return s;
}
