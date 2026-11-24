import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Abas de "Usuários e acesso" (um item só no menu, pedido de 2026-11-23):
 * Usuários e Perfis só para administradores; Auditoria para quem tem a
 * permissão ou é administrador. Cada aba continua com o próprio endereço.
 */
export async function AbasDeAcesso({
  atual,
  administrador,
}: {
  atual: "usuarios" | "perfis" | "auditoria";
  administrador: boolean;
}) {
  const t = await getTranslations("menu.itens");
  const abas = [
    ...(administrador
      ? [
          { id: "usuarios", href: "/usuarios", rotulo: t("usuarios") },
          { id: "perfis", href: "/perfis", rotulo: t("perfis") },
        ]
      : []),
    { id: "auditoria", href: "/auditoria", rotulo: t("auditoria") },
  ];
  if (abas.length < 2) return null;
  return (
    <nav aria-label={t("acesso")} className="border-border flex w-full max-w-6xl gap-5 border-b">
      {abas.map((a) => (
        <Link
          key={a.id}
          href={a.href}
          aria-current={a.id === atual ? "page" : undefined}
          className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
            a.id === atual ? "border-primary text-primary" : "text-muted hover:text-text border-transparent"
          }`}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
