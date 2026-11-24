"use client";

import { useState, type ReactNode } from "react";

/**
 * Alternador em pílulas dentro de uma aba (ex.: Atividade: Tarefas |
 * Mensagens), como no painel do negócio. Monta só a parte escolhida e guarda a
 * escolha no endereço (\`parametro\`), para voltar e recarregar no mesmo lugar.
 */
export function Alternador({
  partes,
  inicial,
  parametro,
}: {
  partes: { id: string; rotulo: string; conteudo: ReactNode }[];
  inicial?: string;
  parametro: string;
}) {
  const [atual, setAtual] = useState(partes.some((p) => p.id === inicial) ? inicial! : partes[0]?.id);
  function escolher(id: string) {
    setAtual(id);
    const url = new URL(window.location.href);
    url.searchParams.set(parametro, id);
    window.history.replaceState(window.history.state, "", url);
  }
  return (
    <div className="space-y-4">
      <div className="bg-surface inline-flex rounded-full p-0.5" role="group">
        {partes.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={atual === p.id}
            onClick={() => escolher(p.id)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              atual === p.id ? "bg-background text-text font-semibold shadow-sm" : "text-muted"
            }`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>
      {/* Só a parte escolhida é montada (ex.: mensagens só carregam e marcam como lidas quando abertas). */}
      {partes.find((p) => p.id === atual)?.conteudo}
    </div>
  );
}
