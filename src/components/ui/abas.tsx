"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { TracoDeslizante, useIndicadorDeslizante } from "@/components/ui/indicador";

/**
 * Abas das telas de cadastro (decisão menor "Telas de cadastro grandes"):
 * - os painéis escondidos continuam no formulário (um único Salvar; trocar de
 *   aba não perde o que foi digitado);
 * - campo inválido numa aba escondida abre essa aba sozinho, e a aba ganha
 *   um sinal de alerta; erros do servidor com o nome do campo também;
 * - a aba aberta fica no endereço (?aba=), para recarregar ou mandar o link.
 * Fora de <Abas>, um <PainelDeAba> aparece sempre (ex.: tela de criação).
 */

type Contexto = {
  ativa: string;
  ativar: (id: string) => void;
  /** Abre a aba do campo com este nome e marca o alerta. */
  revelarCampo: (nome: string) => void;
};

const ContextoDasAbas = createContext<Contexto | null>(null);

export const useAbas = () => useContext(ContextoDasAbas);

export type Aba = { id: string; rotulo: string; /** Grupo (só nas abas verticais). */ grupo?: string };

/**
 * Com `vertical`, as abas ficam numa coluna à esquerda, em grupos com título
 * (padrão para 8 abas ou mais, como Configurações); o conteúdo fica à direita.
 */
export function Abas({
  abas,
  inicial,
  vertical = false,
  children,
}: {
  abas: Aba[];
  inicial?: string;
  vertical?: boolean;
  children: ReactNode;
}) {
  const valida = abas.some((a) => a.id === inicial) ? inicial! : abas[0].id;
  const [ativa, setAtiva] = useState(valida);
  const [comErro, setComErro] = useState<Set<string>>(new Set());
  const raiz = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const { estilo, pronto } = useIndicadorDeslizante(lista, vertical ? "" : ativa);

  const ativar = useCallback((id: string) => {
    setAtiva(id);
    setComErro((s) => {
      if (!s.has(id)) return s;
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    const url = new URL(window.location.href);
    url.searchParams.set("aba", id);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  /** Mostra na hora o painel do elemento (antes de o navegador tentar focar o campo). */
  const revelarElemento = useCallback((el: Element | null) => {
    const painel = el?.closest<HTMLElement>("[data-aba]");
    if (!painel) return;
    const id = painel.dataset.aba!;
    raiz.current?.querySelectorAll<HTMLElement>(`[data-aba="${id}"]`).forEach((p) => (p.hidden = false));
    setComErro((s) => new Set(s).add(id));
    setAtiva(id);
  }, []);

  const revelarCampo = useCallback(
    (nome: string) => {
      const campo = raiz.current?.querySelector(`[name="${CSS.escape(nome)}"]`) ?? null;
      revelarElemento(campo);
      (campo as HTMLElement | null)?.focus();
    },
    [revelarElemento],
  );

  return (
    <ContextoDasAbas.Provider value={{ ativa, ativar, revelarCampo }}>
      {vertical ? (
        <div
          ref={raiz}
          onInvalidCapture={(e) => revelarElemento(e.target as Element)}
          className="grid gap-6 md:grid-cols-[14rem_1fr]"
        >
          <div
            role="tablist"
            aria-orientation="vertical"
            className="md:border-border flex flex-col gap-0.5 md:border-r md:pr-3"
          >
            {abas.map((a, i) => (
              <span key={a.id} className="contents">
                {a.grupo && a.grupo !== abas[i - 1]?.grupo && (
                  <span className="text-muted px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider uppercase first:pt-0">
                    {a.grupo}
                  </span>
                )}
                <button
                  type="button"
                  role="tab"
                  id={`aba-${a.id}`}
                  aria-selected={ativa === a.id}
                  onClick={() => ativar(a.id)}
                  className={`relative rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 ${
                    ativa === a.id
                      ? "bg-primary-soft text-primary font-semibold"
                      : "text-text hover:bg-surface font-medium"
                  }`}
                >
                  {ativa === a.id && (
                    <span
                      aria-hidden="true"
                      className="bg-primary absolute inset-y-1.5 left-0 w-0.5 rounded-full"
                    />
                  )}
                  {a.rotulo}
                  {comErro.has(a.id) && (
                    <span
                      aria-label="!"
                      className="bg-danger ml-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    />
                  )}
                </button>
              </span>
            ))}
          </div>
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        <div ref={raiz} onInvalidCapture={(e) => revelarElemento(e.target as Element)}>
          <div
            ref={lista}
            role="tablist"
            className="border-border relative -mx-1 mb-4 flex flex-wrap gap-x-1 border-b"
          >
            {abas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`aba-${a.id}`}
                aria-selected={ativa === a.id}
                onClick={() => ativar(a.id)}
                className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${
                  ativa === a.id
                    ? `${pronto ? "border-transparent" : "border-primary"} text-primary`
                    : "text-muted hover:text-text border-transparent"
                }`}
              >
                {a.rotulo}
                {comErro.has(a.id) && (
                  <span
                    aria-label="!"
                    className="bg-danger ml-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  />
                )}
              </button>
            ))}
            <TracoDeslizante estilo={estilo} />
          </div>
          {children}
        </div>
      )}
    </ContextoDasAbas.Provider>
  );
}

/** Conteúdo de uma aba. Pode haver mais de um painel com o mesmo id (ex.: dentro e fora do formulário). */
export function PainelDeAba({ id, children }: { id: string; children: ReactNode }) {
  const abas = useAbas();
  if (!abas) return <>{children}</>;
  return (
    <div role="tabpanel" data-aba={id} aria-labelledby={`aba-${id}`} hidden={abas.ativa !== id}>
      {children}
    </div>
  );
}

/** Só mostra o conteúdo quando uma das abas indicadas está aberta (ex.: o botão Salvar). */
export function SoNasAbas({ ids, children }: { ids: string[]; children: ReactNode }) {
  const abas = useAbas();
  if (abas && !ids.includes(abas.ativa)) return null;
  return <>{children}</>;
}
