import { EsqueletoDeTela } from "@/components/ui/esqueletos";
import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { negociosParaLigar, opcoesDoContrato } from "@/server/services/contratos";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormContrato } from "@/components/contratos/formulario";
import { valoresVazios } from "@/components/contratos/valores";
import { Cartao, Titulo } from "@/components/ui/basicos";

/** Novo contrato: no negócio (?negocio=) ou avulso. */
async function Painel({ negocio }: { negocio: Promise<string | undefined> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const dealId = (await negocio) ?? null;
  const [opcoes, negocios, t] = await Promise.all([
    opcoesDoContrato(acesso, dealId),
    dealId ? [] : negociosParaLigar(acesso),
    getTranslations("contratos"),
  ]);
  if (!opcoes.podeCriar) notFound();
  const voltar = dealId ? `/negocios/${dealId}?aba=contratos` : "/contratos";
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-4xl">
          <Link href={voltar} className="text-primary text-sm">
            {t("voltar")}
          </Link>
          <Titulo ajuda={t("ajuda")}>{t("novo")}</Titulo>
          <FormContrato
            inicial={valoresVazios(dealId, opcoes.meuLado)}
            opcoes={opcoes}
            negocios={negocios}
            aoCancelar={voltar}
          />
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/contratos/novo">) {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel negocio={searchParams.then((q) => (typeof q.negocio === "string" ? q.negocio : undefined))} />
    </Suspense>
  );
}
