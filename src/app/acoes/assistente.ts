"use server";

import { headers } from "next/headers";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import { responderPergunta, type RespostaDoAssistente } from "@/server/services/assistente";

/** "Pergunte ao sistema" (simulado): só repassa para a camada de serviços (ADR-0004). */
export async function perguntarAoSistemaAcao(
  pergunta: string,
): Promise<{ erro?: string; resposta?: RespostaDoAssistente }> {
  const r = await responderPergunta(await obterAcesso(new Headers(await headers())), pergunta);
  return "erro" in r ? { erro: await traduzirErro(r) } : { resposta: r };
}
