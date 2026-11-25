"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { perguntarAoSistemaAcao } from "@/app/acoes/assistente";
import { AvisoDeSimulacao } from "@/components/ui/aviso-de-simulacao";
import type { RespostaDoAssistente } from "@/server/services/assistente";

type Conversa = { pergunta: string; resposta?: RespostaDoAssistente; erro?: string };

/** Texto aparecendo aos poucos (efeito de assistente); sem animação para quem pediu menos movimento. */
function Digitando({ texto }: { texto: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    // Recomeça do zero porque quem usa troca a "key" a cada resposta.
    const passo = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? texto.length : 3;
    const id = setInterval(() => setN((x) => (x >= texto.length ? (clearInterval(id), x) : x + passo)), 16);
    return () => clearInterval(id);
  }, [texto]);
  return <>{texto.slice(0, n)}</>;
}

/**
 * Bloco "Pergunte ao sistema" da tela principal (simulado, sem IA): campo
 * para a pergunta, sugestões em botões e as respostas com links, a mais
 * recente em cima. Responde com os dados que a pessoa já vê nas telas.
 */
export function PergunteAoSistema({ simulado }: { simulado: boolean }) {
  const t = useTranslations("assistente");
  const [texto, setTexto] = useState("");
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [pensando, iniciar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);
  const sugestoes = [
    t("sugestoes.atrasados"),
    t("sugestoes.tarefas"),
    t("sugestoes.pedidos"),
    t("sugestoes.carteira"),
    t("sugestoes.documentos"),
  ];

  function perguntar(pergunta: string) {
    const p = pergunta.trim();
    if (p.length < 3 || pensando) return;
    setTexto("");
    setConversas((c) => [{ pergunta: p }, ...c].slice(0, 5));
    iniciar(async () => {
      const r = await perguntarAoSistemaAcao(p);
      setConversas((c) => c.map((x, i) => (i === 0 ? { ...x, ...r } : x)));
    });
  }

  return (
    <section
      aria-labelledby="pergunte-titulo"
      className="bg-background border-border shadow-cartao rounded-2xl border p-4 sm:p-5"
    >
      <h2 id="pergunte-titulo" className="text-text mb-1 text-base font-semibold">
        {t("titulo")}
      </h2>
      <p className="text-muted mb-3 text-sm">{t("subtitulo")}</p>
      {simulado && <AvisoDeSimulacao compacto texto={t("aviso")} />}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          perguntar(texto);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          ref={campo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={300}
          placeholder={t("exemplo")}
          aria-label={t("titulo")}
          className="border-border bg-background text-text focus:border-primary min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={pensando || texto.trim().length < 3}
          className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {t("perguntar")}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t("sugestoesRotulo")}>
        {sugestoes.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => perguntar(s)}
            className="border-border text-text hover:border-primary hover:text-primary rounded-full border px-3 py-1 text-xs"
          >
            {s}
          </button>
        ))}
      </div>
      {conversas.length > 0 && (
        <ol className="mt-4 space-y-4" aria-live="polite">
          {conversas.map((c, i) => (
            <li key={`${i}-${c.pergunta}`} className="space-y-2">
              <p className="bg-primary-soft text-text ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm">
                {c.pergunta}
              </p>
              <div className="bg-surface text-text w-fit max-w-[95%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
                {c.erro ? (
                  <span className="text-danger">{c.erro}</span>
                ) : !c.resposta ? (
                  <span className="text-muted inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="border-primary h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
                    />
                    {t("pensando")}
                  </span>
                ) : (
                  <>
                    <p className="whitespace-pre-line">
                      {i === 0 ? (
                        <Digitando key={c.resposta.texto} texto={c.resposta.texto} />
                      ) : (
                        c.resposta.texto
                      )}
                    </p>
                    {c.resposta.itens.length > 0 && (
                      <ul className="divide-border mt-2 divide-y">
                        {c.resposta.itens.map((it, j) => (
                          <li key={j} className="py-1.5">
                            {it.href ? (
                              <Link href={it.href} className="text-primary font-medium hover:underline">
                                {it.rotulo}
                              </Link>
                            ) : (
                              <span className="font-medium">{it.rotulo}</span>
                            )}
                            {it.detalhe && <span className="text-muted block text-xs">{it.detalhe}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {c.resposta.tipo === "ajuda" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {sugestoes.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => perguntar(s)}
                            className="border-border bg-background text-text hover:border-primary rounded-full border px-3 py-1 text-xs"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
