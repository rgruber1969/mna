import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
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
  const grupos = await listarGrupos(acesso);
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="bg-surface flex flex-1 justify-center px-4 py-10">
        <Cartao largura="max-w-2xl">
          <Link href="/empresas" className="text-primary text-sm">
            ← Empresas
          </Link>
          <Titulo sobre="Cadastro">Nova empresa</Titulo>
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
