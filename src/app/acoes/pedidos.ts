"use server";

import { headers } from "next/headers";
import { traduzirErro } from "@/i18n/servidor";
import type { SituacaoDoItem } from "@/config/pedidos";
import { obterAcesso } from "@/server/services/acesso";
import {
  criarPedido,
  criarPedidoPorRediligencia,
  criarRodada,
  definirPrioridades,
  definirSituacaoDoItem,
  editarPedido,
  excluirFonte,
  excluirItem,
  excluirPedido,
  exportarPedido,
  importarPlanilhaDoPedido,
  aprovarEnvioSemNda,
  ligarDocumentoAoItem,
  salvarFonte,
  salvarItem,
  type AbaImportada,
  type DadosDaFonteEntrada,
  type DadosDoItemEntrada,
  type DadosDoPedidoEntrada,
} from "@/server/services/pedidos";

/** Pedidos de documentos: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
type Resposta = { erro?: string; campo?: string };
const erro = async (r: { erro: string; campo?: string }) => ({ erro: await traduzirErro(r), campo: r.campo });

export async function salvarPedidoAcao(
  dealId: string,
  id: string | null,
  dados: DadosDoPedidoEntrada,
  origemId?: string,
): Promise<Resposta & { id?: string }> {
  const a = await acesso();
  const r = id
    ? await editarPedido(a, id, dados)
    : origemId
      ? await criarPedidoPorRediligencia(a, dealId, origemId, dados)
      : await criarPedido(a, dealId, dados);
  if ("erro" in r) return erro(r);
  return { id: "id" in r && typeof r.id === "string" ? r.id : (id ?? undefined) };
}

export async function excluirPedidoAcao(id: string): Promise<Resposta> {
  const r = await excluirPedido(await acesso(), id);
  return "erro" in r ? erro(r) : {};
}

export async function criarRodadaAcao(pedidoId: string, nome: string, data: string): Promise<Resposta> {
  const r = await criarRodada(await acesso(), pedidoId, nome, data);
  return "erro" in r ? erro(r) : {};
}

export async function salvarItemAcao(
  pedidoId: string,
  itemId: string | null,
  dados: DadosDoItemEntrada,
): Promise<Resposta & { id?: string }> {
  const r = await salvarItem(await acesso(), pedidoId, itemId, dados);
  return "erro" in r ? erro(r) : { id: r.id };
}

export async function situacaoDoItemAcao(
  itemId: string,
  periodo: string,
  situacao: SituacaoDoItem,
): Promise<Resposta> {
  const r = await definirSituacaoDoItem(await acesso(), itemId, periodo, situacao);
  return "erro" in r ? erro(r) : {};
}

export async function excluirItemAcao(itemId: string): Promise<Resposta> {
  const r = await excluirItem(await acesso(), itemId);
  return "erro" in r ? erro(r) : {};
}

export async function ligarDocumentoAcao(
  itemId: string,
  documentoId: string,
  ligar: boolean,
): Promise<Resposta> {
  const r = await ligarDocumentoAoItem(await acesso(), itemId, documentoId, ligar);
  return "erro" in r ? erro(r) : {};
}

export async function aprovarEnvioSemNdaAcao(itemId: string, documentoId: string): Promise<Resposta> {
  const r = await aprovarEnvioSemNda(await acesso(), itemId, documentoId);
  return "erro" in r ? erro(r) : {};
}

export async function importarPlanilhaAcao(
  pedidoId: string,
  conteudo: string,
  opcoes: { simular: boolean; rodada: string; nomeDaRodada?: string },
): Promise<Resposta & { abas?: AbaImportada[]; total?: number }> {
  const r = await importarPlanilhaDoPedido(await acesso(), pedidoId, conteudo, opcoes);
  return "erro" in r ? erro(r) : { abas: r.abas, total: r.total };
}

export async function exportarPedidoAcao(
  pedidoId: string,
): Promise<Resposta & { nome?: string; conteudo?: string }> {
  const r = await exportarPedido(await acesso(), pedidoId);
  return "erro" in r ? erro(r) : { nome: r.nome, conteudo: r.conteudo };
}

export async function salvarFonteAcao(id: string | null, dados: DadosDaFonteEntrada): Promise<Resposta> {
  const r = await salvarFonte(await acesso(), id, dados);
  return "erro" in r ? erro(r) : {};
}

export async function excluirFonteAcao(id: string): Promise<Resposta> {
  const r = await excluirFonte(await acesso(), id);
  return "erro" in r ? erro(r) : {};
}

export async function definirPrioridadesAcao(prioridades: string[]): Promise<Resposta> {
  const r = await definirPrioridades(await acesso(), prioridades);
  return "erro" in r ? erro(r) : {};
}
