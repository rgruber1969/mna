import { EsqueletoDeTela } from "@/components/ui/esqueletos";
import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { opcoesParaNovoNegocio } from "@/server/services/negocios";
import { pode } from "@/server/services/permissoes/verificador";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormNovoNegocio } from "@/components/negocios/formularios";
import { Cartao, Titulo } from "@/components/ui/basicos";

/** Novo negócio: formulário curto; o restante nas abas do negócio. */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "deals", "criar"))) notFound();
  const t = await getTranslations("negocios.novo");
  const opcoes = await opcoesParaNovoNegocio(acesso);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-2xl">
          <Link href="/negocios" className="text-primary text-sm">
            {t("voltar")}
          </Link>
          <Titulo sobre={t("sobre")} ajuda={t("ajuda")}>
            {t("titulo")}
          </Titulo>
          <p className="text-muted mb-4 text-sm">{t("aviso")}</p>
          <FormNovoNegocio
            tipos={opcoes.tipos}
            papeis={opcoes.papeis}
            empresas={opcoes.empresas}
            grupos={opcoes.grupos}
            hoje={hoje}
          />
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
