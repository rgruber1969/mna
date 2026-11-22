import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { minhasTarefasAbertas } from "@/server/services/painel";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";
import { ListaPaginada } from "@/components/ui/paginacao-local";

/** Minhas tarefas abertas em todos os negócios (atalho da tela inicial). */
async function Painel({ filtro }: { filtro: Promise<string> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const f = await filtro;
  const [todas, t, tt] = await Promise.all([
    minhasTarefasAbertas(acesso),
    getTranslations("painel"),
    getTranslations("tarefas"),
  ]);
  const lista = f === "atrasadas" ? todas.filter((x) => x.atrasada) : todas;
  const br = (d: string) => d.split("-").reverse().join("/");
  const aba = (id: string, rotulo: string) => (
    <Link
      href={id ? `/tarefas?filtro=${id}` : "/tarefas"}
      aria-current={f === id ? "page" : undefined}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${f === id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted"}`}
    >
      {rotulo}
    </Link>
  );
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-4xl">
          <Titulo ajuda={t("minhasTarefasAjuda")}>{t("minhasTarefas")}</Titulo>
          <div className="mb-3 flex gap-2">
            {aba("", t("todas", { n: todas.length }))}
            {aba("atrasadas", t("soAtrasadas", { n: todas.filter((x) => x.atrasada).length }))}
          </div>
          {lista.length === 0 ? (
            <p className="text-muted text-sm">{t("semTarefas")}</p>
          ) : (
            <ListaPaginada
              className="divide-border divide-y"
              itens={lista.map((x, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span>
                    <Link href={x.link} className="text-text hover:text-primary font-medium">
                      {x.titulo}
                    </Link>
                    <span className="text-muted block text-xs">
                      {x.negocio} · {tt(`situacoes.${x.situacao}` as never)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${x.atrasada ? "text-danger font-medium" : "text-muted"}`}
                  >
                    {x.prazo ? br(x.prazo) : "—"}
                  </span>
                </li>
              ))}
            />
          )}
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/tarefas">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel filtro={searchParams.then((p) => (typeof p.filtro === "string" ? p.filtro : ""))} />
    </Suspense>
  );
}
