import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { excluirPessoaAcao, inativarPessoaAcao, removerVinculoAcao } from "@/app/acoes/cadastros";
import { obterAcesso } from "@/server/services/acesso";
import { listarTiposDeVinculo } from "@/server/services/cadastros";
import { listarEmpresas } from "@/server/services/empresas";
import { obterPessoa } from "@/server/services/pessoas";
import { pode } from "@/server/services/permissoes/verificador";
import { formatarCep } from "@/config/documentos";
import { CabecalhoDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormNovoVinculo, FormPessoa, MostrarDadosSensiveis } from "@/components/cadastros/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

async function Painel({ id, consulta }: { id: Promise<string>; consulta: Promise<{ parecidas?: string }> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "empresas", "ver"))) notFound();
  const p = await obterPessoa(acesso, await id);
  if (!p) notFound();
  const [podeEditar, podeExcluir, { parecidas }] = await Promise.all([
    pode(acesso, "empresas", "editar"),
    pode(acesso, "empresas", "excluir"),
    consulta,
  ]);
  const [tipos, empresas] = podeEditar
    ? await Promise.all([listarTiposDeVinculo(acesso), listarEmpresas(acesso)])
    : [[], []];
  const inicial = Object.fromEntries(
    Object.entries(p).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  ) as Record<string, string>;
  inicial.cep = p.cep ? formatarCep(p.cep) : "";
  const temSensiveis = Object.values(p.mascarados).some(Boolean);
  const convite = new URLSearchParams({ nome: p.nome, email: p.email ?? "" });

  return (
    <>
      <CabecalhoDoTenant acesso={acesso} />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <Cartao largura="max-w-2xl">
          <Link href="/pessoas" className="text-primary text-sm">
            ← Pessoas
          </Link>
          <Titulo sobre="Pessoa">{p.nome}</Titulo>
          {parecidas && (
            <p className="text-warning bg-warning-surface mb-4 rounded-md px-3 py-2 text-sm">
              Atenção: já existe pessoa com o mesmo nome. Sem CPF, confira se não é a mesma pessoa.
            </p>
          )}
          {p.inativaEm && (
            <p className="text-warning bg-warning-surface mb-4 rounded-md px-3 py-2 text-sm">
              Pessoa inativa: não aparece nas listas de escolha.
            </p>
          )}
          <FormPessoa
            id={p.id}
            inicial={inicial}
            mascarados={p.mascarados}
            podeSalvar={podeEditar}
            emailDeLogin={Boolean(p.usuarioId)}
          />
          {(podeEditar || podeExcluir) && (
            <div className="border-border mt-6 flex flex-wrap gap-3 border-t pt-4">
              {podeEditar && (
                <BotaoDeAcao
                  acao={inativarPessoaAcao}
                  campos={{ id: p.id, inativa: p.inativaEm ? "nao" : "sim" }}
                  rotulo={p.inativaEm ? "Reativar pessoa" : "Inativar pessoa"}
                />
              )}
              {podeExcluir && !p.usuarioId && (
                <BotaoDeAcao
                  acao={excluirPessoaAcao}
                  campos={{ id: p.id }}
                  rotulo="Excluir pessoa"
                  confirmar={`Excluir definitivamente ${p.nome}? Os dados não poderão ser recuperados.`}
                  perigo
                />
              )}
            </div>
          )}
        </Cartao>
        <div className="flex w-full max-w-md flex-col gap-6">
          {podeEditar && temSensiveis && (
            <Cartao largura="max-w-md">
              <Titulo sobre="Dados sensíveis">CPF, RG e cônjuge</Titulo>
              <p className="text-muted mb-3 text-sm">
                Aparecem mascarados. Mostrar fica registrado na auditoria.
              </p>
              <MostrarDadosSensiveis pessoaId={p.id} />
            </Cartao>
          )}
          <Cartao largura="max-w-md">
            <Titulo sobre="Pessoa">Empresas vinculadas</Titulo>
            {p.vinculos.length === 0 ? (
              <p className="text-muted text-sm">Nenhuma empresa vinculada.</p>
            ) : (
              <ul className="divide-border divide-y text-sm">
                {p.vinculos.map((v) => (
                  <li key={v.id} className="flex items-start justify-between gap-2 py-2">
                    <span>
                      <Link href={`/empresas/${v.empresaId}`} className="text-primary font-medium">
                        {v.empresa}
                      </Link>
                      <span className="text-muted block text-xs">
                        {[v.tipo, v.cargo, v.percentual && `${Number(v.percentual)}%`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {podeEditar && (
                      <BotaoDeAcao acao={removerVinculoAcao} campos={{ id: v.id }} rotulo="Remover" perigo />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {podeEditar && (
              <FormNovoVinculo
                pessoaId={p.id}
                empresas={empresas.filter((e) => !e.inativa).map((e) => ({ id: e.id, nome: e.razaoSocial }))}
                tipos={tipos}
              />
            )}
          </Cartao>
          <Cartao largura="max-w-md">
            <Titulo sobre="Pessoa">Acesso ao sistema</Titulo>
            {p.usuarioId ? (
              <p className="text-sm">
                Tem acesso.{" "}
                {acesso.administrador && (
                  <Link href={`/usuarios/${p.usuarioId}`} className="text-primary font-medium">
                    Ver usuário
                  </Link>
                )}
              </p>
            ) : acesso.administrador ? (
              p.email ? (
                <Link href={`/usuarios?${convite}`} className="text-primary text-sm font-medium">
                  Convidar para o sistema
                </Link>
              ) : (
                <p className="text-muted text-sm">Informe o e-mail para poder convidar.</p>
              )
            ) : (
              <p className="text-muted text-sm">Sem acesso. Só administradores convidam.</p>
            )}
          </Cartao>
        </div>
      </main>
    </>
  );
}

export default function Page({ params, searchParams }: PageProps<"/t/[slug]/pessoas/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel id={params.then((p) => p.id)} consulta={searchParams as Promise<{ parecidas?: string }>} />
    </Suspense>
  );
}
