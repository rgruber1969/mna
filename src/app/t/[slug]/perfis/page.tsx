import { EsqueletoDeTela } from "@/components/ui/esqueletos";
import { AbasDeAcesso } from "@/components/acesso/abas-de-acesso";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { definirModoAcao } from "@/app/acoes/perfis";
import { obterAcesso } from "@/server/services/acesso";
import { listarPerfis, type PerfilResumo } from "@/server/services/perfis";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormNovoPerfil } from "@/components/perfis/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Avatar, Cartao, Titulo } from "@/components/ui/basicos";

/** Perfis do tenant e de deal, e o modo de permissões (só administradores). */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const { modo, perfis } = await listarPerfis(acesso);
  const t = await getTranslations("administracao.perfis");

  const lista = (camada: "tenant" | "deal") => (
    <ul className="divide-border divide-y text-sm">
      {perfis
        .filter((p) => p.camada === camada)
        .map((p: PerfilResumo) => (
          <li key={p.id} className="flex items-start justify-between gap-3 py-2">
            <span>
              <Link href={`/perfis/${p.id}`} className="text-primary font-medium">
                {p.nome}
              </Link>
              {p.exigeDoisFatores && (
                <span className="text-success ml-2 text-xs font-medium">{t("exige2fa")}</span>
              )}
              {p.descricao && <span className="text-muted block text-xs">{p.descricao}</span>}
            </span>
            {camada === "tenant" && (
              <span className="flex shrink-0 items-center gap-2">
                {p.pessoas.length > 0 && (
                  <span className="flex -space-x-2" title={p.pessoas.map((x) => x.nome).join(", ")}>
                    {p.pessoas.slice(0, 5).map((x) => (
                      <span key={x.id} className="ring-background rounded-full ring-2">
                        <Avatar nome={x.nome} foto={x.foto} tamanho={24} />
                      </span>
                    ))}
                    {p.pessoas.length > 5 && (
                      <span className="bg-surface text-muted ring-background grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ring-2">
                        +{p.pessoas.length - 5}
                      </span>
                    )}
                  </span>
                )}
                <span className="text-muted text-xs">{t("usuariosEmUso", { n: p.emUso })}</span>
              </span>
            )}
          </li>
        ))}
    </ul>
  );

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-wrap items-start justify-start gap-6 px-3 py-6 sm:px-6">
        <AbasDeAcesso atual="perfis" administrador={true} />
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <Cartao largura="max-w-2xl">
            <Titulo sobre={t("sobre")}>{t("tituloTenant")}</Titulo>
            <p className="text-muted mb-4 text-sm">{t("textoTenant")}</p>
            {lista("tenant")}
          </Cartao>
          <Cartao largura="max-w-2xl">
            <Titulo sobre={t("sobre")}>{t("tituloDeal")}</Titulo>
            <p className="text-muted mb-4 text-sm">{t("textoDeal")}</p>
            {lista("deal")}
          </Cartao>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Cartao largura="max-w-sm">
            <Titulo sobre={t("configuracaoSobre")}>{t("modoTitulo")}</Titulo>
            <p className="text-text mb-2 text-sm">
              {t.rich("modoAtual", {
                modo: modo === "perfil" ? t("modoPorPerfil") : t("modoPorUsuario"),
                forte: (c) => <strong>{c}</strong>,
              })}
            </p>
            <p className="text-muted mb-4 text-sm">
              {modo === "perfil" ? t("modoPorPerfilTexto") : t("modoPorUsuarioTexto")}
            </p>
            <BotaoDeAcao
              acao={definirModoAcao}
              campos={{ modo: modo === "perfil" ? "usuario" : "perfil" }}
              rotulo={modo === "perfil" ? t("mudarParaUsuario") : t("mudarParaPerfil")}
              confirmar={modo === "perfil" ? t("confirmarMudarParaUsuario") : t("confirmarMudarParaPerfil")}
            />
          </Cartao>
          <Cartao largura="max-w-sm">
            <Titulo sobre={t("novoSobre")}>{t("criarTitulo")}</Titulo>
            <FormNovoPerfil perfis={perfis} />
          </Cartao>
        </div>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel />
    </Suspense>
  );
}
