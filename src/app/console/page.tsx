import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { produto } from "@/config/produto";
import { obterAcesso } from "@/server/services/acesso";
import { listarTenants, MOTIVOS_DE_REDEFINICAO } from "@/server/services/console";
import { Cabecalho } from "@/components/acesso/cabecalho";
import { ExigeSegundoFator } from "@/components/acesso/telas";
import { FormNovoTenant } from "@/components/acesso/formularios";
import { FormRedefinirPelaPlataforma } from "@/components/usuarios/formularios";
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
      <Cabecalho area={`${produto.nome} · Console`} usuario={acesso.usuario} console />
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
                    {t.suspensoEm && <span className="text-danger mr-2 font-medium">Suspenso</span>}
                    {t.slug}.{dominio}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Cartao largura="max-w-sm">
            <Titulo sobre="Novo">Cadastrar tenant</Titulo>
            <FormNovoTenant />
          </Cartao>
          <Cartao largura="max-w-sm">
            <Titulo sobre="Suporte">Redefinir 2FA de uma conta</Titulo>
            <p className="text-muted mb-4 text-sm">
              Para quem perdeu todos os fatores e tem acesso a mais de um tenant que exige 2FA. Apaga
              autenticador, códigos e passkeys, encerra as sessões e avisa a pessoa por e-mail.
            </p>
            <FormRedefinirPelaPlataforma motivos={{ ...MOTIVOS_DE_REDEFINICAO }} />
          </Cartao>
        </div>
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
