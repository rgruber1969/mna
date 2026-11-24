/**
 * Semáforo dos prazos (ADR-0010, adendo de 2026-11-23; propostas de layout v3):
 * vermelho = vencido, amarelo = vence em até N dias, verde = em dia. N vem de
 * Configurações → Painel principal (padrão 7). Cálculo puro, usado no servidor
 * (painel, kanban, linha do tempo) e nas telas.
 */

export type NivelDoPrazo = "atrasado" | "proximo" | "emDia";

export const DIAS_DE_AVISO_PADRAO = 7;
export const DIAS_DE_AVISO_MINIMO = 1;
export const DIAS_DE_AVISO_MAXIMO = 30;

/** Dias corridos de `hoje` até `data` (negativo = já passou). Datas em "AAAA-MM-DD". */
export function diasAte(data: string, hoje: string): number {
  return Math.round((Date.parse(`${data}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
}

/** Situação de um prazo; null quando não há prazo. */
export function nivelDoPrazo(
  data: string | null | undefined,
  hoje: string,
  diasDeAviso = DIAS_DE_AVISO_PADRAO,
): NivelDoPrazo | null {
  if (!data) return null;
  const d = diasAte(data, hoje);
  return d < 0 ? "atrasado" : d <= diasDeAviso ? "proximo" : "emDia";
}

/** Classes (tokens semânticos) de cada situação: texto, fundo fosco, faixa/ponto. */
export const CORES_DO_NIVEL: Record<NivelDoPrazo, { texto: string; fundo: string; faixa: string }> = {
  atrasado: { texto: "text-danger", fundo: "bg-danger-soft", faixa: "bg-danger" },
  proximo: { texto: "text-warning", fundo: "bg-warning-soft", faixa: "bg-warning-fill" },
  emDia: { texto: "text-success", fundo: "bg-success-soft", faixa: "bg-success" },
};

/** Hoje ("AAAA-MM-DD") no fuso de São Paulo, no servidor ou no navegador (toISOString usaria UTC). */
export const hojeNoBrasil = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
