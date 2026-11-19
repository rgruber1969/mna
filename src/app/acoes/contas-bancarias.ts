"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  excluirContaBancaria,
  revelarContaBancaria,
  salvarContaBancaria,
  type AlvoDaConta,
} from "@/server/services/contas-bancarias";
import type { Estado } from "./acesso";

/** Contas bancárias de empresas e pessoas: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");
const alvo = (f: FormData): AlvoDaConta => ({
  tipo: texto(f, "alvoTipo") === "pessoa" ? "pessoa" : "empresa",
  id: texto(f, "alvoId"),
});

export async function salvarContaBancariaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.contas");
  const r = await salvarContaBancaria(await acesso(), alvo(f), {
    id: texto(f, "id") || undefined,
    bancoCodigo: texto(f, "bancoCodigo"),
    bancoNome: texto(f, "bancoNome"),
    agencia: texto(f, "agencia"),
    conta: texto(f, "conta"),
    tipoConta: texto(f, "tipoConta"),
    chavePix: texto(f, "chavePix"),
    tipoChavePix: texto(f, "tipoChavePix"),
    principal: texto(f, "principal") === "sim",
  });
  return "erro" in r ? { erro: await traduzirErro(r), campo: r.campo } : { ok: t("salva") };
}

export async function excluirContaBancariaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.contas");
  const r = await excluirContaBancaria(await acesso(), alvo(f), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("excluida") };
}

export async function revelarContaBancariaAcao(alvoDaConta: AlvoDaConta, id: string) {
  return revelarContaBancaria(await acesso(), alvoDaConta, id);
}
