"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AvisoDeSimulacao } from "@/components/ui/aviso-de-simulacao";

const LOGOS = {
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5z"
      />
      <path
        fill="currentColor"
        opacity=".75"
        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22z"
      />
      <path fill="currentColor" opacity=".55" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9z" />
      <path
        fill="currentColor"
        opacity=".35"
        d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3 7.5l3.4 2.6C7.2 7.8 9.4 6 12 6z"
      />
    </svg>
  ),
  microsoft: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <rect x="3" y="3" width="8.5" height="8.5" />
      <rect x="12.5" y="3" width="8.5" height="8.5" opacity=".75" />
      <rect x="3" y="12.5" width="8.5" height="8.5" opacity=".55" />
      <rect x="12.5" y="12.5" width="8.5" height="8.5" opacity=".35" />
    </svg>
  ),
};

/**
 * Entrar com Google ou Microsoft (item 3, simulado): os botões aparecem na
 * tela de entrada com aviso de demonstração; ao clicar, explicam que a função
 * chega numa próxima versão (decidido em 2026-11-18). Nada sai da aplicação.
 */
export function BotoesDeLoginSocial() {
  const t = useTranslations("acesso.loginSocial");
  const [clicado, setClicado] = useState<"google" | "microsoft" | null>(null);
  return (
    <div className="mt-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {(["google", "microsoft"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setClicado(p)}
            className="border-border text-text hover:border-primary flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors"
          >
            {LOGOS[p]}
            {t(p)}
          </button>
        ))}
      </div>
      {clicado && <AvisoDeSimulacao compacto texto={t("emBreve", { provedor: t(`nomes.${clicado}`) })} />}
    </div>
  );
}
