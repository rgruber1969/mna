"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { moverNegocioParaEtapaAcao, painelDoNegocioAcao } from "@/app/acoes/kanban";
import { EtapasDoNegocio } from "@/components/negocios/etapas";
import { DataRoomDoNegocio } from "@/components/negocios/documentos";
import { TarefasDoNegocio } from "@/components/negocios/tarefas";
import { Avatar, Aviso } from "@/components/ui/basicos";

/**
 * Kanban de negócios (item 15): colunas = etapas padrão, com ícone, total e
 * atrasados; cartão com faixa de cor pelo prazo estimado, progresso das
 * etapas, fotos das pessoas e menu "…"; busca no topo. Arrastar (ou "Mover
 * para") muda a etapa. Clicar abre o painel em abas, sem sair do quadro.
 */

type Nivel = "atrasado" | "proximo" | "atencao" | "emDia" | null;
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
  nivelDoPrazo: Nivel;
  progresso: { feitas: number; total: number };
};
type Painel = Awaited<ReturnType<typeof painelDoNegocioAcao>>;

const FUNIL = ["prospectada", "teaser", "nda", "proposta", "escolhida"] as const;
const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);
const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Cor da faixa e do prazo (tokens semânticos). */
const corDoNivel: Record<Exclude<Nivel, null>, { faixa: string; texto: string }> = {
  emDia: { faixa: "bg-success", texto: "text-success" },
  atencao: { faixa: "bg-warning opacity-60", texto: "text-warning" },
  proximo: { faixa: "bg-warning", texto: "text-warning" },
  atrasado: { faixa: "bg-danger", texto: "text-danger" },
};
/**
 * Ícone de cada coluna: fundo sólido nas cores da identidade visual (principal
 * e destaque, alternadas) e figura clara; desenho próprio para cada etapa
 * (pelo nome; etapas sem desenho conhecido usam a sequência de reserva).
 */
const coresDasColunas = ["bg-primary text-primary-foreground", "bg-accent text-accent-foreground"];
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

function IconeDaColuna({ nome, indice }: { nome: string; indice: number }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm ${coresDasColunas[indice % coresDasColunas.length]}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d={desenhoDa(nome, indice)} />
      </svg>
    </span>
  );
}

/** Menu "…" do cartão. */
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
        className="text-muted hover:text-text rounded px-1 text-base leading-none"
      >
        ⋮
      </button>
      {aberto && (
        <div
          role="menu"
          className="bg-background border-border absolute top-6 right-0 z-20 w-48 rounded-md border py-1 shadow-lg"
        >
          {item(t("detalhes"), () => abrir())}
          {item(t("verTarefas"), () => abrir("tarefas"))}
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
        <span className="bg-success/15 text-success -ml-2 flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-[10px] font-semibold">
          +{pessoas.length - 3}
        </span>
      )}
    </span>
  );
}

function AbasDoPainel({
  abas,
  ativa,
  mudar,
}: {
  abas: { id: string; rotulo: string }[];
  ativa: string;
  mudar: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="border-border mb-3 flex shrink-0 gap-1 overflow-x-auto overflow-y-hidden border-b"
    >
      {abas.map((a) => (
        <button
          key={a.id}
          type="button"
          role="tab"
          aria-selected={ativa === a.id}
          onClick={() => mudar(a.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${ativa === a.id ? "border-primary text-primary font-medium" : "text-muted border-transparent"}`}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="border-border flex gap-3 border-b py-1.5 text-sm last:border-0">
      <span className="text-muted w-40 shrink-0">{rotulo}</span>
      <span className="text-text">{children}</span>
    </div>
  );
}

export function KanbanDeNegocios({
  colunas,
  cartoes,
  hoje,
  filtros,
  tipos,
}: {
  colunas: { id: string; nome: string }[];
  cartoes: Cartao[];
  hoje: string;
  /** Filtros da lista (situação, lado, tipo), aplicados ao escolher. */
  filtros: { situacao: string; lado: string; tipo: string };
  tipos: { id: string; nome: string }[];
}) {
  const t = useTranslations("negocios.kanban");
  const tl = useTranslations("negocios.lista");
  const tsit = useTranslations("negocios.situacoes");
  const ts = useTranslations("negocios.situacoes");
  const tf = useTranslations("negocios.funil");
  const router = useRouter();
  const [movendo, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [arrastado, setArrastado] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [aberto, setAberto] = useState<{ cartao: Cartao; painel: Painel | undefined; aba: string } | null>(
    null,
  );
  const todas = [{ id: "a-iniciar", nome: t("aIniciar") }, ...colunas];
  const termo = semAcento(busca.trim());
  const visiveis = termo
    ? cartoes.filter((c) =>
        [
          c.nome,
          c.nomeInterno ?? "",
          ...(c.vendedoras ?? []),
          ...c.coordenadores,
          ...c.pessoas.map((p) => p.nome),
        ].some((x) => semAcento(x).includes(termo)),
      )
    : cartoes;

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

  async function abrir(c: Cartao, aba = "resumo") {
    setAberto({ cartao: c, painel: undefined, aba });
    const painel = await painelDoNegocioAcao(c.id);
    setAberto((x) => (x?.cartao.id === c.id ? { ...x, painel } : x));
  }

  const p = aberto?.painel;
  const c0 = aberto?.cartao;
  const abasDoPainel = [
    { id: "resumo", rotulo: t("abas.resumo") },
    ...(p?.etapas ? [{ id: "etapas", rotulo: t("abas.etapas") }] : []),
    { id: "empresas", rotulo: `${t("abas.empresas")} (${p?.empresas.length ?? 0})` },
    { id: "participantes", rotulo: `${t("abas.participantes")} (${p?.participantes.length ?? 0})` },
    ...(p?.tarefas ? [{ id: "tarefas", rotulo: t("abas.tarefas") }] : []),
    ...(p?.dataRoom ? [{ id: "documentos", rotulo: t("abas.documentos") }] : []),
    { id: "historico", rotulo: t("abas.historico") },
  ];

  return (
    <div>
      <form
        className="mb-3 flex flex-wrap items-center gap-2"
        onChange={(e) => (e.target as HTMLElement).tagName === "SELECT" && e.currentTarget.requestSubmit()}
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
        <select
          name="situacao"
          defaultValue={filtros.situacao}
          aria-label={tl("filtroSituacao")}
          className={"border-border bg-background text-text rounded-md border px-2 py-1.5 text-sm"}
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
          className={"border-border bg-background text-text rounded-md border px-2 py-1.5 text-sm"}
        >
          <option value="">{tl("todosLados")}</option>
          <option value="vendedor">{tl("ladoVendedor")}</option>
          <option value="comprador">{tl("ladoComprador")}</option>
        </select>
        <select
          name="tipo"
          defaultValue={filtros.tipo}
          aria-label={tl("filtroTipo")}
          className={"border-border bg-background text-text rounded-md border px-2 py-1.5 text-sm"}
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
          {(["emDia", "atencao", "proximo", "atrasado"] as const).map((n) => (
            <span key={n} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${corDoNivel[n].faixa}`} />{" "}
              {t(`niveis.${n}`)}
            </span>
          ))}
        </span>
      </form>
      {erro && <Aviso>{erro}</Aviso>}
      <div
        className={`grid auto-cols-[minmax(13rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 ${movendo ? "opacity-70" : ""}`}
      >
        {todas.map((coluna, i) => {
          const daColuna = visiveis.filter((c) => c.colunaId === coluna.id);
          const atrasados = daColuna.filter((c) => c.nivelDoPrazo === "atrasado").length;
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
              className={`bg-surface min-w-0 rounded-xl border p-3 ${sobre === coluna.id ? "border-primary" : "border-transparent"}`}
            >
              <header className="mb-3">
                <h3 className="text-text truncate text-sm font-semibold" title={coluna.nome}>
                  {coluna.nome}
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  <IconeDaColuna nome={coluna.nome} indice={i} />
                  <span>
                    <span className="text-text block text-xl leading-none font-bold">{daColuna.length}</span>
                    <span className={`text-xs ${atrasados ? "text-danger" : "text-muted"}`}>
                      {atrasados ? t("atrasados", { n: atrasados }) : t("negocios", { n: daColuna.length })}
                    </span>
                  </span>
                </div>
              </header>
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
                    className={`bg-background relative rounded-lg p-3 pl-4 text-xs shadow-sm ${c.podeMover ? "cursor-grab" : ""}`}
                  >
                    {c.nivelDoPrazo && (
                      <span
                        className={`absolute inset-y-0 left-0 w-1.5 rounded-l-lg ${corDoNivel[c.nivelDoPrazo].faixa}`}
                        aria-hidden="true"
                      />
                    )}
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
                    {c.funil && (
                      <ul className="mt-1 space-y-0.5">
                        {FUNIL.filter((s) => c.funil![s]?.length).map((s) => (
                          <li key={s} className="text-muted break-words">
                            <span className="text-text font-medium">{tf(s)}:</span> {c.funil![s].join(", ")}
                          </li>
                        ))}
                      </ul>
                    )}
                    {c.progresso.total > 0 && (
                      <div className="bg-surface mt-2 h-1.5 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${(c.progresso.feitas / c.progresso.total) * 100}%` }}
                        />
                      </div>
                    )}
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <span className="text-muted">
                        {t("progresso", { feitas: c.progresso.feitas, total: c.progresso.total })}
                        {c.prazo && (
                          <span
                            className={`block font-medium ${c.nivelDoPrazo ? corDoNivel[c.nivelDoPrazo].texto : ""}`}
                          >
                            {t("prazo", { data: br(c.prazo) ?? "" })}
                          </span>
                        )}
                      </span>
                      <Fotos pessoas={c.pessoas} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {aberto && c0 && (
        <div
          className="fixed inset-0 z-40 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={c0.nome}
        >
          <button
            type="button"
            aria-label={t("fechar")}
            onClick={() => setAberto(null)}
            className="bg-backdrop/40 absolute inset-0"
          />
          <aside className="bg-background relative flex h-full w-full max-w-3xl flex-col p-5 shadow-xl">
            <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
              <div>
                <h2 className="text-text text-lg font-bold">{c0.nome}</h2>
                <p className="text-muted text-sm">
                  {[c0.nomeInterno, ts(c0.situacao as never), c0.etapa && t("etapa", { etapa: c0.etapa })]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="flex items-center gap-3">
                <Link href={`/negocios/${c0.id}`} className="text-primary text-sm font-medium">
                  {t("abrirNegocio")}
                </Link>
                <button type="button" onClick={() => setAberto(null)} className="text-muted text-sm">
                  {t("fechar")}
                </button>
              </span>
            </div>
            {p === undefined ? (
              <p className="text-muted text-sm">{t("carregando")}</p>
            ) : p === null ? (
              <p className="text-muted text-sm">{t("semAcesso")}</p>
            ) : (
              <>
                <AbasDoPainel
                  abas={abasDoPainel}
                  ativa={aberto.aba}
                  mudar={(aba) => setAberto((x) => (x ? { ...x, aba } : x))}
                />
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {aberto.aba === "resumo" && (
                    <div>
                      {p.resumo?.nomeInterno && (
                        <Linha rotulo={t("resumo.nomeInterno")}>{p.resumo.nomeInterno}</Linha>
                      )}
                      {p.resumo?.tipo && <Linha rotulo={t("resumo.tipo")}>{p.resumo.tipo}</Linha>}
                      <Linha rotulo={t("resumo.situacao")}>{ts(c0.situacao as never)}</Linha>
                      <Linha rotulo={t("resumo.etapa")}>{c0.etapa ?? t("aIniciar")}</Linha>
                      {p.resumo && <Linha rotulo={t("resumo.inicio")}>{br(p.resumo.dataInicio)}</Linha>}
                      {p.resumo?.previsaoFechamento && (
                        <Linha rotulo={t("resumo.previsao")}>{br(p.resumo.previsaoFechamento)}</Linha>
                      )}
                      {c0.prazo && (
                        <Linha rotulo={t("resumo.prazo")}>
                          <span className={c0.nivelDoPrazo ? corDoNivel[c0.nivelDoPrazo].texto : ""}>
                            {br(c0.prazo)}
                            {c0.nivelDoPrazo && ` · ${t(`niveis.${c0.nivelDoPrazo}`)}`}
                          </span>
                        </Linha>
                      )}
                      {p.resumo?.valorEstimado && (
                        <Linha rotulo={t("resumo.valor")}>
                          {Number(p.resumo.valorEstimado).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </Linha>
                      )}
                      {c0.coordenadores.length > 0 && (
                        <Linha rotulo={t("resumo.coordenador")}>{c0.coordenadores.join(", ")}</Linha>
                      )}
                      {c0.funil && (
                        <Linha rotulo={t("resumo.funil")}>
                          {FUNIL.filter((s) => c0.funil![s]?.length)
                            .map((s) => `${tf(s)}: ${c0.funil![s].join(", ")}`)
                            .join(" · ")}
                        </Linha>
                      )}
                      {p.resumo?.descricao && (
                        <Linha rotulo={t("resumo.descricao")}>{p.resumo.descricao}</Linha>
                      )}
                    </div>
                  )}
                  {aberto.aba === "etapas" && p.etapas && (
                    <EtapasDoNegocio
                      dealId={c0.id}
                      etapas={p.etapas.etapas}
                      podeIncluir={p.etapas.podeIncluir}
                      podeExcluir={p.etapas.podeExcluir}
                      hoje={hoje}
                    />
                  )}
                  {aberto.aba === "empresas" && (
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
                  )}
                  {aberto.aba === "participantes" && (
                    <ul className="divide-border divide-y text-sm">
                      {p.participantes.map((x) => (
                        <li key={x.id} className="py-2">
                          <span className="text-text font-medium">{x.nome}</span>
                          <span className="text-muted block text-xs">
                            {[
                              x.perfil ?? t("contato"),
                              x.empresa,
                              x.prazo && t("ate", { data: br(x.prazo) ?? "" }),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {aberto.aba === "tarefas" && p.tarefas && (
                    <TarefasDoNegocio dealId={c0.id} quadro={p.tarefas} etapaFiltro="" />
                  )}
                  {aberto.aba === "documentos" && p.dataRoom && (
                    <DataRoomDoNegocio
                      dealId={c0.id}
                      dr={p.dataRoom}
                      etapaFiltro=""
                      aoMudar={() => abrir(c0, "documentos")}
                    />
                  )}
                  {aberto.aba === "historico" &&
                    (p.historico.length === 0 ? (
                      <p className="text-muted text-sm">{t("semEventos")}</p>
                    ) : (
                      <ul className="divide-border divide-y text-sm">
                        {p.historico.map((h, k) => (
                          <li key={k} className="py-1.5">
                            {h.texto}
                            <span className="text-muted block text-xs">{h.detalhe}</span>
                          </li>
                        ))}
                      </ul>
                    ))}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
