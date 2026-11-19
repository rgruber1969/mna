import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { listarGrupos } from "@/server/services/empresas";
import { pode } from "@/server/services/permissoes/verificador";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormEmpresa } from "@/components/cadastros/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "empresas", "criar"))) notFound();
  const t = await getTranslations("cadastros.empresas");
  const grupos = await listarGrupos(acesso);
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-2xl">
          <Link href="/empresas" className="text-primary text-sm">
            {t("voltar")}
          </Link>
          <Titulo sobre={t("sobre")}>{t("nova")}</Titulo>
          <FormEmpresa inicial={{ pais: "Brasil" }} grupos={grupos} podeSalvar />
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel />
    </Suspense>
  );
}
