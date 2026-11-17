import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { produto } from "@/config/produto";
import { obterConvite } from "@/server/services/convites";
import { Cartao, Carregando, Moldura, Titulo } from "@/components/ui/basicos";
import { FormConvite, FormEntrar, FormSegundoFator } from "./formularios";

/** Telas de acesso compartilhadas pelo console e pelos tenants. */

export function TelaEntrar({ onde }: { onde: string }) {
  return (
    <Moldura>
      <Cartao>
        <Titulo sobre={produto.nome}>Entrar em {onde}</Titulo>
        <FormEntrar />
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
