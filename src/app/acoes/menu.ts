"use server";

import { headers } from "next/headers";
import { obterAcesso } from "@/server/services/acesso";
import { alternarFavorito, definirMenuRecolhido, ordenarFavoritos } from "@/server/services/menu";

/** Preferências do menu lateral: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));

export async function alternarFavoritoAcao(itemId: string): Promise<string[]> {
  return alternarFavorito(await acesso(), itemId);
}

export async function definirMenuRecolhidoAcao(recolhido: boolean): Promise<void> {
  await definirMenuRecolhido(await acesso(), recolhido);
}

export async function ordenarFavoritosAcao(ordem: string[]): Promise<string[]> {
  return ordenarFavoritos(await acesso(), ordem);
}
