import { useTranslations } from "next-intl";
import { produto } from "@/config/produto";
import { AssinaturaRgruber } from "@/components/ui/basicos";

/**
 * Página inicial provisória da fundação técnica. Será substituída pela tela
 * principal (KPIs, pendências e mensagens) quando o login existir.
 */
export default function Inicio() {
  const t = useTranslations("acesso.raiz");
  return (
    <main className="bg-surface flex flex-1 items-center justify-center px-6">
      <section className="border-border bg-background w-full max-w-xl rounded-lg border p-10">
        <p className="text-accent text-sm font-semibold tracking-widest uppercase">{t("sobre")}</p>
        <h1 className="text-primary mt-3 text-3xl font-semibold">{produto.nome}</h1>
        <p className="text-muted mt-4 leading-relaxed">{t("texto")}</p>
        {/* /api/docs é rota da API (Hono), não página do Next: <a> é o correto aqui. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/docs"
          className="bg-primary text-primary-foreground mt-8 inline-block rounded-md px-5 py-2.5 text-sm font-medium"
        >
          {t("documentacaoDaApi")}
        </a>
      </section>
      <AssinaturaRgruber className="fixed bottom-4" />
    </main>
  );
}
