import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { produto } from "@/config/produto";
import { obterAcesso } from "@/server/services/acesso";
import { obterTenant } from "@/server/services/console";
import { Cabecalho } from "@/components/acesso/cabecalho";
import { ExigeSegundoFator } from "@/components/acesso/telas";
import { FormConvidarAdministrador } from "@/components/acesso/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

async function Detalhe({ id }: { id: Promise<string> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "console") redirect("/entrar");
  if (!acesso.usuario.doisFatoresAtivo) redirect("/configurar-2fa");
  if (!acesso.segundoFatorNaSessao) return <ExigeSegundoFator />;
  const t = await obterTenant(acesso, await id);
  if (!t) notFound();
  const dominio = process.env.APP_DOMINIO ?? "localhost:3000";

  return (
    <>
      <Cabecalho area={`${produto.nome} · Console`} usuario={acesso.usuario.nome} />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <Cartao largura="max-w-xl">
          <Link href="/" className="text-primary text-sm">
            ← Tenants
          </Link>
          <Titulo sobre="Tenant">{t.nome}</Titulo>
          <dl className="text-sm">
            <dt className="text-muted">Endereço</dt>
            <dd className="text-text mb-3">
              {t.slug}.{dominio}
            </dd>
            <dt className="text-muted">Administradores ativos</dt>
            <dd className="text-text mb-3">{t.administradores}</dd>
          </dl>
          {t.convitesPendentes.length > 0 && (
            <>
              <h2 className="text-text mt-4 mb-2 text-sm font-semibold">Convites pendentes</h2>
              <ul className="text-muted text-sm">
                {t.convitesPendentes.map((c) => (
                  <li key={c.email + c.expiraEm.toISOString()}>
                    {c.nome} ({c.email}) · vence em {c.expiraEm.toLocaleString("pt-BR")}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Cartao>
        <Cartao largura="max-w-sm">
          <Titulo sobre="Primeiro acesso">Convidar administrador</Titulo>
          <FormConvidarAdministrador tenantId={t.id} />
        </Cartao>
      </main>
    </>
  );
}

export default function Page({ params }: PageProps<"/console/tenants/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Detalhe id={params.then((p) => p.id)} />
    </Suspense>
  );
}
