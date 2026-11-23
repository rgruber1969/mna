"use server";

import { headers } from "next/headers";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import { exportarLimpezaDaAuditoria } from "@/server/services/auditoria";

/** Auditoria: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));

export async function exportarLimpezaDaAuditoriaAcao(
  formato: "pdf" | "xlsx",
): Promise<{ nome?: string; conteudo?: string; tipo?: string; erro?: string }> {
  const r = await exportarLimpezaDaAuditoria(await acesso(), formato === "xlsx" ? "xlsx" : "pdf");
  return "erro" in r ? { erro: await traduzirErro(r) } : r;
}
