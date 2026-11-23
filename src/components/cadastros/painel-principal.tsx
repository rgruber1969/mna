"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { salvarDiasDeAvisoDoPrazoAcao } from "@/app/acoes/negocios";
import { useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso } from "@/components/ui/basicos";
import { CORES_DO_NIVEL, DIAS_DE_AVISO_MAXIMO, DIAS_DE_AVISO_MINIMO } from "@/config/prazos";

const somar = (data: string, dias: number) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const br = (d: string) => d.split("-").reverse().join("/");

/** Configurações → Painel principal: dias de antecedência do amarelo, com prévia das três situações. */
export function FormPainelPrincipal({ dias, hoje }: { dias: number; hoje: string }) {
  const t = useTranslations("configuracoes.painel");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(salvarDiasDeAvisoDoPrazoAcao);
  const [n, setN] = useState(dias);
  const valido = Number.isInteger(n) && n >= DIAS_DE_AVISO_MINIMO && n <= DIAS_DE_AVISO_MAXIMO;
  const linhas = [
    { nivel: "atrasado" as const, rotulo: t("vencido"), quando: t("depoisDoPrazo") },
    {
      nivel: "proximo" as const,
      rotulo: t("venceEm", { n: valido ? n : dias }),
      quando: t("ate", { data: br(somar(hoje, valido ? n : dias)) }),
    },
    {
      nivel: "emDia" as const,
      rotulo: t("emDia"),
      quando: t("aPartirDe", { data: br(somar(hoje, (valido ? n : dias) + 1)) }),
    },
  ];
  return (
    <form action={salvar} className="max-w-md">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <p className="text-text text-sm font-medium">{t("titulo")}</p>
      <p className="text-muted mb-3 text-xs">{t("explicacao")}</p>
      <label className="mb-4 flex items-center gap-2">
        <span className="sr-only">{t("dias")}</span>
        <input
          name="diasAvisoPrazo"
          type="number"
          min={DIAS_DE_AVISO_MINIMO}
          max={DIAS_DE_AVISO_MAXIMO}
          value={Number.isNaN(n) ? "" : n}
          onChange={(e) => setN(e.target.valueAsNumber)}
          required
          aria-label={t("dias")}
          className="border-border bg-background text-text focus:border-primary w-20 rounded-md border px-3 py-2 text-base font-semibold outline-none"
        />
        <span className="text-muted text-sm">{t("unidade")}</span>
      </label>
      <ul className="mb-4 space-y-2">
        {linhas.map((l) => (
          <li key={l.nivel} className="flex items-center justify-between gap-3 text-xs">
            <span
              className={`${CORES_DO_NIVEL[l.nivel].fundo} ${CORES_DO_NIVEL[l.nivel].texto} inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold`}
            >
              <span className={`${CORES_DO_NIVEL[l.nivel].faixa} h-1.5 w-1.5 rounded-full`} />
              {l.rotulo}
            </span>
            <span className="text-muted">{l.quando}</span>
          </li>
        ))}
      </ul>
      <button
        type="submit"
        disabled={salvando || !valido}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {salvando ? t("salvando") : t("salvar")}
      </button>
    </form>
  );
}
