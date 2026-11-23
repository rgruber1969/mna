"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Indicador que desliza (propostas de layout v3; ui-motion, pílula/sublinhado
 * que desliza): mede a aba ativa (aria-selected) dentro da lista e devolve o
 * estilo do traço, que anima até o novo item em 300 ms (ease-out) em vez de
 * sumir de um lugar e aparecer no outro. Antes da medida (primeira pintura),
 * `pronto` é falso e a aba ativa usa a própria borda.
 */
export function useIndicadorDeslizante(
  lista: RefObject<HTMLElement | null>,
  ativa: string,
  seletor = '[aria-selected="true"]',
  modo: "traco" | "pilula" = "traco",
) {
  const [estilo, setEstilo] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    const medir = () => {
      const alvo = el.querySelector<HTMLElement>(seletor);
      if (!alvo) return setEstilo(null);
      // Pela posição na tela (o item pode estar dentro de outro elemento posicionado).
      const r = alvo.getBoundingClientRect();
      const c = el.getBoundingClientRect();
      const left = r.left - c.left + el.scrollLeft;
      const top = r.top - c.top + el.scrollTop;
      setEstilo(
        modo === "traco"
          ? { left, top: top + r.height - 2, width: r.width }
          : { left, top, width: r.width, height: r.height },
      );
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [lista, ativa, seletor, modo]);
  return { estilo, pronto: estilo !== null };
}

/** O traço em si (posição absoluta dentro da lista, que precisa ser `relative`). */
export function TracoDeslizante({ estilo }: { estilo: CSSProperties | null }) {
  if (!estilo) return null;
  return (
    <span
      aria-hidden="true"
      className="bg-primary pointer-events-none absolute h-0.5 rounded-full transition-[left,top,width] duration-300 ease-out motion-reduce:transition-none"
      style={estilo}
    />
  );
}

/** Fundo do item ativo do menu lateral, que desliza até o novo item. */
export function PilulaDeslizante({ estilo }: { estilo: CSSProperties | null }) {
  if (!estilo) return null;
  return (
    <span
      aria-hidden="true"
      className="bg-primary-soft pointer-events-none absolute -z-0 rounded-md transition-[left,top,width,height] duration-300 ease-out motion-reduce:transition-none"
      style={estilo}
    />
  );
}
