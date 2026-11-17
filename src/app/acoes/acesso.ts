"use server";

import { headers } from "next/headers";
import {
  confirmarAutenticador,
  entrar,
  iniciarAutenticador,
  obterAcesso,
  sair,
  verificarSegundoFator,
  type ResultadoLogin,
} from "@/server/services/acesso";
import { aceitarConvite } from "@/server/services/convites";
import { convidarAdministradorDoTenant, criarTenant } from "@/server/services/console";

/**
 * Ações de formulário: só repassam para a camada de serviços (ADR-0004).
 * Os caminhos são relativos ao endereço atual (console ou tenant).
 */

export type Estado = { erro?: string; ok?: string; destino?: string } | undefined;

const cabecalhos = async () => new Headers(await headers());
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");

/**
 * Destino após a ação: o formulário navega no navegador (requisição nova, que
 * passa pelo proxy). Um redirect dentro da ação seria resolvido sem o proxy
 * (ADR-0011) e renderizaria a área errada.
 */
function irPara(destino: string): Estado {
  return { destino };
}

function seguir(r: ResultadoLogin): Estado {
  if ("erro" in r) return { erro: r.erro };
  return irPara(r.etapa === "dois-fatores" ? "/dois-fatores" : "/");
}

export async function entrarAcao(_: Estado, f: FormData): Promise<Estado> {
  return seguir(await entrar({ email: texto(f, "email"), senha: texto(f, "senha") }, await cabecalhos()));
}

export async function segundoFatorAcao(_: Estado, f: FormData): Promise<Estado> {
  const recuperacao = f.get("recuperacao") === "on";
  return seguir(await verificarSegundoFator({ codigo: texto(f, "codigo"), recuperacao }, await cabecalhos()));
}

export async function sairAcao(): Promise<Estado> {
  await sair(await cabecalhos());
  return irPara("/entrar");
}

export async function aceitarConviteAcao(_: Estado, f: FormData): Promise<Estado> {
  if (texto(f, "senha") !== texto(f, "confirmacao") && f.has("confirmacao"))
    return { erro: "As senhas não conferem." };
  return seguir(
    await aceitarConvite(
      texto(f, "token"),
      { nome: texto(f, "nome"), senha: texto(f, "senha") },
      await cabecalhos(),
    ),
  );
}

export type EstadoAutenticador =
  { erro?: string; uri?: string; qr?: string; codigosRecuperacao?: string[] } | undefined;

export async function iniciarAutenticadorAcao(
  _: EstadoAutenticador,
  f: FormData,
): Promise<EstadoAutenticador> {
  const r = await iniciarAutenticador(texto(f, "senha"), await cabecalhos());
  if ("erro" in r) return { erro: r.erro };
  const { toString } = await import("qrcode");
  const qr = await toString(r.uri, { type: "svg", margin: 1 });
  return { uri: r.uri, qr, codigosRecuperacao: r.codigosRecuperacao };
}

export async function confirmarAutenticadorAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await confirmarAutenticador(texto(f, "codigo"), await cabecalhos());
  if ("erro" in r) return { erro: r.erro };
  return irPara("/");
}

// --- Console -----------------------------------------------------------------

export async function criarTenantAcao(_: Estado, f: FormData): Promise<Estado> {
  const acesso = await obterAcesso(await cabecalhos());
  const r = await criarTenant(acesso, { nome: texto(f, "nome"), slug: texto(f, "slug") });
  if ("erro" in r) return { erro: r.erro };
  return irPara(`/tenants/${r.id}`);
}

export async function convidarAdministradorAcao(_: Estado, f: FormData): Promise<Estado> {
  const acesso = await obterAcesso(await cabecalhos());
  const r = await convidarAdministradorDoTenant(acesso, texto(f, "tenantId"), {
    nome: texto(f, "nome"),
    email: texto(f, "email"),
  });
  if ("erro" in r) return { erro: r.erro };
  return { ok: "Convite enviado. Ele vale por 3 dias." };
}
