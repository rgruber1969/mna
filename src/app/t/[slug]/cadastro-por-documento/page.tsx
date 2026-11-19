import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { pode } from "@/server/services/permissoes/verificador";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { CadastroPorDocumento } from "@/components/cadastros/cadastro-por-documento";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Cadastro de empresas, pessoas e vínculos a partir de documento (ADR-0021). */
async function Painel({ de }: { de: Promise<string | undefined> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "empresas", "criar"))) notFound();
  const t = await getTranslations("cadastros.porDocumento");
  const voltar = (await de) === "pessoas" ? "/pessoas" : "/empresas";
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-2xl">
          <Link href={voltar} className="text-primary text-sm">
            {voltar === "/pessoas" ? t("voltarPessoas") : t("voltarEmpresas")}
          </Link>
          <Titulo sobre={t("sobre")}>{t("titulo")}</Titulo>
          <CadastroPorDocumento />
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/cadastro-por-documento">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel de={searchParams.then((s) => (typeof s.de === "string" ? s.de : undefined))} />
    </Suspense>
  );
}
