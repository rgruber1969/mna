"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * Paginação de listas que já estão na tela (abas do negócio e painel do
 * kanban): 20 por página, com "x–y de total" e anterior/próxima.
 */
export const OPCOES_POR_PAGINA = [10, 20, 50, 100];

export function usePaginacao<T>(itens: T[], inicial = 20) {
  const [pedida, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(inicial);
  const paginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const pagina = Math.min(pedida, paginas);
  return {
    atual: itens.slice((pagina - 1) * porPagina, pagina * porPagina),
    controles: (
      <Paginacao
        pagina={pagina}
        paginas={paginas}
        total={itens.length}
        porPagina={porPagina}
        mudar={setPagina}
        mudarPorPagina={(n) => {
          setPorPagina(n);
          setPagina(1);
        }}
      />
    ),
  };
}

export function Paginacao({
  pagina,
  paginas,
  total,
  porPagina,
  mudar,
  mudarPorPagina,
}: {
  pagina: number;
  paginas: number;
  total: number;
  porPagina: number;
  mudar: (p: number) => void;
  mudarPorPagina?: (n: number) => void;
}) {
  const t = useTranslations("comum.lista");
  // Até 10 itens não há o que paginar nem escolher.
  if (total <= OPCOES_POR_PAGINA[0]) return null;
  return (
    <nav aria-label={t("paginacao")} className="text-muted mt-3 flex items-center justify-between text-xs">
      <span>
        {t("intervalo", {
          de: (pagina - 1) * porPagina + 1,
          ate: Math.min(pagina * porPagina, total),
          total,
        })}
      </span>
      <span className="flex items-center gap-3">
        {mudarPorPagina && (
          <label className="flex items-center gap-1">
            {t("porPagina")}
            <select
              value={porPagina}
              onChange={(e) => mudarPorPagina(Number(e.target.value))}
              className="border-border bg-background text-text rounded border px-1 py-0.5"
            >
              {OPCOES_POR_PAGINA.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {paginas > 1 && (
          <>
            <button
              type="button"
              disabled={pagina === 1}
              onClick={() => mudar(pagina - 1)}
              className="text-primary disabled:text-muted"
            >
              ‹ {t("anterior")}
            </button>
            <span>{t("paginaDe", { pagina, paginas })}</span>
            <button
              type="button"
              disabled={pagina === paginas}
              onClick={() => mudar(pagina + 1)}
              className="text-primary disabled:text-muted"
            >
              {t("proxima")} ›
            </button>
          </>
        )}
      </span>
    </nav>
  );
}

/** Lista já montada (ex.: no servidor) mostrada 20 por vez. */
export function ListaPaginada({
  itens,
  className,
  porPagina = 20,
}: {
  itens: ReactNode[];
  className?: string;
  porPagina?: number;
}) {
  const { atual, controles } = usePaginacao(itens, porPagina);
  return (
    <>
      <ul className={className}>{atual}</ul>
      {controles}
    </>
  );
}
