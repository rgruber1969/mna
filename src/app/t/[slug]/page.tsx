import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Tela inicial provisória do tenant; a tela principal (KPIs, deals) vem depois. */
async function Inicio() {
  await connection();
  const t = await getTranslations("acesso.inicio");
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-xl">
          <Titulo sobre={acesso.administrador ? t("administrador") : t("usuario")}>
            {t("ola", { nome: acesso.usuario.nome })}
          </Titulo>
          <p className="text-muted text-sm">{t("texto")}</p>
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <Inicio />
    </Suspense>
  );
}
