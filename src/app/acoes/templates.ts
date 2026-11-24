"use server";

import { headers } from "next/headers";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import { gerarDocumentoDoTemplate } from "@/server/services/templates";

/** Templates DOCX (item 13, simulado): só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));

/** Devolve o DOCX gerado em base64 para o navegador baixar. */
export async function gerarDocumentoDoTemplateAcao(
  codigo: string,
  alvoId: string,
): Promise<{ nome?: string; conteudo?: string; erro?: string }> {
  const r = await gerarDocumentoDoTemplate(await acesso(), codigo, alvoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : r;
}
