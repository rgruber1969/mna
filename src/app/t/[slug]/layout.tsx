import { Suspense } from "react";
import { connection } from "next/server";
import { marcaPorSlug } from "@/server/services/marca";

/**
 * Tema do tenant (white label, ADR-0010): sobrescreve as variáveis de cor e
 * de fonte de `globals.css` e troca o ícone da aba, em todas as telas do
 * tenant, inclusive a de entrada. O CSS só contém valores já validados
 * (cores #RRGGBB e fontes da lista curta).
 */
async function TemaDoTenant({ slug }: { slug: Promise<string> }) {
  await connection();
  const marca = await marcaPorSlug(await slug);
  if (!marca) return null;
  return (
    <>
      {marca.css && <style>{marca.css}</style>}
      {marca.icone && <link rel="icon" href={marca.icone} type="image/png" />}
    </>
  );
}

export default function Layout({ children, params }: LayoutProps<"/t/[slug]">) {
  return (
    <>
      <Suspense fallback={null}>
        <TemaDoTenant slug={params.then((p) => p.slug)} />
      </Suspense>
      {children}
    </>
  );
}
