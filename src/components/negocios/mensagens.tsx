"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  conversasDoNegocioAcao,
  enviarMensagemAcao,
  anexoParaDocumentoAcao,
  concluirAnexoAcao,
  iniciarAnexoAcao,
  linkDoAnexoAcao,
  mensagemParaTarefaAcao,
  obterConversaAcao,
} from "@/app/acoes/mensagens";
import { useAbas } from "@/components/ui/abas";
import { Ajuda, Aviso } from "@/components/ui/basicos";
import type { Conversa, ResumoDeConversa } from "@/server/services/mensagens";

/**
 * Aba Mensagens do negócio (item 16): à esquerda as conversas (geral,
 * etapas, documentos e tarefas com mensagens); à direita a conversa, por
 * canal. Sem tempo real: recarrega a cada 20 segundos enquanto aberta.
 */

const INTERVALO = 20_000;
const chaveDoAlvo = (a: { tipo: string; id: string | null }) => `${a.tipo}:${a.id ?? "-"}`;

export function rotuloDoCanal(
  t: ReturnType<typeof useTranslations>,
  c: { tipo: "vendedor" | "equipe" | "entre"; compradora: string | null },
) {
  return t(`canais.${c.tipo}`, { compradora: c.compradora ?? "" });
}

export function MensagensDoNegocio({
  dealId,
  conversaInicial,
  canalInicial,
}: {
  dealId: string;
  conversaInicial?: string;
  canalInicial?: string;
}) {
  const t = useTranslations("mensagens");
  const [lista, setLista] = useState<ResumoDeConversa[] | null>(null);
  const [atual, setAtual] = useState(conversaInicial || "deal:-");
  const [canal, setCanal] = useState<string | null>(canalInicial ?? null);

  const recarregarLista = useCallback(async () => {
    setLista(await conversasDoNegocioAcao(dealId));
  }, [dealId]);
  useEffect(() => {
    const primeira = setTimeout(() => void recarregarLista(), 0);
    const id = setInterval(() => void recarregarLista(), INTERVALO);
    return () => {
      clearTimeout(primeira);
      clearInterval(id);
    };
  }, [recarregarLista]);

  function abrir(chave: string) {
    setAtual(chave);
    setCanal(null);
    const q = new URLSearchParams(window.location.search);
    q.set("aba", "mensagens");
    q.set("conversa", chave);
    q.delete("canal");
    window.history.replaceState(null, "", `?${q.toString()}`);
  }

  const etapas = lista?.filter((c) => c.alvo.tipo === "etapa") ?? [];
  const outros = lista?.filter((c) => c.alvo.tipo === "versao" || c.alvo.tipo === "tarefa") ?? [];
  const geral = lista?.find((c) => c.alvo.tipo === "deal");
  const item = (c: ResumoDeConversa, rotulo: string) => {
    const chave = chaveDoAlvo(c.alvo);
    const ativo = chave === atual;
    return (
      <li key={chave}>
        <button
          type="button"
          onClick={() => abrir(chave)}
          aria-current={ativo ? "true" : undefined}
          className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
            ativo ? "bg-primary-soft text-primary font-medium" : "text-text hover:bg-surface"
          }`}
        >
          <span className="min-w-0 truncate">{rotulo}</span>
          <span className="flex shrink-0 items-center gap-1">
            {c.total > 0 && <span className="text-muted text-xs">{c.total}</span>}
            {c.naoLidas > 0 && (
              <span className="bg-danger text-primary-foreground rounded-full px-1.5 text-xs font-semibold">
                {c.naoLidas}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <nav aria-label={t("titulo")} className="border-border md:border-r md:pr-3">
        {!lista ? (
          <p className="text-muted text-sm">{t("carregando")}</p>
        ) : (
          <>
            <ul>{geral && item(geral, t("geral"))}</ul>
            {etapas.length > 0 && (
              <>
                <p className="text-muted mt-3 mb-1 px-2 text-xs font-semibold uppercase">
                  {t("grupoEtapas")}
                </p>
                <ul>{etapas.map((c) => item(c, c.rotulo))}</ul>
              </>
            )}
            {outros.length > 0 && (
              <>
                <p className="text-muted mt-3 mb-1 px-2 text-xs font-semibold uppercase">
                  {t("grupoOutros")}
                </p>
                <ul>{outros.map((c) => item(c, `${t(`tipos.${c.alvo.tipo}`)}: ${c.rotulo}`))}</ul>
              </>
            )}
          </>
        )}
      </nav>
      <ConversaDoItem
        key={atual}
        dealId={dealId}
        alvo={atual}
        canalInicial={canal}
        aoMudar={() => void recarregarLista()}
      />
    </div>
  );
}

/** Uma conversa (qualquer item), com abas por canal, envio, menções e "marcar como tarefa". */
export function ConversaDoItem({
  dealId,
  alvo,
  canalInicial,
  aoMudar,
}: {
  dealId: string;
  alvo: string;
  canalInicial?: string | null;
  aoMudar?: () => void;
}) {
  const t = useTranslations("mensagens");
  const formato = useFormatter();
  const router = useRouter();
  const [conversa, setConversa] = useState<Conversa | null | undefined>(undefined);
  const [canal, setCanal] = useState<string | null>(canalInicial ?? null);
  const [texto, setTexto] = useState("");
  const [mencoes, setMencoes] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pendentes, setPendentes] = useState<{ chave: string; nome: string; id?: string; erro?: string }[]>(
    [],
  );
  const enviandoAnexo = pendentes.some((x) => !x.id && !x.erro);
  async function anexar(arquivos: FileList | null) {
    for (const arquivo of [...(arquivos ?? [])].slice(0, 10)) {
      const chave = `${arquivo.name}-${arquivo.size}-${Date.now()}`;
      setPendentes((p) => [...p, { chave, nome: arquivo.name }]);
      const marcar = (x: { id?: string; erro?: string }) =>
        setPendentes((p) => p.map((y) => (y.chave === chave ? { ...y, ...x } : y)));
      const inicio = await iniciarAnexoAcao(dealId, { nomeArquivo: arquivo.name, tamanho: arquivo.size });
      if (inicio.erro || !inicio.url || !inicio.anexoId) {
        marcar({ erro: inicio.erro ?? t("erroAnexo") });
        continue;
      }
      const envio = await fetch(inicio.url, {
        method: "PUT",
        body: arquivo,
        headers: { "content-type": "application/octet-stream" },
      }).catch(() => null);
      const fim = envio?.ok ? await concluirAnexoAcao(inicio.anexoId) : { erro: t("erroAnexo") };
      marcar(fim.erro ? { erro: fim.erro } : { id: inicio.anexoId });
    }
  }
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(
    async (c: string | null) => {
      const r = await obterConversaAcao(dealId, alvo, c);
      setConversa(r);
      if (r?.canal) setCanal(r.canal);
      aoMudar?.();
    },
    // aoMudar muda a cada renderização do pai; a conversa só depende do item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dealId, alvo],
  );
  useEffect(() => {
    const primeira = setTimeout(() => void carregar(canal), 0);
    const id = setInterval(() => void carregar(canal), INTERVALO);
    return () => {
      clearTimeout(primeira);
      clearInterval(id);
    };
  }, [carregar, canal]);
  const total = conversa?.mensagens.length ?? 0;
  useEffect(() => {
    const caixa = fim.current?.parentElement;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
  }, [total]);

  if (conversa === undefined) return <p className="text-muted text-sm">{t("carregando")}</p>;
  if (conversa === null) return <Aviso>{t("erros.naoEncontrada")}</Aviso>;

  async function enviar() {
    if (!canal || !texto.trim()) return;
    setEnviando(true);
    setErro(null);
    const validas = (conversa?.pessoas ?? []).filter(
      (p) => mencoes.has(p.id) && texto.includes(`@${p.nome}`),
    );
    const r = await enviarMensagemAcao(dealId, alvo, canal, {
      texto,
      mencoes: validas.map((p) => p.id),
      anexos: pendentes.filter((x) => x.id && !x.erro).map((x) => x.id!),
    });
    setEnviando(false);
    if (r.erro) return setErro(r.erro);
    setTexto("");
    setMencoes(new Set());
    setPendentes([]);
    await carregar(canal);
  }

  return (
    <section aria-label={conversa.rotulo || t("geral")} className="min-w-0">
      <h3 className="text-text mb-2 font-semibold">
        {conversa.alvo.tipo === "deal"
          ? t("geral")
          : `${t(`tipos.${conversa.alvo.tipo}`)}: ${conversa.rotulo}`}
      </h3>
      {conversa.canais.length === 0 ? (
        <p className="text-muted text-sm">{t("semCanal")}</p>
      ) : (
        <>
          <div role="tablist" aria-label={t("titulo")} className="mb-3 flex flex-wrap items-center gap-2">
            {conversa.canais.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === canal}
                onClick={() => {
                  setCanal(c.id);
                  setMencoes(new Set());
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  c.id === canal
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted hover:text-primary"
                }`}
              >
                {rotuloDoCanal(t, c)}
                {c.naoLidas > 0 && ` (${c.naoLidas})`}
              </button>
            ))}
            <Ajuda
              texto={`${t("canaisAjuda")}

${t("regras")}`}
            />
          </div>
          <div className="border-border bg-background max-h-[28rem] overflow-y-auto rounded-md border p-3">
            {conversa.mensagens.length === 0 ? (
              <p className="text-muted text-sm">{t("nenhuma")}</p>
            ) : (
              <ul className="space-y-3">
                {conversa.mensagens.map((m) => (
                  <li key={m.id} className={`flex ${m.minha ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        m.minha ? "bg-primary-soft text-text" : "bg-surface text-text"
                      }`}
                    >
                      <p className="text-muted mb-0.5 text-xs">
                        <span className="text-text font-semibold">
                          {m.minha ? t("voce") : (m.autor ?? t("removido"))}
                        </span>{" "}
                        · {formato.dateTime(new Date(m.em), { dateStyle: "short", timeStyle: "short" })}
                      </p>
                      <p className="break-words whitespace-pre-wrap">{m.texto}</p>
                      {m.anexos.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {m.anexos.map((x) => (
                            <li key={x.id} className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="text-primary underline"
                                onClick={async () => {
                                  const r = await linkDoAnexoAcao(x.id);
                                  if (r.erro || !r.url) return setErro(r.erro ?? t("erroAnexo"));
                                  window.location.assign(r.url);
                                }}
                              >
                                📎 {x.nome}
                              </button>
                              <span className="text-muted">
                                {Math.max(1, Math.round(x.tamanho / 1024))} KB
                              </span>
                              {conversa.podeEscrever && (
                                <button
                                  type="button"
                                  className="text-muted hover:text-primary"
                                  onClick={async () => {
                                    const r = await anexoParaDocumentoAcao(x.id);
                                    if (r.erro) return setErro(r.erro);
                                    setErro(null);
                                    setAviso(t("virouDocumento", { nome: x.nome }));
                                    router.refresh();
                                  }}
                                >
                                  {t("virarDocumento")}
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {m.mencoes.length > 0 && (
                        <p className="text-primary mt-1 text-xs">
                          {t("mencionou", { nomes: m.mencoes.join(", ") })}
                        </p>
                      )}
                      <div className="mt-1 flex gap-3 text-xs">
                        {m.tarefaId ? (
                          <a href={`?aba=tarefas`} className="text-primary">
                            {t("verTarefa")}
                          </a>
                        ) : (
                          conversa.podeVirarTarefa && (
                            <button
                              type="button"
                              className="text-muted hover:text-primary"
                              onClick={async () => {
                                const r = await mensagemParaTarefaAcao(m.id);
                                if (r.erro) return setErro(r.erro);
                                await carregar(canal);
                                router.refresh();
                              }}
                            >
                              {t("virarTarefa")}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div ref={fim} />
          </div>
          {erro && <Aviso>{erro}</Aviso>}
          {aviso && <Aviso tipo="ok">{aviso}</Aviso>}
          {conversa.podeEscrever ? (
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void enviar();
              }}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <label className="border-primary text-primary cursor-pointer rounded-md border px-3 py-1 text-xs font-medium">
                  📎 {t("anexar")}
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      void anexar(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {pendentes.map((x) => (
                  <span
                    key={x.chave}
                    className={`rounded-full border px-2 py-0.5 text-xs ${x.erro ? "border-danger text-danger" : "border-border text-muted"}`}
                  >
                    {x.nome} · {x.erro ?? (x.id ? t("anexoPronto") : t("anexoEnviando"))}
                    <button
                      type="button"
                      aria-label={t("tirarAnexo", { nome: x.nome })}
                      onClick={() => setPendentes((p) => p.filter((y) => y.chave !== x.chave))}
                      className="ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <CaixaComMencoes
                texto={texto}
                mudar={setTexto}
                pessoas={conversa.pessoas}
                aoMencionar={(id) => setMencoes((m) => new Set(m).add(id))}
                aoEnviar={() => void enviar()}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted text-xs">{t("imutavel")}</span>
                <button
                  type="submit"
                  disabled={enviando || enviandoAnexo || !texto.trim()}
                  className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {enviando ? t("enviando") : t("enviar")}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-muted mt-3 text-sm">{t("fechado")}</p>
          )}
        </>
      )}
    </section>
  );
}

/** Só carrega (e marca como lido) quando a aba Mensagens está aberta. */
export function AbaDeMensagens(props: Parameters<typeof MensagensDoNegocio>[0]) {
  const abas = useAbas();
  if (abas && abas.ativa !== "mensagens") return null;
  return <MensagensDoNegocio {...props} />;
}

const semAcento = (x: string) =>
  x
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Caixa da mensagem com sugestões de menção: ao digitar "@" e o começo do
 * nome, aparecem as pessoas do canal; Enter, Tab ou clique escolhe.
 */
function CaixaComMencoes({
  texto,
  mudar,
  pessoas,
  aoMencionar,
  aoEnviar,
}: {
  texto: string;
  mudar: (t: string) => void;
  pessoas: { id: string; nome: string }[];
  aoMencionar: (id: string) => void;
  aoEnviar: () => void;
}) {
  const t = useTranslations("mensagens");
  const campo = useRef<HTMLTextAreaElement>(null);
  const [busca, setBusca] = useState<{ inicio: number; termo: string } | null>(null);
  const [indice, setIndice] = useState(0);
  const opcoes = busca
    ? pessoas.filter((p) => semAcento(p.nome).includes(semAcento(busca.termo))).slice(0, 6)
    : [];

  function lerBusca(valor: string, cursor: number) {
    const antes = valor.slice(0, cursor);
    const m = /(^|\s)@([^\s@]{0,40})$/u.exec(antes);
    setBusca(m ? { inicio: cursor - m[2].length - 1, termo: m[2] } : null);
    setIndice(0);
  }

  function escolher(p: { id: string; nome: string }) {
    if (!busca) return;
    const cursor = busca.inicio + 1 + busca.termo.length;
    const novo = `${texto.slice(0, busca.inicio)}@${p.nome} ${texto.slice(cursor)}`;
    mudar(novo);
    aoMencionar(p.id);
    setBusca(null);
    const pos = busca.inicio + p.nome.length + 2;
    requestAnimationFrame(() => {
      campo.current?.focus();
      campo.current?.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <label className="block">
        <span className="text-text mb-1 block text-sm font-medium">{t("escrever")}</span>
        <textarea
          ref={campo}
          value={texto}
          onChange={(e) => {
            mudar(e.target.value);
            lerBusca(e.target.value, e.target.selectionStart);
          }}
          onClick={(e) => lerBusca(texto, e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (opcoes.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                return setIndice((i) => (i + 1) % opcoes.length);
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                return setIndice((i) => (i - 1 + opcoes.length) % opcoes.length);
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                return escolher(opcoes[indice]);
              }
              if (e.key === "Escape") return setBusca(null);
            }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) aoEnviar();
          }}
          onBlur={() => setTimeout(() => setBusca(null), 150)}
          maxLength={5000}
          rows={3}
          placeholder={pessoas.length > 0 ? t("dicaMencao") : undefined}
          aria-autocomplete="list"
          className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm"
        />
      </label>
      {opcoes.length > 0 && (
        <ul
          role="listbox"
          aria-label={t("mencionar")}
          className="border-border bg-background shadow-cartao absolute z-10 mt-1 w-72 overflow-hidden rounded-md border"
        >
          {opcoes.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === indice}
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(p);
              }}
              onMouseEnter={() => setIndice(i)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${i === indice ? "bg-primary-soft text-primary" : "text-text"}`}
            >
              @{p.nome}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted mt-1 text-xs">{t("mencionarAjuda")}</p>
    </div>
  );
}
