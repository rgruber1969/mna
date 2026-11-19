import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { excluirPerfilAcao, exigirDoPerfilAcao } from "@/app/acoes/perfis";
import { obterAcesso } from "@/server/services/acesso";
import { obterPerfil } from "@/server/services/perfis";
import { recursosDaCamada } from "@/server/services/permissoes/catalogo";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormMatrizDoPerfil, FormEditarPerfil } from "@/components/perfis/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Um perfil: matriz de permissões, nome, quem o usa e exclusão. */
async function Detalhe({ id }: { id: Promise<string> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const p = await obterPerfil(acesso, await id);
  if (!p) notFound();
  const t = await getTranslations("administracao.perfis.detalhe");

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-wrap items-start justify-start gap-6 px-3 py-6 sm:px-6">
        <Cartao largura="max-w-2xl">
          <Link href="/perfis" className="text-primary text-sm">
            {t("voltar")}
          </Link>
          <Titulo sobre={p.camada === "tenant" ? t("sobreTenant") : t("sobreDeal")}>{p.nome}</Titulo>
          <p className="text-muted mb-4 text-sm">
            {t("marque")}
            {acesso.tenant.modoPermissoes === "usuario" && ` ${t("notaModoUsuario")}`}
          </p>
          <FormMatrizDoPerfil id={p.id} recursos={recursosDaCamada(p.camada)} matriz={p.matriz} />
        </Cartao>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Cartao largura="max-w-sm">
            <Titulo sobre={t("editarSobre")}>{t("nomeEDescricao")}</Titulo>
            <FormEditarPerfil id={p.id} nome={p.nome} descricao={p.descricao} />
          </Cartao>
          {p.camada === "tenant" && (
            <Cartao largura="max-w-sm">
              <Titulo sobre={t("segurancaSobre")}>{t("doisFatores")}</Titulo>
              <p className="text-muted mb-4 text-sm">{p.exigeDoisFatores ? t("exigida") : t("naoExigida")}</p>
              <BotaoDeAcao
                acao={exigirDoPerfilAcao}
                campos={{ id: p.id, valor: p.exigeDoisFatores ? "nao" : "sim" }}
                rotulo={p.exigeDoisFatores ? t("deixarDeExigir") : t("exigir")}
              />
            </Cartao>
          )}
          {p.camada === "tenant" && (
            <Cartao largura="max-w-sm">
              <Titulo sobre={t("emUsoSobre")}>{t("usuariosComPerfil")}</Titulo>
              {p.usuarios.length === 0 ? (
                <p className="text-muted text-sm">{t("nenhum")}</p>
              ) : (
                <ul className="text-sm">
                  {p.usuarios.map((u) => (
                    <li key={u.id}>
                      <Link href={`/usuarios/${u.id}`} className="text-primary">
                        {u.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          )}
          <Cartao largura="max-w-sm">
            <Titulo sobre={t("excluirSobre")}>{t("excluirTitulo")}</Titulo>
            <p className="text-muted mb-4 text-sm">{t("excluirTexto")}</p>
            <BotaoDeAcao
              acao={excluirPerfilAcao}
              campos={{ id: p.id }}
              rotulo={t("excluirTitulo")}
              confirmar={t("confirmarExcluir")}
              perigo
            />
          </Cartao>
        </div>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ params }: PageProps<"/t/[slug]/perfis/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Detalhe id={params.then((p) => p.id)} />
    </Suspense>
  );
}
