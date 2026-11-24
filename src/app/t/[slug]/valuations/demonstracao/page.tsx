import { EsqueletoDeTela } from "@/components/ui/esqueletos";
import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AcessoNegado, obterAcesso } from "@/server/services/acesso";
import { telaDoValuation } from "@/server/services/valuation";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { AvisoDeSimulacao } from "@/components/ui/aviso-de-simulacao";
import { Abas, PainelDeAba } from "@/components/ui/abas";
import { Cartao, Titulo } from "@/components/ui/basicos";
import {
  CenariosDoValuation,
  ComparacaoDoValuation,
  MetodosDoValuation,
  PainelDoValuation,
  PremissasDoValuation,
  RateioDoValuation,
  TeseDoValuation,
} from "@/components/valuation/detalhe";
import { br } from "@/components/valuation/formato";
import { estaSimulada } from "@/config/funcionalidades";

const ABAS = ["painel", "premissas", "metodos", "cenarios", "rateio", "tese", "comparacao"] as const;

/** Valuation de demonstração (item 18, simulado), com comparação com ofertas reais. */
async function Painel({
  aba,
  negocio,
}: {
  aba: Promise<string | undefined>;
  negocio: Promise<string | undefined>;
}) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const tela = await telaDoValuation(acesso, await negocio).catch((e) => {
    if (e instanceof AcessoNegado) notFound();
    throw e;
  });
  if ("erro" in tela) notFound();
  const t = await getTranslations("valuation");
  const { dados, resultado } = tela;
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-6xl">
          <Link href="/valuations" className="text-primary text-sm">
            {t("voltar")}
          </Link>
          <Titulo sobre={t("sobre")} ajuda={t("ajuda")}>
            {dados.titulo}
          </Titulo>
          <p className="text-muted -mt-2 mb-4 text-sm">
            {t("versaoSituacao", { versao: dados.versao, data: br(dados.dataBase), empresa: dados.empresa })}
          </p>
          {estaSimulada("valuation") && <AvisoDeSimulacao texto={t("aviso")} />}
          <Abas inicial={await aba} abas={ABAS.map((id) => ({ id, rotulo: t(`abas.${id}`) }))}>
            <PainelDeAba id="painel">
              <PainelDoValuation dados={dados} resultado={resultado} comparacao={tela.comparacao} />
            </PainelDeAba>
            <PainelDeAba id="premissas">
              <PremissasDoValuation dados={dados} />
            </PainelDeAba>
            <PainelDeAba id="metodos">
              <MetodosDoValuation dados={dados} resultado={resultado} />
            </PainelDeAba>
            <PainelDeAba id="cenarios">
              <CenariosDoValuation dados={dados} resultado={resultado} />
            </PainelDeAba>
            <PainelDeAba id="rateio">
              <RateioDoValuation dados={dados} resultado={resultado} />
            </PainelDeAba>
            <PainelDeAba id="tese">
              <TeseDoValuation dados={dados} />
            </PainelDeAba>
            <PainelDeAba id="comparacao">
              {estaSimulada("valuation") && <AvisoDeSimulacao compacto texto={t("avisoComparacao")} />}
              <div className="mt-3">
                <ComparacaoDoValuation
                  dados={dados}
                  resultado={resultado}
                  negocios={tela.negocios}
                  comparacao={tela.comparacao}
                />
              </div>
            </PainelDeAba>
          </Abas>
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/valuations/demonstracao">) {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel
        aba={searchParams.then((q) => (typeof q.aba === "string" ? q.aba : undefined))}
        negocio={searchParams.then((q) => (typeof q.negocio === "string" ? q.negocio : undefined))}
      />
    </Suspense>
  );
}
