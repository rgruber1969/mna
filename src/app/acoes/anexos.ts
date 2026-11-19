"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import { enviarAnexo, removerAnexo, type AlvoDoAnexo } from "@/server/services/anexos";
import type { Estado } from "./acesso";

/** Anexos do cadastro: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");

function alvo(f: FormData): AlvoDoAnexo {
  return { tipo: texto(f, "alvoTipo") === "pessoa" ? "pessoa" : "empresa", id: texto(f, "alvoId") };
}

export async function enviarAnexoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.anexos");
  const arquivo = f.get("arquivo");
  const r = await enviarAnexo(
    await acesso(),
    alvo(f),
    texto(f, "categoria"),
    texto(f, "descricao"),
    arquivo instanceof File ? arquivo : null,
  );
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("enviado") };
}

export async function removerAnexoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.anexos");
  const r = await removerAnexo(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("removido") };
}
