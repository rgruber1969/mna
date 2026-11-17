import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { tenantPorSlug } from "@/server/services/acesso";
import { TelaEntrar } from "@/components/acesso/telas";
import { Carregando } from "@/components/ui/basicos";

async function Conteudo({ slug }: { slug: Promise<string> }) {
  await connection();
  const t = await tenantPorSlug(await slug);
  if (!t) notFound();
  return <TelaEntrar onde={t.nome} />;
}

export default function Page({ params }: PageProps<"/t/[slug]/entrar">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo slug={params.then((p) => p.slug)} />
    </Suspense>
  );
}
