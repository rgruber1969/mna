"use server";

import { headers } from "next/headers";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  aprovarVersaoDoEbook,
  comentarVersaoDoEbook,
  concluirVersaoDoEbook,
  criarVersaoDoEbook,
  excluirVersaoDoEbook,
  liberarVersaoDoEbook,
  pdfDaVersaoDoEbook,
  type DadosVersaoDoEbook,
} from "@/server/services/ebook";

/** E-book e OnePager (item 19): só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
type Resposta = { erro?: string };

/** Cria a versão; com arquivo, devolve o link para o navegador enviar o PDF ao data room. */
export async function criarVersaoDoEbookAcao(
  dealId: string,
  dados: DadosVersaoDoEbook,
): Promise<Resposta & { id?: string; url?: string }> {
  const r = await criarVersaoDoEbook(await acesso(), dealId, dados);
  return "erro" in r ? { erro: await traduzirErro(r) } : { id: r.id, url: r.url };
}

export async function concluirVersaoDoEbookAcao(versaoId: string): Promise<Resposta> {
  const r = await concluirVersaoDoEbook(await acesso(), versaoId);
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

/** Arquivo da versão: link do data room ou, nas versões antigas, o PDF de exemplo em base64. */
export async function pdfDaVersaoDoEbookAcao(
  versaoId: string,
): Promise<{ nome?: string; conteudo?: string; url?: string; erro?: string }> {
  const r = await pdfDaVersaoDoEbook(await acesso(), versaoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : r;
}
