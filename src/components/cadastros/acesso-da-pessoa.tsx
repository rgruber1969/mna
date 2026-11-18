import Link from "next/link";

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
  if (acesso === "usuario") return <span className="text-success shrink-0 text-xs font-medium">usuário</span>;
  if (acesso === "convidado") return <span className="text-muted shrink-0 text-xs">convite enviado</span>;
  if (!podeConvidar) return <span className="text-muted shrink-0 text-xs">sem acesso</span>;
  if (!email) return <span className="text-muted shrink-0 text-xs">sem e-mail para convidar</span>;
  return (
    <Link
      href={`/usuarios?${new URLSearchParams({ nome, email })}`}
      className="text-primary shrink-0 text-xs font-medium"
    >
      Convidar
    </Link>
  );
}
