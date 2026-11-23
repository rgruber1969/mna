"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Janela central (painel sobre a tela, com fundo escurecido): fecha com Esc,
 * no fundo ou no botão. Vai para o body, para nenhum ancestral com transform
 * prender o "fixed".
 */
export function Janela({
  titulo,
  rotuloFechar,
  fechar,
  largura = "max-w-3xl",
  children,
}: {
  titulo: ReactNode;
  rotuloFechar: string;
  fechar: () => void;
  largura?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label={rotuloFechar}
        onClick={fechar}
        className="bg-backdrop/45 absolute inset-0 animate-[aparecer_200ms_ease-out]"
      />
      <section
        className={`bg-background border-border shadow-cartao relative flex max-h-full w-full ${largura} animate-[aparecer_200ms_ease-out] flex-col overflow-hidden rounded-2xl border`}
      >
        <header className="border-border flex items-start gap-3 border-b px-5 py-4">
          <h2 className="text-text min-w-0 flex-1 text-lg font-bold tracking-tight">{titulo}</h2>
          <button
            type="button"
            onClick={fechar}
            aria-label={rotuloFechar}
            className="text-muted hover:bg-surface grid h-8 w-8 place-items-center rounded-full text-lg"
          >
            ×
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
