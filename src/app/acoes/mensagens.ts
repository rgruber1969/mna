"use server";

import { headers } from "next/headers";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  conversasDoNegocio,
  definirMeuResumo,
  enviarMensagem,
  lerAlvo,
  mensagemParaTarefa,
  minhasMensagens,
  obterConversa,
  type Conversa,
  type MensagemRecente,
  type ResumoDeConversa,
} from "@/server/services/mensagens";

/** Mensageria: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));

export async function conversasDoNegocioAcao(dealId: string): Promise<ResumoDeConversa[] | null> {
  return conversasDoNegocio(await acesso(), dealId);
}

export async function obterConversaAcao(
  dealId: string,
  alvo: string,
  canal?: string | null,
): Promise<Conversa | null> {
  const a = lerAlvo(alvo);
  return a ? obterConversa(await acesso(), dealId, a, canal) : null;
}

export async function enviarMensagemAcao(
  dealId: string,
  alvo: string,
  canal: string,
  dados: { texto: string; mencoes: string[] },
): Promise<{ erro?: string }> {
  const a = lerAlvo(alvo);
  if (!a) return { erro: await traduzirErro({ erro: "mensagens.erros.naoEncontrada" }) };
  const r = await enviarMensagem(await acesso(), dealId, a, canal, dados);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function mensagemParaTarefaAcao(mensagemId: string): Promise<{ erro?: string }> {
  const r = await mensagemParaTarefa(await acesso(), mensagemId);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function minhasMensagensAcao(
  limite = 10,
): Promise<{ conversas: MensagemRecente[]; naoLidas: number }> {
  return minhasMensagens(await acesso(), limite);
}

export async function definirMeuResumoAcao(ligado: boolean): Promise<void> {
  await definirMeuResumo(await acesso(), ligado);
}
