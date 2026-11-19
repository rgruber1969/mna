import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * Situação de acesso de uma pessoa ao sistema, com o atalho para convidar
 * (abre o convite em Usuários já com nome e e-mail; só administradores).
 */
export function AcessoDaPessoa({
  acesso,
  nome,
  email,
  podeConvidar,
  soIcone = false,
}: {
  acesso: "usuario" | "convidado" | "sem-acesso";
  nome: string;
  email: string | null;
  podeConvidar: boolean;
  /** Na tabela (o título da coluna dá o contexto): usuário aparece só com o sinal de "check". */
  soIcone?: boolean;
}) {
  const t = useTranslations("cadastros.acessoDaPessoa");
  if (acesso === "usuario")
    return (
      <span className="text-success inline-flex shrink-0 items-center gap-1 text-xs font-medium">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          role="img"
          aria-label={t("eUsuario")}
        >
          <title>{t("eUsuario")}</title>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        {!soIcone && t("usuario")}
      </span>
    );
  if (acesso === "convidado")
    return <span className="text-muted shrink-0 text-xs">{t("conviteEnviado")}</span>;
  if (!podeConvidar) return <span className="text-muted shrink-0 text-xs">{t("semAcesso")}</span>;
  if (!email) return <span className="text-muted shrink-0 text-xs">{t("semEmail")}</span>;
  return (
    <Link
      href={`/usuarios?${new URLSearchParams({ nome, email })}`}
      className="text-primary shrink-0 text-xs font-medium"
    >
      {t("convidar")}
    </Link>
  );
}
