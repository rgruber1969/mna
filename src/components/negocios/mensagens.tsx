"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  conversasDoNegocioAcao,
  enviarMensagemAcao,
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
  const [enviando, setEnviando] = useState(false);
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
    const r = await enviarMensagemAcao(dealId, alvo, canal, { texto, mencoes: [...mencoes] });
    setEnviando(false);
    if (r.erro) return setErro(r.erro);
    setTexto("");
    setMencoes(new Set());
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
            <Ajuda texto={t("canaisAjuda")} />
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
          {conversa.podeEscrever ? (
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void enviar();
              }}
            >
              <label className="block">
                <span className="text-text mb-1 block text-sm font-medium">{t("escrever")}</span>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void enviar();
                  }}
                  maxLength={5000}
                  rows={3}
                  className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
              {conversa.pessoas.length > 0 && (
                <fieldset className="mt-2">
                  <legend className="text-muted text-xs font-semibold">
                    {t("mencionar")} <Ajuda texto={t("mencionarAjuda")} />
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {conversa.pessoas.map((p) => (
                      <label
                        key={p.id}
                        className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${
                          mencoes.has(p.id)
                            ? "border-primary text-primary bg-primary-soft"
                            : "border-border text-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={mencoes.has(p.id)}
                          onChange={() => {
                            const n = new Set(mencoes);
                            if (n.has(p.id)) n.delete(p.id);
                            else n.add(p.id);
                            setMencoes(n);
                          }}
                        />
                        @{p.nome}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted text-xs">{t("imutavel")}</span>
                <button
                  type="submit"
                  disabled={enviando || !texto.trim()}
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
