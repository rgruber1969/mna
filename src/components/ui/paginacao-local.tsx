"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * Paginação de listas que já estão na tela (abas do negócio e painel do
 * kanban): 20 por página, com "x–y de total" e anterior/próxima.
 */
export function usePaginacao<T>(itens: T[], porPagina = 20) {
  const [pedida, setPagina] = useState(1);
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
}: {
  pagina: number;
  paginas: number;
  total: number;
  porPagina: number;
  mudar: (p: number) => void;
}) {
  const t = useTranslations("comum.lista");
  if (paginas <= 1) return null;
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
