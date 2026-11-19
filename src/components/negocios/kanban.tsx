"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { moverNegocioParaEtapaAcao, painelDoNegocioAcao } from "@/app/acoes/kanban";
import { EtapasDoNegocio } from "@/components/negocios/etapas";
import { Aviso } from "@/components/ui/basicos";

/**
 * Kanban de negócios (item 15): colunas = etapas padrão; cartão = negócio, na
 * coluna da etapa atual. Arrastar (ou "Mover para") muda a etapa, depois de
 * confirmar; clicar abre o painel lateral com as etapas e o histórico, sem
 * sair do quadro.
 */

type Cartao = {
  id: string;
  nome: string;
  nomeInterno: string | null;
  vendedoras: string[] | null;
  coordenadores: string[];
  situacao: string;
  etapa: string | null;
  etapasEmParalelo: number;
  colunaId: string;
  podeMover: boolean;
  funil: Record<string, string[]> | null;
};
type Painel = Awaited<ReturnType<typeof painelDoNegocioAcao>>;

const FUNIL = ["prospectada", "teaser", "nda", "proposta", "escolhida"] as const;

export function KanbanDeNegocios({
  colunas,
  cartoes,
  hoje,
}: {
  colunas: { id: string; nome: string }[];
  cartoes: Cartao[];
  hoje: string;
}) {
  const t = useTranslations("negocios.kanban");
  const ts = useTranslations("negocios.situacoes");
  const tf = useTranslations("negocios.funil");
  const router = useRouter();
  const [movendo, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [arrastado, setArrastado] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [aberto, setAberto] = useState<{ cartao: Cartao; painel: Painel | undefined } | null>(null);
  const todas = [{ id: "a-iniciar", nome: t("aIniciar") }, ...colunas];

  function mover(id: string, colunaId: string) {
    const c = cartoes.find((x) => x.id === id);
    const destino = todas.find((x) => x.id === colunaId);
    if (!c || !destino || c.colunaId === colunaId || colunaId === "a-iniciar") return;
    if (!window.confirm(t("confirmarMover", { negocio: c.nome, etapa: destino.nome }))) return;
    iniciar(async () => {
      const r = await moverNegocioParaEtapaAcao(id, colunaId);
      setErro(r.erro ?? null);
      if (!r.erro) router.refresh();
    });
  }

  async function abrir(c: Cartao) {
    setAberto({ cartao: c, painel: undefined });
    const painel = await painelDoNegocioAcao(c.id);
    setAberto({ cartao: c, painel });
  }

  return (
    <div>
      {erro && <Aviso>{erro}</Aviso>}
      <div
        className={`grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-2 overflow-x-auto pb-2 ${movendo ? "opacity-70" : ""}`}
      >
        {todas.map((coluna) => {
          const daColuna = cartoes.filter((c) => c.colunaId === coluna.id);
          return (
            <section
              key={coluna.id}
              aria-label={coluna.nome}
              onDragOver={(e) => {
                if (!arrastado || coluna.id === "a-iniciar") return;
                e.preventDefault();
                setSobre(coluna.id);
              }}
              onDragLeave={() => setSobre((x) => (x === coluna.id ? null : x))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                if (arrastado) mover(arrastado, coluna.id);
                setArrastado(null);
              }}
              className={`bg-background min-w-0 rounded-lg border p-2 ${sobre === coluna.id ? "border-primary" : "border-border"}`}
            >
              <h3 className="text-muted mb-2 flex items-center justify-between gap-1 px-1 text-xs font-semibold tracking-wide uppercase">
                <span className="truncate" title={coluna.nome}>
                  {coluna.nome}
                </span>
                <span className="font-normal">{daColuna.length}</span>
              </h3>
              <ul className="flex min-h-16 flex-col gap-2">
                {daColuna.map((c) => (
                  <li
                    key={c.id}
                    draggable={c.podeMover}
                    onDragStart={(e) => {
                      setArrastado(c.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setArrastado(null)}
                    className={`border-border bg-surface rounded-md border p-2 text-xs shadow-sm ${c.podeMover ? "cursor-grab" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => abrir(c)}
                      className="text-text block w-full text-left font-semibold break-words"
                    >
                      {c.nome}
                    </button>
                    {c.nomeInterno && <p className="text-muted break-words">{c.nomeInterno}</p>}
                    {c.vendedoras && c.vendedoras.length > 0 && (
                      <p className="text-muted mt-1 break-words">{c.vendedoras.join(", ")}</p>
                    )}
                    {c.situacao !== "andamento" && (
                      <p className="text-warning mt-1 font-medium">{ts(c.situacao as never)}</p>
                    )}
                    {c.etapasEmParalelo > 0 && (
                      <p className="text-muted mt-1">{t("emParalelo", { n: c.etapasEmParalelo })}</p>
                    )}
                    {c.funil && (
                      <ul className="mt-1 space-y-0.5">
                        {FUNIL.filter((s) => c.funil![s]?.length).map((s) => (
                          <li key={s} className="text-muted break-words">
                            <span className="text-text font-medium">{tf(s)}:</span> {c.funil![s].join(", ")}
                          </li>
                        ))}
                      </ul>
                    )}
                    {c.coordenadores.length > 0 && (
                      <p className="text-muted mt-1">{c.coordenadores.join(", ")}</p>
                    )}
                    {c.podeMover && (
                      <select
                        value=""
                        onChange={(e) => e.target.value && mover(c.id, e.target.value)}
                        aria-label={t("moverPara", { negocio: c.nome })}
                        className="border-border bg-background text-muted mt-2 w-full rounded border px-1 py-0.5 text-xs"
                      >
                        <option value="">{t("moverParaCurto")}</option>
                        {colunas
                          .filter((x) => x.id !== c.colunaId)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nome}
                            </option>
                          ))}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {aberto && (
        <div
          className="fixed inset-0 z-40 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={aberto.cartao.nome}
        >
          <button
            type="button"
            aria-label={t("fechar")}
            onClick={() => setAberto(null)}
            className="bg-backdrop/40 absolute inset-0"
          />
          <aside className="bg-surface relative h-full w-full max-w-2xl overflow-y-auto p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-text text-lg font-bold">{aberto.cartao.nome}</h2>
                {aberto.cartao.nomeInterno && (
                  <p className="text-muted text-sm">{aberto.cartao.nomeInterno}</p>
                )}
                <p className="text-muted text-sm">
                  {[
                    ts(aberto.cartao.situacao as never),
                    aberto.cartao.etapa && t("etapa", { etapa: aberto.cartao.etapa }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="flex items-center gap-3">
                <Link href={`/negocios/${aberto.cartao.id}`} className="text-primary text-sm font-medium">
                  {t("abrirNegocio")}
                </Link>
                <button type="button" onClick={() => setAberto(null)} className="text-muted text-sm">
                  {t("fechar")}
                </button>
              </span>
            </div>
            {aberto.painel === undefined ? (
              <p className="text-muted text-sm">{t("carregando")}</p>
            ) : aberto.painel === null ? (
              <p className="text-muted text-sm">{t("semAcesso")}</p>
            ) : (
              <>
                {aberto.painel.etapas && (
                  <section className="mb-5">
                    <h3 className="text-accent mb-2 text-xs font-semibold tracking-widest uppercase">
                      {t("etapas")}
                    </h3>
                    <EtapasDoNegocio
                      dealId={aberto.cartao.id}
                      etapas={aberto.painel.etapas.etapas}
                      podeIncluir={aberto.painel.etapas.podeIncluir}
                      podeExcluir={aberto.painel.etapas.podeExcluir}
                      hoje={hoje}
                    />
                  </section>
                )}
                <section>
                  <h3 className="text-accent mb-2 text-xs font-semibold tracking-widest uppercase">
                    {t("ultimosEventos")}
                  </h3>
                  {aberto.painel.historico.length === 0 ? (
                    <p className="text-muted text-sm">{t("semEventos")}</p>
                  ) : (
                    <ul className="divide-border divide-y text-sm">
                      {aberto.painel.historico.map((h, i) => (
                        <li key={i} className="py-1.5">
                          {h.texto}
                          <span className="text-muted block text-xs">{h.detalhe}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/negocios/${aberto.cartao.id}?aba=historico`}
                    className="text-primary mt-2 inline-block text-xs"
                  >
                    {t("verHistorico")}
                  </Link>
                </section>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
