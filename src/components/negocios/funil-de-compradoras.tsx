"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { alterarSituacaoNoFunilAcao } from "@/app/acoes/negocios";
import { totalNominal } from "@/config/ofertas";
import { Ajuda, Aviso } from "@/components/ui/basicos";
import { Gaveta } from "@/components/ui/gaveta";
import { COMPLETOS, NovaVersao, TEASERS, Versao } from "@/components/ebook/aba";
import { AbaDeOfertas } from "@/components/ofertas/aba";
import { ObservacoesDoCartao } from "@/components/negocios/andamento";
import type { CartaoDoFunil } from "@/server/services/negocios-andamento";
import type { EbookDoNegocio } from "@/server/services/ebook";
import type { OfertasDoNegocio, OpcoesDaOferta } from "@/server/services/ofertas";

/**
 * Funil de compradoras no padrão do kanban de negócios (propostas
 * "funil-e-materiais", decisões de 2026-11-24): colunas com ícone e contador,
 * coluna opcional "Preparação" com os teasers (cartões de material, não de
 * compradora), atalhos nos cabeçalhos (Teasers; Completos e Registrar oferta
 * a partir do NDA; Ofertas na proposta), cartões com faixa de cor, menu ⋮,
 * arrastar com "Desfazer" e gaveta à direita para consultar e editar.
 */

const COLUNAS = ["prospectada", "teaser", "nda", "proposta", "escolhida", "descartada"] as const;
type Coluna = (typeof COLUNAS)[number];
type Cartao = Omit<CartaoDoFunil, "historico"> & {
  historico: { de: string; para: string; quando: string | Date; ator: string | null }[];
};
type Gavetas =
  | { tipo: "teasers" }
  | { tipo: "completos" }
  | { tipo: "ofertas"; nova?: boolean; compradoraId?: string }
  | { tipo: "compradora"; id: string };
type Pendente = { id: string; de: Coluna; para: Coluna; texto: string };

/** Ícones das colunas (vetor, 24 px, na cor da marca), como no kanban de negócios. */
const DESENHOS: Record<Coluna | "preparacao", string> = {
  preparacao: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4",
  prospectada: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  teaser: "M3 11l18-8-8 18-2-8z",
  nda: "M7 3h7l5 5v13H7zM14 3v5h5M9 15l2 2 4-4",
  proposta: "M3 6h18v12H3zM3 7l9 6 9-6",
  escolhida: "M5 12l4 4 10-10",
  descartada: "M6 6l12 12M18 6L6 18",
};
function Icone({ coluna }: { coluna: Coluna | "preparacao" }) {
  return (
    <span className="bg-primary-soft text-primary ring-primary/15 grid h-6 w-6 shrink-0 place-items-center rounded-md ring-1 ring-inset">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[15px] w-[15px]"
        aria-hidden="true"
      >
        <path d={DESENHOS[coluna]} />
      </svg>
    </span>
  );
}

/** Ícones pequenos dos materiais: e-book (livro) e OnePager (folha). */
function IconeDoMaterial({ material }: { material: string }) {
  const livro = material.startsWith("ebook");
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primary h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path
        d={
          livro
            ? "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6"
            : "M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5"
        }
      />
    </svg>
  );
}

const br = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
const reais = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

function AvisoDeMovimento({ texto, desfazer }: { texto: string; desfazer: () => void }) {
  const t = useTranslations("negocios.kanban");
  return createPortal(
    <div
      role="status"
      className="bg-background border-border shadow-cartao border-l-primary fixed right-4 bottom-4 z-50 flex animate-[entrada-suave_350ms_cubic-bezier(0.34,1.56,0.64,1)] items-center gap-4 rounded-xl border border-l-4 px-4 py-3 text-sm"
    >
      <span className="text-text">{texto}</span>
      <button type="button" onClick={desfazer} className="text-primary font-bold">
        {t("desfazer")}
      </button>
    </div>,
    document.body,
  );
}

function MenuDoCartao({
  cartao,
  podeEditar,
  abrir,
  ofertas,
  mover,
}: {
  cartao: Cartao;
  podeEditar: boolean;
  abrir: () => void;
  ofertas: (() => void) | null;
  mover: (para: Coluna) => void;
}) {
  const t = useTranslations("negocios.funilQuadro");
  const tf = useTranslations("negocios.funil");
  const [aberto, setAberto] = useState(false);
  const [moverAberto, setMoverAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  const item = (rotulo: string, acao: () => void) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setAberto(false);
        acao();
      }}
      className="hover:bg-surface text-text block w-full px-3 py-1.5 text-left text-xs"
    >
      {rotulo}
    </button>
  );
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={t("maisAcoes", { nome: cartao.nome })}
        onClick={() => setAberto((x) => !x)}
        className={`${aberto ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"} text-muted hover:text-text rounded px-1 text-base leading-none transition-opacity`}
      >
        ⋮
      </button>
      {aberto && (
        <div
          role="menu"
          className="bg-background border-border shadow-cartao absolute top-6 right-0 z-20 w-48 rounded-md border py-1"
        >
          {item(t("detalhes"), abrir)}
          {ofertas && item(t("verOfertas"), ofertas)}
          {podeEditar && (
            <>
              <button
                type="button"
                role="menuitem"
                aria-expanded={moverAberto}
                onClick={() => setMoverAberto((x) => !x)}
                className="hover:bg-surface text-text border-border block w-full border-t px-3 py-1.5 text-left text-xs"
              >
                {t("moverPara")} {moverAberto ? "▾" : "▸"}
              </button>
              {moverAberto &&
                COLUNAS.filter((c) => c !== cartao.situacao).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAberto(false);
                      mover(c);
                    }}
                    className="hover:bg-surface text-muted block w-full py-1 pr-3 pl-6 text-left text-xs"
                  >
                    {tf(c)}
                  </button>
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const GUARDA_PREPARACAO = "mna.funil.preparacao-recolhida";

export function FunilDeCompradoras({
  dealId,
  cartoes,
  podeEditar,
  ebook,
  ofertas,
  opcoesOferta,
  diasParada = 30,
}: {
  /** Dias parada na mesma situação para o cartão ficar amarelo (Configurações › Prazos de eventos). */
  diasParada?: number;
  dealId: string;
  cartoes: Cartao[];
  podeEditar: boolean;
  ebook: EbookDoNegocio | null;
  ofertas: OfertasDoNegocio | null;
  opcoesOferta: OpcoesDaOferta | null;
}) {
  const t = useTranslations("negocios.funilQuadro");
  const ta = useTranslations("negocios.andamento");
  const tf = useTranslations("negocios.funil");
  const te = useTranslations("ebook");
  const router = useRouter();
  const [movendo, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [arrastado, setArrastado] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [posicoes, setPosicoes] = useState<Record<string, Coluna>>({});
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [gaveta, setGaveta] = useState<Gavetas | null>(null);
  const [preparacaoRecolhida, setPreparacaoRecolhida] = useState(false);
  const tempo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendenteRef = useRef<Pendente | null>(null);

  useEffect(() => {
    try {
      setPreparacaoRecolhida(localStorage.getItem(GUARDA_PREPARACAO) === "1");
    } catch {
      /* sem armazenamento local: fica aberta */
    }
  }, []);
  function alternarPreparacao() {
    setPreparacaoRecolhida((x) => {
      try {
        localStorage.setItem(GUARDA_PREPARACAO, x ? "0" : "1");
      } catch {
        /* sem armazenamento local */
      }
      return !x;
    });
  }

  const enviar = useCallback(
    (id: string, para: string, descartarOutras = false) => {
      const f = new FormData();
      f.set("dealId", dealId);
      f.set("id", id);
      f.set("situacao", para);
      if (descartarOutras) f.set("descartarOutras", "sim");
      iniciar(async () => {
        const r = await alterarSituacaoNoFunilAcao(undefined, f);
        setErro(r?.erro ?? null);
        if (r?.erro)
          setPosicoes((x) => {
            const { [id]: _, ...resto } = x;
            void _;
            return resto;
          });
        else router.refresh();
      });
    },
    [dealId, router],
  );
  const situacaoDe = (c: Cartao) => posicoes[c.id] ?? (c.situacao as Coluna);

  // Mover: otimista, grava depois de 4 s (ou ao mover outro), com "Desfazer".
  const confirmarPendente = useCallback(() => {
    if (tempo.current) clearTimeout(tempo.current);
    const p = pendenteRef.current;
    pendenteRef.current = null;
    setPendente(null);
    if (p) enviar(p.id, p.para);
  }, [enviar]);
  useEffect(() => () => confirmarPendente(), [confirmarPendente]);
  useEffect(() => {
    setPosicoes((x) => {
      const resto = Object.fromEntries(
        Object.entries(x).filter(([id, col]) => cartoes.find((c) => c.id === id)?.situacao !== col),
      );
      return Object.keys(resto).length === Object.keys(x).length ? x : resto;
    });
  }, [cartoes]);

  function mover(id: string, para: Coluna) {
    const c = cartoes.find((x) => x.id === id);
    if (!c || situacaoDe(c) === para) return;
    // Escolher pergunta se descarta as outras; descartar avisa que o acesso acaba: sem "Desfazer".
    if (para === "escolhida" && cartoes.some((x) => x.id !== id && situacaoDe(x) !== "descartada"))
      return setEscolha(id);
    if (para === "descartada") {
      if (!window.confirm(ta("confirmarDescarte", { nome: c.nome }))) return;
      confirmarPendente();
      setPosicoes((x) => ({ ...x, [id]: para }));
      return enviar(id, para);
    }
    confirmarPendente();
    const p = { id, de: situacaoDe(c), para, texto: t("movido", { nome: c.nome, coluna: tf(para) }) };
    setErro(null);
    setPosicoes((x) => ({ ...x, [id]: para }));
    pendenteRef.current = p;
    setPendente(p);
    tempo.current = setTimeout(confirmarPendente, 4000);
  }
  function desfazer() {
    if (tempo.current) clearTimeout(tempo.current);
    const p = pendenteRef.current;
    pendenteRef.current = null;
    setPendente(null);
    if (p)
      setPosicoes((x) => {
        const { [p.id]: _, ...resto } = x;
        void _;
        return resto;
      });
  }

  // Materiais (e-book e OnePager) e ofertas para os atalhos.
  const materiaisDe = (lista: readonly string[]) =>
    (ebook?.materiais ?? []).filter((m) => lista.includes(m.material));
  const teasers = materiaisDe(TEASERS);
  const completos = materiaisDe(COMPLETOS);
  const versoes = (lista: typeof teasers) => lista.reduce((n, m) => n + m.versoes.length, 0);
  const ofertasDe = (empresaId: string) =>
    (ofertas?.ofertas ?? []).filter((o) => o.compradoraId === empresaId);
  const comPreparacao = Boolean(ebook?.vendedor);
  const escolhida = cartoes.find((c) => c.id === escolha);
  const atalho = (rotulo: string, acao: () => void, destaque = false) => (
    <button
      type="button"
      onClick={acao}
      className={
        destaque
          ? "bg-cta text-cta-foreground rounded-md px-2 py-0.5 text-[11px] font-semibold"
          : "border-border bg-background text-text hover:border-primary rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      }
    >
      {rotulo}
    </button>
  );
  const podeRegistrar = Boolean(ofertas?.podeCriar && opcoesOferta);

  const cartaoAberto = gaveta?.tipo === "compradora" ? cartoes.find((c) => c.id === gaveta.id) : null;

  return (
    <div>
      {erro && <Aviso>{erro}</Aviso>}
      {escolhida && (
        <div
          role="dialog"
          aria-label={ta("escolherTitulo")}
          className="border-primary bg-surface mb-3 rounded-md border p-3 text-sm"
        >
          <p className="text-text mb-2">{ta("escolherPergunta", { nome: escolhida.nome })}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium"
              onClick={() => {
                setPosicoes((x) => ({ ...x, [escolhida.id]: "escolhida" }));
                enviar(escolhida.id, "escolhida", true);
                setEscolha(null);
              }}
            >
              {ta("escolherEDescartar")}
            </button>
            <button
              type="button"
              className="border-border text-text rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                setPosicoes((x) => ({ ...x, [escolhida.id]: "escolhida" }));
                enviar(escolhida.id, "escolhida");
                setEscolha(null);
              }}
            >
              {ta("escolherEManter")}
            </button>
            <button type="button" className="text-muted text-sm" onClick={() => setEscolha(null)}>
              {ta("cancelar")}
            </button>
          </div>
        </div>
      )}
      <div
        className={`grid auto-cols-[minmax(12.5rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 ${movendo ? "opacity-80" : ""}`}
      >
        {comPreparacao &&
          (preparacaoRecolhida ? (
            <button
              type="button"
              onClick={alternarPreparacao}
              title={t("mostrarPreparacao")}
              className="border-border text-muted hover:border-primary w-9 rounded-xl border border-dashed py-3 text-[11px] font-semibold tracking-wide uppercase [writing-mode:vertical-rl]"
            >
              {t("preparacao")} ▸
            </button>
          ) : (
            <section
              aria-label={t("preparacao")}
              className="border-border min-w-0 rounded-xl border border-dashed p-2.5"
            >
              <header className="mb-2.5 px-1">
                <h3 className="flex items-center gap-2">
                  <Icone coluna="preparacao" />
                  <span className="text-text min-w-0 truncate text-sm font-semibold">{t("preparacao")}</span>
                  <Ajuda texto={t("preparacaoDica")} />

                  <button
                    type="button"
                    onClick={alternarPreparacao}
                    aria-label={t("recolherPreparacao")}
                    title={t("recolherPreparacao")}
                    className="text-muted hover:text-text ml-auto text-xs"
                  >
                    ◂
                  </button>
                </h3>
              </header>
              <ul className="flex flex-col gap-2">
                {TEASERS.map((material) => {
                  const m = teasers.find((x) => x.material === material);
                  const ultima = m?.versoes[0];
                  return (
                    <li key={material}>
                      <button
                        type="button"
                        onClick={() => setGaveta({ tipo: "teasers" })}
                        className="border-border bg-background hover:border-primary w-full rounded-lg border p-3 text-left text-xs"
                      >
                        <span className="text-text flex items-center gap-1.5 text-sm font-semibold">
                          <IconeDoMaterial material={material} />
                          {te(`materiais.${material}`)}
                        </span>
                        <span className="text-muted">
                          {ultima
                            ? `${te("versao", { numero: ultima.numero })} · ${te(`situacoes.${ultima.situacao}`)}`
                            : t("ausente")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        {COLUNAS.map((coluna) => {
          const daColuna = cartoes.filter((c) => situacaoDe(c) === coluna);
          return (
            <section
              key={coluna}
              aria-label={tf(coluna)}
              onDragOver={(e) => {
                if (!podeEditar || !arrastado) return;
                e.preventDefault();
                setSobre(coluna);
              }}
              onDragLeave={() => setSobre((x) => (x === coluna ? null : x))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                if (arrastado) mover(arrastado, coluna);
                setArrastado(null);
              }}
              className={`bg-surface min-w-0 rounded-xl border p-2.5 transition-colors ${sobre === coluna ? "border-primary bg-primary-soft" : "border-border"}`}
            >
              <header className="mb-2.5 px-1">
                <h3 className="flex items-center gap-2">
                  <Icone coluna={coluna} />
                  <span className="text-text min-w-0 truncate text-sm font-semibold" title={tf(coluna)}>
                    {tf(coluna)}
                  </span>
                  <span className="border-border bg-background text-muted rounded-full border px-1.5 text-[11px] tabular-nums">
                    {daColuna.length}
                  </span>
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {coluna === "prospectada" &&
                    ebook &&
                    atalho(t("teasers", { n: versoes(teasers) }), () => setGaveta({ tipo: "teasers" }))}
                  {coluna === "nda" &&
                    ebook &&
                    atalho(t("completos", { n: versoes(completos) }), () => setGaveta({ tipo: "completos" }))}
                  {coluna === "proposta" &&
                    ofertas &&
                    atalho(t("ofertas", { n: ofertas.ofertas.length }), () => setGaveta({ tipo: "ofertas" }))}
                  {(coluna === "nda" || coluna === "proposta") &&
                    podeRegistrar &&
                    atalho(t("registrarOferta"), () => setGaveta({ tipo: "ofertas", nova: true }), true)}
                </div>
              </header>
              <ul className="flex min-h-16 flex-col gap-2">
                {daColuna.map((c) => {
                  const ultimo = [...c.historico].reverse().find((h) => h.para === situacaoDe(c)) ?? null;
                  const desde = ultimo ? new Date(ultimo.quando) : null;
                  const parada =
                    desde &&
                    !["escolhida", "descartada"].includes(situacaoDe(c)) &&
                    (Date.now() - desde.getTime()) / 86_400_000 > diasParada;
                  const dela = ofertasDe(c.empresaId);
                  const ultimaOferta = dela[0];
                  return (
                    <li
                      key={c.id}
                      draggable={podeEditar}
                      onDragStart={(e) => {
                        setArrastado(c.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setArrastado(null)}
                      className={`${parada ? "bg-warning-soft" : "bg-background"} border-border group hover:border-primary relative overflow-hidden rounded-lg border p-3 pl-4 text-xs transition-colors ${podeEditar ? "cursor-grab" : ""}`}
                    >
                      <span
                        className={`absolute inset-y-0 left-0 w-1 ${parada ? "bg-warning-fill" : situacaoDe(c) === "descartada" ? "bg-border" : "bg-success"}`}
                        aria-hidden="true"
                      />
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setGaveta({ tipo: "compradora", id: c.id })}
                          className="text-text text-left text-sm font-semibold break-words"
                        >
                          {c.nome}
                        </button>
                        <MenuDoCartao
                          cartao={c}
                          podeEditar={podeEditar}
                          abrir={() => setGaveta({ tipo: "compradora", id: c.id })}
                          ofertas={
                            dela.length
                              ? () => setGaveta({ tipo: "ofertas", compradoraId: c.empresaId })
                              : null
                          }
                          mover={(para) => mover(c.id, para)}
                        />
                      </div>
                      <p className={`mt-0.5 ${parada ? "text-warning font-medium" : "text-muted"}`}>
                        {[
                          desde && t(parada ? "paradaDesde" : "desde", { data: br(desde) }),
                          c.equipe.length > 0 && t("equipe", { n: c.equipe.length }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {dela.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setGaveta({ tipo: "ofertas", compradoraId: c.empresaId })}
                          className="text-primary mt-1 block text-left font-medium"
                        >
                          {t("ofertasDaCompradora", {
                            n: dela.length,
                            valor: reais(totalNominal(ultimaOferta)),
                          })}
                        </button>
                      )}
                      {c.observacoes && (
                        <p className="text-muted mt-1 line-clamp-2" title={c.observacoes}>
                          {c.observacoes}
                        </p>
                      )}
                      {c.equipe.length > 0 && (
                        <p className="mt-2 flex items-center" title={c.equipe.join(", ")}>
                          {c.equipe.slice(0, 3).map((n, i) => (
                            <span
                              key={n}
                              className={`bg-primary-soft text-primary ring-background grid h-[22px] w-[22px] place-items-center rounded-full text-[9px] font-bold ring-2 ${i > 0 ? "-ml-1.5" : ""}`}
                            >
                              {iniciais(n)}
                            </span>
                          ))}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {gaveta && (gaveta.tipo === "teasers" || gaveta.tipo === "completos") && ebook && (
        <Gaveta
          titulo={t(gaveta.tipo === "teasers" ? "gavetaTeasers" : "gavetaCompletos")}
          subtitulo={t(gaveta.tipo === "teasers" ? "gavetaTeasersDica" : "gavetaCompletosDica")}
          rotuloFechar={t("fechar")}
          fechar={() => setGaveta(null)}
          largura="max-w-[30rem]"
        >
          <div className="space-y-5">
            {ebook.podeCriar && (
              <NovaVersao
                dealId={dealId}
                aoCriar={() => router.refresh()}
                materiais={gaveta.tipo === "teasers" ? TEASERS : COMPLETOS}
              />
            )}
            {(gaveta.tipo === "teasers" ? TEASERS : COMPLETOS).map((material) => {
              const m = ebook.materiais.find((x) => x.material === material);
              return (
                <section key={material}>
                  <h3 className="text-text flex items-center gap-1.5 text-sm font-semibold">
                    <IconeDoMaterial material={material} />
                    {te(`materiais.${material}`)}
                  </h3>
                  {!m || m.versoes.length === 0 ? (
                    <p className="text-muted mt-1 text-sm">{t("ausente")}</p>
                  ) : (
                    <ul className="divide-border divide-y">
                      {m.versoes.map((v) => (
                        <Versao key={v.id} v={v} vendedor={ebook.vendedor} aoMudar={() => router.refresh()} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </Gaveta>
      )}
      {gaveta?.tipo === "ofertas" && ofertas && (
        <Gaveta
          titulo={
            gaveta.compradoraId
              ? t("gavetaOfertasDe", {
                  nome: cartoes.find((c) => c.empresaId === gaveta.compradoraId)?.nome ?? "",
                })
              : t("gavetaOfertas")
          }
          rotuloFechar={t("fechar")}
          fechar={() => setGaveta(null)}
          largura="max-w-4xl"
        >
          <AbaDeOfertas
            dealId={dealId}
            dados={ofertas}
            opcoes={opcoesOferta}
            novaAoAbrir={Boolean(gaveta.nova)}
            compradoraId={gaveta.compradoraId}
          />
        </Gaveta>
      )}
      {cartaoAberto && (
        <Gaveta
          titulo={cartaoAberto.nome}
          subtitulo={tf(situacaoDe(cartaoAberto))}
          rotuloFechar={t("fechar")}
          fechar={() => setGaveta(null)}
        >
          <div className="space-y-4 text-sm">
            {podeEditar && (
              <label className="block">
                <span className="text-text mb-1 block text-xs font-medium">{t("moverPara")}</span>
                <select
                  value={situacaoDe(cartaoAberto)}
                  onChange={(e) => mover(cartaoAberto.id, e.target.value as Coluna)}
                  className="border-border bg-background text-text w-full rounded-md border px-2 py-1.5 text-sm"
                >
                  {COLUNAS.map((c) => (
                    <option key={c} value={c}>
                      {tf(c)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {cartaoAberto.equipe.length > 0 && (
              <p className="text-muted text-xs">{ta("equipe", { nomes: cartaoAberto.equipe.join(", ") })}</p>
            )}
            <section>
              <h3 className="text-muted text-xs font-semibold tracking-wider uppercase">
                {t("observacoes")}
              </h3>
              <ObservacoesDoCartao dealId={dealId} cartao={cartaoAberto} podeEditar={podeEditar} />
            </section>
            {ofertasDe(cartaoAberto.empresaId).length > 0 && (
              <section>
                <h3 className="text-muted mb-1 text-xs font-semibold tracking-wider uppercase">
                  {t("ofertasTitulo")}
                </h3>
                <ul className="divide-border divide-y text-xs">
                  {ofertasDe(cartaoAberto.empresaId).map((o) => (
                    <li key={o.id} className="flex justify-between gap-2 py-1.5">
                      <span>
                        {t("rodada", { n: o.rodada })} · {br(`${o.data}T12:00:00`)}
                        {o.aceita && (
                          <span className="text-success ml-1 font-semibold">· {t("escolhidaOferta")}</span>
                        )}
                      </span>
                      <span className="text-text font-semibold tabular-nums">{reais(totalNominal(o))}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setGaveta({ tipo: "ofertas", compradoraId: cartaoAberto.empresaId })}
                  className="text-primary mt-1 text-xs font-semibold"
                >
                  {t("abrirOfertas")} →
                </button>
              </section>
            )}
            {cartaoAberto.historico.length > 0 && (
              <section>
                <h3 className="text-muted mb-1 text-xs font-semibold tracking-wider uppercase">
                  {t("historico")}
                </h3>
                <ol className="text-muted space-y-1 text-xs">
                  {cartaoAberto.historico.map((h, i) => (
                    <li key={i}>
                      <span className="text-text">
                        {h.de ? `${tf(h.de as never)} → ` : ""}
                        {tf(h.para as never)}
                      </span>
                      <span className="block">
                        {[
                          h.ator,
                          new Date(h.quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </Gaveta>
      )}
      {pendente && <AvisoDeMovimento texto={pendente.texto} desfazer={desfazer} />}
    </div>
  );
}
