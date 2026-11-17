"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useActionState, useState } from "react";
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

const CANCELADO = "A operação foi cancelada ou o tempo acabou. Tente de novo.";

/** Login completo com passkey (política 2A): o aparelho + digital/rosto/PIN. */
export function BotaoEntrarComPasskey() {
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
    } catch {
      setEstado({ erro: CANCELADO });
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
        {ocupado ? "Aguardando a passkey..." : "Entrar com passkey"}
      </button>
    </div>
  );
}

/** Cadastro de passkey. Com `reentrar`, a pessoa sai e entra de novo com ela. */
export function FormCriarPasskey({ reentrar = false }: { reentrar?: boolean }) {
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
    } catch {
      setEstado({ erro: CANCELADO });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form action={criar}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <p className="text-muted mb-4 text-sm">
        A passkey fica no seu celular ou computador e é liberada pela digital, pelo rosto ou pelo PIN do
        aparelho. Ela já vale como verificação em duas etapas.
      </p>
      <Campo rotulo="Nome da passkey (ex.: celular, notebook)" name="nome" maxLength={60} />
      <Botao disabled={ocupado}>{ocupado ? "Aguardando o aparelho..." : "Cadastrar passkey"}</Botao>
    </form>
  );
}

/** Pedido de link de acesso por e-mail (política 1A). */
export function FormPedirLink() {
  const [estado, acao, enviando] = useActionState(pedirLinkAcao, undefined);
  if (estado?.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return (
    <form action={acao}>
      <Campo rotulo="E-mail para receber o link" name="email" type="email" autoComplete="username" required />
      <Botao disabled={enviando}>{enviando ? "Enviando..." : "Receber link por e-mail"}</Botao>
    </form>
  );
}

/**
 * Uso do link: um botão, e não login automático ao abrir, porque antivírus de
 * e-mail abrem os links sozinhos e gastariam o link de uso único.
 */
export function FormUsarLink({ token }: { token: string }) {
  const [estado, acao, enviando] = useActionState(
    async (anterior: Estado, dados: FormData) => seguirDestino(await entrarComLinkAcao(anterior, dados)),
    undefined,
  );
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <input type="hidden" name="token" value={token} />
      <Botao disabled={enviando}>{enviando ? "Entrando..." : "Entrar"}</Botao>
    </form>
  );
}
