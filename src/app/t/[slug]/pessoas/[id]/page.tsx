import { EsqueletoDeTela } from "@/components/ui/esqueletos";
import { connection } from "next/server";
import { BANCOS, listarContasBancarias } from "@/server/services/contas-bancarias";
import { ContasBancarias } from "@/components/cadastros/contas-bancarias";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { excluirPessoaAcao, inativarPessoaAcao, removerVinculoAcao } from "@/app/acoes/cadastros";
import { obterAcesso } from "@/server/services/acesso";
import { listarTiposDeVinculo } from "@/server/services/cadastros";
import { listarEmpresas } from "@/server/services/empresas";
import { obterPessoa } from "@/server/services/pessoas";
import { CATEGORIAS_DE_PESSOA, listarAnexos } from "@/server/services/anexos";
import { AnexosDoCadastro } from "@/components/cadastros/anexos";
import { pode } from "@/server/services/permissoes/verificador";
import { formatarCep } from "@/config/documentos";
import { AcessoDaPessoa } from "@/components/cadastros/acesso-da-pessoa";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormNovoVinculo, FormPessoa, MostrarDadosSensiveis } from "@/components/cadastros/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Cartao, Titulo } from "@/components/ui/basicos";
import { Abas, PainelDeAba } from "@/components/ui/abas";

async function Painel({
  id,
  consulta,
}: {
  id: Promise<string>;
  consulta: Promise<{ parecidas?: string; aba?: string }>;
}) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "empresas", "ver"))) notFound();
  const t = await getTranslations("cadastros.pessoas");
  const p = await obterPessoa(acesso, await id);
  if (!p) notFound();
  const [podeEditar, podeExcluir, { parecidas }, podeBaixar, anexos] = await Promise.all([
    pode(acesso, "empresas", "editar"),
    pode(acesso, "empresas", "excluir"),
    consulta,
    pode(acesso, "empresas", "baixar"),
    listarAnexos(acesso, { tipo: "pessoa", id: p.id }),
  ]);
  const contas = await listarContasBancarias(acesso, { tipo: "pessoa", id: p.id });
  const [tipos, empresas] = podeEditar
    ? await Promise.all([listarTiposDeVinculo(acesso), listarEmpresas(acesso)])
    : [[], []];
  const inicial = Object.fromEntries(
    Object.entries(p).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  ) as Record<string, string>;
  inicial.cep = p.cep ? formatarCep(p.cep) : "";
  const temSensiveis = Object.values(p.mascarados).some(Boolean);
  const tAbas = await getTranslations("cadastros.abas");
  const abaInicial = (await consulta).aba;

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-4xl">
          <Link href="/pessoas" className="text-primary text-sm">
            {t("voltar")}
          </Link>
          <Titulo sobre={t("sobrePessoa")}>{p.nome}</Titulo>
          {parecidas && (
            <p className="text-warning bg-warning-surface mb-4 rounded-md px-3 py-2 text-sm">
              {t("avisoMesmoNome")}
            </p>
          )}
          {p.inativaEm && (
            <p className="text-warning bg-warning-surface mb-4 rounded-md px-3 py-2 text-sm">
              {t("avisoInativa")}
            </p>
          )}
          <Abas
            inicial={abaInicial}
            abas={[
              { id: "dados", rotulo: tAbas("dados") },
              { id: "documentos", rotulo: tAbas("documentos") },
              { id: "endereco", rotulo: tAbas("endereco") },
              { id: "conjuge", rotulo: tAbas("conjuge") },
              { id: "empresas", rotulo: `${tAbas("empresas")} (${p.vinculos.length})` },
              { id: "bancarios", rotulo: `${tAbas("bancarios")} (${contas.length})` },
              { id: "anexos", rotulo: `${tAbas("anexos")} (${anexos.length})` },
              { id: "acesso", rotulo: tAbas("acesso") },
            ]}
          >
            <FormPessoa
              id={p.id}
              inicial={inicial}
              mascarados={p.mascarados}
              podeSalvar={podeEditar}
              emailDeLogin={Boolean(p.usuarioId)}
            />
            <PainelDeAba id="dados">
              {(podeEditar || podeExcluir) && (
                <div className="border-border mt-6 flex flex-wrap gap-3 border-t pt-4">
                  {podeEditar && (
                    <BotaoDeAcao
                      acao={inativarPessoaAcao}
                      campos={{ id: p.id, inativa: p.inativaEm ? "nao" : "sim" }}
                      rotulo={p.inativaEm ? t("reativar") : t("inativar")}
                    />
                  )}
                  {podeExcluir && !p.usuarioId && (
                    <BotaoDeAcao
                      acao={excluirPessoaAcao}
                      campos={{ id: p.id }}
                      rotulo={t("excluirPessoa")}
                      confirmar={t("confirmarExcluir", { nome: p.nome })}
                      perigo
                    />
                  )}
                </div>
              )}
            </PainelDeAba>
            {podeEditar && temSensiveis && (
              <PainelDeAba id="documentos">
                <div className="border-border mt-6 border-t pt-4">
                  <p className="text-text text-sm font-medium">{t("tituloSensiveis")}</p>
                  <p className="text-muted mb-3 text-sm">{t("sensiveisExplicacao")}</p>
                  <MostrarDadosSensiveis pessoaId={p.id} />
                </div>
              </PainelDeAba>
            )}
            <PainelDeAba id="empresas">
              {p.vinculos.length === 0 ? (
                <p className="text-muted text-sm">{t("nenhumaEmpresaVinculada")}</p>
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
                        <BotaoDeAcao
                          acao={removerVinculoAcao}
                          campos={{ id: v.id }}
                          rotulo={t("remover")}
                          perigo
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {podeEditar && (
                <div className="max-w-md">
                  <FormNovoVinculo
                    pessoaId={p.id}
                    empresas={empresas
                      .filter((e) => !e.inativa)
                      .map((e) => ({ id: e.id, nome: e.razaoSocial }))}
                    tipos={tipos}
                  />
                </div>
              )}
            </PainelDeAba>
            <PainelDeAba id="bancarios">
              <ContasBancarias
                alvo={{ tipo: "pessoa", id: p.id }}
                contas={contas}
                bancos={BANCOS}
                podeEditar={podeEditar}
                podeRevelar={podeEditar}
              />
            </PainelDeAba>
            <PainelDeAba id="anexos">
              <div className="max-w-xl">
                <AnexosDoCadastro
                  alvo={{ tipo: "pessoa", id: p.id }}
                  anexos={anexos}
                  categorias={CATEGORIAS_DE_PESSOA}
                  podeEnviar={podeEditar}
                  podeBaixar={podeBaixar}
                />
              </div>
            </PainelDeAba>
            <PainelDeAba id="acesso">
              <p className="flex items-center gap-3 text-sm">
                <AcessoDaPessoa
                  acesso={p.acesso}
                  nome={p.nome}
                  email={p.email}
                  podeConvidar={acesso.administrador}
                />
                {p.usuarioId && acesso.administrador && (
                  <Link href={`/usuarios/${p.usuarioId}`} className="text-primary text-xs font-medium">
                    {t("verUsuario")}
                  </Link>
                )}
              </p>
            </PainelDeAba>
          </Abas>
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ params, searchParams }: PageProps<"/t/[slug]/pessoas/[id]">) {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel
        id={params.then((p) => p.id)}
        consulta={searchParams as Promise<{ parecidas?: string; aba?: string }>}
      />
    </Suspense>
  );
}
