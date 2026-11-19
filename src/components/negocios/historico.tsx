"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** Histórico do negócio, 20 eventos por página (os textos já vêm traduzidos do servidor). */
export function HistoricoPaginado({ eventos }: { eventos: { texto: string; detalhe: string }[] }) {
  const t = useTranslations("negocios.historico");
  const porPagina = 20;
  const [pagina, setPagina] = useState(1);
  const paginas = Math.max(1, Math.ceil(eventos.length / porPagina));
  const atual = eventos.slice((pagina - 1) * porPagina, pagina * porPagina);
  if (eventos.length === 0) return <p className="text-muted text-sm">{t("nenhum")}</p>;
  return (
    <div>
      <ul className="divide-border divide-y text-sm">
        {atual.map((e, i) => (
          <li key={i} className="py-2">
            <span>{e.texto}</span>
            <span className="text-muted block text-xs">{e.detalhe}</span>
          </li>
        ))}
      </ul>
      {paginas > 1 && (
        <nav aria-label={t("paginas")} className="text-muted mt-3 flex items-center justify-between text-xs">
          <span>
            {t("intervalo", {
              de: (pagina - 1) * porPagina + 1,
              ate: Math.min(pagina * porPagina, eventos.length),
              total: eventos.length,
            })}
          </span>
          <span className="flex items-center gap-3">
            <button
              type="button"
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
              className="text-primary disabled:text-muted"
            >
              {t("anterior")}
            </button>
            <span>{t("paginaDe", { pagina, paginas })}</span>
            <button
              type="button"
              disabled={pagina === paginas}
              onClick={() => setPagina((p) => p + 1)}
              className="text-primary disabled:text-muted"
            >
              {t("proxima")}
            </button>
          </span>
        </nav>
      )}
    </div>
  );
}
