"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro, type ErroDeServico } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  cancelarConviteDaEquipe,
  convidarParaEquipe,
  definirSuspensao,
  redefinirDoisFatoresPelaPlataforma,
  removerDaEquipe,
  definirRetencaoDaAuditoria,
  renomearTenant,
} from "@/server/services/console";
import {
  cancelarConvite,
  convidarUsuario,
  definirAdministrador,
  definirExigenciaDeTodos,
  definirExigenciaIndividual,
  redefinirDoisFatoresDoUsuario,
  reenviarConvite,
  removerAutenticadorDoUsuario,
  removerPasskeyDoUsuario,
  revogarAcesso,
} from "@/server/services/usuarios";
import type { Estado } from "./acesso";

/** Ações da administração de usuários: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");
const sim = (f: FormData, nome: string) => texto(f, nome) === "sim";

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

/** Igual a `estado`, com as mensagens de sucesso da área do console. */
const estadoConsole = (r: { ok: true } | ErroDeServico, mensagem: string) =>
  estado(r, mensagem, undefined, "console");

export async function convidarUsuarioAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await convidarUsuario(await acesso(), {
    nome: texto(f, "nome"),
    email: texto(f, "email"),
    administrador: f.get("administrador") === "on",
    perfis: f.getAll("perfil").map(String),
    exigeDoisFatores: f.get("exige2fa") === "on",
  });
  return estado(r, "acoes.conviteEnviado");
}

export async function reenviarConviteAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await reenviarConvite(await acesso(), texto(f, "id")), "acoes.conviteReenviado");
}

export async function cancelarConviteAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await cancelarConvite(await acesso(), texto(f, "id")), "acoes.conviteCancelado");
}

export async function exigirDeTodosAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await definirExigenciaDeTodos(await acesso(), sim(f, "valor")), "acoes.configuracaoSalva");
}

export async function exigirDoUsuarioAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await definirExigenciaIndividual(await acesso(), texto(f, "id"), sim(f, "valor")),
    "acoes.configuracaoSalva",
  );
}

export async function definirAdministradorAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await definirAdministrador(await acesso(), texto(f, "id"), sim(f, "valor")),
    "acoes.papelAlterado",
  );
}

export async function revogarAcessoAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await revogarAcesso(await acesso(), texto(f, "id")), "", "/usuarios");
}

export async function removerPasskeyAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await removerPasskeyDoUsuario(await acesso(), texto(f, "id"), texto(f, "passkey")),
    "acoes.passkeyRemovida",
  );
}

export async function removerAutenticadorAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await removerAutenticadorDoUsuario(await acesso(), texto(f, "id")),
    "acoes.autenticadorRemovido",
  );
}

export async function redefinirDoisFatoresAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await redefinirDoisFatoresDoUsuario(await acesso(), texto(f, "id")),
    "acoes.doisFatoresRedefinido",
  );
}

export async function redefinirPelaPlataformaAcao(_: Estado, f: FormData): Promise<Estado> {
  return estadoConsole(
    await redefinirDoisFatoresPelaPlataforma(await acesso(), {
      email: texto(f, "email"),
      motivo: texto(f, "motivo"),
      identidadeConfirmada: f.get("identidade") === "on",
    }),
    "acoes.doisFatoresRedefinido",
  );
}

// --- Console: tenant e equipe da RGRUBER --------------------------------------------

export async function renomearTenantAcao(_: Estado, f: FormData): Promise<Estado> {
  return estadoConsole(
    await renomearTenant(await acesso(), texto(f, "id"), texto(f, "nome")),
    "acoes.nomeAlterado",
  );
}

export async function definirRetencaoAcao(_: Estado, f: FormData): Promise<Estado> {
  return estadoConsole(
    await definirRetencaoDaAuditoria(await acesso(), texto(f, "id"), texto(f, "meses")),
    "acoes.retencaoAlterada",
  );
}

export async function suspenderTenantAcao(_: Estado, f: FormData): Promise<Estado> {
  const suspender = sim(f, "valor");
  return estadoConsole(
    await definirSuspensao(await acesso(), texto(f, "id"), suspender),
    suspender ? "acoes.tenantSuspenso" : "acoes.tenantReativado",
  );
}

export async function convidarParaEquipeAcao(_: Estado, f: FormData): Promise<Estado> {
  return estadoConsole(
    await convidarParaEquipe(await acesso(), { nome: texto(f, "nome"), email: texto(f, "email") }),
    "acoes.conviteEnviado",
  );
}

export async function cancelarConviteDaEquipeAcao(_: Estado, f: FormData): Promise<Estado> {
  return estadoConsole(
    await cancelarConviteDaEquipe(await acesso(), texto(f, "id")),
    "acoes.conviteCancelado",
  );
}

export async function removerDaEquipeAcao(_: Estado, f: FormData): Promise<Estado> {
  return estadoConsole(await removerDaEquipe(await acesso(), texto(f, "id")), "acoes.acessoRemovido");
}
