import { useTranslations } from "next-intl";
import { METODOS, type Metodo } from "@/config/valuation";
import { milhoes } from "./formato";

/**
 * Painel visual do valuation (item 18): um eixo só (R$ milhões), uma barra
 * por método (mesma cor: a identidade vem do rótulo), a faixa mínimo–máximo
 * sombreada, o ponderado como linha tracejada e as ofertas como losangos com
 * rótulo. Cada marca tem balão (title) e a mesma informação está nas tabelas.
 */
export function GraficoDoValuation({
  valores,
  ponderado,
  faixa,
  ofertas,
}: {
  valores: Record<Metodo, number>;
  ponderado: number;
  faixa: { minimo: number; maximo: number };
  ofertas: { id: string; rotulo: string; total: number }[];
}) {
  const t = useTranslations("valuation");
  const L = 720;
  const ESQ = 190;
  const DIR = 24;
  const LINHA = 34;
  const TOPO = 44;
  const linhas = METODOS.length + (ofertas.length ? 1 : 0);
  const A = TOPO + linhas * LINHA + 28;
  const maior = Math.max(...Object.values(valores), faixa.maximo, ponderado, ...ofertas.map((o) => o.total));
  const passo = 20_000_000;
  const fim = Math.ceil((maior * 1.08) / passo) * passo;
  const x = (v: number) => ESQ + (Math.max(0, v) / fim) * (L - ESQ - DIR);
  const marcas = Array.from({ length: fim / passo + 1 }, (_, i) => i * passo);
  const base = TOPO + linhas * LINHA;
  return (
    <figure className="m-0">
      <figcaption className="text-text mb-1 text-sm font-semibold">{t("painel.grafico")}</figcaption>
      <p className="text-muted mb-2 text-xs">{t("painel.graficoDescricao")}</p>
      <svg viewBox={`0 0 ${L} ${A}`} className="h-auto w-full" role="img" aria-label={t("painel.grafico")}>
        {/* Faixa esperada (mínimo–máximo), atrás de tudo. */}
        <rect
          x={x(faixa.minimo)}
          y={TOPO - 8}
          width={x(faixa.maximo) - x(faixa.minimo)}
          height={linhas * LINHA + 8}
          className="fill-primary-soft"
        >
          <title>{`${t("painel.faixa")}: ${milhoes(faixa.minimo)} – ${milhoes(faixa.maximo)}`}</title>
        </rect>
        <text x={x(faixa.minimo) - 4} y={TOPO - 12} textAnchor="end" className="fill-muted text-[10px]">
          {t("painel.minimo")} {milhoes(faixa.minimo)}
        </text>
        <text x={x(faixa.maximo) + 4} y={TOPO - 12} className="fill-muted text-[10px]">
          {t("painel.maximo")} {milhoes(faixa.maximo)}
        </text>
        {/* Grade e eixo (recessivos). */}
        {marcas.map((m) => (
          <g key={m}>
            <line x1={x(m)} x2={x(m)} y1={TOPO - 8} y2={base} className="stroke-border" strokeWidth={1} />
            <text x={x(m)} y={base + 16} textAnchor="middle" className="fill-muted text-[10px]">
              {(m / 1_000_000).toLocaleString("pt-BR")}
            </text>
          </g>
        ))}
        <text x={L - DIR} y={A - 2} textAnchor="end" className="fill-muted text-[10px]">
          {t("painel.eixo")}
        </text>
        {/* Barras dos métodos. */}
        {METODOS.map((m, i) => {
          const y = TOPO + i * LINHA;
          return (
            <g key={m}>
              <text x={ESQ - 10} y={y + LINHA / 2 + 4} textAnchor="end" className="fill-text text-[12px]">
                {t(`metodos.${m}`)}
              </text>
              <rect
                x={ESQ}
                y={y + 8}
                width={Math.max(2, x(valores[m]) - ESQ)}
                height={LINHA - 16}
                rx={4}
                className="fill-primary"
              >
                <title>{`${t(`metodos.${m}`)}: ${milhoes(valores[m])}`}</title>
              </rect>
              <text x={x(valores[m]) + 6} y={y + LINHA / 2 + 4} className="fill-text text-[11px] font-medium">
                {milhoes(valores[m])}
              </text>
            </g>
          );
        })}
        {/* Ofertas reais do negócio escolhido. */}
        {ofertas.length > 0 && (
          <g>
            <text
              x={ESQ - 10}
              y={TOPO + METODOS.length * LINHA + LINHA / 2 + 4}
              textAnchor="end"
              className="fill-text text-[12px]"
            >
              {t("painel.ofertas")}
            </text>
            {ofertas.map((o) => {
              const cx = x(o.total);
              const cy = TOPO + METODOS.length * LINHA + LINHA / 2;
              return (
                <path
                  key={o.id}
                  d={`M${cx},${cy - 8} L${cx + 8},${cy} L${cx},${cy + 8} L${cx - 8},${cy} z`}
                  className="fill-accent stroke-surface"
                  strokeWidth={2}
                >
                  <title>{`${o.rotulo}: ${milhoes(o.total)}`}</title>
                </path>
              );
            })}
          </g>
        )}
        {/* Valor ponderado (linha tracejada com rótulo acima da faixa). */}
        <text
          x={x(ponderado)}
          y={TOPO - 26}
          textAnchor="middle"
          className="fill-text text-[11px] font-semibold"
        >
          {t("painel.ponderadoCurto")} {milhoes(ponderado)}
        </text>
        <line
          x1={x(ponderado)}
          x2={x(ponderado)}
          y1={TOPO - 20}
          y2={base}
          className="stroke-text"
          strokeWidth={2}
          strokeDasharray="5 4"
        >
          <title>{`${t("painel.ponderado")}: ${milhoes(ponderado)}`}</title>
        </line>
      </svg>
    </figure>
  );
}
