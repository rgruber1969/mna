"use server";

import { headers } from "next/headers";
import { obterAcesso } from "@/server/services/acesso";
import {
  cancelarConviteDaEquipe,
  convidarParaEquipe,
  definirSuspensao,
  redefinirDoisFatoresPelaPlataforma,
  removerDaEquipe,
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

function estado(r: { ok: true } | { erro: string }, mensagem: string, destino?: string): Estado {
  if ("erro" in r) return { erro: r.erro };
  return destino ? { destino } : { ok: mensagem };
}

export async function convidarUsuarioAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await convidarUsuario(await acesso(), {
    nome: texto(f, "nome"),
    email: texto(f, "email"),
    administrador: f.get("administrador") === "on",
    perfis: f.getAll("perfil").map(String),
  });
  return estado(r, "Convite enviado. Ele vale por 3 dias.");
}

export async function reenviarConviteAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await reenviarConvite(await acesso(), texto(f, "id")), "Convite reenviado.");
}

export async function cancelarConviteAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await cancelarConvite(await acesso(), texto(f, "id")), "Convite cancelado.");
}

export async function exigirDeTodosAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await definirExigenciaDeTodos(await acesso(), sim(f, "valor")), "Configuração salva.");
}

export async function exigirDoUsuarioAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await definirExigenciaIndividual(await acesso(), texto(f, "id"), sim(f, "valor")),
    "Configuração salva.",
  );
}

export async function definirAdministradorAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await definirAdministrador(await acesso(), texto(f, "id"), sim(f, "valor")),
    "Papel alterado.",
  );
}

export async function revogarAcessoAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await revogarAcesso(await acesso(), texto(f, "id")), "", "/usuarios");
}

export async function removerPasskeyAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await removerPasskeyDoUsuario(await acesso(), texto(f, "id"), texto(f, "passkey")),
    "Passkey removida.",
  );
}

export async function removerAutenticadorAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await removerAutenticadorDoUsuario(await acesso(), texto(f, "id")), "Autenticador removido.");
}

export async function redefinirDoisFatoresAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await redefinirDoisFatoresDoUsuario(await acesso(), texto(f, "id")),
    "2FA redefinido. A pessoa configura de novo no próximo acesso.",
  );
}

export async function redefinirPelaPlataformaAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await redefinirDoisFatoresPelaPlataforma(await acesso(), {
      email: texto(f, "email"),
      motivo: texto(f, "motivo"),
      identidadeConfirmada: f.get("identidade") === "on",
    }),
    "2FA redefinido e pessoa avisada por e-mail.",
  );
}

// --- Console: tenant e equipe da RGRUBER --------------------------------------------

export async function renomearTenantAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await renomearTenant(await acesso(), texto(f, "id"), texto(f, "nome")), "Nome alterado.");
}

export async function suspenderTenantAcao(_: Estado, f: FormData): Promise<Estado> {
  const suspender = sim(f, "valor");
  return estado(
    await definirSuspensao(await acesso(), texto(f, "id"), suspender),
    suspender ? "Tenant suspenso." : "Tenant reativado.",
  );
}

export async function convidarParaEquipeAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(
    await convidarParaEquipe(await acesso(), { nome: texto(f, "nome"), email: texto(f, "email") }),
    "Convite enviado. Ele vale por 3 dias.",
  );
}

export async function cancelarConviteDaEquipeAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await cancelarConviteDaEquipe(await acesso(), texto(f, "id")), "Convite cancelado.");
}

export async function removerDaEquipeAcao(_: Estado, f: FormData): Promise<Estado> {
  return estado(await removerDaEquipe(await acesso(), texto(f, "id")), "Acesso removido.");
}
