"use server";

import { headers } from "next/headers";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import { excluirTarefaGeral, moverTarefaGeral, salvarTarefaGeral } from "@/server/services/tarefas-gerais";

/** Kanban de tarefas gerais: só repassa para a camada de serviços. */
const acesso = async () => obterAcesso(new Headers(await headers()));
type Resposta = { erro?: string };
const resposta = async (r: { ok: true } | { erro: string; parametros?: Record<string, string | number> }) =>
  "erro" in r ? { erro: await traduzirErro(r) } : {};

export async function salvarTarefaGeralAcao(
  id: string | null,
  dados: { titulo: string; descricao: string; prioridade: string; prazo: string; responsavelId: string },
): Promise<Resposta> {
  return resposta(
    await salvarTarefaGeral(await acesso(), id, {
      ...dados,
      prioridade: (["baixa", "normal", "alta", "urgente"].includes(dados.prioridade)
        ? dados.prioridade
        : "normal") as "baixa" | "normal" | "alta" | "urgente",
    }),
  );
}

export async function moverTarefaGeralAcao(id: string, situacao: string): Promise<Resposta> {
  return resposta(await moverTarefaGeral(await acesso(), id, situacao));
}

export async function excluirTarefaGeralAcao(id: string): Promise<Resposta> {
  return resposta(await excluirTarefaGeral(await acesso(), id));
}
