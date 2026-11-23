"use client";

import { useState, type DragEvent } from "react";

/**
 * Ordenar arrastando (favoritos, etapas): a pessoa pega a linha pela alça
 * "⋮⋮", a lista se reorganiza enquanto ela arrasta e a nova ordem é gravada
 * ao soltar. Só a alça inicia o arraste (os campos da linha continuam
 * selecionáveis). Os botões ↑ ↓ de cada tela continuam como alternativa pelo
 * teclado. Listas aninhadas (subetapas) usam outra instância: os eventos não
 * sobem para a lista de fora.
 */
export function useOrdenacao<T extends { id: string }>(itens: T[], gravar: (ids: string[]) => void) {
  const original = itens.map((i) => i.id);
  const chave = original.join(",");
  // Ordem arrastada, guardada junto com a lista de onde saiu: quando o servidor manda uma
  // lista diferente (depois de gravar ou de outra mudança), volta a valer a dele.
  const [rascunho, setRascunho] = useState<{ base: string; ordem: string[] } | null>(null);
  const ordem = rascunho && rascunho.base === chave ? rascunho.ordem : original;
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [pegou, setPegou] = useState<string | null>(null);
  const porId = new Map(itens.map((i) => [i.id, i]));
  const lista = [
    ...ordem.flatMap((id) => (porId.has(id) ? [porId.get(id)!] : [])),
    ...itens.filter((i) => !ordem.includes(i.id)),
  ];

  const linha = (id: string) => ({
    draggable: pegou === id,
    "data-arrastando": arrastando === id ? "sim" : undefined,
    onDragStart: (e: DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      setArrastando(id);
    },
    onDragOver: (e: DragEvent) => {
      if (!arrastando || arrastando === id) return;
      e.preventDefault();
      e.stopPropagation();
      const sem = ordem.filter((x) => x !== arrastando);
      sem.splice(ordem.indexOf(id), 0, arrastando);
      setRascunho({ base: chave, ordem: sem });
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    onDragEnd: (e: DragEvent) => {
      e.stopPropagation();
      setArrastando(null);
      setPegou(null);
      if (ordem.join(",") !== chave) gravar(ordem);
    },
  });

  const alca = (id: string) => ({
    onPointerDown: () => setPegou(id),
    onPointerUp: () => setPegou((x) => (x === id && !arrastando ? null : x)),
  });

  return { lista, linha, alca, arrastando };
}

/** A alça "⋮⋮" (pegar para arrastar). */
export function AlcaDeArrastar({
  rotulo,
  ...props
}: { rotulo: string } & ReturnType<ReturnType<typeof useOrdenacao>["alca"]>) {
  return (
    <span
      {...props}
      role="img"
      aria-label={rotulo}
      title={rotulo}
      className="text-muted hover:text-primary inline-grid h-6 w-4 shrink-0 cursor-grab place-items-center select-none active:cursor-grabbing"
    >
      <svg viewBox="0 0 10 16" aria-hidden="true" className="h-4 w-2.5" fill="currentColor">
        <circle cx="2.5" cy="3" r="1.3" />
        <circle cx="7.5" cy="3" r="1.3" />
        <circle cx="2.5" cy="8" r="1.3" />
        <circle cx="7.5" cy="8" r="1.3" />
        <circle cx="2.5" cy="13" r="1.3" />
        <circle cx="7.5" cy="13" r="1.3" />
      </svg>
    </span>
  );
}
