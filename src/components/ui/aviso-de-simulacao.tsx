import { useTranslations } from "next-intl";

/**
 * Aviso visível das funcionalidades simuladas (decisão menor "Funcionalidades
 * simuladas"): faixa no topo da tela ou do bloco, dizendo que é demonstração
 * e o que ainda não acontece de verdade.
 */
export function AvisoDeSimulacao({ texto, compacto = false }: { texto?: string; compacto?: boolean }) {
  const t = useTranslations("comum.simulacao");
  return (
    <p
      role="note"
      className={`bg-warning-soft text-warning border-warning-fill/40 flex items-start gap-2 rounded-lg border ${compacto ? "px-2.5 py-1.5 text-xs" : "mb-4 px-3 py-2 text-sm"}`}
    >
      <span aria-hidden="true" className="font-bold">
        ◆
      </span>
      <span>
        <b className="font-semibold">{t("titulo")}</b> {texto ?? t("padrao")}
      </span>
    </p>
  );
}
