"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  entrarComLinkAcao,
  entrarComPasskeyAcao,
  opcoesCriarPasskeyAcao,
  opcoesEntrarComPasskeyAcao,
  pedirLinkAcao,
  salvarPasskeyAcao,
  type Estado,
} from "@/app/acoes/acesso";
import { Aviso, Botao, Campo } from "@/components/ui/basicos";

/** Navega no navegador para o destino devolvido pela ação (passa pelo proxy). */
function seguirDestino(r: Estado) {
  if (r?.destino) window.location.assign(r.destino);
  return r;
}

/**
 * Mensagem para cada motivo de falha da passkey (antes, todos apareciam como
 * "cancelada", escondendo a causa). O detalhe técnico vai entre parênteses
 * para facilitar o suporte; nada de dado pessoal.
 */
function mensagemDoErro(e: unknown, t: Tradutor): string {
  const erro = e as { name?: string; code?: string; message?: string };
  const codigo = erro?.code ?? "";
  const nome = erro?.name ?? "";
  if (codigo === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || nome === "InvalidStateError")
    return t("erros.jaRegistrada");
  if (codigo === "ERROR_INVALID_DOMAIN" || codigo === "ERROR_INVALID_RP_ID" || nome === "SecurityError")
    return t("erros.enderecoInvalido");
  if (/not supported/i.test(erro?.message ?? "") || nome === "NotSupportedError")
    return t("erros.naoSuportada");
  if (codigo === "ERROR_CEREMONY_ABORTED" || nome === "NotAllowedError" || nome === "AbortError")
    return t("erros.cancelada", { detalhe: codigo || nome });
  return t("erros.generica", { detalhe: codigo || nome || t("erroDesconhecido") });
}

type Tradutor = ReturnType<typeof useTranslations<"acesso.passkey">>;

/** Login completo com passkey (política 2A): o aparelho + digital/rosto/PIN. */
export function BotaoEntrarComPasskey() {
  const t = useTranslations("acesso.passkey");
  const [estado, setEstado] = useState<Estado>();
  const [ocupado, setOcupado] = useState(false);

  async function entrar() {
    setOcupado(true);
    setEstado(undefined);
    try {
      const opcoes = await opcoesEntrarComPasskeyAcao();
      if ("erro" in opcoes) return setEstado({ erro: String(opcoes.erro) });
      const resposta = await startAuthentication({ optionsJSON: opcoes as never });
      setEstado(seguirDestino(await entrarComPasskeyAcao(resposta)));
    } catch (e) {
      console.error("Passkey:", e);
      setEstado({ erro: mensagemDoErro(e, t) });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <button
        type="button"
        onClick={entrar}
        disabled={ocupado}
        className="border-primary text-primary w-full rounded-md border px-4 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {ocupado ? t("aguardandoPasskey") : t("entrar")}
      </button>
    </div>
  );
}

/** Cadastro de passkey. Com `reentrar`, a pessoa sai e entra de novo com ela. */
export function FormCriarPasskey({ reentrar = false }: { reentrar?: boolean }) {
  const t = useTranslations("acesso.passkey");
  const [estado, setEstado] = useState<Estado>();
  const [ocupado, setOcupado] = useState(false);

  async function criar(dados: FormData) {
    setOcupado(true);
    setEstado(undefined);
    try {
      const opcoes = await opcoesCriarPasskeyAcao();
      if ("erro" in opcoes) return setEstado({ erro: String(opcoes.erro) });
      const resposta = await startRegistration({ optionsJSON: opcoes as never });
      setEstado(seguirDestino(await salvarPasskeyAcao(resposta, String(dados.get("nome") ?? ""), reentrar)));
    } catch (e) {
      console.error("Passkey:", e);
      setEstado({ erro: mensagemDoErro(e, t) });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form action={criar}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <p className="text-muted mb-4 text-sm">{t("intro")}</p>
      <Campo rotulo={t("rotuloNome")} name="nome" maxLength={60} />
      <Botao disabled={ocupado}>{ocupado ? t("aguardandoAparelho") : t("cadastrar")}</Botao>
    </form>
  );
}

/** Pedido de link de acesso por e-mail (política 1A). */
export function FormPedirLink() {
  const t = useTranslations("acesso.link");
  const tGeral = useTranslations("acesso.geral");
  const [estado, acao, enviando] = useActionState(pedirLinkAcao, undefined);
  if (estado?.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return (
    <form action={acao}>
      <Campo rotulo={t("rotuloEmail")} name="email" type="email" autoComplete="username" required />
      <Botao disabled={enviando}>{enviando ? tGeral("enviando") : t("receber")}</Botao>
    </form>
  );
}

/**
 * Uso do link: um botão, e não login automático ao abrir, porque antivírus de
 * e-mail abrem os links sozinhos e gastariam o link de uso único.
 */
export function FormUsarLink({ token }: { token: string }) {
  const t = useTranslations("acesso.geral");
  const [estado, acao, enviando] = useActionState(
    async (anterior: Estado, dados: FormData) => seguirDestino(await entrarComLinkAcao(anterior, dados)),
    undefined,
  );
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <input type="hidden" name="token" value={token} />
      <Botao disabled={enviando}>{enviando ? t("entrando") : t("entrar")}</Botao>
    </form>
  );
}
