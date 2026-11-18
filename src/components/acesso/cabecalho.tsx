import Link from "next/link";
import { FormSair } from "./formularios";

/** Barra superior das áreas logadas: área, usuário e botão de sair. */
export function Cabecalho({
  area,
  usuario,
  administrador = false,
  console: noConsole = false,
}: {
  area: string;
  usuario: string;
  /** Administrador do tenant: mostra o link para a administração de usuários. */
  administrador?: boolean;
  /** Console da plataforma: mostra o link para a equipe da RGRUBER. */
  console?: boolean;
}) {
  return (
    <header className="border-border bg-background flex items-center justify-between border-b px-6 py-3">
      <Link href="/" className="text-primary font-semibold">
        {area}
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted">{usuario}</span>
        {noConsole && (
          <Link href="/equipe" className="text-primary font-medium">
            Equipe
          </Link>
        )}
        {administrador && (
          <>
            <Link href="/usuarios" className="text-primary font-medium">
              Usuários
            </Link>
            <Link href="/perfis" className="text-primary font-medium">
              Perfis
            </Link>
          </>
        )}
        <Link href="/seguranca" className="text-primary font-medium">
          Segurança
        </Link>
        <FormSair />
      </div>
    </header>
  );
}
