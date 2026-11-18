"use server";

import { headers } from "next/headers";
import { obterAcesso } from "@/server/services/acesso";
import {
  enviarImagemDaMarca,
  removerImagemDaMarca,
  restaurarPadrao,
  salvarIdentidade,
} from "@/server/services/identidade-visual";
import type { Estado } from "./acesso";

/** Identidade visual do tenant: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");

export async function salvarIdentidadeAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await salvarIdentidade(await acesso(), {
    nomeExibicao: texto(f, "nomeExibicao"),
    corPrimaria: texto(f, "corPrimaria"),
    corDestaque: texto(f, "corDestaque"),
    fonte: texto(f, "fonte"),
  });
  return "erro" in r ? { erro: r.erro } : { ok: "Identidade visual salva." };
}

export async function restaurarPadraoAcao(): Promise<Estado> {
  const r = await restaurarPadrao(await acesso());
  return "erro" in r ? { erro: r.erro } : { ok: "Cores e fonte voltaram ao padrão." };
}

export async function enviarImagemAcao(_: Estado, f: FormData): Promise<Estado> {
  const arquivo = f.get("imagem");
  const r = await enviarImagemDaMarca(
    await acesso(),
    texto(f, "tipo"),
    arquivo instanceof File ? arquivo : null,
  );
  return "erro" in r ? { erro: r.erro } : { ok: "Imagem atualizada." };
}

export async function removerImagemAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await removerImagemDaMarca(await acesso(), texto(f, "tipo"));
  return "erro" in r ? { erro: r.erro } : { ok: "Imagem removida." };
}
