"use server";

import { headers } from "next/headers";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  confirmarCadastro,
  proporCadastro,
  type Proposta,
  type ResultadoDoCadastro,
} from "@/server/services/cadastro-por-documento";

/** Cadastro a partir de documento (ADR-0021): só repassa para a camada de serviços. */

const acesso = async () => obterAcesso(new Headers(await headers()));

async function arquivoDe(f: FormData) {
  const a = f.get("arquivo");
  return a instanceof File && a.size > 0
    ? { nome: a.name, conteudo: new Uint8Array(await a.arrayBuffer()) }
    : null;
}

export type EstadoDaProposta = { erro?: string; proposta?: Proposta } | undefined;

export async function proporCadastroAcao(f: FormData): Promise<EstadoDaProposta> {
  const arquivo = await arquivoDe(f);
  const r = await proporCadastro(await acesso(), arquivo ?? { nome: "", conteudo: new Uint8Array() });
  return "erro" in r ? { erro: await traduzirErro(r) } : { proposta: r };
}

export type EstadoDoCadastro =
  { erro?: string; resultado?: ResultadoDoCadastro & { falhasTraduzidas: string[] } } | undefined;

export async function confirmarCadastroAcao(f: FormData): Promise<EstadoDoCadastro> {
  let selecao: unknown = null;
  try {
    selecao = JSON.parse(String(f.get("selecao") ?? "null"));
  } catch {
    selecao = null;
  }
  const r = await confirmarCadastro(await acesso(), selecao, await arquivoDe(f));
  if ("erro" in r) return { erro: await traduzirErro(r) };
  const falhasTraduzidas = await Promise.all(
    r.falhas.map(async (x) => `${x.item}: ${await traduzirErro(x.erro)}`),
  );
  return { resultado: { ...r, falhasTraduzidas } };
}
