import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Fragment, Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { buscarDocumentos } from "@/server/services/busca-de-documentos";
import { paginaDeNegocios } from "@/server/services/negocios";
import { traduzirErro } from "@/i18n/servidor";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { Aviso, Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Trecho com o termo destacado (o banco marca com « e »). */
function Trecho({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(«[^»]*»)/).map((p, i) =>
        p.startsWith("«") ? (
          <mark key={i} className="bg-primary-soft text-primary rounded px-0.5 font-semibold">
            {p.slice(1, -1)}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/** Busca de documentos (item 35; ADR-0022): geral ou num negócio, só o que a pessoa vê. */
async function Painel({ pedido }: { pedido: Promise<{ q: string; negocio: string }> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const { q, negocio } = await pedido;
  const t = await getTranslations("busca");
  const [negocios, r] = await Promise.all([
    paginaDeNegocios(acesso, {}, { pagina: 1, porPagina: 100, ordem: "numero", direcao: "asc" })
      .then((p) => p.itens)
      .catch(() => []),
    q.trim() ? buscarDocumentos(acesso, { termo: q, dealId: negocio || null }) : null,
  ]);
  const erro = r && "erro" in r ? await traduzirErro(r) : null;
  const resultados = r && "resultados" in r ? r.resultados : null;
  const campo = "border-border bg-background text-text rounded-md border px-3 py-2 text-sm";
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-4xl">
          <Titulo sobre={t("sobre")}>{t("titulo")}</Titulo>
          <form method="get" className="mb-2 flex flex-wrap items-end gap-3">
            <label className="min-w-64 flex-1">
              <span className="text-text mb-1 block text-sm font-medium">{t("termo")}</span>
              <input name="q" defaultValue={q} placeholder={t("dica")} className={`${campo} w-full`} />
            </label>
            <label>
              <span className="text-text mb-1 block text-sm font-medium">{t("negocio")}</span>
              <select name="negocio" defaultValue={negocio} className={campo}>
                <option value="">{t("todos")}</option>
                {negocios.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nome}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
            >
              {t("buscar")}
            </button>
          </form>
          <p className="text-muted mb-4 text-xs">{t("ajudaSintaxe")}</p>
          {erro && <Aviso>{erro}</Aviso>}
          {resultados &&
            (resultados.length === 0 ? (
              <p className="text-muted text-sm">{t("nenhum")}</p>
            ) : (
              <>
                <p className="text-muted mb-2 text-sm">{t("quantos", { n: resultados.length })}</p>
                <ul className="divide-border divide-y">
                  {resultados.map((x) => (
                    <li key={x.versaoId} className="py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link
                          href={`/negocios/${x.dealId}?aba=documentos`}
                          className="text-text hover:text-primary font-medium"
                        >
                          {x.titulo}{" "}
                          <span className="text-muted text-xs">({t("versao", { n: x.numero })})</span>
                        </Link>
                        <span className="flex gap-1 text-xs">
                          {x.noNome && (
                            <span className="border-border text-muted rounded-full border px-2">
                              {t("noNome")}
                            </span>
                          )}
                          {x.noConteudo && (
                            <span className="border-primary text-primary rounded-full border px-2">
                              {t("noConteudo")}
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="text-muted text-xs">
                        {[x.negocio, x.etapa ?? t("geral"), x.nomeArquivo].join(" · ")}
                      </p>
                      {x.trecho && (
                        <p className="text-text mt-1 text-sm">
                          … <Trecho texto={x.trecho} /> …
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ))}
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/busca">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel
        pedido={searchParams.then((p) => ({
          q: typeof p.q === "string" ? p.q : "",
          negocio: typeof p.negocio === "string" ? p.negocio : "",
        }))}
      />
    </Suspense>
  );
}
