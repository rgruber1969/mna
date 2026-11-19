"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro } from "@/i18n/servidor";
import {
  confirmarAutenticador,
  entrar,
  entrarSoComEmail,
  entrarComLinkMagico,
  entrarComPasskey,
  iniciarAutenticador,
  opcoesParaCriarPasskey,
  opcoesParaEntrarComPasskey,
  pedirLinkMagico,
  salvarPasskey,
  type OpcoesWebAuthn,
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

async function seguir(r: ResultadoLogin): Promise<Estado> {
  if ("erro" in r) return { erro: await traduzirErro(r) };
  return irPara(r.etapa === "dois-fatores" ? "/dois-fatores" : "/");
}

export async function entrarAcao(_: Estado, f: FormData): Promise<Estado> {
  return seguir(await entrar({ email: texto(f, "email"), senha: texto(f, "senha") }, await cabecalhos()));
}

export async function entrarSoComEmailAcao(_: Estado, f: FormData): Promise<Estado> {
  return seguir(await entrarSoComEmail(texto(f, "email"), await cabecalhos()));
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
    return { erro: await traduzirErro({ erro: "acesso.erros.senhasNaoConferem" }) };
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
  if ("erro" in r) return { erro: await traduzirErro(r) };
  const { toString } = await import("qrcode");
  const qr = await toString(r.uri, { type: "svg", margin: 1 });
  return { uri: r.uri, qr, codigosRecuperacao: r.codigosRecuperacao };
}

export async function confirmarAutenticadorAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await confirmarAutenticador(texto(f, "codigo"), await cabecalhos());
  if ("erro" in r) return { erro: await traduzirErro(r) };
  return irPara("/");
}

// --- Link mágico e passkey ---------------------------------------------------

export async function pedirLinkAcao(_: Estado, f: FormData): Promise<Estado> {
  await pedirLinkMagico(texto(f, "email"), await cabecalhos());
  return { ok: (await getTranslations("acesso.sucesso"))("linkEnviado") };
}

export async function entrarComLinkAcao(_: Estado, f: FormData): Promise<Estado> {
  return seguir(await entrarComLinkMagico(texto(f, "token"), await cabecalhos()));
}

/** Os erros dos serviços chegam como chave; aqui viram a frase. */
async function traduzirOpcoes(
  r: OpcoesWebAuthn | { erro: string },
): Promise<OpcoesWebAuthn | { erro: string }> {
  return typeof r.erro === "string" ? { erro: await traduzirErro({ erro: r.erro }) } : r;
}

export async function opcoesEntrarComPasskeyAcao(): Promise<OpcoesWebAuthn | { erro: string }> {
  return traduzirOpcoes(await opcoesParaEntrarComPasskey(await cabecalhos()));
}

export async function entrarComPasskeyAcao(resposta: unknown): Promise<Estado> {
  return seguir(await entrarComPasskey(resposta, await cabecalhos()));
}

export async function opcoesCriarPasskeyAcao(): Promise<OpcoesWebAuthn | { erro: string }> {
  return traduzirOpcoes(await opcoesParaCriarPasskey(await cabecalhos()));
}

/**
 * Salva a passkey. Com `reentrar`, encerra a sessão atual (aberta só com senha)
 * para a pessoa entrar de novo já com a passkey, que conta como dois fatores.
 */
export async function salvarPasskeyAcao(resposta: unknown, nome: string, reentrar: boolean): Promise<Estado> {
  const h = await cabecalhos();
  const r = await salvarPasskey(resposta, nome, h);
  if ("erro" in r) return { erro: await traduzirErro(r) };
  if (!reentrar) return { ok: (await getTranslations("acesso.sucesso"))("passkeyCadastrada") };
  await sair(h);
  return irPara("/entrar?passkey=cadastrada");
}

// --- Console -----------------------------------------------------------------

export async function criarTenantAcao(_: Estado, f: FormData): Promise<Estado> {
  const acesso = await obterAcesso(await cabecalhos());
  const r = await criarTenant(acesso, { nome: texto(f, "nome"), slug: texto(f, "slug") });
  if ("erro" in r) return { erro: await traduzirErro(r) };
  return irPara(`/tenants/${r.id}`);
}

export async function convidarAdministradorAcao(_: Estado, f: FormData): Promise<Estado> {
  const acesso = await obterAcesso(await cabecalhos());
  const r = await convidarAdministradorDoTenant(acesso, texto(f, "tenantId"), {
    nome: texto(f, "nome"),
    email: texto(f, "email"),
  });
  if ("erro" in r) return { erro: await traduzirErro(r) };
  return { ok: (await getTranslations("acesso.sucesso"))("conviteEnviado") };
}
