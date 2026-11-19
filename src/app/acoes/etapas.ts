"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  definirEtapaPadraoAtiva,
  excluirEtapaPadrao,
  editarEtapa,
  incluirEtapa,
  moverEtapa,
  moverEtapaPadrao,
  mudarSituacaoDaEtapa,
  removerEtapa,
  salvarEtapaPadrao,
} from "@/server/services/etapas";
import type { Estado } from "./acesso";

/** Etapas: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");

export type EstadoEtapa = (NonNullable<Estado> & { aviso?: string; etapaAnterior?: string }) | undefined;

export async function mudarSituacaoDaEtapaAcao(_: EstadoEtapa, f: FormData): Promise<EstadoEtapa> {
  const t = await getTranslations("etapas.mensagens");
  const r = await mudarSituacaoDaEtapa(
    await acesso(),
    texto(f, "dealId"),
    texto(f, "id"),
    texto(f, "situacao"),
    texto(f, "confirmado") === "sim",
  );
  if ("aviso" in r) return { aviso: r.aviso, etapaAnterior: r.etapa };
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("situacaoAlterada") };
}

export async function editarEtapaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("etapas.mensagens");
  const r = await editarEtapa(await acesso(), texto(f, "dealId"), texto(f, "id"), {
    nome: texto(f, "nome"),
    inicioPrevisto: texto(f, "inicioPrevisto"),
    fimPrevisto: texto(f, "fimPrevisto"),
    inicioReal: texto(f, "inicioReal"),
    fimReal: texto(f, "fimReal"),
    dependeDeId: texto(f, "dependeDeId"),
    observacoes: texto(f, "observacoes"),
    escala: texto(f, "escala"),
  });
  return "erro" in r ? { erro: await traduzirErro(r), campo: r.campo } : { ok: t("salva") };
}

export async function incluirEtapaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("etapas.mensagens");
  const r = await incluirEtapa(await acesso(), texto(f, "dealId"), {
    nome: texto(f, "nome"),
    paiId: texto(f, "paiId") || undefined,
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("incluida") };
}

export async function removerEtapaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("etapas.mensagens");
  const r = await removerEtapa(await acesso(), texto(f, "dealId"), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("removida") };
}

export async function moverEtapaAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await moverEtapa(
    await acesso(),
    texto(f, "dealId"),
    texto(f, "id"),
    texto(f, "direcao") === "subir" ? "subir" : "descer",
  );
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: " " };
}

export async function salvarEtapaPadraoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("etapas.mensagens");
  const r = await salvarEtapaPadrao(await acesso(), {
    id: texto(f, "id") || undefined,
    nome: texto(f, "nome"),
    paiId: texto(f, "paiId") || undefined,
    escala: f.has("escala") ? texto(f, "escala") : undefined,
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("salva") };
}

export async function moverEtapaPadraoAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await moverEtapaPadrao(
    await acesso(),
    texto(f, "id"),
    texto(f, "direcao") === "subir" ? "subir" : "descer",
  );
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: " " };
}

export async function definirEtapaPadraoAtivaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("etapas.mensagens");
  const r = await definirEtapaPadraoAtiva(await acesso(), texto(f, "id"), texto(f, "ativa") === "sim");
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("salva") };
}

export async function excluirEtapaPadraoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("etapas.mensagens");
  const r = await excluirEtapaPadrao(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("removida") };
}
