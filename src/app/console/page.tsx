import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { produto } from "@/config/produto";
import { obterAcesso } from "@/server/services/acesso";
import { listarTenants } from "@/server/services/console";
import { Cabecalho } from "@/components/acesso/cabecalho";
import { ExigeSegundoFator } from "@/components/acesso/telas";
import { FormNovoTenant } from "@/components/acesso/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "console") redirect("/entrar");
  if (!acesso.usuario.doisFatoresAtivo) redirect("/configurar-2fa");
  if (!acesso.segundoFatorNaSessao) return <ExigeSegundoFator />;
  const tenants = await listarTenants(acesso);
  const dominio = process.env.APP_DOMINIO ?? "localhost:3000";

  return (
    <>
      <Cabecalho area={`${produto.nome} · Console`} usuario={acesso.usuario.nome} />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <Cartao largura="max-w-2xl">
          <Titulo sobre="Console">Tenants</Titulo>
          {tenants.length === 0 ? (
            <p className="text-muted text-sm">Nenhum tenant cadastrado.</p>
          ) : (
            <ul className="divide-border divide-y">
              {tenants.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <Link href={`/tenants/${t.id}`} className="text-primary font-medium">
                    {t.nome}
                  </Link>
                  <span className="text-muted text-sm">
                    {t.slug}.{dominio}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao largura="max-w-sm">
          <Titulo sobre="Novo">Cadastrar tenant</Titulo>
          <FormNovoTenant />
        </Cartao>
      </main>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel />
    </Suspense>
  );
}
