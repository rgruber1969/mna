"use client";

import { useRouter } from "next/navigation";

import { mudarSituacaoDaTarefaAcao } from "@/app/acoes/tarefas";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { TracoDeslizante, useIndicadorDeslizante } from "@/components/ui/indicador";
import { pedirAba, useAbas } from "@/components/ui/abas";
import { Avatar } from "@/components/ui/basicos";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { painelDoNegocioAcao } from "@/app/acoes/kanban";
import { EtapasDoNegocio } from "@/components/negocios/etapas";
import { DataRoomDoNegocio } from "@/components/negocios/documentos";
import { TarefasDoNegocio } from "@/components/negocios/tarefas";
import { MensagensDoNegocio } from "@/components/negocios/mensagens";
import { HistoricoPaginado } from "@/components/negocios/historico";
import { CORES_DO_NIVEL, diasAte, nivelDoPrazo, type NivelDoPrazo } from "@/config/prazos";

/**
 * Detalhe do negócio aberto no kanban (propostas de layout v3, modelo A em
 * painel central): cabeçalho-resumo, linha do tempo das etapas com a situação
 * de cada uma, abas horizontais (Resumo, Etapas, Pessoas e empresas,
 * Atividade, Documentos, Histórico) e "Próximo passo" no topo do Resumo.
 */

export type Painel = Awaited<ReturnType<typeof painelDoNegocioAcao>>;
export type CartaoDoPainel = {
  id: string;
  nome: string;
  nomeInterno: string | null;
  situacao: string;
  etapa: string | null;
  coordenadores: string[];
  funil: Record<string, string[]> | null;
  prazo: string | null;
  nivelDoPrazo: NivelDoPrazo | null;
  fimDaEtapa: string | null;
  valorEstimado: number | null;
};

const FUNIL = ["prospectada", "teaser", "nda", "proposta", "escolhida"] as const;
const br = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "");
const curta = (d: string) => br(d).slice(0, 5);
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Chip({ nivel, children }: { nivel: NivelDoPrazo | null; children: ReactNode }) {
  const c = nivel ? CORES_DO_NIVEL[nivel] : null;
  return (
    <span
      className={`${c ? `${c.fundo} ${c.texto}` : "bg-primary-soft text-primary"} inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap`}
    >
      {c && <span className={`${c.faixa} h-1.5 w-1.5 rounded-full`} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Linha do tempo das etapas principais: verde/vermelho nas passadas, semáforo na atual, data estimada nas próximas. */
type EtapaDaLinha = NonNullable<NonNullable<Painel>["etapas"]>["etapas"][number];

/**
 * Linha das etapas principais (painel do kanban e tela do negócio). `atalho`
 * aparece embaixo da etapa de prospecção: Funil de compradoras e Ofertas são
 * o mesmo assunto (as ofertas são das compradoras), então é um atalho só.
 */
export function LinhaDasEtapas({
  etapas,
  hoje,
  dias,
  atalho,
}: {
  etapas: EtapaDaLinha[];
  hoje: string;
  dias: number;
  atalho?: { href: string; rotulo: string } | null;
}) {
  const t = useTranslations("negocios.kanban.painel");
  // Etapa da prospecção: a de nome "Prospecção" (ou a primeira, na falta dela).
  const daProspeccao = etapas.find((e) => /prospec/i.test(e.nome))?.id ?? etapas[0]?.id;
  if (etapas.length === 0) return null;
  return (
    <ol className="flex items-start" aria-label={t("linhaDoTempo")}>
      {etapas.map((e, i) => {
        const feita = e.situacao === "concluida" || e.situacao === "pulada";
        const atrasou = feita && e.fimPrevisto && e.fimReal && e.fimReal > e.fimPrevisto;
        const atual = e.situacao === "andamento";
        const nivelAtual = atual ? nivelDoPrazo(e.fimPrevisto, hoje, dias) : null;
        const bolinha = feita
          ? atrasou
            ? "bg-danger border-danger text-primary-foreground"
            : "bg-success border-success text-primary-foreground"
          : atual
            ? nivelAtual === "atrasado"
              ? "border-danger text-danger ring-danger-soft ring-4"
              : nivelAtual === "proximo"
                ? "border-warning-fill text-warning ring-warning-soft ring-4"
                : "border-primary text-primary ring-primary-soft ring-4"
            : "border-border text-muted";
        let detalhe: ReactNode = null;
        if (feita)
          detalhe = atrasou ? (
            <span className="text-danger font-semibold">
              {t("atrasou", { n: diasAte(e.fimReal!, e.fimPrevisto!), data: curta(e.fimPrevisto!) })}
            </span>
          ) : (
            <span className="text-success font-semibold">{t("noPrazo")}</span>
          );
        else if (atual) {
          const d = e.fimPrevisto ? diasAte(e.fimPrevisto, hoje) : null;
          detalhe =
            d === null ? (
              <span className="text-muted">{t("semPrevisao")}</span>
            ) : (
              <span className={`${nivelAtual ? CORES_DO_NIVEL[nivelAtual].texto : ""} font-semibold`}>
                {d < 0
                  ? t("diasAtraso", { n: -d })
                  : nivelAtual === "proximo"
                    ? t("emDias", { n: d })
                    : t("emDia")}
              </span>
            );
        } else
          detalhe = (
            <span className="text-muted">{e.fimPrevisto ? t("prev", { data: br(e.fimPrevisto) }) : ""}</span>
          );
        return (
          <li
            key={e.id}
            aria-current={atual ? "step" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-1 px-1 text-center text-[11px] ${atual ? "text-text font-semibold" : "text-muted"}`}
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className="bg-border absolute top-2.5 right-1/2 left-[-50%] -z-0 h-0.5"
              />
            )}
            <span
              className={`${bolinha} bg-background relative z-10 grid h-5 w-5 place-items-center rounded-full border-2 text-[10px] font-bold`}
            >
              {feita ? "✓" : i + 1}
            </span>
            <span className="line-clamp-2">{e.nome}</span>
            {(feita || atual) && e.inicioReal && (
              <span className="text-muted font-normal">
                {feita && e.fimReal
                  ? `${curta(e.inicioReal)} → ${curta(e.fimReal)}`
                  : t("desde", { data: curta(e.inicioReal) })}
              </span>
            )}
            <span className="font-normal">{detalhe}</span>
            {atalho && e.id === daProspeccao && (
              <Link
                href={atalho.href}
                onClick={(e) => pedirAba("compradoras") && e.preventDefault()}
                className="border-primary/40 text-primary hover:bg-primary-soft mt-0.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
              >
                {atalho.rotulo} →
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Resumo do negócio em modo consulta (painel do kanban e tela do negócio):
 * próximo passo, dados principais, valor estimado e o funil de compradoras.
 * Sem `irPara`, troca de aba pelas abas da tela (quando dentro de <Abas>).
 */
export function ResumoDoNegocio({
  painel: p,
  cartao: c0,
  hoje,
  dias,
  irPara,
  aoConcluir,
}: {
  painel: Pick<NonNullable<Painel>, "tarefas" | "resumo"> & {
    participantes?: { id: string; nome: string; foto?: string | null; perfil?: string | null }[];
  };
  cartao: CartaoDoPainel;
  hoje: string;
  dias: number;
  irPara?: (aba: string) => void;
  /** Depois de concluir a tarefa do próximo passo (sem isto, recarrega a tela). */
  aoConcluir?: () => void;
}) {
  const t = useTranslations("negocios.kanban");
  const ts = useTranslations("negocios.situacoes");
  const tf = useTranslations("negocios.funil");
  const abas = useAbas();
  const mudarAba = irPara ?? ((aba: string) => abas?.ativar(aba === "funil" ? "compradoras" : aba));
  const contagem = (x: string) => c0.funil?.[x]?.length ?? 0;
  const chegaram = (i: number) => FUNIL.slice(i).reduce((x, y) => x + contagem(y), 0);
  const totalFunil = chegaram(0);
  return (
    <div className="space-y-4">
      <ProximoPasso
        painel={p}
        cartao={c0}
        hoje={hoje}
        dias={dias}
        irPara={mudarAba}
        aoConcluir={aoConcluir}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {p.resumo?.nomeInterno && <Campo rotulo={t("resumo.nomeInterno")}>{p.resumo.nomeInterno}</Campo>}
          {p.resumo?.tipo && <Campo rotulo={t("resumo.tipo")}>{p.resumo.tipo}</Campo>}
          <Campo rotulo={t("resumo.situacao")}>{ts(c0.situacao as never)}</Campo>
          <Campo rotulo={t("resumo.etapa")}>{c0.etapa ?? t("aIniciar")}</Campo>
          {p.resumo && <Campo rotulo={t("resumo.inicio")}>{br(p.resumo.dataInicio)}</Campo>}
          {p.resumo?.previsaoFechamento && (
            <Campo rotulo={t("resumo.previsao")}>{br(p.resumo.previsaoFechamento)}</Campo>
          )}
          {c0.coordenadores.length > 0 && (
            <Campo rotulo={t("resumo.coordenador")}>{c0.coordenadores.join(", ")}</Campo>
          )}
          <Campo rotulo={t("resumo.valorEstimado")}>
            {p.resumo?.valorEstimado ? reais(Number(p.resumo.valorEstimado)) : "—"}
          </Campo>
          {(p.participantes?.length ?? 0) > 0 && (
            <Campo rotulo={t("resumo.pessoas", { n: p.participantes!.length })}>
              <span className="mt-1 flex items-center" title={p.participantes!.map((x) => x.nome).join(", ")}>
                {p.participantes!.slice(0, 6).map((x, i) => (
                  <span key={x.id} className={`ring-background rounded-full ring-2 ${i > 0 ? "-ml-2" : ""}`}>
                    <Avatar nome={x.nome} foto={x.foto ?? null} tamanho={26} />
                  </span>
                ))}
                {p.participantes!.length > 6 && (
                  <span className="bg-primary-soft text-primary ring-background -ml-2 grid h-[26px] min-w-[26px] place-items-center rounded-full px-1 text-[10px] font-semibold ring-2">
                    +{p.participantes!.length - 6}
                  </span>
                )}
              </span>
            </Campo>
          )}
          {p.resumo?.descricao && (
            <Campo rotulo={t("resumo.descricao")} largo>
              <span className="font-normal">{p.resumo.descricao}</span>
            </Campo>
          )}
        </dl>
        {(p.resumo?.valorEstimado || c0.funil) && (
          <div className="bg-primary-soft space-y-2 rounded-xl p-4">
            {p.resumo?.valorEstimado && (
              <>
                <p className="text-muted text-xs">{t("resumo.valor")}</p>
                <p className="text-text text-2xl leading-none font-bold tabular-nums">
                  {reais(Number(p.resumo.valorEstimado))}
                </p>
              </>
            )}
            {c0.funil && totalFunil > 0 && (
              <>
                <p className="flex items-center justify-between gap-2 pt-2 text-xs">
                  <span className="text-text font-semibold">{t("resumo.funil")}</span>
                  <Link
                    href={`/negocios/${c0.id}?aba=compradoras`}
                    onClick={(e) => pedirAba("compradoras") && e.preventDefault()}
                    className="text-primary font-semibold"
                  >
                    {t("painel.abrirFunil")} →
                  </Link>
                </p>
                <div className="grid grid-cols-[6rem_1fr_1.5rem] items-center gap-x-2 gap-y-1 text-xs">
                  {FUNIL.map((s, i) => (
                    <span key={s} className="contents">
                      <span className="text-muted">{tf(s)}</span>
                      <span className="bg-border h-1.5 overflow-hidden rounded-full">
                        <span
                          className="bg-primary block h-full rounded-full"
                          style={{ width: `${(chegaram(i) / totalFunil) * 100}%` }}
                        />
                      </span>
                      <span className="text-text text-right tabular-nums">{chegaram(i)}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProximoPasso({
  painel,
  cartao,
  hoje,
  dias,
  irPara,
  aoConcluir,
}: {
  painel: Pick<NonNullable<Painel>, "tarefas">;
  cartao: CartaoDoPainel;
  hoje: string;
  dias: number;
  irPara: (aba: string) => void;
  aoConcluir?: () => void;
}) {
  const t = useTranslations("negocios.kanban.painel");
  const router = useRouter();
  const [concluindo, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const abertas = (painel.tarefas?.tarefas ?? [])
    .filter((x) => x.situacao !== "concluida" && x.situacao !== "cancelada")
    .sort((x, y) => (x.prazo ?? "9999").localeCompare(y.prazo ?? "9999"));
  const tarefa = abertas[0];
  const usarTarefa = tarefa && (tarefa.prazo || !cartao.fimDaEtapa || cartao.situacao !== "andamento");
  const data = usarTarefa ? tarefa.prazo : cartao.fimDaEtapa;
  if (!usarTarefa && !(cartao.fimDaEtapa && cartao.etapa))
    return <p className="text-muted bg-surface rounded-xl px-4 py-3 text-sm">{t("semProximo")}</p>;
  const nivel = nivelDoPrazo(data, hoje, dias);
  const cor = nivel ? CORES_DO_NIVEL[nivel] : null;
  const quando = !data
    ? t("semData")
    : data < hoje
      ? t("venceu", { data: br(data) })
      : t("vence", { data: br(data) });
  return (
    <div
      className={`${cor && nivel !== "emDia" ? cor.fundo : "bg-primary-soft"} relative flex flex-wrap items-center gap-3 overflow-hidden rounded-xl py-3 pr-4 pl-5`}
    >
      <span
        aria-hidden="true"
        className={`${cor && nivel !== "emDia" ? cor.faixa : "bg-primary"} absolute inset-y-0 left-0 w-1`}
      />
      <div className={`min-w-0 flex-1 ${cor && nivel !== "emDia" ? cor.texto : "text-primary"}`}>
        <p className="text-[11px] font-bold tracking-wide uppercase">
          {t("proximoPasso")} · {quando}
        </p>
        <p className="text-text truncate text-sm font-semibold">
          {usarTarefa ? tarefa.titulo : t("fimDaEtapa", { etapa: cartao.etapa! })}
        </p>
        {usarTarefa && tarefa.responsaveis.length > 0 && (
          <p className="text-muted truncate text-xs">
            {t("responsaveis", { nomes: tarefa.responsaveis.join(", ") })}
          </p>
        )}
      </div>
      {usarTarefa && (
        <button
          type="button"
          disabled={concluindo}
          onClick={() =>
            iniciar(async () => {
              const r = await mudarSituacaoDaTarefaAcao(tarefa.id, "concluida");
              if (r.erro) return setErro(r.erro);
              setErro(null);
              if (aoConcluir) aoConcluir();
              else router.refresh();
            })
          }
          className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          {concluindo ? t("concluindo") : t("concluir")}
        </button>
      )}
      <button
        type="button"
        onClick={() => irPara(usarTarefa ? "atividade" : "etapas")}
        className="border-border bg-background text-text rounded-full border px-3 py-1.5 text-xs font-semibold"
      >
        {usarTarefa ? t("abrirTarefa") : t("verEtapas")}
      </button>
      {erro && <p className="text-danger w-full text-xs">{erro}</p>}
    </div>
  );
}

function Campo({
  rotulo,
  children,
  largo = false,
}: {
  rotulo: string;
  children: ReactNode;
  largo?: boolean;
}) {
  return (
    <div className={largo ? "sm:col-span-2 lg:col-span-3" : ""}>
      <dt className="text-muted text-[11px]">{rotulo}</dt>
      <dd className="text-text text-sm font-medium">{children}</dd>
    </div>
  );
}

export function PainelDoNegocio({
  cartao: c0,
  painel: p,
  aba,
  mudarAba,
  hoje,
  dias,
  posicao,
  anterior,
  proximo,
  fechar,
  recarregar,
  nomeDaTransicao,
}: {
  cartao: CartaoDoPainel;
  painel: Painel | undefined;
  aba: string;
  mudarAba: (aba: string) => void;
  hoje: string;
  dias: number;
  posicao: { i: number; n: number };
  anterior: (() => void) | null;
  proximo: (() => void) | null;
  fechar: () => void;
  recarregar: (aba: string) => void;
  nomeDaTransicao?: string;
}) {
  const t = useTranslations("negocios.kanban");
  const ts = useTranslations("negocios.situacoes");
  const tf = useTranslations("negocios.funil");
  const tm = useTranslations("mensagens");
  const listaDeAbas = useRef<HTMLDivElement>(null);
  const { estilo: traco, pronto } = useIndicadorDeslizante(listaDeAbas, `${aba}|${p === undefined}`);
  const [filtroAtividade, setFiltroAtividade] = useState<"tudo" | "tarefas" | "mensagens">("tudo");
  const atraso = c0.nivelDoPrazo === "atrasado" && c0.prazo ? -diasAte(c0.prazo, hoje) : 0;
  const tarefasAbertas = (p?.tarefas?.tarefas ?? []).filter(
    (x) => x.situacao !== "concluida" && x.situacao !== "cancelada",
  ).length;
  const mensagens = p?.mensagens;
  const abas = [
    { id: "resumo", rotulo: t("abas.resumo") },
    ...(p?.etapas ? [{ id: "etapas", rotulo: t("abas.etapas") }] : []),
    {
      id: "pessoas",
      rotulo: `${t("abas.pessoas")} (${(p?.empresas.length ?? 0) + (p?.participantes.length ?? 0)})`,
    },
    {
      id: "atividade",
      rotulo:
        mensagens && mensagens.novas > 0
          ? t("abaComNovas", {
              rotulo: `${t("abas.atividade")} (${tarefasAbertas + mensagens.total})`,
              n: mensagens.novas,
            })
          : `${t("abas.atividade")} (${tarefasAbertas + (mensagens?.total ?? 0)})`,
    },
    ...(p?.dataRoom
      ? [{ id: "documentos", rotulo: `${t("abas.documentos")} (${p.dataRoom.documentos.length})` }]
      : []),
    { id: "historico", rotulo: t("abas.historico") },
  ];

  // No body: nenhum ancestral (com transform ou animação) prende o painel e o fundo escurecido.
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={c0.nome}
    >
      <button
        type="button"
        aria-label={t("fechar")}
        onClick={fechar}
        className="bg-backdrop/45 absolute inset-0 animate-[aparecer_200ms_ease-out]"
      />
      <section
        className="bg-background border-border shadow-cartao relative flex max-h-full w-full max-w-6xl flex-col gap-4 overflow-hidden rounded-2xl border p-5 sm:p-6"
        style={{ viewTransitionName: nomeDaTransicao }}
      >
        <header className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {c0.etapa && <Chip nivel={null}>{c0.etapa}</Chip>}
              {c0.situacao !== "andamento" && <Chip nivel="proximo">{ts(c0.situacao as never)}</Chip>}
              {atraso > 0 && <Chip nivel="atrasado">{t("painel.etapaAtrasada", { n: atraso })}</Chip>}
            </div>
            <h2 className="text-text mt-1 text-xl font-bold tracking-tight">{c0.nome}</h2>
            <p className="text-muted truncate text-sm">
              {[c0.nomeInterno, p?.resumo?.tipo, c0.coordenadores.join(", ")].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span
            className="border-border text-muted flex items-center gap-1 rounded-full border px-1 py-0.5 text-xs"
            title={t("painel.atalhos")}
          >
            <button
              type="button"
              onClick={anterior ?? undefined}
              disabled={!anterior}
              aria-label={t("painel.anterior")}
              className="hover:bg-surface grid h-7 w-7 place-items-center rounded-full disabled:opacity-40"
            >
              ‹
            </button>
            <span className="tabular-nums">{t("painel.posicao", posicao)}</span>
            <button
              type="button"
              onClick={proximo ?? undefined}
              disabled={!proximo}
              aria-label={t("painel.proximo")}
              className="hover:bg-surface grid h-7 w-7 place-items-center rounded-full disabled:opacity-40"
            >
              ›
            </button>
          </span>
          <button
            type="button"
            onClick={() => mudarAba("atividade")}
            className="border-border text-text hover:border-primary rounded-full border px-3 py-1.5 text-sm font-medium"
          >
            {t("painel.mensagem")}
          </button>
          {c0.funil && (
            <Link
              href={`/negocios/${c0.id}?aba=compradoras`}
              title={t("painel.funilDica")}
              className="border-border text-text hover:border-primary rounded-full border px-3 py-1.5 text-sm font-medium"
            >
              {t("painel.compradoras")}
            </Link>
          )}
          <Link
            href={`/negocios/${c0.id}`}
            className="bg-primary text-primary-foreground rounded-full px-4 py-1.5 text-sm font-semibold"
          >
            {t("abrirNegocio")} →
          </Link>
          <button
            type="button"
            onClick={fechar}
            aria-label={t("fechar")}
            className="text-muted hover:bg-surface grid h-8 w-8 place-items-center rounded-full text-lg"
          >
            ×
          </button>
        </header>
        {p === undefined ? (
          <div className="space-y-3" role="status" aria-busy="true">
            <span className="sr-only">{t("carregando")}</span>
            <span className="esqueleto block h-14" />
            <span className="esqueleto block h-8 w-2/3" />
            <span className="esqueleto block h-40" />
          </div>
        ) : p === null ? (
          <p className="text-muted text-sm">{t("semAcesso")}</p>
        ) : (
          <>
            <LinhaDasEtapas
              etapas={p.etapas?.etapas ?? []}
              hoje={hoje}
              dias={dias}
              atalho={
                c0.funil
                  ? { href: `/negocios/${c0.id}?aba=compradoras`, rotulo: t("painel.compradoras") }
                  : null
              }
            />
            <div
              ref={listaDeAbas}
              role="tablist"
              className="border-border relative flex shrink-0 flex-wrap gap-x-1 border-b"
            >
              {abas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={aba === a.id}
                  onClick={() => mudarAba(a.id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors duration-200 ${aba === a.id ? `${pronto ? "border-transparent" : "border-primary"} text-primary font-semibold` : "text-muted hover:text-text border-transparent"}`}
                >
                  {a.rotulo}
                </button>
              ))}
              <TracoDeslizante estilo={traco} />
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              {aba === "resumo" && (
                <ResumoDoNegocio
                  painel={p}
                  cartao={c0}
                  hoje={hoje}
                  dias={dias}
                  irPara={mudarAba}
                  aoConcluir={() => recarregar("resumo")}
                />
              )}
              {aba === "etapas" && p.etapas && (
                <EtapasDoNegocio
                  dealId={c0.id}
                  etapas={p.etapas.etapas}
                  podeIncluir={p.etapas.podeIncluir}
                  podeExcluir={p.etapas.podeExcluir}
                  hoje={hoje}
                  soLinhaDoTempo
                />
              )}
              {aba === "pessoas" && (
                <div className="grid gap-6 md:grid-cols-2">
                  <section>
                    <h3 className="text-muted mb-1 text-xs font-semibold tracking-wider uppercase">
                      {t("empresasTitulo")}
                    </h3>
                    <ul className="divide-border divide-y text-sm">
                      {p.empresas.map((e) => (
                        <li key={e.id} className="py-2">
                          <span className="text-text font-medium">{e.nome}</span>
                          <span className="text-muted block text-xs">
                            {[
                              e.papel,
                              e.situacaoFunil && tf(e.situacaoFunil as never),
                              e.atuaPara && t("trabalhaPara", { nome: e.atuaPara }),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3 className="text-muted mb-1 text-xs font-semibold tracking-wider uppercase">
                      {t("pessoasTitulo")}
                    </h3>
                    <ul className="divide-border divide-y text-sm">
                      {p.participantes.map((x) => (
                        <li key={x.id} className="py-2">
                          <span className="text-text font-medium">{x.nome}</span>
                          <span className="text-muted block text-xs">
                            {[x.perfil ?? t("contato"), x.empresa, x.prazo && t("ate", { data: br(x.prazo) })]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              )}
              {aba === "atividade" && (
                <div className="space-y-4">
                  <div className="bg-surface inline-flex rounded-full p-0.5" role="group">
                    {(["tudo", "tarefas", "mensagens"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={filtroAtividade === f}
                        onClick={() => setFiltroAtividade(f)}
                        className={`rounded-full px-3 py-1 text-xs transition-colors ${filtroAtividade === f ? "bg-background text-text font-semibold shadow-sm" : "text-muted"}`}
                      >
                        {f === "mensagens" && mensagens && mensagens.novas > 0
                          ? tm("abaComNovas", mensagens)
                          : t(`atividade.${f}`)}
                      </button>
                    ))}
                  </div>
                  {filtroAtividade !== "mensagens" && p.tarefas && (
                    <TarefasDoNegocio
                      dealId={c0.id}
                      quadro={p.tarefas}
                      etapaFiltro=""
                      aoMudar={() => recarregar("atividade")}
                    />
                  )}
                  {filtroAtividade !== "tarefas" && <MensagensDoNegocio dealId={c0.id} />}
                </div>
              )}
              {aba === "documentos" && p.dataRoom && (
                <DataRoomDoNegocio
                  dealId={c0.id}
                  dr={p.dataRoom}
                  etapaFiltro=""
                  aoMudar={() => recarregar("documentos")}
                />
              )}
              {aba === "historico" && <HistoricoPaginado eventos={p.historico} />}
            </div>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
