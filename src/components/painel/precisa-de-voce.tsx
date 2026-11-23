"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CORES_DO_NIVEL, type NivelDoPrazo } from "@/config/prazos";

type Prazo = {
  data: string;
  tipo: "tarefa" | "etapa" | "exclusividade" | "participacao";
  texto: string;
  negocio: string;
  link: string;
  nivel: NivelDoPrazo;
};
type Mensagem = { autor: string | null; negocio: string; trecho: string; link: string };

const br = (d: string) => d.split("-").reverse().join("/").slice(0, 5);

/** Ícones pequenos de cada tipo (traço, mesma família dos ícones do menu). */
const DESENHO: Record<Prazo["tipo"] | "mensagem", string> = {
  tarefa: "M9 4h6v3H9zM7 6H5v15h14V6h-2M9 13l2 2 4-4",
  etapa: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v7h-4z",
  exclusividade: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  participacao: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1",
  mensagem: "M4 5h16v11H9l-5 4z",
};

function Icone({ tipo, nivel }: { tipo: keyof typeof DESENHO; nivel?: NivelDoPrazo }) {
  const cor =
    nivel === "atrasado" || nivel === "proximo"
      ? `${CORES_DO_NIVEL[nivel].fundo} ${CORES_DO_NIVEL[nivel].texto}`
      : "bg-surface text-muted";
  return (
    <span className={`${cor} grid h-7 w-7 shrink-0 place-items-center rounded-lg`} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        <path d={DESENHO[tipo]} />
      </svg>
    </span>
  );
}

/**
 * "Precisa de você": faixa da semana (um ponto por prazo, na cor da situação;
 * clicar no dia filtra) e a lista única de vencidos → mensagens novas →
 * prazos por data, cada linha com a sua ação.
 */
export function PrecisaDeVoce({
  hoje,
  semana,
  prazos,
  mensagens,
}: {
  hoje: string;
  semana: { data: string; niveis: NivelDoPrazo[] }[];
  prazos: Prazo[];
  mensagens: Mensagem[];
}) {
  const t = useTranslations("painel.precisa");
  const [dia, setDia] = useState<string | null>(null);
  const segunda = semana[0]?.data ?? hoje;
  const vencidosAntes = prazos.filter((p) => p.nivel === "atrasado" && p.data < segunda).length;
  const vencidos = prazos.filter((p) => p.nivel === "atrasado");
  const futuros = prazos.filter((p) => p.nivel !== "atrasado");
  const nomeDoDia = (d: string) =>
    new Date(`${d}T12:00:00Z`)
      .toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" })
      .replace(".", "");

  type Linha =
    | { chave: string; tipo: Prazo["tipo"]; prazo: Prazo }
    | { chave: string; tipo: "mensagem"; mensagem: Mensagem };
  const linhas: Linha[] = dia
    ? prazos.filter((p) => p.data === dia).map((p, i) => ({ chave: `d${i}`, tipo: p.tipo, prazo: p }))
    : [
        ...vencidos.map((p, i) => ({ chave: `v${i}`, tipo: p.tipo, prazo: p })),
        ...mensagens.map((m, i) => ({ chave: `m${i}`, tipo: "mensagem" as const, mensagem: m })),
        ...futuros.slice(0, 5).map((p, i) => ({ chave: `f${i}`, tipo: p.tipo, prazo: p })),
      ];
  const restantes = dia ? 0 : Math.max(0, futuros.length - 5);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label={t("semana")}>
        {semana.map((s) => {
          const ativo = dia === s.data;
          const eHoje = s.data === hoje;
          return (
            <button
              key={s.data}
              type="button"
              onClick={() => setDia(ativo ? null : s.data)}
              aria-pressed={ativo}
              aria-label={`${nomeDoDia(s.data)} ${br(s.data)}${eHoje ? `, ${t("hoje")}` : ""}`}
              className={`rounded-lg py-1.5 text-[11px] transition-colors ${
                ativo
                  ? "bg-primary text-primary-foreground"
                  : eHoje
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-surface"
              }`}
            >
              <span className="block capitalize">{nomeDoDia(s.data)}</span>
              <b
                className={`block text-sm tabular-nums ${ativo ? "" : eHoje ? "text-primary" : "text-text"}`}
              >
                {s.data.slice(8)}
              </b>
              <span className="mt-0.5 flex h-1.5 justify-center gap-0.5">
                {s.niveis.slice(0, 4).map((n, i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full ${CORES_DO_NIVEL[n].faixa}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {dia ? (
        <p className="text-muted mt-2 flex items-center justify-between text-xs">
          {t("filtrando", { dia: `${nomeDoDia(dia)} ${br(dia)}` })}
          <button type="button" onClick={() => setDia(null)} className="text-primary font-semibold">
            {t("limparDia")}
          </button>
        </p>
      ) : (
        vencidosAntes > 0 && (
          <p className="bg-danger-soft text-danger mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold">
            {t("vencidosAntes", { n: vencidosAntes })}
          </p>
        )
      )}
      {linhas.length === 0 ? (
        <p className="text-muted mt-3 text-sm">{t("vazio")}</p>
      ) : (
        <ul className="divide-border mt-1 divide-y">
          {linhas.map((l) =>
            l.tipo === "mensagem" ? (
              <li key={l.chave} className="flex items-start gap-2.5 py-2">
                <Icone tipo="mensagem" />
                <span className="min-w-0 flex-1">
                  <span className="text-text block truncate text-sm font-semibold">
                    {[l.mensagem.autor, l.mensagem.negocio].filter(Boolean).join(" · ")}
                  </span>
                  <span className="text-muted block truncate text-xs">{l.mensagem.trecho}</span>
                </span>
                <Link href={l.mensagem.link} className="text-primary shrink-0 pt-0.5 text-xs font-bold">
                  {t("acoes.mensagem")}
                </Link>
              </li>
            ) : (
              <li key={l.chave} className="flex items-start gap-2.5 py-2">
                <Icone tipo={l.tipo} nivel={l.prazo.nivel} />
                <span className="min-w-0 flex-1">
                  <span className="text-text block truncate text-sm font-semibold">
                    {t(`titulos.${l.tipo}`, { texto: l.prazo.texto })}
                  </span>
                  <span className="text-muted block truncate text-xs">
                    {t(`tipos.${l.tipo}`)} · {l.prazo.negocio} ·{" "}
                    <span className={l.prazo.nivel === "atrasado" ? "text-danger font-semibold" : ""}>
                      {l.prazo.nivel === "atrasado"
                        ? t("venceu", { data: br(l.prazo.data) })
                        : t("vence", { data: `${nomeDoDia(l.prazo.data)} ${br(l.prazo.data)}` })}
                    </span>
                  </span>
                </span>
                <Link href={l.prazo.link} className="text-primary shrink-0 pt-0.5 text-xs font-bold">
                  {t(`acoes.${l.tipo}`)}
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
      {restantes > 0 && <p className="text-muted pt-1 text-xs">{t("mais", { n: restantes })}</p>}
    </div>
  );
}
