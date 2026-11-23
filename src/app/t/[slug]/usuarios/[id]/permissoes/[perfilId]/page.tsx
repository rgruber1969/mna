import { EsqueletoDeTela } from "@/components/ui/esqueletos";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { obterAcesso } from "@/server/services/acesso";
import { obterMatrizIndividual } from "@/server/services/perfis";
import { recursosDaCamada } from "@/server/services/permissoes/catalogo";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormCopiarMatriz, FormMatrizIndividual } from "@/components/perfis/formularios";
import { Cartao, Titulo } from "@/components/ui/basicos";

/** Permissões próprias de um usuário num perfil (modo por usuário). */
async function Detalhe({ ids }: { ids: Promise<{ id: string; perfilId: string }> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const { id, perfilId } = await ids;
  const m = await obterMatrizIndividual(acesso, id, perfilId);
  const t = await getTranslations("administracao.usuarios.permissoesIndividuais");
  if (!m) notFound();

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-wrap items-start justify-start gap-6 px-3 py-6 sm:px-6">
        <Cartao largura="max-w-2xl">
          <Link href={`/usuarios/${m.usuario.id}`} className="text-primary text-sm">
            ← {m.usuario.nome}
          </Link>
          <Titulo sobre={t("perfilSobre", { nome: m.perfil.nome })}>
            {t("titulo", { nome: m.usuario.nome })}
          </Titulo>
          <p className="text-muted mb-4 text-sm">
            {m.personalizada ? t("personalizadas") : t("seguemOPerfil")}
            {acesso.tenant.modoPermissoes === "perfil" && ` ${t("modoPorPerfil")}`}
          </p>
          <FormMatrizIndividual
            usuarioId={m.usuario.id}
            perfilId={m.perfil.id}
            recursos={recursosDaCamada(m.perfil.camada)}
            matriz={m.matriz}
          />
        </Cartao>
        <Cartao largura="max-w-sm">
          <Titulo sobre={t("atalhoSobre")}>{t("atalhoTitulo")}</Titulo>
          <p className="text-muted mb-4 text-sm">{t("atalhoTexto")}</p>
          <FormCopiarMatriz usuarioId={m.usuario.id} perfilId={m.perfil.id} outros={m.outros} />
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ params }: PageProps<"/t/[slug]/usuarios/[id]/permissoes/[perfilId]">) {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Detalhe ids={params} />
    </Suspense>
  );
}
