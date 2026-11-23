"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { moverNegocioParaEtapaAcao, painelDoNegocioAcao } from "@/app/acoes/kanban";
import { Avatar, Aviso } from "@/components/ui/basicos";
import { CORES_DO_NIVEL, diasAte, type NivelDoPrazo } from "@/config/prazos";
import { PainelDoNegocio, type Painel } from "@/components/negocios/painel-do-negocio";

/**
 * Kanban de negócios (item 15; propostas de layout v3, modelo A): totais da
 * carteira numa caixa discreta, filtros rápidos, colunas = etapas padrão com
 * ícone, contagem e valor; cartão com a cor da situação do prazo (fundo
 * fosco + faixa + etiqueta com texto), mini barra do funil de compradoras e
 * progresso. Mover de etapa é otimista, com "Desfazer". Clicar abre o
 * detalhe num painel central que cresce a partir do cartão.
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
  pessoas: { nome: string; foto: string | null }[];
  prazo: string | null;
  nivelDoPrazo: NivelDoPrazo | null;
  fimDaEtapa: string | null;
  previsaoFechamento: string | null;
  valorEstimado: number | null;
  progresso: { feitas: number; total: number };
};

const FUNIL = ["prospectada", "teaser", "nda", "proposta", "escolhida"] as const;
const br = (d: string) => d.split("-").reverse().join("/");
const curta = (d: string) => br(d).slice(0, 5);
const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const reais = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const somar = (data: string, dias: number) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/** Desenho de cada etapa (pelo nome); etapas sem desenho conhecido usam a sequência de reserva. */
const DESENHOS: { chave: RegExp; d: string }[] = [
  { chave: /iniciar/, d: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" }, // relógio
  { chave: /prospec/, d: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" }, // lupa
  { chave: /negocia/, d: "M4 5h16v10H9l-5 4z" }, // balão de conversa
  { chave: /term|loi|mou/, d: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" }, // documento
  { chave: /dilig/, d: "M9 4h6v3H9zM7 6H5v15h14V6h-2M9 13l2 2 4-4" }, // prancheta com check
  { chave: /closing|fecha|→|cp/, d: "M4 12h12M12 6l6 6-6 6" }, // seta (condições até o closing)
  { chave: /^qpa$|spa|contrato|acordo/, d: "M4 20h4l11-11-4-4L4 16zM13 7l4 4" }, // caneta (assinatura)
  {
    chave: /^closing$/,
    d: "M7 4h10v4a5 5 0 0 1-10 0zM12 13v4M8 21h8M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
  }, // troféu
  { chave: /pós|pos-|pos /, d: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" }, // calendário
];
const RESERVA = [
  "M5 12l4 4 10-10",
  "M4 17l5-5 4 4 7-7",
  "M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z",
  "M3 7h18M3 12h18M3 17h18",
];

function desenhoDa(nome: string, indice: number) {
  const n = semAcento(nome).trim();
  // "Closing" exato tem o troféu; as demais com "closing" (ex.: "QPA → Closing") têm a seta.
  if (n === "closing") return DESENHOS[7].d;
  if (n.startsWith("pos")) return DESENHOS[8].d;
  return DESENHOS.find((x) => x.chave.test(n))?.d ?? RESERVA[indice % RESERVA.length];
}

/** Ícone da coluna: 24 px, todos iguais (fundo suave da marca, desenho na cor da marca), em vetor. */
function IconeDaColuna({ nome, indice }: { nome: string; indice: number }) {
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
        <path d={desenhoDa(nome, indice)} />
      </svg>
    </span>
  );
}

/** Funil no cartão: mini barra (do mais claro, prospectadas, ao mais escuro, com proposta) + resumo curto. */
function MiniFunil({ funil }: { funil: Record<string, string[]> }) {
  const t = useTranslations("negocios.kanban");
  const tf = useTranslations("negocios.funil");
  const n = (s: string) => funil[s]?.length ?? 0;
  const total = FUNIL.reduce((x, s) => x + n(s), 0);
  if (total === 0) return null;
  if (n("escolhida") > 0 && total === n("escolhida"))
    return <p className="text-muted">{t("funilEscolhida")}</p>;
  const nda = n("nda") + n("proposta") + n("escolhida");
  const proposta = n("proposta") + n("escolhida");
  const tons = ["opacity-25", "opacity-50", "opacity-75", "opacity-100", "opacity-100"];
  const lista = FUNIL.filter((s) => n(s))
    .map((s) => `${tf(s)} ${n(s)}`)
    .join(", ");
  return (
    <div className="mt-1.5" title={lista}>
      <span
        className="flex h-1.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={t("funilAria", { lista })}
      >
        {FUNIL.map((s, i) =>
          n(s) ? <span key={s} className={`bg-primary ${tons[i]}`} style={{ flexGrow: n(s) }} /> : null,
        )}
      </span>
      <p className="text-muted mt-1">
        {[
          String(total),
          nda > 0 && t("funilNda", { n: nda }),
          proposta > 0 && t("funilProposta", { n: proposta }),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

function ChipDoPrazo({ cartao: c, hoje }: { cartao: Cartao; hoje: string }) {
  const t = useTranslations("negocios.kanban.chip");
  if (!c.prazo || !c.nivelDoPrazo)
    return (
      <span className="text-muted">
        {c.situacao === "andamento" && c.etapa ? t("semPrazo") : t("semPrazoEtapa")}
      </span>
    );
  const d = diasAte(c.prazo, hoje);
  const data = curta(c.prazo);
  const texto =
    d < 0
      ? t("atraso", { data, n: -d })
      : d === 0
        ? t("hoje", { data })
        : c.nivelDoPrazo === "proximo"
          ? t("emDias", { data, n: d })
          : t("data", { data });
  const cor = CORES_DO_NIVEL[c.nivelDoPrazo];
  return (
    <span
      className={`${cor.fundo} ${cor.texto} inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap`}
    >
      <span className={`${cor.faixa} h-1.5 w-1.5 rounded-full`} aria-hidden="true" />
      {texto}
    </span>
  );
}

/** Menu "⋮" do cartão: aparece ao passar o mouse ou ao focar (teclado). */
function MenuDoCartao({
  cartao,
  colunas,
  abrir,
  mover,
}: {
  cartao: Cartao;
  colunas: { id: string; nome: string }[];
  abrir: (aba?: string) => void;
  mover: (colunaId: string) => void;
}) {
  const t = useTranslations("negocios.kanban");
  const [aberto, setAberto] = useState(false);
  const [moverAberto, setMoverAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
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
        aria-label={t("maisAcoes", { negocio: cartao.nome })}
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
          {item(t("detalhes"), () => abrir())}
          {item(t("verTarefas"), () => abrir("atividade"))}
          {item(t("verDocumentos"), () => abrir("documentos"))}
          <Link
            href={`/negocios/${cartao.id}`}
            role="menuitem"
            className="hover:bg-surface text-text block px-3 py-1.5 text-xs"
          >
            {t("abrirNegocio")}
          </Link>
          {cartao.podeMover && (
            <>
              <button
                type="button"
                role="menuitem"
                aria-expanded={moverAberto}
                onClick={() => setMoverAberto((x) => !x)}
                className="hover:bg-surface text-text border-border block w-full border-t px-3 py-1.5 text-left text-xs"
              >
                {t("moverParaCurto")} {moverAberto ? "▾" : "▸"}
              </button>
              {moverAberto &&
                colunas
                  .filter((c) => c.id !== cartao.colunaId)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAberto(false);
                        mover(c.id);
                      }}
                      className="hover:bg-surface text-muted block w-full py-1 pr-3 pl-6 text-left text-xs"
                    >
                      {c.nome}
                    </button>
                  ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Fotos({ pessoas }: { pessoas: { nome: string; foto: string | null }[] }) {
  const t = useTranslations("negocios.kanban");
  if (pessoas.length === 0) return null;
  const nomes = pessoas.map((p) => p.nome).join(", ");
  return (
    <span className="flex items-center" title={nomes} aria-label={t("pessoas", { nomes })}>
      {pessoas.slice(0, 3).map((p, i) => (
        <span key={i} className={i > 0 ? "-ml-2" : ""}>
          <Avatar nome={p.nome} foto={p.foto} tamanho={22} />
        </span>
      ))}
      {pessoas.length > 3 && (
        <span className="bg-primary-soft text-primary -ml-2 flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-[10px] font-semibold">
          +{pessoas.length - 3}
        </span>
      )}
    </span>
  );
}

/** Totais da carteira numa caixa discreta (borda fina, sem sombra, divisórias entre os números). */
function Totais({ cartoes, hoje }: { cartoes: Cartao[]; hoje: string }) {
  const t = useTranslations("negocios.kanban.totais");
  const soma = (lista: Cartao[]) => lista.reduce((x, c) => x + (c.valorEstimado ?? 0), 0);
  const ate = (dias: number) =>
    cartoes.filter(
      (c) =>
        c.previsaoFechamento && c.previsaoFechamento >= hoje && c.previsaoFechamento <= somar(hoje, dias),
    );
  const em90 = ate(90);
  const em180 = ate(180);
  const atrasados = cartoes.filter((c) => c.nivelDoPrazo === "atrasado").length;
  const item = "border-border px-4 first:pl-0 sm:px-5 [&:not(:first-child)]:border-l";
  return (
    <section
      aria-label={t("rotulo")}
      className="bg-background/70 border-border mb-3 flex flex-wrap items-stretch gap-y-2 rounded-xl border px-4 py-2.5 sm:px-5"
    >
      <div className={item}>
        <p className="text-muted text-[11px] font-semibold">{t("carteira")}</p>
        <p className="text-text text-xl font-bold tabular-nums">{reais(soma(cartoes))}</p>
      </div>
      <div className={item}>
        <p className="text-muted text-[11px] font-semibold">{t("abertos")}</p>
        <p className="text-text text-xl font-bold tabular-nums">{cartoes.length}</p>
      </div>
      <div className={item}>
        <p className="text-muted text-[11px] font-semibold">{t("atrasados")}</p>
        <p className={`text-xl font-bold tabular-nums ${atrasados ? "text-danger" : "text-text"}`}>
          {atrasados}
        </p>
      </div>
      <div className={item}>
        <p className="text-muted text-[11px] font-semibold">{t("closing")}</p>
        <p className="text-muted flex flex-wrap items-baseline gap-x-5 text-xs">
          <span>
            <b className="text-text mr-1 text-xl tabular-nums">{em90.length}</b>
            {t("em90", { valor: reais(soma(em90)) })}
          </span>
          <span>
            <b className="text-text mr-1 text-xl tabular-nums">{em180.length}</b>
            {t("em180", { valor: reais(soma(em180)) })}
          </span>
        </p>
      </div>
    </section>
  );
}

/** Aviso no canto inferior direito, com "Desfazer" (some sozinho; pausa com o mouse em cima). */
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

type Aberto = { cartao: Cartao; painel: Painel | undefined; aba: string };
type Pendente = { id: string; de: string; para: string; texto: string };

/** View Transitions do navegador, quando houver e sem "reduzir movimento"; senão, troca direto. */
function comTransicao(atualizar: () => void, tipo: "abrir" | "fechar") {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    atualizar();
    return Promise.resolve();
  }
  document.documentElement.dataset.transicao = tipo;
  const vt = doc.startViewTransition(() => flushSync(atualizar));
  return vt.finished.finally(() => delete document.documentElement.dataset.transicao);
}

export function KanbanDeNegocios({
  colunas,
  cartoes,
  hoje,
  diasDeAviso,
  filtros,
  tipos,
}: {
  colunas: { id: string; nome: string }[];
  cartoes: Cartao[];
  hoje: string;
  diasDeAviso: number;
  /** Filtros da lista (situação, lado, tipo), aplicados ao escolher. */
  filtros: { situacao: string; lado: string; tipo: string };
  tipos: { id: string; nome: string }[];
}) {
  const t = useTranslations("negocios.kanban");
  const tl = useTranslations("negocios.lista");
  const tsit = useTranslations("negocios.situacoes");
  const ts = useTranslations("negocios.situacoes");
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [rapido, setRapido] = useState<"todos" | "atrasados" | "proximos">("todos");
  const [arrastado, setArrastado] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [posicoes, setPosicoes] = useState<Record<string, string>>({});
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [animando, setAnimando] = useState<string | null>(null);
  const tempo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendenteRef = useRef<Pendente | null>(null);

  const todas = [{ id: "a-iniciar", nome: t("aIniciar") }, ...colunas];
  const colunaDe = useCallback((c: Cartao) => posicoes[c.id] ?? c.colunaId, [posicoes]);
  const termo = semAcento(busca.trim());
  const visiveis = cartoes
    .filter(
      (c) =>
        !termo ||
        [
          c.nome,
          c.nomeInterno ?? "",
          ...(c.vendedoras ?? []),
          ...c.coordenadores,
          ...c.pessoas.map((p) => p.nome),
        ].some((x) => semAcento(x).includes(termo)),
    )
    .filter((c) =>
      rapido === "atrasados"
        ? c.nivelDoPrazo === "atrasado"
        : rapido === "proximos"
          ? c.nivelDoPrazo === "proximo"
          : true,
    );
  const atrasados = cartoes.filter((c) => c.nivelDoPrazo === "atrasado").length;
  const proximos = cartoes.filter((c) => c.nivelDoPrazo === "proximo").length;
  /** Ordem de navegação do painel: coluna a coluna, de cima para baixo. */
  const porColuna = todas.map((col) => visiveis.filter((c) => colunaDe(c) === col.id));
  const ordem = porColuna.flat();

  // --- Mover de etapa: otimista, grava depois de 4 s (ou ao sair), com "Desfazer" ---------------
  const gravar = useCallback(
    async (p: Pendente) => {
      const r = await moverNegocioParaEtapaAcao(p.id, p.para);
      if (r.erro) {
        setErro(r.erro);
        setPosicoes((x) => {
          const { [p.id]: _, ...resto } = x;
          void _;
          return resto;
        });
      } else router.refresh();
    },
    [router],
  );
  const confirmarPendente = useCallback(() => {
    if (tempo.current) clearTimeout(tempo.current);
    const p = pendenteRef.current;
    pendenteRef.current = null;
    setPendente(null);
    if (p) void gravar(p);
  }, [gravar]);
  useEffect(() => () => confirmarPendente(), [confirmarPendente]);
  // Depois que o servidor confirma (dados novos), a posição local deixa de ser necessária.
  useEffect(() => {
    setPosicoes((x) => {
      const resto = Object.fromEntries(
        Object.entries(x).filter(([id, col]) => cartoes.find((c) => c.id === id)?.colunaId !== col),
      );
      return Object.keys(resto).length === Object.keys(x).length ? x : resto;
    });
  }, [cartoes]);

  function mover(id: string, colunaId: string) {
    const c = cartoes.find((x) => x.id === id);
    const destino = todas.find((x) => x.id === colunaId);
    if (!c || !destino || colunaDe(c) === colunaId || colunaId === "a-iniciar") return;
    confirmarPendente();
    const p = {
      id,
      de: colunaDe(c),
      para: colunaId,
      texto: t("movido", { negocio: c.nome, etapa: destino.nome }),
    };
    setErro(null);
    setPosicoes((x) => ({ ...x, [id]: colunaId }));
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

  // --- Painel central ----------------------------------------------------------------------
  const carregar = useCallback(async (c: Cartao) => {
    const painel = await painelDoNegocioAcao(c.id);
    setAberto((x) => (x?.cartao.id === c.id ? { ...x, painel } : x));
  }, []);

  const escreverEndereco = (id: string | null, aba?: string, novo = false) => {
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("negocio", id);
    else u.searchParams.delete("negocio");
    if (id && aba && aba !== "resumo") u.searchParams.set("aba", aba);
    else u.searchParams.delete("aba");
    window.history[novo ? "pushState" : "replaceState"](window.history.state, "", u);
  };

  function abrir(c: Cartao, aba = "resumo", animar = true) {
    if (aberto?.cartao.id === c.id) {
      setAberto({ ...aberto, aba });
      escreverEndereco(c.id, aba);
      void carregar(c);
      return;
    }
    const trocar = () => {
      setAnimando(null);
      setAberto({ cartao: c, painel: undefined, aba });
    };
    escreverEndereco(c.id, aba, !aberto);
    if (animar && !aberto) {
      flushSync(() => setAnimando(c.id));
      void comTransicao(trocar, "abrir");
    } else trocar();
    void carregar(c);
  }

  const fechar = useCallback(() => {
    if (!aberto) return;
    const id = aberto.cartao.id;
    escreverEndereco(null);
    void comTransicao(() => {
      setAberto(null);
      setAnimando(id);
    }, "fechar").then(() => setAnimando(null));
  }, [aberto]);

  // Abre o negócio que já vem no endereço (link compartilhado ou recarga da página).
  useEffect(() => {
    const u = new URL(window.location.href);
    const id = u.searchParams.get("negocio");
    const c = id && cartoes.find((x) => x.id === id);
    if (c) abrir(c, u.searchParams.get("aba") ?? "resumo", false);
    const voltar = () => {
      if (!new URL(window.location.href).searchParams.get("negocio")) setAberto(null);
    };
    window.addEventListener("popstate", voltar);
    return () => window.removeEventListener("popstate", voltar);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem
  }, []);

  // Teclado com o painel aberto: ↑ ↓ na mesma coluna, ← → colunas vizinhas, Esc fecha.
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "Escape") return fechar();
      const col = porColuna.findIndex((l) => l.some((c) => c.id === aberto.cartao.id));
      if (col < 0) return;
      const pos = porColuna[col].findIndex((c) => c.id === aberto.cartao.id);
      let alvoCartao: Cartao | undefined;
      if (e.key === "ArrowDown") alvoCartao = porColuna[col][pos + 1];
      else if (e.key === "ArrowUp") alvoCartao = porColuna[col][pos - 1];
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const passo = e.key === "ArrowRight" ? 1 : -1;
        for (let i = col + passo; i >= 0 && i < porColuna.length; i += passo)
          if (porColuna[i].length) {
            alvoCartao = porColuna[i][Math.min(pos, porColuna[i].length - 1)];
            break;
          }
      } else return;
      e.preventDefault();
      if (alvoCartao) abrir(alvoCartao, aberto.aba, false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const indice = aberto ? ordem.findIndex((c) => c.id === aberto.cartao.id) : -1;
  const pill = (ativo: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${ativo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted hover:text-text"}`;

  return (
    <div>
      <Totais cartoes={visiveis} hoje={hoje} />
      <form
        className="mb-3 flex flex-wrap items-center gap-2"
        onChange={(e) => (e.target as HTMLElement).tagName === "SELECT" && e.currentTarget.requestSubmit()}
        onSubmit={() => setRapido("todos")}
      >
        <input type="hidden" name="vista" value="kanban" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={t("buscar")}
          aria-label={t("buscar")}
          className="border-border bg-background text-text focus:border-primary w-full max-w-xs rounded-full border px-4 py-1.5 text-sm outline-none"
        />
        <span role="group" aria-label={t("filtros.rapidos")} className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={rapido === "todos"}
            onClick={() => setRapido("todos")}
            className={pill(rapido === "todos")}
          >
            {t("filtros.todos")}
          </button>
          <button
            type="button"
            aria-pressed={rapido === "atrasados"}
            onClick={() => setRapido(rapido === "atrasados" ? "todos" : "atrasados")}
            className={pill(rapido === "atrasados")}
          >
            {t("filtros.atrasados", { n: atrasados })}
          </button>
          <button
            type="button"
            aria-pressed={rapido === "proximos"}
            onClick={() => setRapido(rapido === "proximos" ? "todos" : "proximos")}
            className={pill(rapido === "proximos")}
          >
            {t("filtros.proximos", { n: proximos, dias: diasDeAviso })}
          </button>
        </span>
        <select
          name="situacao"
          defaultValue={filtros.situacao}
          aria-label={tl("filtroSituacao")}
          className="border-border bg-background text-text rounded-full border px-3 py-1 text-xs"
        >
          <option value="">{tl("todasSituacoes")}</option>
          <option value="abertos">{tl("emAberto")}</option>
          {(["andamento", "suspenso", "concluido", "encerrado"] as const).map((x) => (
            <option key={x} value={x}>
              {tsit(x)}
            </option>
          ))}
        </select>
        <select
          name="lado"
          defaultValue={filtros.lado}
          aria-label={tl("filtroLado")}
          className="border-border bg-background text-text rounded-full border px-3 py-1 text-xs"
        >
          <option value="">{tl("todosLados")}</option>
          <option value="vendedor">{tl("ladoVendedor")}</option>
          <option value="comprador">{tl("ladoComprador")}</option>
        </select>
        <select
          name="tipo"
          defaultValue={filtros.tipo}
          aria-label={tl("filtroTipo")}
          className="border-border bg-background text-text rounded-full border px-3 py-1 text-xs"
        >
          <option value="">{tl("todosTipos")}</option>
          {tipos.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <span
          className="text-muted ml-auto flex flex-wrap items-center gap-3 text-xs"
          aria-label={t("legenda")}
        >
          {(["emDia", "proximo", "atrasado"] as const).map((n) => (
            <span key={n} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-sm ${CORES_DO_NIVEL[n].faixa}`} />{" "}
              {t(`niveis.${n}`, { dias: diasDeAviso })}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="bg-border inline-block h-2 w-2 rounded-sm" /> {t("niveis.semPrazo")}
          </span>
        </span>
      </form>
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid auto-cols-[minmax(12.5rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {todas.map((coluna, i) => {
          const daColuna = porColuna[i];
          if (coluna.id === "a-iniciar" && daColuna.length === 0) return null;
          const atrasadosDaColuna = daColuna.filter((c) => c.nivelDoPrazo === "atrasado").length;
          const valor = reais(daColuna.reduce((x, c) => x + (c.valorEstimado ?? 0), 0));
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
              className={`bg-surface min-w-0 rounded-xl border p-2.5 transition-colors ${sobre === coluna.id ? "border-primary bg-primary-soft" : "border-border"}`}
            >
              <header className="mb-2.5 px-1">
                <h3 className="flex items-center gap-2">
                  <IconeDaColuna nome={coluna.nome} indice={i} />
                  <span className="text-text min-w-0 truncate text-sm font-semibold" title={coluna.nome}>
                    {coluna.nome}
                  </span>
                  <span className="border-border bg-background text-muted rounded-full border px-1.5 text-[11px] tabular-nums">
                    {daColuna.length}
                  </span>
                </h3>
                <p className={`mt-1 text-[11px] ${atrasadosDaColuna ? "text-danger" : "text-muted"}`}>
                  {atrasadosDaColuna
                    ? t("colunaAtrasados", { n: atrasadosDaColuna, valor })
                    : t("colunaValor", { valor })}
                </p>
              </header>
              <ul className="flex min-h-16 flex-col gap-2">
                {daColuna.map((c) => {
                  const nivel = c.nivelDoPrazo;
                  const cor = nivel ? CORES_DO_NIVEL[nivel] : null;
                  const fundo = nivel === "atrasado" || nivel === "proximo" ? cor!.fundo : "bg-background";
                  return (
                    <li
                      key={c.id}
                      draggable={c.podeMover}
                      onDragStart={(e) => {
                        setArrastado(c.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setArrastado(null)}
                      style={{ viewTransitionName: animando === c.id ? "negocio-aberto" : undefined }}
                      className={`${fundo} border-border group hover:border-primary relative overflow-hidden rounded-lg border p-3 pl-4 text-xs transition-[border-color,transform] duration-150 hover:-translate-y-px ${c.podeMover ? "cursor-grab active:cursor-grabbing" : ""} ${aberto?.cartao.id === c.id ? "ring-primary ring-2" : ""}`}
                    >
                      <span
                        className={`absolute inset-y-0 left-0 w-1 ${cor ? cor.faixa : "bg-border"}`}
                        aria-hidden="true"
                      />
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => abrir(c)}
                          className="text-text text-left text-sm font-semibold break-words"
                        >
                          {c.nome}
                        </button>
                        <MenuDoCartao
                          cartao={c}
                          colunas={colunas}
                          abrir={(aba) => abrir(c, aba)}
                          mover={(col) => mover(c.id, col)}
                        />
                      </div>
                      {c.nomeInterno && <p className="text-muted break-words">{c.nomeInterno}</p>}
                      {c.vendedoras && c.vendedoras.length > 0 && (
                        <p className="text-muted mt-0.5 break-words">{c.vendedoras.join(", ")}</p>
                      )}
                      {c.situacao !== "andamento" && (
                        <p className="text-warning mt-1 font-medium">{ts(c.situacao as never)}</p>
                      )}
                      {c.funil && <MiniFunil funil={c.funil} />}
                      {c.progresso.total > 0 && (
                        <div
                          className="bg-border mt-2 h-1 overflow-hidden rounded-full"
                          title={t("progresso", { feitas: c.progresso.feitas, total: c.progresso.total })}
                        >
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${(c.progresso.feitas / c.progresso.total) * 100}%` }}
                          />
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <ChipDoPrazo cartao={c} hoje={hoje} />
                        <Fotos pessoas={c.pessoas} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      {aberto && (
        <PainelDoNegocio
          cartao={aberto.cartao}
          painel={aberto.painel}
          aba={aberto.aba}
          mudarAba={(aba) => {
            setAberto((x) => (x ? { ...x, aba } : x));
            escreverEndereco(aberto.cartao.id, aba);
          }}
          hoje={hoje}
          dias={diasDeAviso}
          posicao={{ i: Math.max(indice, 0) + 1, n: ordem.length }}
          anterior={indice > 0 ? () => abrir(ordem[indice - 1], aberto.aba, false) : null}
          proximo={
            indice >= 0 && indice < ordem.length - 1
              ? () => abrir(ordem[indice + 1], aberto.aba, false)
              : null
          }
          fechar={fechar}
          recarregar={(aba) => abrir(aberto.cartao, aba, false)}
          nomeDaTransicao={animando === null ? "negocio-aberto" : undefined}
        />
      )}
      {pendente && <AvisoDeMovimento texto={pendente.texto} desfazer={desfazer} />}
    </div>
  );
}
