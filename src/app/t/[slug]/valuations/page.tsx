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
import { Cartao, Titulo, estiloTabela } from "@/components/ui/basicos";
import { br, milhoes } from "@/components/valuation/formato";
import { estaSimulada } from "@/config/funcionalidades";

/** Valuations que a pessoa vê (item 18, simulado: um valuation fictício). */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const tela = await telaDoValuation(acesso).catch((e) => {
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
          <Titulo ajuda={t("ajuda")}>{t("titulo")}</Titulo>
          {estaSimulada("valuation") && <AvisoDeSimulacao texto={t("aviso")} />}
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              disabled
              title={t("novoEmBreve")}
              className="bg-cta text-cta-foreground rounded-md px-3 py-1.5 text-sm font-semibold opacity-60"
            >
              {t("novo")}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className={estiloTabela.tabela}>
              <thead className={estiloTabela.cabecalho}>
                <tr>
                  <th className={estiloTabela.th}>{t("colValuation")}</th>
                  <th className={estiloTabela.th}>{t("colEmpresa")}</th>
                  <th className={estiloTabela.th}>{t("colDataBase")}</th>
                  <th className={`${estiloTabela.th} text-right`}>{t("colValor")}</th>
                  <th className={`${estiloTabela.th} text-right`}>{t("colFaixa")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className={estiloTabela.linha}>
                  <td className={estiloTabela.td}>
                    <Link href="/valuations/demonstracao" className="text-primary font-medium">
                      {dados.titulo}
                    </Link>
                  </td>
                  <td className={`${estiloTabela.td} text-xs`}>{dados.empresa}</td>
                  <td className={`${estiloTabela.td} text-xs`}>{br(dados.dataBase)}</td>
                  <td className={`${estiloTabela.td} text-right tabular-nums`}>
                    {milhoes(resultado.ponderado)}
                  </td>
                  <td className={`${estiloTabela.td} text-right text-xs whitespace-nowrap tabular-nums`}>
                    {milhoes(dados.faixa.minimo)} – {milhoes(dados.faixa.maximo)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
