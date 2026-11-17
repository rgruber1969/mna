import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { produto } from "@/config/produto";
import { obterAcesso } from "@/server/services/acesso";
import { obterConvite } from "@/server/services/convites";
import { Cartao, Carregando, Moldura, Titulo } from "@/components/ui/basicos";
import { Cabecalho } from "./cabecalho";
import { AvisoDaEntrada } from "./aviso-da-entrada";
import { FormAutenticador, FormSair } from "./formularios";
import { BotaoEntrarComPasskey, FormCriarPasskey, FormPedirLink, FormUsarLink } from "./passkey-e-link";
import { FormConvite, FormEntrar, FormSegundoFator } from "./formularios";

/** Telas de acesso compartilhadas pelo console e pelos tenants. */

export function TelaEntrar({ onde }: { onde: string }) {
  return (
    <Moldura>
      <Cartao>
        <Titulo sobre={produto.nome}>Entrar em {onde}</Titulo>
        <Suspense>
          <AvisoDaEntrada />
        </Suspense>
        <FormEntrar />
        <div className="border-border my-6 border-t" />
        <BotaoEntrarComPasskey />
        <details className="mt-4">
          <summary className="text-primary cursor-pointer text-sm font-medium">
            Receber link de acesso por e-mail
          </summary>
          <div className="mt-4">
            <FormPedirLink />
          </div>
        </details>
      </Cartao>
    </Moldura>
  );
}

export function TelaSegundoFator() {
  return (
    <Moldura>
      <Cartao>
        <Titulo sobre="Verificação em duas etapas">Confirme que é você</Titulo>
        <FormSegundoFator />
      </Cartao>
    </Moldura>
  );
}

async function ConteudoConvite({ token }: { token: Promise<string> }) {
  await connection();
  const t = await token;
  const c = await obterConvite((await headers()).get("host"), t);
  if (!c) notFound();
  return (
    <>
      <Titulo sobre="Convite">Olá, {c.nome}</Titulo>
      <p className="text-muted mb-6 text-sm">
        Você foi convidado(a) para acessar {c.onde} com o e-mail{" "}
        <strong className="text-text">{c.email}</strong>.{" "}
        {c.contaExiste
          ? "Você já tem conta na plataforma: confirme sua senha para aceitar."
          : "Defina seu nome e uma senha para criar seu acesso."}
      </p>
      <FormConvite token={t} contaExiste={c.contaExiste} nome={c.nome} />
    </>
  );
}

export function TelaConvite({ token }: { token: Promise<string> }) {
  return (
    <Moldura>
      <Cartao>
        <Suspense fallback={<Carregando />}>
          <ConteudoConvite token={token} />
        </Suspense>
      </Cartao>
    </Moldura>
  );
}

export function TelaLink({ token }: { token: Promise<string> }) {
  return (
    <Moldura>
      <Cartao>
        <Titulo sobre="Link de acesso">Entrar</Titulo>
        <p className="text-muted mb-6 text-sm">
          Clique para entrar. Se você tiver verificação em duas etapas, o código será pedido em seguida.
        </p>
        <Suspense fallback={<Carregando />}>
          <TokenDoLink token={token} />
        </Suspense>
      </Cartao>
    </Moldura>
  );
}

async function TokenDoLink({ token }: { token: Promise<string> }) {
  return <FormUsarLink token={decodeURIComponent(await token)} />;
}

/** Aviso para quem precisa entrar de novo com dois fatores (ex.: só usou a senha). */
export function ExigeSegundoFator() {
  return (
    <Moldura>
      <Cartao>
        <Titulo sobre="Segurança">Entre com dois fatores</Titulo>
        <p className="text-muted mb-6 text-sm">
          Esta área exige verificação em duas etapas. Saia e entre de novo usando a passkey ou a senha com o
          código do aplicativo autenticador.
        </p>
        <FormSair />
      </Cartao>
    </Moldura>
  );
}

async function ConteudoSeguranca() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (!acesso) redirect("/entrar");
  const area = acesso.area === "console" ? `${produto.nome} · Console` : acesso.tenant.nome;
  return (
    <>
      <Cabecalho area={area} usuario={acesso.usuario.nome} />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <Cartao>
          <Titulo sobre="Segurança">Passkey</Titulo>
          {acesso.usuario.temPasskey && (
            <p className="text-success mb-4 text-sm">Você já tem passkey cadastrada. Pode cadastrar outra.</p>
          )}
          <FormCriarPasskey />
        </Cartao>
        <Cartao>
          <Titulo sobre="Segurança">Aplicativo autenticador</Titulo>
          {acesso.usuario.temAutenticador ? (
            <p className="text-success text-sm">Aplicativo autenticador ativo.</p>
          ) : (
            <FormAutenticador />
          )}
        </Cartao>
      </main>
    </>
  );
}

export function TelaSeguranca() {
  return (
    <Suspense fallback={<Carregando />}>
      <ConteudoSeguranca />
    </Suspense>
  );
}
