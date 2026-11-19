import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { listarPessoas } from "@/server/services/pessoas";
import { pode } from "@/server/services/permissoes/verificador";
import { AcessoDaPessoa } from "@/components/cadastros/acesso-da-pessoa";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { Avatar, Cartao, Carregando, Etiqueta, Titulo, estiloTabela } from "@/components/ui/basicos";

/** Pessoas do tenant, com ou sem acesso ao sistema (dominio.md, "Pessoa e usuário"). */
async function Painel({ busca }: { busca: Promise<{ busca?: string; inativas?: string }> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "empresas", "ver"))) notFound();
  const t = await getTranslations("cadastros.pessoas");
  const tDoc = await getTranslations("cadastros.porDocumento");
  const filtro = await busca;
  const [pessoas, podeCriar] = await Promise.all([
    listarPessoas(acesso, { busca: filtro.busca, inativas: filtro.inativas === "sim" }),
    pode(acesso, "empresas", "criar"),
  ]);

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <Titulo sobre={t("sobre")}>{t("titulo")}</Titulo>
            {podeCriar && (
              <span className="flex shrink-0 flex-wrap justify-end gap-2">
                <Link
                  href="/cadastro-por-documento?de=pessoas"
                  className="border-primary text-primary shrink-0 rounded-md border px-3 py-2 text-sm font-medium"
                >
                  {tDoc("botao")}
                </Link>
                <Link
                  href="/pessoas/nova"
                  className="bg-primary text-primary-foreground shrink-0 rounded-md px-3 py-2 text-sm font-medium"
                >
                  {t("nova")}
                </Link>
              </span>
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
          {pessoas.length === 0 ? (
            <p className="text-muted text-sm">{t("nenhuma")}</p>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className={estiloTabela.tabela}>
                <thead className={estiloTabela.cabecalho}>
                  <tr>
                    <th className={estiloTabela.th}>{t("colNome")}</th>
                    <th className={estiloTabela.th}>{t("colEmpresas")}</th>
                    <th className={`${estiloTabela.th} text-right`}>{t("colAcesso")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pessoas.map((p) => (
                    <tr key={p.id} className={estiloTabela.linha}>
                      <td className={estiloTabela.td}>
                        <span className="flex items-center gap-3">
                          <Avatar nome={p.nome} foto={p.foto} tamanho={40} />
                          <span className="min-w-0">
                            <Link href={`/pessoas/${p.id}`} className="text-text block font-semibold">
                              {p.nome}
                              {p.inativa && (
                                <span className="text-muted ml-2 text-xs font-normal">{t("inativa")}</span>
                              )}
                            </Link>
                            {p.email && <span className="text-muted block truncate text-xs">{p.email}</span>}
                          </span>
                        </span>
                      </td>
                      <td className={estiloTabela.td}>
                        <span className="flex flex-wrap gap-1">
                          {p.empresas.length === 0 ? (
                            <span className="text-muted text-xs">—</span>
                          ) : (
                            p.empresas.map((e) => <Etiqueta key={e}>{e}</Etiqueta>)
                          )}
                        </span>
                      </td>
                      <td className={`${estiloTabela.td} text-right`}>
                        <AcessoDaPessoa
                          acesso={p.acesso}
                          nome={p.nome}
                          email={p.email}
                          podeConvidar={acesso.administrador}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/pessoas">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel busca={searchParams as Promise<{ busca?: string; inativas?: string }>} />
    </Suspense>
  );
}
