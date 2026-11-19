import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { excluirGrupoAcao } from "@/app/acoes/cadastros";
import { obterAcesso } from "@/server/services/acesso";
import { listarEmpresas, listarGrupos } from "@/server/services/empresas";
import { pode } from "@/server/services/permissoes/verificador";
import { formatarCnpj } from "@/config/documentos";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormNovoGrupo } from "@/components/cadastros/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Empresas e grupos econômicos do tenant (dominio.md, "Empresa"). */
async function Painel({ busca }: { busca: Promise<{ busca?: string; inativas?: string }> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "empresas", "ver"))) notFound();
  const t = await getTranslations("cadastros.empresas");
  const tc = await getTranslations("comum");
  const filtro = await busca;
  const [empresas, grupos, podeCriar, podeExcluir] = await Promise.all([
    listarEmpresas(acesso, { busca: filtro.busca, inativas: filtro.inativas === "sim" }),
    listarGrupos(acesso),
    pode(acesso, "empresas", "criar"),
    pode(acesso, "empresas", "excluir"),
  ]);

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-wrap items-start justify-start gap-6 px-3 py-6 sm:px-6">
        <Cartao largura="max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <Titulo sobre={t("sobre")}>{t("titulo")}</Titulo>
            {podeCriar && (
              <Link
                href="/empresas/nova"
                className="bg-primary text-primary-foreground shrink-0 rounded-md px-3 py-2 text-sm font-medium"
              >
                {t("nova")}
              </Link>
            )}
          </div>
          <form className="mb-4 flex flex-wrap items-center gap-3">
            <input
              name="busca"
              defaultValue={filtro.busca}
              aria-label={t("buscarAria")}
              placeholder={t("buscarPlaceholder")}
              className="border-border bg-background text-text w-full max-w-xs rounded-md border px-3 py-2 text-sm"
            />
            <label className="text-muted flex items-center gap-1 text-sm">
              <input type="checkbox" name="inativas" value="sim" defaultChecked={filtro.inativas === "sim"} />{" "}
              {t("mostrarInativas")}
            </label>
            <button className="text-primary text-sm font-medium">{t("buscar")}</button>
          </form>
          {empresas.length === 0 ? (
            <p className="text-muted text-sm">{t("nenhuma")}</p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {empresas.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                  <span>
                    <Link href={`/empresas/${e.id}`} className="text-primary font-medium">
                      {e.razaoSocial}
                    </Link>
                    {e.doContratante && (
                      <span className="text-accent ml-2 text-xs font-medium">{t("contratante")}</span>
                    )}
                    {e.inativa && <span className="text-muted ml-2 text-xs">{t("inativa")}</span>}
                    <span className="text-muted block text-xs">
                      {[
                        e.nomeFantasia,
                        e.cnpj ? formatarCnpj(e.cnpj) : e.pais !== "Brasil" ? e.pais : null,
                        e.grupo && t("grupo", { nome: e.grupo }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="text-muted shrink-0 text-xs">{t("pessoas", { n: e.pessoas })}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao largura="max-w-sm">
          <Titulo sobre={t("sobre")}>{t("gruposTitulo")}</Titulo>
          {grupos.length === 0 ? (
            <p className="text-muted text-sm">{t("nenhumGrupo")}</p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {grupos.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {g.nome}
                    <span className="text-muted block text-xs">
                      {t("empresasDoGrupo", { n: g.empresas })}
                    </span>
                  </span>
                  {podeExcluir && (
                    <BotaoDeAcao
                      acao={excluirGrupoAcao}
                      campos={{ id: g.id }}
                      rotulo={tc("excluir")}
                      confirmar={t("confirmarExcluirGrupo", { nome: g.nome })}
                      perigo
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          {podeCriar && <FormNovoGrupo />}
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/empresas">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel busca={searchParams as Promise<{ busca?: string; inativas?: string }>} />
    </Suspense>
  );
}
