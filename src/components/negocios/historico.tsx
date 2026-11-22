"use client";

import { useTranslations } from "next-intl";
import { usePaginacao } from "@/components/ui/paginacao-local";

/** Histórico do negócio, 20 eventos por página (os textos já vêm traduzidos do servidor). */
export function HistoricoPaginado({ eventos }: { eventos: { texto: string; detalhe: string }[] }) {
  const t = useTranslations("negocios.historico");
  const { atual, controles } = usePaginacao(eventos);
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
      {controles}
    </div>
  );
}
