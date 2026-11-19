"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro, type ErroDeServico } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  copiarMatrizIndividual,
  criarPerfil,
  definirExigenciaDoPerfil,
  definirModoPermissoes,
  definirPerfisDoUsuario,
  excluirPerfil,
  editarPerfil,
  salvarMatrizDoPerfil,
  salvarMatrizIndividual,
} from "@/server/services/perfis";
import type { Estado } from "./acesso";

/** Ações de perfis e permissões: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");

/** Traduz o resultado do serviço: erro (chave) vira a frase; sucesso vira a mensagem da chave dada. */
async function estado(
  r: { ok: true } | ErroDeServico,
  mensagem: string,
  destino?: string,
  area = "administracao",
): Promise<Estado> {
  if ("erro" in r) return { erro: await traduzirErro(r) };
  if (destino) return { destino };
  return { ok: (await getTranslations(area))(mensagem) };
}

/** Caixas marcadas "recurso:acao" → matriz (o serviço descarta o que não vale). */
function matrizDoFormulario(f: FormData): Record<string, string[]> {
  const matriz: Record<string, string[]> = {};
  for (const valor of f.getAll("m")) {
    const [recurso, acao] = String(valor).split(":");
    if (recurso && acao) (matriz[recurso] ??= []).push(acao);
  }
  return matriz;
}

export async function criarPerfilAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await criarPerfil(await acesso(), {
    nome: texto(f, "nome"),
    camada: texto(f, "camada"),
    descricao: texto(f, "descricao"),
    copiarDe: texto(f, "copiarDe") || undefined,
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { destino: `/perfis/${r.id}` };
}

export async function editarPerfilAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await editarPerfil(await acesso(), texto(f, "id"), {
      nome: texto(f, "nome"),
      descricao: texto(f, "descricao"),
    }),
    "acoes.perfilSalvo",
  );
}

export async function salvarMatrizDoPerfilAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await salvarMatrizDoPerfil(await acesso(), texto(f, "id"), matrizDoFormulario(f)),
    "acoes.permissoesSalvas",
  );
}

export async function excluirPerfilAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await excluirPerfil(await acesso(), texto(f, "id")), "", "/perfis");
}

export async function exigirDoPerfilAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await definirExigenciaDoPerfil(await acesso(), texto(f, "id"), texto(f, "valor") === "sim"),
    "acoes.exigenciaSalva",
  );
}

export async function definirModoAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await definirModoPermissoes(await acesso(), texto(f, "modo")), "acoes.modoAlterado");
}

export async function definirPerfisDoUsuarioAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await definirPerfisDoUsuario(await acesso(), texto(f, "id"), f.getAll("perfil").map(String)),
    "acoes.perfisSalvos",
  );
}

export async function salvarMatrizIndividualAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await salvarMatrizIndividual(await acesso(), texto(f, "id"), texto(f, "perfil"), matrizDoFormulario(f)),
    "acoes.permissoesDoUsuarioSalvas",
  );
}

export async function copiarMatrizIndividualAcao(_: Estado, f: FormData): Promise<Estado> {
  const origem = texto(f, "origem");
  return estado(
    await copiarMatrizIndividual(await acesso(), texto(f, "id"), texto(f, "perfil"), origem),
    origem === "perfil" ? "acoes.voltouAoPerfil" : "acoes.permissoesCopiadas",
  );
}
