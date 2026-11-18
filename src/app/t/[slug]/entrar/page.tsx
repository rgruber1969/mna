import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { headers } from "next/headers";
import { entradaDeDesenvolvimentoDisponivel, tenantPorSlug, tenantSuspenso } from "@/server/services/acesso";
import { TelaEntrar } from "@/components/acesso/telas";
import { Cartao, Carregando, LogoDoTenant, Moldura, Titulo } from "@/components/ui/basicos";
import { marcaPorSlug } from "@/server/services/marca";

async function Conteudo({ slug }: { slug: Promise<string> }) {
  await connection();
  const s = await slug;
  const t = await tenantPorSlug(s);
  if (!t && (await tenantSuspenso(s)))
    return (
      <Moldura>
        <Cartao>
          <Titulo sobre="Acesso">Acesso suspenso</Titulo>
          <p className="text-muted text-sm">
            O acesso a este endereço está suspenso no momento. Fale com o responsável pelo contrato.
          </p>
        </Cartao>
      </Moldura>
    );
  if (!t) notFound();
  const marca = await marcaPorSlug(s);
  // Fundo escuro: logo para fundo escuro; sem ela, a de fundo claro sobre uma placa clara.
  const logo = marca?.logoEscuro ? (
    <LogoDoTenant src={marca.logoEscuro} nome={t.nomeExibido} className="h-16" />
  ) : marca?.logoClaro ? (
    <span className="bg-background inline-block rounded-lg px-5 py-3">
      <LogoDoTenant src={marca.logoClaro} nome={t.nomeExibido} className="h-14" />
    </span>
  ) : undefined;
  return (
    <TelaEntrar
      titulo={t.nomeExibido}
      logoDoTenant={logo}
      linhas
      soComEmail={entradaDeDesenvolvimentoDisponivel(new Headers(await headers()))}
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
