"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Gaveta à direita (detalhe sem sair da tela): o conteúdo de fundo continua
 * visível; fecha com Esc, no fundo ou no botão. Largura padrão de 26 rem
 * (detalhes curtos); conteúdos maiores, como as ofertas, pedem mais.
 */
export function Gaveta({
  titulo,
  subtitulo,
  rotuloFechar,
  fechar,
  largura = "max-w-[26rem]",
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  rotuloFechar: string;
  fechar: () => void;
  largura?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement | null)?.closest?.("input, textarea, select"))
        fechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={rotuloFechar}
        onClick={fechar}
        className="bg-backdrop/25 absolute inset-0 animate-[aparecer_200ms_ease-out]"
      />
      <aside
        className={`bg-background border-border shadow-cartao relative flex h-full w-full ${largura} animate-[entrada-lateral_250ms_cubic-bezier(0.2,0.8,0.2,1)] flex-col border-l`}
      >
        <header className="border-border flex items-start gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-text text-lg font-bold tracking-tight">{titulo}</h2>
            {subtitulo && <p className="text-muted text-xs">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label={rotuloFechar}
            className="text-muted hover:bg-surface grid h-8 w-8 place-items-center rounded-full text-lg"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
