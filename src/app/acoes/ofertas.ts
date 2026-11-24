"use server";

import { headers } from "next/headers";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  aceitarOferta,
  salvarCondicoesDaOferta,
  type DadosDasCondicoes,
  concluirArquivoDaOferta,
  criarOferta,
  editarOferta,
  excluirOferta,
  iniciarArquivoDaOferta,
  linkDoArquivoDaOferta,
  salvarRateioDoNegocio,
  type DadosOferta,
} from "@/server/services/ofertas";

/** Ofertas recebidas: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
type Resposta = { erro?: string; campo?: string };

export async function salvarOfertaAcao(
  dealId: string,
  id: string | null,
  dados: DadosOferta,
): Promise<Resposta & { id?: string }> {
  const r = id
    ? await editarOferta(await acesso(), id, dados)
    : await criarOferta(await acesso(), dealId, dados);
  if ("erro" in r) return { erro: await traduzirErro(r), campo: r.campo };
  return { id: "id" in r ? r.id : (id ?? undefined) };
}

export async function excluirOfertaAcao(id: string): Promise<Resposta> {
  const r = await excluirOferta(await acesso(), id);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function salvarRateioAcao(
  dealId: string,
  dados: { percentuais: { empresaId: string; percentual: string }[]; criterio: string },
): Promise<Resposta> {
  const r = await salvarRateioDoNegocio(await acesso(), dealId, dados);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function iniciarArquivoDaOfertaAcao(
  ofertaId: string,
  dados: { nomeArquivo: string; tamanho: number },
): Promise<{ arquivoId?: string; url?: string; erro?: string }> {
  const r = await iniciarArquivoDaOferta(await acesso(), ofertaId, dados);
  return "erro" in r ? { erro: await traduzirErro(r) } : r;
}

export async function concluirArquivoDaOfertaAcao(arquivoId: string): Promise<Resposta> {
  const r = await concluirArquivoDaOferta(await acesso(), arquivoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function linkDoArquivoDaOfertaAcao(arquivoId: string): Promise<{ url?: string; erro?: string }> {
  const r = await linkDoArquivoDaOferta(await acesso(), arquivoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : r;
}

export async function aceitarOfertaAcao(id: string): Promise<Resposta & { funil?: boolean }> {
  const r = await aceitarOferta(await acesso(), id);
  return "erro" in r ? { erro: await traduzirErro(r) } : { funil: r.funil };
}

export async function salvarCondicoesAcao(dealId: string, dados: DadosDasCondicoes): Promise<Resposta> {
  const r = await salvarCondicoesDaOferta(await acesso(), dealId, dados);
  return "erro" in r ? { erro: await traduzirErro(r), campo: r.campo } : {};
}
