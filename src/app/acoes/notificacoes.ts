"use server";

import { headers } from "next/headers";
import { obterAcesso } from "@/server/services/acesso";
import {
  marcarTodasComoLidas,
  minhasNotificacoes,
  removerNotificacao,
  type Notificacao,
} from "@/server/services/notificacoes";

/** Notificações da própria pessoa: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));

export async function minhasNotificacoesAcao(): Promise<{ itens: Notificacao[]; naoLidas: number }> {
  return minhasNotificacoes(await acesso());
}

export async function marcarTodasComoLidasAcao(): Promise<void> {
  await marcarTodasComoLidas(await acesso());
}

export async function removerNotificacaoAcao(id: string): Promise<void> {
  await removerNotificacao(await acesso(), id);
}
