"use client";

import { useTranslations } from "next-intl";
import { lerNumero, vencimento } from "@/config/ofertas";
import { CampoDeValor } from "@/components/ui/campo-de-valor";

const campo = "border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm";
const br = (d: string) => d.split("-").reverse().join("/");

/** Parcela no formulário: data fixa ou meses após o closing (texto, como digitado). */
export type ParcelaNoFormulario = { valor: string; data: string; meses: string };

export const parcelaParaFormulario = (p: { valor: string; data: string; meses?: number | null }) => ({
  valor: p.valor === "" ? "" : String(Number(p.valor)).replace(".", ","),
  data: p.data ?? "",
  meses: p.meses ? String(p.meses) : "",
});

export const parcelaParaEnvio = (p: ParcelaNoFormulario) =>
  p.meses
    ? { valor: p.valor, data: "", meses: Number(p.meses) }
    : { valor: p.valor, data: p.data, meses: null };

/**
 * Parcelas a prazo: cada uma vence numa data fixa ou em meses após o closing
 * (o mais comum: +12, +24, +60…). Com a previsão de fechamento, mostra o
 * vencimento estimado.
 */
export function EditorDeParcelas({
  parcelas,
  mudar,
  previsao,
  somenteLeitura = false,
}: {
  parcelas: ParcelaNoFormulario[];
  mudar: (p: ParcelaNoFormulario[]) => void;
  previsao: string | null;
  somenteLeitura?: boolean;
}) {
  const t = useTranslations("ofertas");
  const trocar = (i: number, x: Partial<ParcelaNoFormulario>) =>
    mudar(parcelas.map((p, j) => (j === i ? { ...p, ...x } : p)));
  return (
    <div>
      <span className="text-text mb-1 block text-sm font-medium">{t("parcelas")}</span>
      {parcelas.map((p, i) => {
        const relativa = p.meses !== "";
        const estimado =
          relativa && previsao && Number(p.meses) > 0
            ? vencimento({ data: "", meses: Number(p.meses) }, previsao)
            : null;
        return (
          <div key={i} className="mb-2 flex flex-wrap items-end gap-2">
            <label className="w-40">
              <span className="text-muted block text-xs">{t("parcela", { n: i + 1 })}</span>
              <CampoDeValor
                valor={p.valor}
                disabled={somenteLeitura}
                aria-label={`${t("parcela", { n: i + 1 })}: ${t("valor")}`}
                mudar={(x) => trocar(i, { valor: x })}
              />
            </label>
            <label className="w-44">
              <span className="text-muted block text-xs">{t("vencimentoTipo")}</span>
              <select
                value={relativa ? "meses" : "data"}
                aria-label={`${t("parcela", { n: i + 1 })}: ${t("vencimentoTipo")}`}
                disabled={somenteLeitura}
                onChange={(e) =>
                  trocar(
                    i,
                    e.target.value === "meses"
                      ? { meses: p.meses || "12", data: "" }
                      : { meses: "", data: p.data },
                  )
                }
                className={campo}
              >
                <option value="meses">{t("mesesAposClosing")}</option>
                <option value="data">{t("dataFixa")}</option>
              </select>
            </label>
            {relativa ? (
              <label className="w-28">
                <span className="text-muted block text-xs">{t("meses")}</span>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={p.meses}
                  disabled={somenteLeitura}
                  aria-label={`${t("parcela", { n: i + 1 })}: ${t("meses")}`}
                  onChange={(e) => trocar(i, { meses: e.target.value })}
                  className={campo}
                />
              </label>
            ) : (
              <label className="w-44">
                <span className="text-muted block text-xs">{t("vencimento")}</span>
                <input
                  type="date"
                  value={p.data}
                  disabled={somenteLeitura}
                  aria-label={`${t("parcela", { n: i + 1 })}: ${t("vencimento")}`}
                  onChange={(e) => trocar(i, { data: e.target.value })}
                  className={campo}
                />
              </label>
            )}
            {estimado && (
              <span className="text-muted pb-2 text-xs">
                {t("vencimentoEstimado", { data: br(estimado) })}
              </span>
            )}
            {!somenteLeitura && (
              <button
                type="button"
                aria-label={t("tirarParcela", { n: i + 1 })}
                onClick={() => mudar(parcelas.filter((_, j) => j !== i))}
                className="text-danger px-2 py-2 text-sm"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      {!somenteLeitura && (
        <button
          type="button"
          onClick={() =>
            mudar([...parcelas, { valor: "", data: "", meses: String(12 * (parcelas.length + 1)) }])
          }
          className="text-primary text-sm font-medium"
        >
          {t("incluirParcela")}
        </button>
      )}
      <p className="text-muted mt-1 text-xs">
        {previsao ? t("closingBase", { data: br(previsao) }) : t("closingSemPrevisao")}
      </p>
    </div>
  );
}

/** Rateio entre as vendedoras, compacto (percentuais estreitos), com a soma e o critério. */
export function EditorDeRateio({
  vendedoras,
  rateio,
  criterio,
  mudarRateio,
  mudarCriterio,
  somenteLeitura = false,
}: {
  vendedoras: { id: string; nome: string }[];
  rateio: { empresaId: string; percentual: string }[];
  criterio: string;
  mudarRateio: (r: { empresaId: string; percentual: string }[]) => void;
  mudarCriterio: (c: string) => void;
  somenteLeitura?: boolean;
}) {
  const t = useTranslations("ofertas");
  const soma = rateio.reduce((s, r) => s + (Number(lerNumero(r.percentual) ?? "0") || 0), 0);
  return (
    <div className="space-y-2">
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {vendedoras.map((vd) => (
          <label key={vd.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate" title={vd.nome}>
              {vd.nome}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <input
                inputMode="decimal"
                disabled={somenteLeitura}
                aria-label={`${vd.nome} ${t("percentual")}`}
                value={rateio.find((r) => r.empresaId === vd.id)?.percentual ?? ""}
                onChange={(e) =>
                  mudarRateio([
                    ...rateio.filter((r) => r.empresaId !== vd.id),
                    { empresaId: vd.id, percentual: e.target.value },
                  ])
                }
                className="border-border bg-background text-text w-16 rounded-md border px-2 py-1 text-right text-sm tabular-nums"
              />
              %
            </span>
          </label>
        ))}
      </div>
      <p className={`text-xs tabular-nums ${Math.abs(soma - 100) < 0.01 ? "text-success" : "text-warning"}`}>
        {t("somaRateio", { soma: soma.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) })}
      </p>
      <label className="block">
        <span className="text-text mb-1 block text-sm font-medium">{t("criterio")}</span>
        <input
          value={criterio}
          disabled={somenteLeitura}
          onChange={(e) => mudarCriterio(e.target.value)}
          placeholder={t("criterioDica")}
          className={campo}
        />
      </label>
    </div>
  );
}

/** Rateio inicial: o salvo (próprio ou do negócio) ou partes iguais. */
export function rateioInicial(
  vendedoras: { id: string; nome: string }[],
  salvo: { empresaId: string; percentual: string }[],
) {
  if (salvo.length)
    return salvo.map((r) => ({
      empresaId: r.empresaId,
      percentual: String(Number(r.percentual)).replace(".", ","),
    }));
  if (vendedoras.length === 0) return [];
  const parte = Math.floor(10000 / vendedoras.length) / 100;
  return vendedoras.map((v, i) => ({
    empresaId: v.id,
    percentual: String(
      i === vendedoras.length - 1 ? Math.round((100 - parte * (vendedoras.length - 1)) * 100) / 100 : parte,
    ).replace(".", ","),
  }));
}
