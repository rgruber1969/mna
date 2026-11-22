"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  avisarFinanceiro,
  concluirArquivoDoContrato,
  contasDasEmpresas,
  criarContrato,
  editarContrato,
  excluirContrato,
  iniciarArquivoDoContrato,
  linkDoArquivoDoContrato,
  type DadosContrato,
} from "@/server/services/contratos";

/** Contratos de serviço: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));

export async function salvarContratoAcao(
  id: string | null,
  dados: DadosContrato,
): Promise<{ id?: string; erro?: string; campo?: string }> {
  const r = id ? await editarContrato(await acesso(), id, dados) : await criarContrato(await acesso(), dados);
  if ("erro" in r) return { erro: await traduzirErro(r), campo: r.campo };
  revalidatePath("/contratos");
  return { id: "id" in r ? r.id : (id ?? undefined) };
}

export async function excluirContratoAcao(id: string): Promise<{ erro?: string }> {
  const r = await excluirContrato(await acesso(), id);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function contasDasEmpresasAcao(
  dealId: string | null,
  empresaIds: string[],
): Promise<{ id: string; empresaId: string; descricao: string; principal: boolean }[]> {
  return contasDasEmpresas(await acesso(), dealId, empresaIds);
}

export async function iniciarArquivoDoContratoAcao(
  contratoId: string,
  dados: { nomeArquivo: string; tamanho: number; comentario?: string },
): Promise<{ arquivoId?: string; url?: string; erro?: string }> {
  const r = await iniciarArquivoDoContrato(await acesso(), contratoId, dados);
  return "erro" in r ? { erro: await traduzirErro(r) } : r;
}

export async function concluirArquivoDoContratoAcao(arquivoId: string): Promise<{ erro?: string }> {
  const r = await concluirArquivoDoContrato(await acesso(), arquivoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function linkDoArquivoDoContratoAcao(
  arquivoId: string,
): Promise<{ url?: string; erro?: string }> {
  const r = await linkDoArquivoDoContrato(await acesso(), arquivoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : r;
}

export async function avisarFinanceiroAcao(id: string): Promise<{ enviados?: number; erro?: string }> {
  const r = await avisarFinanceiro(await acesso(), id);
  return "erro" in r ? { erro: await traduzirErro(r) } : r;
}
