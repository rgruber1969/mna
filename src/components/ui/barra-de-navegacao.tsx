"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barra fina no topo durante a troca de tela (propostas de layout v3,
 * "Transições"): só aparece se a navegação passar de 300 ms (não pisca em
 * trocas rápidas); corre rápido até 30% e desacelera até 85% ("progresso
 * psicológico"); completa e some quando a nova tela chega. Complementa o
 * skeleton, nunca o substitui.
 */
export function BarraDeNavegacao() {
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [largura, setLargura] = useState(0);
  const [visivel, setVisivel] = useState(false);
  const tempos = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ativa = useRef(false);

  const limpar = () => {
    tempos.current.forEach(clearTimeout);
    tempos.current = [];
  };

  // Começa ao clicar num link interno que muda de tela.
  useEffect(() => {
    const clique = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const destino = new URL(a.href, window.location.href);
      if (destino.origin !== window.location.origin) return;
      if (destino.pathname === window.location.pathname && destino.search === window.location.search) return;
      limpar();
      ativa.current = true;
      tempos.current.push(
        setTimeout(() => {
          if (!ativa.current) return;
          setVisivel(true);
          setLargura(30);
          tempos.current.push(setTimeout(() => ativa.current && setLargura(85), 300));
        }, 300),
      );
    };
    document.addEventListener("click", clique, true);
    return () => document.removeEventListener("click", clique, true);
  }, []);

  // Termina quando o endereço muda (a nova tela chegou).
  useEffect(() => {
    if (!ativa.current) return;
    ativa.current = false;
    limpar();
    setLargura(100);
    tempos.current.push(
      setTimeout(() => {
        setVisivel(false);
        setLargura(0);
      }, 250),
    );
  }, [caminho, parametros]);

  return (
    <div
      aria-hidden="true"
      className="bg-primary pointer-events-none fixed top-0 left-0 z-[60] h-0.5"
      style={{
        width: `${largura}%`,
        opacity: visivel ? 1 : 0,
        transition:
          largura === 85
            ? "width 2.5s cubic-bezier(0.1, 0.6, 0.2, 1), opacity 250ms ease-out"
            : "width 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 250ms ease-out",
      }}
    />
  );
}
