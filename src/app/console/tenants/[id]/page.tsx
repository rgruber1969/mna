import { getFormatter, getTranslations } from "next-intl/server";
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

const DATA_E_HORA = { dateStyle: "short", timeStyle: "medium" } as const;

async function Detalhe({ id }: { id: Promise<string> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "console") redirect("/entrar");
  if (!acesso.usuario.doisFatoresAtivo) redirect("/configurar-2fa");
  if (!acesso.segundoFatorNaSessao) return <ExigeSegundoFator />;
  const ten = await obterTenant(acesso, await id);
  if (!ten) notFound();
  const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
  const t = await getTranslations("console.tenant");
  const formatar = await getFormatter();

  return (
    <>
      <Cabecalho area={`${produto.nome} · Console`} usuario={acesso.usuario} console />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <Cartao largura="max-w-xl">
          <Link href="/" className="text-primary text-sm">
            {t("voltar")}
          </Link>
          <Titulo sobre={t("sobre")}>{ten.nome}</Titulo>
          <dl className="text-sm">
            <dt className="text-muted">{t("endereco")}</dt>
            <dd className="text-text mb-3">
              {ten.slug}.{dominio}
            </dd>
            <dt className="text-muted">{t("administradores")}</dt>
            <dd className="text-text mb-3">{ten.administradores}</dd>
            <dt className="text-muted">{t("situacao")}</dt>
            <dd className="mb-3">
              {ten.suspensoEm ? (
                <span className="text-danger">
                  {t("suspensoDesde", { data: formatar.dateTime(ten.suspensoEm, DATA_E_HORA) })}
                </span>
              ) : (
                <span className="text-success">{t("ativo")}</span>
              )}
            </dd>
          </dl>
          <BotaoDeAcao
            acao={suspenderTenantAcao}
            campos={{ id: ten.id, valor: ten.suspensoEm ? "nao" : "sim" }}
            rotulo={ten.suspensoEm ? t("reativar") : t("suspender")}
            confirmar={ten.suspensoEm ? t("confirmarReativar") : t("confirmarSuspender")}
            perigo={!ten.suspensoEm}
          />
          {ten.convitesPendentes.length > 0 && (
            <>
              <h2 className="text-text mt-4 mb-2 text-sm font-semibold">{t("convitesPendentes")}</h2>
              <ul className="text-muted text-sm">
                {ten.convitesPendentes.map((c) => (
                  <li key={c.email + c.expiraEm.toISOString()}>
                    {t("conviteVence", {
                      nome: c.nome,
                      email: c.email,
                      data: formatar.dateTime(c.expiraEm, DATA_E_HORA),
                    })}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Cartao>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Cartao largura="max-w-sm">
            <Titulo sobre={t("convidarSobre")}>{t("convidarTitulo")}</Titulo>
            <FormConvidarAdministrador tenantId={ten.id} />
          </Cartao>
          <Cartao largura="max-w-sm">
            <Titulo sobre={t("edicaoSobre")}>{t("nomeTitulo")}</Titulo>
            <p className="text-muted mb-4 text-sm">{t("enderecoFixo")}</p>
            <FormRenomearTenant id={ten.id} nome={ten.nome} />
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
