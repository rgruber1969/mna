import { connection } from "next/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { entradaDeDesenvolvimentoDisponivel } from "@/server/services/acesso";
import { LogoRgruber, TelaEntrar } from "@/components/acesso/telas";
import { Carregando } from "@/components/ui/basicos";

/** Entrada do console: identidade da RGRUBER, fundo escuro da marca. */
async function Conteudo() {
  await connection();
  const t = await getTranslations("acesso.entrada");
  const soComEmail = entradaDeDesenvolvimentoDisponivel(new Headers(await headers()));
  return <TelaEntrar titulo={t("tituloConsole")} marca={<LogoRgruber />} soComEmail={soComEmail} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo />
    </Suspense>
  );
}
