import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { produto } from "@/config/produto";
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

/** Título da aba do navegador com o nome de exibição do tenant (white label). */
export async function generateMetadata({ params }: LayoutProps<"/t/[slug]">): Promise<Metadata> {
  const marca = await marcaPorSlug((await params).slug);
  return marca ? { title: `${marca.nome} · ${produto.nome}` } : {};
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
