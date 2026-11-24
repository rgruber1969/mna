"use server";

import { headers } from "next/headers";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  aprovarVersaoDoEbook,
  comentarVersaoDoEbook,
  criarVersaoDoEbook,
  excluirVersaoDoEbook,
  liberarVersaoDoEbook,
  pdfDaVersaoDoEbook,
  type DadosVersaoDoEbook,
} from "@/server/services/ebook";

/** E-book e OnePager (item 19): só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
type Resposta = { erro?: string };

export async function criarVersaoDoEbookAcao(dealId: string, dados: DadosVersaoDoEbook): Promise<Resposta> {
  const r = await criarVersaoDoEbook(await acesso(), dealId, dados);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function comentarVersaoDoEbookAcao(versaoId: string, texto: string): Promise<Resposta> {
  const r = await comentarVersaoDoEbook(await acesso(), versaoId, texto);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function aprovarVersaoDoEbookAcao(versaoId: string): Promise<Resposta> {
  const r = await aprovarVersaoDoEbook(await acesso(), versaoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function liberarVersaoDoEbookAcao(versaoId: string): Promise<Resposta & { avisados?: number }> {
  const r = await liberarVersaoDoEbook(await acesso(), versaoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : { avisados: r.avisados };
}

export async function excluirVersaoDoEbookAcao(versaoId: string): Promise<Resposta> {
  const r = await excluirVersaoDoEbook(await acesso(), versaoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

/** PDF de exemplo da versão, em base64, para o navegador abrir ou baixar. */
export async function pdfDaVersaoDoEbookAcao(
  versaoId: string,
): Promise<{ nome?: string; conteudo?: string; erro?: string }> {
  const r = await pdfDaVersaoDoEbook(await acesso(), versaoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : r;
}
