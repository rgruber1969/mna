import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
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
  const filtro = await busca;
  const [empresas, grupos, podeCriar, podeExcluir] = await Promise.all([
    listarEmpresas(acesso, { busca: filtro.busca, inativas: filtro.inativas === "sim" }),
    listarGrupos(acesso),
    pode(acesso, "empresas", "criar"),
    pode(acesso, "empresas", "excluir"),
  ]);

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <Cartao largura="max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <Titulo sobre="Cadastro">Empresas</Titulo>
            {podeCriar && (
              <Link
                href="/empresas/nova"
                className="bg-primary text-primary-foreground shrink-0 rounded-md px-3 py-2 text-sm font-medium"
              >
                Nova empresa
              </Link>
            )}
          </div>
          <form className="mb-4 flex flex-wrap items-center gap-3">
            <input
              name="busca"
              defaultValue={filtro.busca}
              aria-label="Buscar empresa"
              placeholder="Buscar por nome ou CNPJ"
              className="border-border bg-background text-text w-full max-w-xs rounded-md border px-3 py-2 text-sm"
            />
            <label className="text-muted flex items-center gap-1 text-sm">
              <input type="checkbox" name="inativas" value="sim" defaultChecked={filtro.inativas === "sim"} />{" "}
              Mostrar inativas
            </label>
            <button className="text-primary text-sm font-medium">Buscar</button>
          </form>
          {empresas.length === 0 ? (
            <p className="text-muted text-sm">Nenhuma empresa encontrada.</p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {empresas.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                  <span>
                    <Link href={`/empresas/${e.id}`} className="text-primary font-medium">
                      {e.razaoSocial}
                    </Link>
                    {e.doContratante && (
                      <span className="text-accent ml-2 text-xs font-medium">contratante</span>
                    )}
                    {e.inativa && <span className="text-muted ml-2 text-xs">inativa</span>}
                    <span className="text-muted block text-xs">
                      {[
                        e.nomeFantasia,
                        e.cnpj ? formatarCnpj(e.cnpj) : e.pais !== "Brasil" ? e.pais : null,
                        e.grupo && `Grupo ${e.grupo}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="text-muted shrink-0 text-xs">
                    {e.pessoas === 0 ? "sem pessoas" : `${e.pessoas} pessoa${e.pessoas > 1 ? "s" : ""}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao largura="max-w-sm">
          <Titulo sobre="Cadastro">Grupos econômicos</Titulo>
          {grupos.length === 0 ? (
            <p className="text-muted text-sm">Nenhum grupo cadastrado.</p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {grupos.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {g.nome}
                    <span className="text-muted block text-xs">
                      {g.empresas === 0
                        ? "sem empresas"
                        : `${g.empresas} empresa${g.empresas > 1 ? "s" : ""}`}
                    </span>
                  </span>
                  {podeExcluir && (
                    <BotaoDeAcao
                      acao={excluirGrupoAcao}
                      campos={{ id: g.id }}
                      rotulo="Excluir"
                      confirmar={`Excluir o grupo ${g.nome}? As empresas ficam sem grupo.`}
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
