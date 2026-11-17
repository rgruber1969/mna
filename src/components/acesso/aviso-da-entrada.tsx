"use client";

import { useSearchParams } from "next/navigation";
import { Aviso } from "@/components/ui/basicos";

/** Mensagens da tela de entrada vindas de outras telas (ex.: passkey recém-cadastrada). */
export function AvisoDaEntrada() {
  const params = useSearchParams();
  if (params.get("passkey") === "cadastrada")
    return <Aviso tipo="ok">Passkey cadastrada. Agora entre com ela.</Aviso>;
  return null;
}
