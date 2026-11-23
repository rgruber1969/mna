import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * Skeletons das telas (propostas de layout v3, "Transições"): a geometria do
 * conteúdo final aparece no mesmo instante da navegação (nada pula quando o
 * conteúdo chega) e um brilho indica que está carregando. Só tokens
 * semânticos; o brilho e o "reduzir movimento" ficam em globals.css.
 */

function B({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`esqueleto block ${className}`} style={style} />;
}

/** Região anunciada aos leitores de tela enquanto carrega. */
function Carregando({ children }: { children: ReactNode }) {
  const t = useTranslations("comum.basicos");
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex flex-1 flex-col gap-4 px-3 py-4 sm:px-6"
    >
      <span className="sr-only">{t("carregando")}</span>
      {children}
    </div>
  );
}

/** Imitação da casca (menu lateral e barra superior) para a primeira carga. */
export function EsqueletoDaCasca({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1">
      <aside className="bg-background border-border fixed inset-y-0 left-0 hidden w-60 flex-col gap-3 border-r px-5 pt-5 md:flex">
        <B className="mb-4 h-7 w-32" />
        {Array.from({ length: 9 }, (_, i) => (
          <B key={i} className="h-5" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col md:pl-60">
        <div className="flex h-16 items-center gap-3 px-3 sm:px-6">
          <B className="h-9 w-9 rounded-full" />
          <B className="hidden h-9 w-80 rounded-full sm:block" />
          <span className="ml-auto flex gap-3">
            <B className="h-9 w-9 rounded-full" />
            <B className="h-9 w-9 rounded-full" />
            <B className="h-9 w-9 rounded-full" />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EsqueletoDoPainelConteudo() {
  return (
    <Carregando>
      <B className="h-4 w-2/3 max-w-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-background border-border space-y-2 rounded-xl border p-4">
            <B className="h-3 w-24" />
            <B className="h-8 w-12" />
            <B className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <div className="bg-background border-border space-y-4 rounded-xl border p-4">
          <B className="h-3 w-40" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-4">
              <B className="h-4" />
              <B className="h-4" />
              <B className="h-1.5" />
              <B className="h-5 rounded-full" />
              <B className="h-4" />
            </div>
          ))}
        </div>
        <div className="bg-background border-border space-y-3 rounded-xl border p-4">
          <B className="h-3 w-28" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <B key={i} className="h-12 rounded-lg" />
            ))}
          </div>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <B className="h-7 w-7 rounded-lg" />
              <span className="flex-1 space-y-1.5">
                <B className="h-3.5 w-3/4" />
                <B className="h-3 w-1/2" />
              </span>
            </div>
          ))}
        </div>
      </div>
    </Carregando>
  );
}

export function EsqueletoDoKanbanConteudo() {
  const cartoes = [2, 2, 2, 1, 1, 1];
  return (
    <Carregando>
      <div className="flex items-center justify-between">
        <B className="h-7 w-40" />
        <B className="h-9 w-36 rounded-md" />
      </div>
      <B className="h-16 rounded-xl" />
      <div className="grid auto-cols-[minmax(12rem,1fr)] grid-flow-col gap-3 overflow-hidden">
        {cartoes.map((n, i) => (
          <div key={i} className="bg-surface border-border space-y-3 rounded-xl border p-3">
            <span className="flex items-center gap-2">
              <B className="h-6 w-6 rounded-md" />
              <B className="h-4 w-24" />
            </span>
            {Array.from({ length: n }, (_, j) => (
              <div key={j} className="bg-background space-y-2 rounded-lg p-3">
                <B className="h-3 w-12" />
                <B className="h-4 w-3/4" />
                <B className="h-1.5" />
                <B className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Carregando>
  );
}

export function EsqueletoDeListaConteudo() {
  return (
    <Carregando>
      <div className="bg-background border-border space-y-4 rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <B className="h-7 w-48" />
          <B className="h-9 w-32 rounded-md" />
        </div>
        <div className="flex gap-3">
          <B className="h-9 w-64 rounded-md" />
          <B className="h-9 w-36 rounded-md" />
          <B className="h-9 w-36 rounded-md" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="border-border grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 border-t pt-3">
            <B className="h-4" />
            <B className="h-4" />
            <B className="h-4" />
            <B className="h-4" />
          </div>
        ))}
      </div>
    </Carregando>
  );
}

export function EsqueletoDoNegocioConteudo() {
  return (
    <Carregando>
      <div className="bg-background border-border space-y-5 rounded-xl border p-5">
        <B className="h-3 w-24" />
        <B className="h-7 w-72" />
        <B className="h-4 w-96 max-w-full" />
        <div className="flex justify-between gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <B className="h-5 w-5 rounded-full" />
              <B className="h-3 w-16" />
            </span>
          ))}
        </div>
        <div className="flex gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <B key={i} className="h-5 w-24" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="space-y-1.5">
              <B className="h-3 w-20" />
              <B className="h-4 w-36" />
            </span>
          ))}
        </div>
      </div>
    </Carregando>
  );
}

/** Primeira carga de uma tela do tenant: casca + conteúdo genérico (lista). */
export function EsqueletoDeTela() {
  return (
    <EsqueletoDaCasca>
      <EsqueletoDeListaConteudo />
    </EsqueletoDaCasca>
  );
}

export function EsqueletoDoPainel() {
  return (
    <EsqueletoDaCasca>
      <EsqueletoDoPainelConteudo />
    </EsqueletoDaCasca>
  );
}

export function EsqueletoDoKanban() {
  return (
    <EsqueletoDaCasca>
      <EsqueletoDoKanbanConteudo />
    </EsqueletoDaCasca>
  );
}

export function EsqueletoDoNegocio() {
  return (
    <EsqueletoDaCasca>
      <EsqueletoDoNegocioConteudo />
    </EsqueletoDaCasca>
  );
}
