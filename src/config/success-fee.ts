/** Cálculo puro do success fee (usado no servidor e na simulação da tela; C3). */

/**
 * Success fee estimado sobre um valor (ex.: o da oferta escolhida): o maior
 * entre o percentual e o mínimo; com o retainer descontado, subtrai o que já
 * foi pago de honorários fixos (nunca abaixo de zero).
 */
export function successFeeEstimado(
  c: {
    successFeePercentual: string | null;
    successFeeMinimo: string | null;
    retainerDescontado: boolean;
  },
  valor: number,
  retainerPago = 0,
): number | null {
  const pct = c.successFeePercentual === null ? null : Number(c.successFeePercentual);
  const minimo = c.successFeeMinimo === null ? null : Number(c.successFeeMinimo);
  if (pct === null && minimo === null) return null;
  const bruto = Math.max(pct === null ? 0 : (valor * pct) / 100, minimo ?? 0);
  const liquido = c.retainerDescontado ? Math.max(0, bruto - retainerPago) : bruto;
  return Math.round(liquido * 100) / 100;
}
