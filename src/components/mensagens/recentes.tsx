"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { definirMeuResumoAcao } from "@/app/acoes/mensagens";
import { rotuloDoCanal } from "@/components/negocios/mensagens";
import type { MensagemRecente } from "@/server/services/mensagens";

/** Lista das últimas conversas com mensagens (página Mensagens e tela principal). */
export function MensagensRecentes({
  conversas,
  compacta = false,
}: {
  conversas: MensagemRecente[];
  compacta?: boolean;
}) {
  const t = useTranslations("mensagens");
  const formato = useFormatter();
  const agora = useNow({ updateInterval: 60_000 });
  if (conversas.length === 0) return <p className="text-muted text-sm">{t("nenhumaRecente")}</p>;
  return (
    <ul className="divide-border divide-y">
      {conversas.map((c) => (
        <li key={c.link} className="py-2">
          <Link href={c.link} className="group block">
            <span className="flex items-baseline justify-between gap-2">
              <span className={`text-text min-w-0 truncate text-sm ${c.naoLidas > 0 ? "font-semibold" : ""}`}>
                {c.negocio}
                {" · "}
                {c.alvo.tipo === "deal" ? t("geral") : `${t(`tipos.${c.alvo.tipo}`)}: ${c.rotulo}`}
              </span>
              <span className="text-muted shrink-0 text-xs">
                {formato.relativeTime(new Date(c.em), agora)}
              </span>
            </span>
            <span className="text-muted block truncate text-xs">
              {!compacta && `${rotuloDoCanal(t, c.canal)} · `}
              <span className="text-text">{c.autor ?? t("removido")}:</span> {c.trecho}
            </span>
            {c.naoLidas > 0 && (
              <span className="bg-danger text-primary-foreground mt-0.5 inline-block rounded-full px-1.5 text-xs font-semibold">
                {t("naoLidas", { n: c.naoLidas })}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Cada pessoa liga ou desliga o próprio resumo de mensagens por e-mail. */
export function OpcaoDoResumo({ ligado, horas }: { ligado: boolean; horas: number }) {
  const t = useTranslations("mensagens");
  const [valor, setValor] = useState(ligado);
  return (
    <label className="border-border bg-surface mb-4 flex items-start gap-2 rounded-md border p-3 text-sm">
      <input
        type="checkbox"
        checked={valor}
        onChange={async (e) => {
          setValor(e.target.checked);
          await definirMeuResumoAcao(e.target.checked);
        }}
        className="mt-0.5"
      />
      <span>
        <span className="text-text block font-medium">{t("resumoEmail")}</span>
        <span className="text-muted block text-xs">{t("resumoAjuda", { horas })}</span>
      </span>
    </label>
  );
}
