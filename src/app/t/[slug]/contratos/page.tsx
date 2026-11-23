import { EsqueletoDeTela } from "@/components/ui/esqueletos";
import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { listarContratos, opcoesDoContrato } from "@/server/services/contratos";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { TabelaDeContratos } from "@/components/contratos/detalhe";
import { Cartao, Titulo } from "@/components/ui/basicos";

/** Contratos de serviço que a pessoa vê (item 17): todos ou só os avulsos. */
async function Painel({ filtro }: { filtro: Promise<string | undefined> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const soAvulsos = (await filtro) === "avulsos";
  const [contratos, opcoes, t] = await Promise.all([
    listarContratos(acesso, soAvulsos ? { dealId: null } : {}),
    opcoesDoContrato(acesso, null),
    getTranslations("contratos"),
  ]);
  const aba = (ativo: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${ativo ? "bg-primary-soft text-primary" : "text-muted"}`;
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-6xl">
          <Titulo ajuda={t("ajuda")}>{t("titulo")}</Titulo>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <nav className="flex gap-2">
              <Link href="/contratos" className={aba(!soAvulsos)}>
                {t("todos")}
              </Link>
              <Link href="/contratos?filtro=avulsos" className={aba(soAvulsos)}>
                {t("avulsos")}
              </Link>
            </nav>
            {opcoes.podeCriar && (
              <Link
                href="/contratos/novo"
                className="bg-cta text-cta-foreground rounded-md px-3 py-1.5 text-sm font-semibold"
              >
                {t("novo")}
              </Link>
            )}
          </div>
          <TabelaDeContratos contratos={contratos} mostrarNegocio />
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/contratos">) {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel filtro={searchParams.then((q) => (typeof q.filtro === "string" ? q.filtro : undefined))} />
    </Suspense>
  );
}
