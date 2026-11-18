import Link from "next/link";
import { Avatar, LogoDoTenant } from "@/components/ui/basicos";
import { FormSair } from "./formularios";
import type { AcessoTenant } from "@/server/services/acesso";
import { pode } from "@/server/services/permissoes/verificador";

/** Itens de menu do tenant que a pessoa pode ver (a decisão continua no servidor). */
async function menuDoTenant(a: AcessoTenant): Promise<{ href: string; rotulo: string }[]> {
  const itens = [
    { href: "/empresas", rotulo: "Empresas", recurso: "empresas" as const },
    { href: "/pessoas", rotulo: "Pessoas", recurso: "empresas" as const },
    { href: "/cadastros", rotulo: "Cadastros", recurso: "cadastros" as const },
  ];
  const visiveis = await Promise.all(itens.map((i) => pode(a, i.recurso, "ver")));
  return itens.filter((_, i) => visiveis[i]);
}

/** Barra superior das áreas logadas: área, menu, usuário (com foto) e botão de sair. */
export async function Cabecalho({
  area,
  logo,
  usuario,
  administrador = false,
  console: noConsole = false,
  tenant,
}: {
  area: string;
  /** Logo do tenant (white label): aparece no lugar do nome. */
  logo?: string | null;
  usuario: { nome: string; foto?: string | null };
  /** Administrador do tenant: mostra os links de administração. */
  administrador?: boolean;
  /** Console da plataforma: mostra o link para a equipe da RGRUBER. */
  console?: boolean;
  /** Acesso no tenant: mostra os itens de menu permitidos. */
  tenant?: AcessoTenant;
}) {
  const menu = tenant ? await menuDoTenant(tenant) : [];
  return (
    <header className="border-border bg-background flex items-center justify-between border-b px-6 py-3">
      <Link href="/" className="text-primary font-semibold" title={area}>
        {logo ? <LogoDoTenant src={logo} nome={area} /> : area}
      </Link>
      <nav aria-label="Menu" className="flex items-center gap-4 text-sm">
        {menu.map((m) => (
          <Link key={m.href} href={m.href} className="text-primary font-medium">
            {m.rotulo}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/seguranca" className="text-muted flex items-center gap-2" title="Minha conta">
          <Avatar nome={usuario.nome} foto={usuario.foto} />
          <span>{usuario.nome}</span>
        </Link>
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
            <Link href="/identidade-visual" className="text-primary font-medium">
              Identidade visual
            </Link>
          </>
        )}
        <Link href="/seguranca" className="text-primary font-medium">
          Minha conta
        </Link>
        <FormSair />
      </div>
    </header>
  );
}

/** Cabeçalho padrão das telas do tenant (marca, menu permitido e links de administração). */
export function CabecalhoDoTenant({ acesso }: { acesso: AcessoTenant }) {
  return (
    <Cabecalho
      area={acesso.tenant.nomeExibido}
      logo={acesso.tenant.logo}
      usuario={acesso.usuario}
      tenant={acesso}
      administrador={acesso.administrador}
    />
  );
}
