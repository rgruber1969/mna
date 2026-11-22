"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import { enviarFotoDaConta, removerFotoDaConta } from "@/server/services/foto-da-conta";
import { definirMenuInvertido, definirTema } from "@/server/services/preferencias-da-conta";
import type { Estado } from "./acesso";

/** Ações da própria conta: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));

export async function enviarFotoAcao(_: Estado, f: FormData): Promise<Estado> {
  const arquivo = f.get("foto");
  const r = await enviarFotoDaConta(await acesso(), arquivo instanceof File ? arquivo : null);
  return "erro" in r
    ? { erro: await traduzirErro(r) }
    : { ok: (await getTranslations("acesso.sucesso"))("fotoAtualizada") };
}

export async function removerFotoAcao(): Promise<Estado> {
  const r = await removerFotoDaConta(await acesso());
  return "erro" in r
    ? { erro: await traduzirErro(r) }
    : { ok: (await getTranslations("acesso.sucesso"))("fotoRemovida") };
}

export async function definirTemaAcao(tema: string): Promise<void> {
  await definirTema(await acesso(), tema);
}

export async function definirMenuInvertidoAcao(ligado: boolean): Promise<void> {
  await definirMenuInvertido(await acesso(), ligado);
}
