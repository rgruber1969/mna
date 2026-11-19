import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("console");
  const motivos = Object.fromEntries(MOTIVOS_DE_REDEFINICAO.map((m) => [m, t(`motivos.${m}`)]));

  return (
    <>
      <Cabecalho area={`${produto.nome} · Console`} usuario={acesso.usuario} console />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <Cartao largura="max-w-2xl">
          <Titulo sobre={t("tenants.sobre")}>{t("tenants.titulo")}</Titulo>
          {tenants.length === 0 ? (
            <p className="text-muted text-sm">{t("tenants.nenhum")}</p>
          ) : (
            <ul className="divide-border divide-y">
              {tenants.map((ten) => (
                <li key={ten.id} className="flex items-center justify-between py-3">
                  <Link href={`/tenants/${ten.id}`} className="text-primary font-medium">
                    {ten.nome}
                  </Link>
                  <span className="text-muted text-sm">
                    {ten.suspensoEm && (
                      <span className="text-danger mr-2 font-medium">{t("tenants.suspenso")}</span>
                    )}
                    {ten.slug}.{dominio}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Cartao largura="max-w-sm">
            <Titulo sobre={t("tenants.novoSobre")}>{t("tenants.cadastrar")}</Titulo>
            <FormNovoTenant />
          </Cartao>
          <Cartao largura="max-w-sm">
            <Titulo sobre={t("tenants.suporteSobre")}>{t("tenants.redefinirTitulo")}</Titulo>
            <p className="text-muted mb-4 text-sm">{t("tenants.redefinirTexto")}</p>
            <FormRedefinirPelaPlataforma motivos={motivos} />
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
