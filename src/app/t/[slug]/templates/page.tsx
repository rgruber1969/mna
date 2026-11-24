import { EsqueletoDeTela } from "@/components/ui/esqueletos";
import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { telaDeTemplates } from "@/server/services/templates";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { ListaDeTemplates } from "@/components/templates/lista";
import { AvisoDeSimulacao } from "@/components/ui/aviso-de-simulacao";
import { Cartao, Titulo } from "@/components/ui/basicos";
import { estaSimulada } from "@/config/funcionalidades";

/** Templates DOCX com preenchimento de campos (item 13, simulado). */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const [tela, t] = await Promise.all([telaDeTemplates(acesso), getTranslations("templates")]);
  if ("erro" in tela) notFound();
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-6xl">
          <Titulo ajuda={t("ajuda")}>{t("titulo")}</Titulo>
          {estaSimulada("templatesDocx") && <AvisoDeSimulacao texto={t("aviso")} />}
          <ListaDeTemplates templates={tela.templates} negocios={tela.negocios} contratos={tela.contratos} />
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel />
    </Suspense>
  );
}
