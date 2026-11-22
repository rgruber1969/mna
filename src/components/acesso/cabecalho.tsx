import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AssinaturaRgruber, Avatar } from "@/components/ui/basicos";
import { produto } from "@/config/produto";
import { FormSair } from "./formularios";
import { CascaDoTenant } from "./casca-do-tenant";
import type { AcessoTenant } from "@/server/services/acesso";
import { marcaPorSlug } from "@/server/services/marca";
import { menuDoUsuario } from "@/server/services/menu";
import { minhasNotificacoes } from "@/server/services/notificacoes";

/** Usuário (com foto), "Minha conta" e sair, na barra do console. */
async function Usuario({ usuario }: { usuario: { nome: string; foto?: string | null } }) {
  const t = await getTranslations("cabecalho");
  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/seguranca" className="text-muted flex items-center gap-2" title={t("minhaConta")}>
        <Avatar nome={usuario.nome} foto={usuario.foto} />
        <span className="hidden sm:inline">{usuario.nome}</span>
      </Link>
      <Link href="/seguranca" className="text-primary font-medium">
        {t("minhaConta")}
      </Link>
      <FormSair />
    </div>
  );
}

/** Barra superior do console da plataforma (poucos itens: sem menu lateral). */
export async function Cabecalho({
  area,
  usuario,
  console: noConsole = false,
}: {
  area: string;
  usuario: { nome: string; foto?: string | null };
  /** Console da plataforma: mostra o link para a equipe da RGRUBER. */
  console?: boolean;
}) {
  const t = await getTranslations("cabecalho");
  return (
    <header className="border-border bg-background flex items-center justify-between border-b px-6 py-3">
      <Link href="/" className="text-primary font-semibold">
        {area}
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {noConsole && (
          <Link href="/equipe" className="text-primary font-medium">
            {t("equipe")}
          </Link>
        )}
        <Usuario usuario={usuario} />
      </div>
    </header>
  );
}

/**
 * Estrutura das telas do tenant: menu lateral com os itens que a pessoa pode
 * ver (grupos, favoritos, recolher), cabeçalho (busca, notificações, usuário
 * com tema) e rodapé.
 */
export async function EstruturaDoTenant({ acesso, children }: { acesso: AcessoTenant; children: ReactNode }) {
  const [menu, notificacoes, marca, t] = await Promise.all([
    menuDoUsuario(acesso),
    minhasNotificacoes(acesso),
    marcaPorSlug(acesso.tenant.slug),
    getTranslations("rodape"),
  ]);
  return (
    <CascaDoTenant
      grupos={menu.grupos}
      favoritosIniciais={menu.favoritos}
      recolhidoInicial={menu.recolhido}
      marca={{
        nome: acesso.tenant.nomeExibido,
        logoClaro: marca?.logoClaro ?? null,
        logoEscuro: marca?.logoEscuro ?? null,
        icone: marca?.icone ?? null,
      }}
      usuario={{
        nome: acesso.usuario.nome,
        foto: acesso.usuario.foto,
        papel: acesso.administrador ? "administrador" : "usuario",
      }}
      tema={acesso.usuario.tema ?? "claro"}
      menuInvertido={acesso.usuario.menuInvertido ?? false}
      notificacoes={notificacoes}
      rodape={
        <>
          <span>{t("direitos", { ano: new Date().getFullYear(), produto: produto.nome })}</span>
          <AssinaturaRgruber className="" escuro="auto" />
        </>
      }
    >
      {children}
    </CascaDoTenant>
  );
}
