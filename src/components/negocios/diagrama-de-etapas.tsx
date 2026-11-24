"use client";

import { useMemo, useRef, useState, type PointerEvent as EventoDePonteiro } from "react";
import { useTranslations } from "next-intl";
import { AvisoDeSimulacao } from "@/components/ui/aviso-de-simulacao";

/**
 * Diagrama das etapas do negócio (item 10, **simulado**): as etapas em
 * colunas, da esquerda para a direita, com setas de dependência; etapas sem
 * dependência ficam na coluna da anterior (em paralelo); subetapas dentro da
 * etapa-mãe. Navegável (clicar ou Enter mostra os detalhes, zoom). A edição
 * gráfica é só demonstração: arrastar move as caixas na tela e nada é
 * gravado (a edição real é pela lista).
 */

import { CABECALHO, LARGURA, SUB, montarDiagrama, type Caixa, type EtapaDoDiagrama } from "./diagrama-layout";

const estilo = {
  nao_iniciada: { caixa: "fill-surface stroke-border", ponto: "fill-border" },
  andamento: { caixa: "fill-primary-soft stroke-primary", ponto: "fill-primary" },
  concluida: { caixa: "fill-success-soft stroke-success", ponto: "fill-success" },
  pulada: { caixa: "fill-background stroke-border", ponto: "fill-border" },
} as const;

const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);
const cortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function DiagramaDeEtapas({
  etapas,
  simulado,
  documentos,
  tarefas,
}: {
  etapas: EtapaDoDiagrama[];
  simulado: boolean;
  documentos?: Record<string, number>;
  tarefas?: Record<string, number>;
}) {
  const t = useTranslations("etapas.diagrama");
  const te = useTranslations("etapas");
  const { caixas, largura, altura } = useMemo(() => montarDiagrama(etapas), [etapas]);
  const [escolhida, setEscolhida] = useState<string | null>(
    etapas.find((e) => e.situacao === "andamento")?.id ?? etapas[0]?.id ?? null,
  );
  const [zoom, setZoom] = useState(1);
  const [editando, setEditando] = useState(false);
  const [desvios, setDesvios] = useState<Record<string, { dx: number; dy: number }>>({});
  const arrasto = useRef<{ id: string; x: number; y: number; dx: number; dy: number } | null>(null);

  if (etapas.length === 0) return <p className="text-muted text-sm">{t("vazio")}</p>;

  const pos = (c: Caixa) => ({
    x: c.x + (desvios[c.etapa.id]?.dx ?? 0),
    y: c.y + (desvios[c.etapa.id]?.dy ?? 0),
  });
  const porId = new Map(caixas.map((c) => [c.etapa.id, c]));
  const setas = caixas.flatMap((c) => {
    const dep = c.etapa.dependeDeId ? porId.get(c.etapa.dependeDeId) : undefined;
    if (!dep) return [];
    const a = pos(dep);
    const b = pos(c);
    const x1 = a.x + LARGURA;
    const y1 = a.y + CABECALHO / 2;
    const x2 = b.x - 4;
    const y2 = b.y + CABECALHO / 2;
    const meio = Math.max(24, (x2 - x1) / 2);
    return [{ id: c.etapa.id, d: `M${x1},${y1} C${x1 + meio},${y1} ${x2 - meio},${y2} ${x2},${y2}` }];
  });
  const detalhe = escolhida ? porId.get(escolhida)?.etapa : undefined;

  function comecar(e: EventoDePonteiro<SVGGElement>, id: string) {
    if (!editando) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const d = desvios[id] ?? { dx: 0, dy: 0 };
    arrasto.current = { id, x: e.clientX, y: e.clientY, ...d };
  }
  function mover(e: EventoDePonteiro<SVGGElement>) {
    const a = arrasto.current;
    if (!a) return;
    setDesvios((ds) => ({
      ...ds,
      [a.id]: { dx: a.dx + (e.clientX - a.x) / zoom, dy: a.dy + (e.clientY - a.y) / zoom },
    }));
  }

  const botao =
    "border-border text-text hover:border-primary rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50";
  return (
    <div>
      {simulado && <AvisoDeSimulacao texto={t("aviso")} />}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex gap-1" role="group" aria-label={t("zoom")}>
          <button type="button" className={botao} onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}>
            −
          </button>
          <button type="button" className={botao} onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className={botao} onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}>
            +
          </button>
        </span>
        <button
          type="button"
          aria-pressed={editando}
          onClick={() => setEditando((x) => !x)}
          className={`${botao} ${editando ? "border-primary text-primary" : ""}`}
        >
          {editando ? t("sairDaEdicao") : t("editarGraficamente")}
        </button>
        {Object.keys(desvios).length > 0 && (
          <button type="button" className={botao} onClick={() => setDesvios({})}>
            {t("desfazer")}
          </button>
        )}
        <span className="text-muted ml-auto flex flex-wrap gap-3 text-xs">
          {(["nao_iniciada", "andamento", "concluida", "pulada"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <svg width="10" height="10" aria-hidden="true">
                <circle cx="5" cy="5" r="4" className={estilo[s].ponto} />
              </svg>
              {te(`situacoes.${s}`)}
            </span>
          ))}
        </span>
      </div>
      {editando && <p className="text-warning mb-2 text-xs">{t("edicaoNaoGrava")}</p>}
      <div className="border-border bg-background overflow-auto rounded-lg border">
        <svg
          role="group"
          aria-label={t("rotulo")}
          width={largura * zoom}
          height={altura * zoom}
          viewBox={`0 0 ${largura} ${altura}`}
          className="block"
        >
          <defs>
            <marker
              id="seta-etapa"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" className="fill-muted" />
            </marker>
          </defs>
          {setas.map((s) => (
            <path
              key={s.id}
              d={s.d}
              className="stroke-muted fill-none"
              strokeWidth={1.5}
              markerEnd="url(#seta-etapa)"
            />
          ))}
          {caixas.map((c) => {
            const { x, y } = pos(c);
            const e = c.etapa;
            const ativa = e.id === escolhida;
            const datas = [br(e.inicioReal ?? e.inicioPrevisto), br(e.fimReal ?? e.fimPrevisto)];
            return (
              <g
                key={e.id}
                role="button"
                tabIndex={0}
                aria-pressed={ativa}
                aria-label={`${e.nome}: ${te(`situacoes.${e.situacao}`)}`}
                transform={`translate(${x},${y})`}
                className={`outline-none ${editando ? "cursor-move" : "cursor-pointer"} [&:focus-visible>rect]:stroke-[3]`}
                onClick={() => setEscolhida(e.id)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    setEscolhida(e.id);
                  }
                }}
                onPointerDown={(ev) => comecar(ev, e.id)}
                onPointerMove={mover}
                onPointerUp={() => (arrasto.current = null)}
              >
                <rect
                  width={LARGURA}
                  height={c.altura}
                  rx={10}
                  className={estilo[e.situacao].caixa}
                  strokeWidth={ativa ? 2.5 : 1.25}
                  strokeDasharray={e.situacao === "pulada" ? "5 4" : undefined}
                />
                <circle cx={14} cy={18} r={4.5} className={estilo[e.situacao].ponto} />
                <text x={26} y={22} className="fill-text text-[13px] font-semibold">
                  <title>{e.nome}</title>
                  {cortar(e.nome, 24)}
                </text>
                <text x={14} y={42} className="fill-muted text-[11px]">
                  {datas[0] || datas[1] ? `${datas[0] ?? "…"} → ${datas[1] ?? "…"}` : te("semDatasCurto")}
                </text>
                {e.subetapas.map((s, i) => (
                  <g key={s.id} transform={`translate(10,${CABECALHO + i * SUB})`}>
                    <rect width={LARGURA - 20} height={SUB - 4} rx={6} className={estilo[s.situacao].caixa} />
                    <circle cx={10} cy={(SUB - 4) / 2} r={3.5} className={estilo[s.situacao].ponto} />
                    <text x={20} y={(SUB - 4) / 2 + 4} className="fill-text text-[11px]">
                      <title>{s.nome}</title>
                      {cortar(s.nome, 28)}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-muted mt-2 text-xs">{t("legenda")}</p>
      {detalhe && (
        <section aria-live="polite" className="border-border mt-3 rounded-lg border p-3 text-sm">
          <h3 className="text-text font-semibold">{detalhe.nome}</h3>
          <p className="text-muted text-xs">
            {[
              te(`situacoes.${detalhe.situacao}`),
              (detalhe.inicioPrevisto || detalhe.fimPrevisto) &&
                te("previsto", {
                  de: br(detalhe.inicioPrevisto) ?? "…",
                  ate: br(detalhe.fimPrevisto) ?? "…",
                }),
              (detalhe.inicioReal || detalhe.fimReal) &&
                te("real", { de: br(detalhe.inicioReal) ?? "…", ate: br(detalhe.fimReal) ?? "…" }),
              detalhe.dependeDe ? te("dependeDeNome", { nome: detalhe.dependeDe }) : t("semDependencia"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {detalhe.subetapas.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {detalhe.subetapas.map((s) => (
                <li key={s.id}>
                  <span className="text-text">{s.nome}</span>
                  <span className="text-muted">
                    {" "}
                    · {te(`situacoes.${s.situacao}`)}
                    {s.dependeDe && ` · ${te("dependeDeNome", { nome: s.dependeDe })}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <span className="mt-2 flex gap-3">
            {documentos && (
              <a href={`?aba=documentos&etapa=${detalhe.id}`} className="text-primary text-xs">
                {te("documentosDaEtapa", { n: documentos[detalhe.id] ?? 0 })}
              </a>
            )}
            {tarefas && (
              <a href={`?aba=tarefas&etapa=${detalhe.id}`} className="text-primary text-xs">
                {te("tarefasDaEtapa", { n: tarefas[detalhe.id] ?? 0 })}
              </a>
            )}
          </span>
        </section>
      )}
    </div>
  );
}
