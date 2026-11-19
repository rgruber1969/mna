import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { obterAcesso } from "@/server/services/acesso";
import { obterIdentidade } from "@/server/services/identidade-visual";
import { enderecoDaImagem } from "@/config/marca";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormIdentidade, FormImagemDaMarca } from "@/components/identidade/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Identidade visual do tenant (white label, ADR-0010): só administradores. */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const id = await obterIdentidade(acesso);
  const t = await getTranslations("administracao.identidade");
  const url = (chave: string | null) => enderecoDaImagem(acesso.tenant.id, chave);

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-wrap items-start justify-start gap-6 px-3 py-6 sm:px-6">
        <Cartao largura="max-w-lg">
          <Titulo sobre={t("sobre")}>{t("titulo")}</Titulo>
          <p className="text-muted mb-4 text-sm">{t("texto")}</p>
          <FormIdentidade inicial={id} />
        </Cartao>
        <Cartao largura="max-w-lg">
          <Titulo sobre={t("sobre")}>{t("logosTitulo")}</Titulo>
          <p className="text-muted mb-4 text-sm">{t("logosTexto")}</p>
          <FormImagemDaMarca
            tipo="logoClaro"
            titulo={t("logoClaro.titulo")}
            explicacao={t("logoClaro.explicacao")}
            atual={url(id.logoClaro)}
            nome={acesso.tenant.nomeExibido}
          />
          <FormImagemDaMarca
            tipo="logoEscuro"
            titulo={t("logoEscuro.titulo")}
            explicacao={t("logoEscuro.explicacao")}
            atual={url(id.logoEscuro)}
            nome={acesso.tenant.nomeExibido}
            fundoEscuro
          />
          <FormImagemDaMarca
            tipo="icone"
            titulo={t("icone.titulo")}
            explicacao={t("icone.explicacao")}
            atual={url(id.icone)}
            nome={acesso.tenant.nomeExibido}
          />
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
