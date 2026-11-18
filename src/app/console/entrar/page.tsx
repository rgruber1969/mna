import { connection } from "next/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import { entradaDeDesenvolvimentoDisponivel } from "@/server/services/acesso";
import { LogoRgruber, TelaEntrar } from "@/components/acesso/telas";
import { Carregando } from "@/components/ui/basicos";

/** Entrada do console: identidade da RGRUBER, fundo escuro da marca. */
async function Conteudo() {
  await connection();
  const soComEmail = entradaDeDesenvolvimentoDisponivel(new Headers(await headers()));
  return <TelaEntrar titulo="Console do Administrador" marca={<LogoRgruber />} soComEmail={soComEmail} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo />
    </Suspense>
  );
}
