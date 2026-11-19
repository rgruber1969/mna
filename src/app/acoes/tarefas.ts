"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  criarTarefa,
  editarTarefa,
  excluirTarefa,
  marcarItem,
  mudarSituacaoDaTarefa,
} from "@/server/services/tarefas";
import type { Estado } from "./acesso";

/** Tarefas: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");

function dados(f: FormData) {
  return {
    titulo: texto(f, "titulo"),
    descricao: texto(f, "descricao"),
    etapaId: texto(f, "etapaId"),
    prioridade: (texto(f, "prioridade") || "normal") as "baixa" | "normal" | "alta" | "urgente",
    prazo: texto(f, "prazo"),
    usuarios: f.getAll("usuarios").map(String),
    perfis: f.getAll("perfis").map(String),
    checklist: texto(f, "checklist").split("\n"),
    documentos: f.getAll("documentos").map(String),
  };
}

export async function salvarTarefaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("tarefas.mensagens");
  const id = texto(f, "id");
  const r = id
    ? await editarTarefa(await acesso(), id, dados(f))
    : await criarTarefa(await acesso(), texto(f, "dealId"), dados(f));
  return "erro" in r ? { erro: await traduzirErro(r), campo: r.campo } : { ok: t(id ? "salva" : "criada") };
}

export async function mudarSituacaoDaTarefaAcao(
  tarefaId: string,
  situacao: string,
): Promise<{ erro?: string }> {
  const r = await mudarSituacaoDaTarefa(await acesso(), tarefaId, situacao);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function marcarItemAcao(itemId: string, feito: boolean): Promise<{ erro?: string }> {
  const r = await marcarItem(await acesso(), itemId, feito);
  return "erro" in r ? { erro: await traduzirErro(r) } : {};
}

export async function excluirTarefaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("tarefas.mensagens");
  const r = await excluirTarefa(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("excluida") };
}
