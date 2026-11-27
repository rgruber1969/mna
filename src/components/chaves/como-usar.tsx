"use client";

import { useState, type ReactNode } from "react";
import { Janela } from "@/components/ui/janela";

/**
 * Botão "Como usar a API" ao lado da ajuda, nas Chaves de API: abre numa janela
 * as instruções (montadas no servidor e recebidas prontas em `children`).
 */
export function BotaoComoUsarAApi({
  rotulo,
  rotuloFechar,
  children,
}: {
  rotulo: string;
  rotuloFechar: string;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="border-primary text-primary hover:bg-primary-soft rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
      >
        {rotulo}
      </button>
      {aberto && (
        <Janela
          titulo={rotulo}
          rotuloFechar={rotuloFechar}
          fechar={() => setAberto(false)}
          largura="max-w-3xl"
        >
          {children}
        </Janela>
      )}
    </>
  );
}
