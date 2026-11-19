"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

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

export type Aba = { id: string; rotulo: string };

export function Abas({ abas, inicial, children }: { abas: Aba[]; inicial?: string; children: ReactNode }) {
  const valida = abas.some((a) => a.id === inicial) ? inicial! : abas[0].id;
  const [ativa, setAtiva] = useState(valida);
  const [comErro, setComErro] = useState<Set<string>>(new Set());
  const raiz = useRef<HTMLDivElement>(null);

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
      <div ref={raiz} onInvalidCapture={(e) => revelarElemento(e.target as Element)}>
        <div role="tablist" className="border-border -mx-1 mb-4 flex gap-1 overflow-x-auto border-b">
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
                  ? "border-primary text-primary"
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
        </div>
        {children}
      </div>
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
