"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Aviso } from "@/components/ui/basicos";

/** Mensagens da tela de entrada vindas de outras telas (ex.: passkey recém-cadastrada). */
export function AvisoDaEntrada() {
  const t = useTranslations("acesso.entrada");
  const params = useSearchParams();
  if (params.get("passkey") === "cadastrada") return <Aviso tipo="ok">{t("passkeyCadastrada")}</Aviso>;
  return null;
}
