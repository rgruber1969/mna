import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { marcarTodasComoLidas, minhasNotificacoes } from "@/server/services/notificacoes";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Todas as notificações da pessoa no tenant; abrir a página marca todas como lidas. */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const [{ itens }, t, formato] = await Promise.all([
    minhasNotificacoes(acesso, 200),
    getTranslations("notificacoes"),
    getFormatter(),
  ]);
  await marcarTodasComoLidas(acesso);
  const agora = new Date();
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-2xl">
          <Titulo sobre={t("titulo")}>{t("pagina")}</Titulo>
          {itens.length === 0 ? (
            <p className="text-muted text-sm">{t("nenhuma")}</p>
          ) : (
            <ul className="divide-border divide-y">
              {itens.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start justify-between gap-4 py-3 ${n.lida ? "" : "font-medium"}`}
                >
                  {n.link ? (
                    <Link href={n.link} className="text-text text-sm">
                      {t(`tipos.${n.tipo}`, n.parametros)}
                    </Link>
                  ) : (
                    <span className="text-text text-sm">{t(`tipos.${n.tipo}`, n.parametros)}</span>
                  )}
                  <span className="text-muted shrink-0 text-xs">
                    {formato.relativeTime(n.criadoEm, agora)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel />
    </Suspense>
  );
}
