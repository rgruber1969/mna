"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { exportarLimpezaDaAuditoriaAcao } from "@/app/acoes/auditoria";
import { AvisoDeSimulacao } from "@/components/ui/aviso-de-simulacao";
import { Aviso } from "@/components/ui/basicos";

/**
 * Limpeza da auditoria com exportação (item 21, simulada): mostra a retenção
 * definida pela RGRUBER, quantos eventos estão além dela e exporta esse
 * período em PDF ou XLSX. Na demonstração, nada é apagado.
 */
export function LimpezaDaAuditoria({ meses, antigos }: { meses: number; antigos: number }) {
  const t = useTranslations("auditoria.limpeza");
  const [gerando, setGerando] = useState<"pdf" | "xlsx" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  async function exportar(formato: "pdf" | "xlsx") {
    setGerando(formato);
    setErro(null);
    const r = await exportarLimpezaDaAuditoriaAcao(formato);
    setGerando(null);
    if (r.erro || !r.conteudo || !r.nome) return setErro(r.erro ?? "");
    const bytes = Uint8Array.from(atob(r.conteudo), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: r.tipo }));
    const a = document.createElement("a");
    a.href = url;
    a.download = r.nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return (
    <section>
      <h2 className="text-text mb-1 text-base font-semibold">{t("titulo")}</h2>
      <AvisoDeSimulacao texto={t("aviso")} />
      <p className="text-muted mb-3 text-sm">{t("explicacao", { meses, antigos })}</p>
      {erro && <Aviso>{erro}</Aviso>}
      <div className="flex flex-wrap gap-2">
        {(["pdf", "xlsx"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => exportar(f)}
            disabled={gerando !== null}
            className="border-border text-text hover:border-primary rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {gerando === f ? t("gerando") : t(f)}
          </button>
        ))}
        <button
          type="button"
          disabled
          title={t("limparEmBreve")}
          className="border-danger/40 text-danger cursor-not-allowed rounded-md border px-3 py-2 text-sm font-medium opacity-60"
        >
          {t("limpar")}
        </button>
      </div>
      <p className="text-muted mt-1 text-xs">{t("limparEmBreve")}</p>
    </section>
  );
}
