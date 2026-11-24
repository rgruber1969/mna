"use client";

import { useTranslations } from "next-intl";

/**
 * Aviso de que o registro foi gravado e a tela está atualizando (a lista nova
 * demora alguns segundos para chegar): evita a impressão de que nada aconteceu.
 */
export function Atualizando({ texto }: { texto?: string }) {
  const t = useTranslations("comum");
  return (
    <p
      role="status"
      className="bg-success-soft text-success inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium"
    >
      <span
        aria-hidden="true"
        className="border-success h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
      />
      {texto ?? t("gravadoAtualizando")}
    </p>
  );
}
