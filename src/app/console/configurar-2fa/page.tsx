import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { obterAcesso } from "@/server/services/acesso";
import { FormAutenticador } from "@/components/acesso/formularios";
import { Cartao, Carregando, Moldura, Titulo } from "@/components/ui/basicos";

/** No console, o 2FA é obrigatório: sem ele, só esta tela fica disponível. */
async function Conteudo() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "console") redirect("/entrar");
  if (acesso.usuario.doisFatoresAtivo) redirect("/");
  return <FormAutenticador />;
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
