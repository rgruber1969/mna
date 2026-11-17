import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { obterAcesso } from "@/server/services/acesso";
import { FormAutenticador } from "@/components/acesso/formularios";
import { FormCriarPasskey } from "@/components/acesso/passkey-e-link";
import { Cartao, Carregando, Moldura, Titulo } from "@/components/ui/basicos";

/** No console, o 2FA é obrigatório: sem ele, só esta tela fica disponível. */
async function Conteudo() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "console") redirect("/entrar");
  if (acesso.usuario.doisFatoresAtivo) redirect("/");
  return (
    <>
      <h2 className="text-text mb-2 text-sm font-semibold">Opção 1: passkey (recomendada)</h2>
      <FormCriarPasskey reentrar />
      <div className="border-border my-6 border-t" />
      <h2 className="text-text mb-2 text-sm font-semibold">Opção 2: aplicativo autenticador</h2>
      <FormAutenticador />
    </>
  );
}

export default function Page() {
  return (
    <Moldura>
      <Cartao>
        <Titulo sobre="Segurança">Verificação em duas etapas</Titulo>
        <Suspense fallback={<Carregando />}>
          <Conteudo />
        </Suspense>
      </Cartao>
    </Moldura>
  );
}
