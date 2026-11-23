"use client";

import type { ComponentProps } from "react";
import { lerNumero } from "@/config/ofertas";

/** "20000.5", "20.000,50" ou "20000" → "20.000,50" (vazio continua vazio). */
export function formatarValor(texto: string): string {
  const n = lerNumero(texto ?? "");
  if (n === null || Number.isNaN(Number(n))) return "";
  return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Só os dígitos digitados, lidos como centavos: "123456" → "1.234,56". */
function mascarar(digitado: string): string {
  const digitos = digitado
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 15);
  if (!digitos) return "";
  const centavos = digitos.padStart(3, "0");
  const inteiro = centavos.slice(0, -2).replace(/^0+(?=\d)/, "");
  return `${Number(inteiro).toLocaleString("pt-BR")},${centavos.slice(-2)}`;
}

/**
 * Campo de valor em reais com máscara (contratos e demais telas): a pessoa
 * digita só números e o campo formata na hora ("1.234,56"), com "R$" à
 * esquerda. O valor enviado é o texto formatado, que o servidor lê com
 * `lerNumero`.
 */
export function CampoDeValor({
  valor,
  mudar,
  erro = false,
  className = "",
  ...props
}: { valor: string; mudar: (v: string) => void; erro?: boolean } & Omit<
  ComponentProps<"input">,
  "value" | "onChange"
>) {
  return (
    <span className={`relative block ${className}`}>
      <span
        aria-hidden="true"
        className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
      >
        R$
      </span>
      <input
        {...props}
        inputMode="numeric"
        value={formatarValor(valor) === "" && valor !== "" ? valor : formatarValor(valor)}
        onChange={(e) => mudar(mascarar(e.target.value))}
        className={`${erro ? "border-danger" : "border-border"} bg-background text-text focus:border-primary w-full rounded-md border py-2 pr-3 pl-9 text-right text-sm tabular-nums outline-none`}
      />
    </span>
  );
}
