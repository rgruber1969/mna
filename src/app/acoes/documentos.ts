"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  acessoDaUltimaVersao,
  alterarAcessoDaVersao,
  concluirEnvio,
  excluirCategoria,
  excluirVersao,
  iniciarEnvio,
  linkDeDownload,
  salvarCategoria,
} from "@/server/services/documentos";
import type { Estado } from "./acesso";

/** Data room: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");

export async function iniciarEnvioAcao(
  dealId: string,
  dados: {
    documentoId?: string;
    titulo?: string;
    etapaId?: string | null;
    categoriaId?: string;
    nomeArquivo: string;
    tamanho: number;
    comentario?: string;
    perfis: string[];
    usuarios: string[];
    todos?: boolean;
  },
): Promise<{ versaoId?: string; url?: string; erro?: string }> {
  const r = await iniciarEnvio(await acesso(), dealId, dados);
  return "erro" in r ? { erro: await traduzirErro(r) } : r;
}

export async function concluirEnvioAcao(versaoId: string): Promise<{ erro?: string }> {
  const r = await concluirEnvio(await acesso(), versaoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function linkDeDownloadAcao(versaoId: string): Promise<{ url?: string; erro?: string }> {
  const r = await linkDeDownload(await acesso(), versaoId);
  return "erro" in r ? { erro: await traduzirErro(r) } : r;
}

export async function excluirVersaoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("documentos.mensagens");
  const r = await excluirVersao(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("versaoExcluida") };
}

export async function acessoDaUltimaVersaoAcao(documentoId: string) {
  return acessoDaUltimaVersao(await acesso(), documentoId);
}

export async function salvarCategoriaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("documentos.mensagens");
  const r = await salvarCategoria(await acesso(), {
    id: texto(f, "id") || undefined,
    nome: texto(f, "nome"),
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("categoriaSalva") };
}

export async function excluirCategoriaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("documentos.mensagens");
  const r = await excluirCategoria(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("categoriaExcluida") };
}

export async function alterarAcessoDaVersaoAcao(
  versaoId: string,
  dados: { todos: boolean; perfis: string[]; usuarios: string[] },
): Promise<{ erro?: string }> {
  const r = await alterarAcessoDaVersao(await acesso(), versaoId, dados);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}
