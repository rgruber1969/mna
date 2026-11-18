import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/basicos";
import { FormSair } from "./formularios";
import { CascaDoTenant } from "./casca-do-tenant";
import type { AcessoTenant } from "@/server/services/acesso";
import { menuDoUsuario } from "@/server/services/menu";

/** Usuário (com foto), "Minha conta" e sair: comum ao console e ao tenant. */
function Usuario({ usuario }: { usuario: { nome: string; foto?: string | null } }) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/seguranca" className="text-muted flex items-center gap-2" title="Minha conta">
        <Avatar nome={usuario.nome} foto={usuario.foto} />
        <span className="hidden sm:inline">{usuario.nome}</span>
      </Link>
      <Link href="/seguranca" className="text-primary font-medium">
        Minha conta
      </Link>
      <FormSair />
    </div>
  );
}

/** Barra superior do console da plataforma (poucos itens: sem menu lateral). */
export function Cabecalho({
  area,
  usuario,
  console: noConsole = false,
}: {
  area: string;
  usuario: { nome: string; foto?: string | null };
  /** Console da plataforma: mostra o link para a equipe da RGRUBER. */
  console?: boolean;
}) {
  return (
    <header className="border-border bg-background flex items-center justify-between border-b px-6 py-3">
      <Link href="/" className="text-primary font-semibold">
        {area}
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {noConsole && (
          <Link href="/equipe" className="text-primary font-medium">
            Equipe
          </Link>
        )}
        <Usuario usuario={usuario} />
      </div>
    </header>
  );
}

/**
 * Estrutura das telas do tenant: menu lateral com os itens que a pessoa pode
 * ver (grupos, busca, favoritos, recolher) e a barra superior com o usuário.
 */
export async function EstruturaDoTenant({ acesso, children }: { acesso: AcessoTenant; children: ReactNode }) {
  const menu = await menuDoUsuario(acesso);
  return (
    <CascaDoTenant
      grupos={menu.grupos}
      favoritosIniciais={menu.favoritos}
      recolhidoInicial={menu.recolhido}
      marca={{ nome: acesso.tenant.nomeExibido, logo: acesso.tenant.logo }}
      barra={<Usuario usuario={acesso.usuario} />}
    >
      {children}
    </CascaDoTenant>
  );
}
