import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { obterAcesso } from "@/server/services/acesso";
import { listarPessoas } from "@/server/services/pessoas";
import { pode } from "@/server/services/permissoes/verificador";
import { CabecalhoDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Pessoas do tenant, com ou sem acesso ao sistema (dominio.md, "Pessoa e usuário"). */
async function Painel({ busca }: { busca: Promise<{ busca?: string; inativas?: string }> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "empresas", "ver"))) notFound();
  const filtro = await busca;
  const [pessoas, podeCriar] = await Promise.all([
    listarPessoas(acesso, { busca: filtro.busca, inativas: filtro.inativas === "sim" }),
    pode(acesso, "empresas", "criar"),
  ]);

  return (
    <>
      <CabecalhoDoTenant acesso={acesso} />
      <main className="bg-surface flex flex-1 justify-center px-4 py-10">
        <Cartao largura="max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <Titulo sobre="Cadastro">Pessoas</Titulo>
            {podeCriar && (
              <Link
                href="/pessoas/nova"
                className="bg-primary text-primary-foreground shrink-0 rounded-md px-3 py-2 text-sm font-medium"
              >
                Nova pessoa
              </Link>
            )}
          </div>
          <form className="mb-4 flex flex-wrap items-center gap-3">
            <input
              name="busca"
              defaultValue={filtro.busca}
              aria-label="Buscar pessoa"
              placeholder="Buscar por nome ou e-mail"
              className="border-border bg-background text-text w-full max-w-xs rounded-md border px-3 py-2 text-sm"
            />
            <label className="text-muted flex items-center gap-1 text-sm">
              <input type="checkbox" name="inativas" value="sim" defaultChecked={filtro.inativas === "sim"} />{" "}
              Mostrar inativas
            </label>
            <button className="text-primary text-sm font-medium">Buscar</button>
          </form>
          {pessoas.length === 0 ? (
            <p className="text-muted text-sm">Nenhuma pessoa encontrada.</p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {pessoas.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2">
                  <span>
                    <Link href={`/pessoas/${p.id}`} className="text-primary font-medium">
                      {p.nome}
                    </Link>
                    {p.inativa && <span className="text-muted ml-2 text-xs">inativa</span>}
                    <span className="text-muted block text-xs">
                      {[p.email, p.empresas.join(", ")].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {p.temConta && (
                    <span className="text-success shrink-0 text-xs font-medium">tem acesso</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </main>
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/pessoas">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel busca={searchParams as Promise<{ busca?: string; inativas?: string }>} />
    </Suspense>
  );
}
