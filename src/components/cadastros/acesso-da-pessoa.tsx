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
}: {
  acesso: "usuario" | "convidado" | "sem-acesso";
  nome: string;
  email: string | null;
  podeConvidar: boolean;
}) {
  const t = useTranslations("cadastros.acessoDaPessoa");
  if (acesso === "usuario")
    return <span className="text-success shrink-0 text-xs font-medium">{t("usuario")}</span>;
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
