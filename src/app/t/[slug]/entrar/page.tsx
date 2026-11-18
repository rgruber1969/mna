import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { tenantPorSlug, tenantSuspenso } from "@/server/services/acesso";
import { TelaEntrar } from "@/components/acesso/telas";
import { Cartao, Carregando, Moldura, Titulo } from "@/components/ui/basicos";

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
  return <TelaEntrar titulo={t.nome} />;
}

export default function Page({ params }: PageProps<"/t/[slug]/entrar">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo slug={params.then((p) => p.slug)} />
    </Suspense>
  );
}
