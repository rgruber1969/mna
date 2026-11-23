"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { exportarNegocioAcao } from "@/app/acoes/negocios";
import { AvisoDeSimulacao } from "@/components/ui/aviso-de-simulacao";
import { Aviso } from "@/components/ui/basicos";

/** Botão "Exportar o negócio (PDF)" (item 22, simulado), com aviso de demonstração. */
export function ExportarNegocio({ dealId }: { dealId: string }) {
  const t = useTranslations("negocios.exportacao");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function exportar() {
    setGerando(true);
    setErro(null);
    const r = await exportarNegocioAcao(dealId);
    setGerando(false);
    if (r.erro || !r.conteudo || !r.nome) return setErro(r.erro ?? "");
    const bytes = Uint8Array.from(atob(r.conteudo), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = r.nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return (
    <div className="space-y-2">
      <AvisoDeSimulacao compacto texto={t("aviso")} />
      {erro && <Aviso>{erro}</Aviso>}
      <button
        type="button"
        onClick={exportar}
        disabled={gerando}
        title={t("ajuda")}
        className="border-border text-text hover:border-primary rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
      >
        {gerando ? t("gerando") : t("botao")}
      </button>
    </div>
  );
}
