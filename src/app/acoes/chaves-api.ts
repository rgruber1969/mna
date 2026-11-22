"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import { criarChave, revogarChave } from "@/server/services/chaves-api";
import type { Estado } from "./acesso";

/** Chaves de API: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");

export async function criarChaveAcao(
  _: { erro?: string; campo?: string; segredo?: string } | undefined,
  f: FormData,
): Promise<{ erro?: string; campo?: string; segredo?: string }> {
  const r = await criarChave(await acesso(), {
    nome: texto(f, "nome"),
    perfilId: texto(f, "perfilId"),
    expiraEm: texto(f, "expiraEm"),
  });
  return "erro" in r ? { erro: await traduzirErro(r), campo: r.campo } : { segredo: r.segredo };
}

export async function revogarChaveAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("chaves");
  const r = await revogarChave(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("revogada") };
}
