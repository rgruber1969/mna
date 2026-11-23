import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { entradaDeDesenvolvimentoDisponivel, tenantPorSlug, tenantSuspenso } from "@/server/services/acesso";
import { TelaEntrar } from "@/components/acesso/telas";
import { estaLigada } from "@/config/funcionalidades";
import { Cartao, Carregando, LogoDoTenant, Moldura, Titulo } from "@/components/ui/basicos";
import { marcaPorSlug } from "@/server/services/marca";

async function Conteudo({ slug }: { slug: Promise<string> }) {
  await connection();
  const t = await getTranslations("acesso.entrada");
  const s = await slug;
  const tenant = await tenantPorSlug(s);
  if (!tenant && (await tenantSuspenso(s)))
    return (
      <Moldura>
        <Cartao>
          <Titulo sobre={t("suspensaSobre")}>{t("suspensaTitulo")}</Titulo>
          <p className="text-muted text-sm">{t("suspensaTexto")}</p>
        </Cartao>
      </Moldura>
    );
  if (!tenant) notFound();
  const marca = await marcaPorSlug(s);
  // Fundo escuro: logo para fundo escuro; sem ela, a de fundo claro sobre uma placa clara.
  const logo = marca?.logoEscuro ? (
    <LogoDoTenant src={marca.logoEscuro} nome={tenant.nomeExibido} className="h-16" />
  ) : marca?.logoClaro ? (
    <span className="bg-background inline-block rounded-lg px-5 py-3">
      <LogoDoTenant src={marca.logoClaro} nome={tenant.nomeExibido} className="h-14" />
    </span>
  ) : undefined;
  return (
    <TelaEntrar
      titulo={tenant.nomeExibido}
      logoDoTenant={logo}
      linhas
      soComEmail={entradaDeDesenvolvimentoDisponivel(new Headers(await headers()))}
      loginSocial={estaLigada("loginSocial")}
    />
  );
}

export default function Page({ params }: PageProps<"/t/[slug]/entrar">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo slug={params.then((p) => p.slug)} />
    </Suspense>
  );
}
