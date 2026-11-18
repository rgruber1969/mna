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
import { suspenderTenantAcao } from "@/app/acoes/usuarios";
import { BotaoDeAcao, FormRenomearTenant } from "@/components/usuarios/formularios";
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
      <Cabecalho area={`${produto.nome} · Console`} usuario={acesso.usuario.nome} console />
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
            <dt className="text-muted">Situação</dt>
            <dd className="mb-3">
              {t.suspensoEm ? (
                <span className="text-danger">Suspenso desde {t.suspensoEm.toLocaleString("pt-BR")}</span>
              ) : (
                <span className="text-success">Ativo</span>
              )}
            </dd>
          </dl>
          <BotaoDeAcao
            acao={suspenderTenantAcao}
            campos={{ id: t.id, valor: t.suspensoEm ? "nao" : "sim" }}
            rotulo={t.suspensoEm ? "Reativar tenant" : "Suspender tenant"}
            confirmar={
              t.suspensoEm
                ? "Reativar o acesso a este tenant?"
                : "Suspender este tenant? Ninguém dele entra mais e as sessões abertas são encerradas agora. Os dados são preservados."
            }
            perigo={!t.suspensoEm}
          />
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
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Cartao largura="max-w-sm">
            <Titulo sobre="Primeiro acesso">Convidar administrador</Titulo>
            <FormConvidarAdministrador tenantId={t.id} />
          </Cartao>
          <Cartao largura="max-w-sm">
            <Titulo sobre="Edição">Nome do tenant</Titulo>
            <p className="text-muted mb-4 text-sm">O endereço é fixo depois de criado.</p>
            <FormRenomearTenant id={t.id} nome={t.nome} />
          </Cartao>
        </div>
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
